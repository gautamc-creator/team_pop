import os
import json
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from elasticsearch import AsyncElasticsearch, ApiError

from livekit import agents, rtc
from livekit.agents import JobContext, WorkerOptions, cli, function_tool, RunContext
from livekit.plugins import google

# Load .env from this project's backend directory, regardless of cwd
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

# livekit-plugins-google reads GOOGLE_API_KEY; our .env stores it as GEMINI_API_KEY
if not os.environ.get("GOOGLE_API_KEY") and os.environ.get("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

# Initialize Elastic Cloud Client
es_client = AsyncElasticsearch(
    hosts=[os.environ.get("ELASTIC_URL")],
    api_key=os.environ.get("ELASTIC_API_KEY"),
)

class ECommerceAgent(agents.Agent):
    def __init__(self, room: rtc.Room):
        # We pass the room instance so our tools can publish to the Data Channel
        self.room = room
        super().__init__(
            instructions="""You are Team Pop, a highly responsive and helpful retail voice assistant. 
            You help users find products. Always be concise. If a user asks for a product, use your tools to search for it."""
        )

    @function_tool
    async def search_products(self, context: RunContext, query: str):
        """
        Searches the sensesindia-v2 index. 
        Uses semantic search on both title and description for maximum accuracy.
        """
        print(f"Gemini triggered product search for: {query}")
        
        index_name = "sensesindia-v2"
        
        try:
            # We use a bool/should query so we can match semantically against 
            # BOTH the title and the detailed description.
            response = await es_client.search(
                index=index_name,
                size=3,
                query={
                    "bool": {
                        "should": [
                            {"semantic": {"field": "product_title", "query": query}},
                            {"semantic": {"field": "product_description", "query": query}}
                        ],
                        "minimum_should_match": 1
                    }
                },
                # Pull everything needed for the UI AND for Gemini's brain
                _source=["product_title", "product_price", "main_image", "url", "product_description", "body"]
            )

            frontend_results = []
            gemini_context = []

            hits = response.get('hits', {}).get('hits', [])
            for hit in hits:
                source = hit['_source']
                
                # 1. Prepare data for the Frontend Data Channel
                frontend_results.append({
                    "id": hit['_id'],
                    "title": source.get("product_title"),
                    "price": source.get("product_price"),
                    "image": source.get("main_image"),
                    "url": source.get("url")
                })
                
                # 2. Prepare data for Gemini to talk about
                # We include the 'body' and 'description' so Gemini can answer specific questions
                gemini_context.append({
                    "title": source.get("product_title"),
                    "price": source.get("product_price"),
                    "description": source.get("product_description"),
                    "full_details": source.get("body")
                })

            if not frontend_results:
                return "I couldn't find any products matching that. Could you try describing it differently?"

        except ApiError as e:
            logging.error(f"Elasticsearch error: {e}")
            return "I'm having trouble checking the catalog. Please try again in a moment."

        # Send the visual data to the frontend (Data Channel)
        payload = json.dumps({
            "type": "product_results",
            "products": frontend_results
        }).encode("utf-8")
        await self.room.local_participant.publish_data(payload=payload)
        
        # Return the full detailed text to Gemini so it can describe the products
        return json.dumps(gemini_context)

async def entrypoint(ctx: JobContext):
    # Connect to the LiveKit WebRTC Room
    await ctx.connect()
    
    # Initialize the Multimodal Live API using Gemini 2.5 Flash
    agent_instance = ECommerceAgent(room=ctx.room)
    session = agents.AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
            voice="Puck", # Standard Gemini voice, you can configure this later
            temperature=0.7,
        ),
    )
    
    # Start the session and join the agent to the room
    await session.start(room=ctx.room, agent=agent_instance)
    
    # Optional: Greet the user as soon as the connection opens
    await session.generate_reply(instructions="Greet the user warmly and ask what they are shopping for today.")

if __name__ == "__main__":
    # This runs the worker process, listening for incoming WebRTC connections
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
import os
import json
import asyncio
from dotenv import load_dotenv
from elasticsearch import AsyncElasticsearch

from livekit import agents, rtc
from livekit.agents import JobContext, WorkerOptions, cli, function_tool, RunContext
from livekit.plugins import google

load_dotenv()

# Initialize Elastic Cloud Client
es_client = AsyncElasticsearch(
    cloud_id=os.environ.get("ELASTIC_URL"),
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
        """Used to search the product catalog when the user asks for items."""
        print(f"Gemini triggered product search for: {query}")
        
        # 1. We will put the Elastic 9.x semantic_text query here in the next step
        # For now, we mock the response using the client's CDN links as planned
        mock_results = [
            {"id": "1", "name": "Red Running Shoes", "price": "₹2999", "image": "https://client-cdn.com/red-shoes.jpg"}
        ]
        
        # 2. FIRE THE DATA CHANNEL EVENT: 
        # This reaches the React frontend instantly, allowing your UI to 
        # expand the horizontal panel and render the product card before Gemini speaks.
        payload = json.dumps({"type": "product_results", "data": mock_results}).encode("utf-8")
        await self.room.local_participant.publish_data(payload=payload)
        
        # 3. Return the text context to Gemini so it can generate the voice response
        return f"Found {len(mock_results)} products. Top match: {mock_results[0]['name']} for {mock_results[0]['price']}."

async def entrypoint(ctx: JobContext):
    # Connect to the LiveKit WebRTC Room
    await ctx.connect()
    
    # Initialize the Multimodal Live API using Gemini 2.5 Flash
    agent_instance = ECommerceAgent(room=ctx.room)
    session = agents.AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash",
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
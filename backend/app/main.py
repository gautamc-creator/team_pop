# from openai import OpenAI
from fastapi import FastAPI,UploadFile,HTTPException,Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.elastic import es
from app.schemas import ChatRequest
import os
from dotenv import load_dotenv
import io
from app.get_llm_context import get_llm_context
import assemblyai as aai
from app.gemini_client import client
from google.genai import types
from pydantic import BaseModel
from typing import List, Optional
import requests
from langfuse import get_client,observe
from fastapi import BackgroundTasks 
from app.crawler_service import run_elastic_crawler 
from app.elastic import generate_index_name
# from app.observability import setup_observability



load_dotenv()

# os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
ASSEMBLY_API_KEY = os.getenv("ASSEMBLY_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = "21m00Tcm4TlvDq8ikWAM" #Rachel


langfuse = get_client()

# client = OpenAI()
app = FastAPI()
aai.settings.api_key = ASSEMBLY_API_KEY

# setup_observability(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- DATA MODELS ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    domain: Optional[str] = None
    
class TTSRequest(BaseModel):
    text: str

class CrawlRequest(BaseModel):
    url:str




@app.post('/crawl')
async def start_crawl(req:CrawlRequest , background_tasks : BackgroundTasks):
    # Trigger the crawler in background
    
    try:
       background_tasks.add_task(run_elastic_crawler,req.url)
       
       index_name = generate_index_name(req.url)
       return {
            "message": "Crawl job started", 
            "target_url": req.url,
            "target_index": index_name
       } 
    
    except Exception as e:
        raise HTTPException(status_code=500,detail=str(e))
    
        
        
        

@app.post("/stt")
@observe(name="stt-call" , as_type="generation")
async def speech_to_text(file: UploadFile):
    """
    Accepts an audio file (webm/wav/mp3),
    sends it to Whisper,
    returns transcribed text.
    """

    if file is None:
        raise HTTPException(status_code=400, detail="Audio file is required")

    try:
        # Read audio bytes
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        # Whisper requires file-like object with name
        audio_buffer = io.BytesIO(audio_bytes)
        audio_buffer.name = file.filename or "audio.webm"
        
        config = aai.TranscriptionConfig(speech_models=["universal"])

        transcript = aai.Transcriber(config=config).transcribe(audio_buffer)
        
        print(transcript)
        
        if transcript.status == "error":
            raise RuntimeError(f"Transcription failed: {transcript.error}")

        

        # Call Whisper
        # transcription = client.audio.transcriptions.create(
        #     model="whisper-1",
        #     file=audio_buffer,
        #     response_format="text"  # returns plain string
        # )

        # return JSONResponse(
        #     content={"text": transcription},
        #     status_code=200
        # )
        
        return JSONResponse(
            content={"text":transcript.text},
            status_code=200
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"STT failed: {str(e)}"
        )

@app.post("/chat")
@observe(name="chat" , as_type="generation")
def chat(req: ChatRequest):
    
    try:
        # 1. Extract the latest query (the last message from the user)
        if not req.messages:
             raise HTTPException(status_code=400, detail="No messages provided")
        
        latest_query = req.messages[-1].content
        
        target_index = "search-index-final-sense"
        
        if req.domain:
            target_index = generate_index_name(req.domain)
            print(f"🔍 Searching specific index: {target_index}")
        
        # 2. Get Context based on the LATEST query only
        context_text, source_urls = get_llm_context(latest_query,index_name = target_index)

        # 3. Construct the System Prompt
        SYSTEM_PROMPT = f"""
        ### ROLE
        You are the expert AI Sales Associate for **SensesIndia** (https://sensesindia.in/).
        Pop builds high-performing, custom AI agents for SMBs.
        
        ### OBJECTIVES
        1. **Answer Questions:** Use ONLY the provided [CONTEXT] to answer. If the answer isn't there, admit it politely.
        2. **Drive Leads:** Your ultimate goal is to get the user to share their **Email Address** so a human executive can follow up.
        
        ### BEHAVIOR GUIDELINES
        1. **The "Manager" Handoff:**
           - If you don't know the answer OR if the question is complex/specific (a "buying signal"), say:
           - "That is a great specific question. I want to make sure you get the perfect solution. Could you leave your **email address**? I will have our Senior Executive reach out to you directly."
        
        2. **Context Citations:**
           - If you use facts from the context, append sources like this: [Source: URL].
           
        3. **Tone:**
           - Professional, enthusiastic, but concise. 
           
        4. **Summary**
           - Give me a seprate summary of the content in short and meaningful that will serve as overview without it containing the urls. 
           
        ### CONTEXT DATA
        {context_text}
        """

        # 4. Format History for Gemini
        # We need to convert the Pydantic messages to the format Gemini expects
        gemini_history = []
        
        # Add system instruction separate from history if using newer API, 
        # or prepended to the first message. 
        # For simplicity with 'generate_content', we can pass system_instruction parameter.

        for msg in req.messages[:-1]: # All messages except the last one (which is the new prompt)
            role = "user" if msg.role == "user" else "model"
            gemini_history.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)]
            ))

        # 5. Call Gemini
        response = client.models.generate_content(
            model= "gemini-2.5-flash",
            contents=gemini_history + [types.Content(role="user", parts=[types.Part.from_text(text=latest_query)])],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3, # Keep it precise
            )
        )

        answer = response.text

        return {
            "answer": answer,
            "sources": source_urls
        }

    except Exception as e:
        print(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post('/tts')
@observe(name="tts-call" , as_type="generation")
async def text_to_speech(request: TTSRequest):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": request.text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }

    # 3. Call the Provider
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ ElevenLabs Error: {response.text}") # Look at your terminal!
        return Response(content=response.content, status_code=500)

    # 4. Return Audio Bytes directly to frontend
    return Response(content=response.content, media_type="audio/mpeg")


 
# Flush events in short-lived applications
# langfuse.flush()


import requests
from fastapi import FastAPI, Response
from pydantic import BaseModel
import os

app = FastAPI()

# 1. Define the Input Model
class TTSRequest(BaseModel):
    text: str

# 2. Configure ElevenLabs (Get key from elevenlabs.io)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = "21m00Tcm4TlvDq8ikWAM" # Default "Rachel" voice


def text_to_speech(request: TTSRequest):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": request.text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }

    # 3. Call the Provider
    response = requests.post(url, json=data, headers=headers)

    # 4. Return Audio Bytes directly to frontend
    return Response(content=response.content, media_type="audio/mpeg")
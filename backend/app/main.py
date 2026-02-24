from fastapi import FastAPI, UploadFile, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import uuid
from dotenv import load_dotenv
import io
import json
import logging
from langfuse import get_client, observe
from fastapi import BackgroundTasks
from app.crawler_service import run_elastic_crawler, set_crawl_status, get_crawl_status
from app.elastic import generate_index_name, count_index_docs
from livekit.api import AccessToken, VideoGrants

# Configure logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

langfuse = get_client()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrawlRequest(BaseModel):
    url: str


@app.post('/api/crawl')
@observe(name="crawl-tigger")
async def start_crawl(req: CrawlRequest, background_tasks: BackgroundTasks):
    # Trigger the crawler in background
    
    try:
       set_crawl_status(req.url, "pending", index=generate_index_name(req.url))
       background_tasks.add_task(run_elastic_crawler, req.url)
       
       index_name = generate_index_name(req.url)
       return {
            "message": "Crawl job started", 
            "target_url": req.url,
            "target_index": index_name
       } 
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/crawl/status')
def crawl_status(url: str):
    status = get_crawl_status(url)
    if not status:
        raise HTTPException(status_code=404, detail="No crawl found for that URL")
    return status

@app.get('/api/crawl/count')
def crawl_count(url: str):
    index_name = generate_index_name(url)
    count = count_index_docs(index_name)
    return {
        "index": index_name,
        "count": count
    }


@app.get('/get-livekit-token')
def get_livekit_token():
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    server_url = os.getenv("LIVEKIT_URL")

    if not api_key or not api_secret or not server_url:
        raise HTTPException(
            status_code=500,
            detail="LiveKit environment variables are not configured on the server."
        )

    identity = f"user-{uuid.uuid4().hex[:8]}"

    token = (
        AccessToken(api_key=api_key, api_secret=api_secret)
        .with_identity(identity)
        .with_grants(VideoGrants(room_join=True, room="team-pop-room"))
        .to_jwt()
    )

    return JSONResponse({"token": token, "serverUrl": server_url})

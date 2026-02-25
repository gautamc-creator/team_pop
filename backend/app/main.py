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
from app.crawler_service import create_job, process_onboarding, JOB_STORE
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


class OnboardRequest(BaseModel):
    domain: str
    tenant_id: str


@app.post("/api/onboard")
async def start_onboarding(req: OnboardRequest, background_tasks: BackgroundTasks):
    job_id = create_job(req.tenant_id, req.domain)
    # Fire the live scrape in the background
    background_tasks.add_task(process_onboarding, job_id, req.domain, req.tenant_id)
    return {"job_id": job_id, "status": "processing"}


@app.get("/api/job/{job_id}")
async def get_job_status(job_id: str):
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


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

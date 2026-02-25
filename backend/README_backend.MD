# Team Pop Backend

The FastAPI backend that powers the Voice Agent. It acts as the brain and WebRTC connection point, orchestrating the connection between the user's live audio and the AI knowledge base.

## 🧠 Core Capabilities

1.  **Crawl Orchestration (`crawler_service.py`)**:
    - Takes a target domain, triggers a crawl pipeline, and indexes the resulting chunks into **Elasticsearch**.
    - Exposes state polling endpoints for the Dashboard to visualize progress.
2.  **LiveKit Token Vending (`main.py`)**:
    - Generates secure JWT access tokens for the frontend Avatar Widget to connect to LiveKit Cloud.
3.  **LiveKit Voice Agent (`agent.py`)**:
    - A persistent background worker that joins the LiveKit WebRTC room.
    - Uses the **Google Gemini Multimodal Live API** (`gemini-2.5-flash`) for true voice-to-voice streaming.
    - Executes asynchronous tool calls (e.g., semantic search via Elasticsearch) to ground its responses in the crawled catalog.

## 🛠️ Setup

### Environment Variables (.env)

Create a `.env` file in the `backend/` directory. No STT/TTS keys (like AssemblyAI/ElevenLabs) are needed as the model natively handles audio.

```env
# LIVEKIT WEBRTC
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret

# ELASTICSEARCH
ELASTIC_URL=https://...
ELASTIC_API_KEY=...
ELASTIC_INFERENCE_ID=.elser-2-elastic # Optional

# GOOGLE AI
GEMINI_API_KEY=...

#FIRECRAWL 
FIRECRAWL_API_KEY=...
```

### Run Locally

```bash
# Create virtual env
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Server (Must be on 8080 to match frontend/dashboard configs)
uvicorn app.main:app --port 8080 --reload
```

## 📡 API Endpoints

### Crawling

- `POST /api/onboard`: Start onboarding/crawling a URL context.
- `GET /api/job/{job_id}`: Poll background task status, returns JSON state indicating progress or completion.

### LiveKit WebRTC

- `GET /get-livekit-token`: Returns `{"token": "jwt...", "serverUrl": "wss..."}` for the frontend connection. Note: The actual audio streaming happens over UDP WebRTC via the LiveKit Cloud, not over HTTP endpoints.

## ⚙️ Key Files

- `app/main.py`: FastAPI entry point and route definitions.
- `app/crawler_service.py`: Logic for managing extraction and index insertion.
- `app/elastic.py`: Setup and configuration for the Async Elasticsearch client.
- `app/agent.py`: The `livekit.agents` worker script that defines the Gemini Voice Agent, its persona, and its tools (`search_products`).

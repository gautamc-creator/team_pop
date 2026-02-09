# Team Pop Backend

The FastAPI backend that powers the Voice Agent. It acts as the brain, orchestrating the connection between the user's voice and the knowledge base.

## 🧠 Core Capabilities

1.  **Crawl Orchestration**:
    - Takes a URL, validates it, and triggers an **Elastic App Search Crawler** (via Docker).
    - Polls the crawl status and verifies when documents are indexed.
2.  **Voice Processing**:
    - **STT**: Uses **AssemblyAI** to transcribe user audio with high accuracy.
    - **TTS**: Uses **ElevenLabs** for ultra-realistic voice synthesis.
3.  **Intelligence Layer**:
    - **Retrieval**: Performs Hybrid Search (Keyword + Semantic) on **Elasticsearch** to find relevant context.
    - **Generation**: Uses **Google Gemini 2.5 Flash** to generate concise, grounded answers.
    - **Robustness**: Includes fallback regex parsing if the LLM fails to output valid JSON.

## 🛠️ Setup

### Environment Variables (.env)

Create a `.env` file in the `backend/` directory:

```env
# ELASTICSEARCH
ELASTIC_URL=https://...
ELASTIC_API_KEY=...
ELASTIC_INFERENCE_ID=.elser-2-elastic # Optional

# AI SERVICES
ASSEMBLY_API_KEY=...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
VOICE_ID=... # ElevenLabs Voice ID
```

### Run Locally

```bash
# Create virtual env
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Server
uvicorn app.main:app --reload
```

## 📡 API Endpoints

### Crawling

- `POST /crawl`: Start crawling a URL.
- `GET /crawl/status`: Check if the crawl is running, completed, or failed.
- `GET /crawl/count`: Get the number of indexed documents.

### Interaction

- `POST /stt`: Accepts `multipart/form-data` audio file. Returns `{"text": "..."}`.
- `POST /chat`: Accepts prompt and history. Returns:
  ```json
  {
    "answer": "Full answer with markdown...",
    "summary": "Short summary for TTS...",
    "sources": ["url1", "url2"]
  }
  ```
- `POST /tts`: Accepts text. Returns audio stream (`audio/mpeg`).

## ⚙️ Key Files

- `app/main.py`: Application entry point and route definitions.
- `app/crawler_service.py`: Logic for managing the Elastic Crawler.
- `app/get_llm_context.py`: Handles RAG (Retrieval Augmented Generation) logic.
- `app/gemini_client.py`: Wrapper for Google Gemini API interactions.

## 📝 Notes

- The chat endpoint uses a system prompt that enforces strict JSON output from Gemini.
- If JSON parsing fails (rare), a regex fallback extracts the answer to prevent user-facing errors.

# Backend for Voice Agent

This backend powers the Voice Agent system. It provides APIs for crawl orchestration, speech-to-text (STT), chat responses grounded in Elasticsearch search results, and text-to-speech (TTS). The current stack uses:

- **AssemblyAI** for STT
- **Elasticsearch** for hybrid (BM25 + semantic) retrieval
- **Google Gemini** for response generation
- **ElevenLabs** for TTS

## Features

- **Crawl orchestration** via Elastic crawler (Docker)
- **Crawl status + count** endpoints
- **Speech-to-Text** via AssemblyAI
- **Hybrid Search** with Elasticsearch (RRF: keyword + semantic)
- **LLM Responses** via Gemini (`gemini-2.5-flash`)
- **Source Grounding** using URLs from the search index
- **TTS Playback** via ElevenLabs
- **CORS** enabled for frontend integration

## Prerequisites

- Python 3.10+
- Elasticsearch cluster
- API keys for AssemblyAI, Gemini, and ElevenLabs
- Virtual environment (recommended)

## Installation

```bash
cd backend
python -m venv .demo
source .demo/bin/activate  # Windows: .demo\Scripts\activate
pip install -r requirements.txt
```

## Environment Variables

Create `backend/.env` with:

```
ELASTIC_URL=<your-elasticsearch-url>
ELASTIC_API_KEY=<your-elasticsearch-api-key>
ASSEMBLY_API_KEY=<your-assemblyai-key>
GEMINI_API_KEY=<your-gemini-key>
ELEVENLABS_API_KEY=<your-elevenlabs-key>
# Optional
VOICE_ID=<elevenlabs-voice-id> # Default: Rachel
ELASTIC_INFERENCE_ID=<elastic-inference-id> # Default: .elser-2-elastic
```

## Running the Server

```bash
uvicorn app.main:app --reload
```

Server will run at `http://localhost:8000`.
Docs available at `http://localhost:8000/docs`.

## API Endpoints

### POST `/crawl`

Triggers a crawler run for a URL in the background.

- **Request**:
  ```json
  { "url": "https://example.com" }
  ```
- **Response**:
  ```json
  { "message": "Crawl job started", "target_url": "...", "target_index": "..." }
  ```

### GET `/crawl/status?url=...`

Returns crawl status for a URL.

- **Response**:
  ```json
  {
    "status": "pending|running|completed|failed",
    "index": "...",
    "error": "optional"
  }
  ```

### GET `/crawl/count?url=...`

Returns document count for the crawl index.

- **Response**:
  ```json
  { "index": "...", "count": 123 }
  ```

### POST `/stt`

Transcribes an uploaded audio file using AssemblyAI.

- **Request**: `multipart/form-data` with `file`
- **Response**:
  ```json
  { "text": "transcribed text" }
  ```

### POST `/chat`

Generates a response grounded in Elasticsearch context and Gemini.

- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "Hi" },
      { "role": "assistant", "content": "Hello!" },
      { "role": "user", "content": "What products do you sell?" }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "answer": "...",
    "summary": "...",
    "sources": ["https://example.com/page", "https://example.com/another"]
  }
  ```

### POST `/tts`

Converts text to speech via ElevenLabs and returns audio bytes.

- **Request Body**:
  ```json
  { "text": "Hello" }
  ```
- **Response**: `audio/mpeg` stream

## Elasticsearch Index

The backend expects an index named:

```
search-index-final-sense
```

Expected fields:

- `title`
- `url`
- `body`
- `headings`
- `semantic_text`

Retrieval uses RRF across keyword + semantic queries and returns the top 3 results.

## Project Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app + endpoints
│   ├── elastic.py        # Elasticsearch client
│   ├── get_llm_context.py# Hybrid search + context formatting
│   ├── gemini_client.py  # Gemini client
│   └── schemas.py        # Pydantic models
├── requirements.txt
└── README.MD
```

## Notes

- **Crawl status** is stored in-memory for local demo.
- **CORS** currently allows all origins. Tighten this for production.
- **TTS voice** is configured in `app.main` via `VOICE_ID`.
- If runtime imports fail, ensure `requirements.txt` includes `assemblyai`, `google-genai`, and `requests`.

## License

MIT. See the root project README for details.

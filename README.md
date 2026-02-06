# Voice Agent Project

This repo contains a voice-enabled AI assistant with a React frontend and a FastAPI backend. The system supports speech-to-text (STT), chat responses grounded in Elasticsearch, text-to-speech (TTS) playback, and a crawl → index → embed onboarding flow.

## Repos/Packages

- `frontend/`: React + Vite UI (3-step onboarding + AvatarWidget)
- `backend/`: FastAPI API server for STT, chat, TTS, and crawler orchestration

## Quick Start (Local)

### 1) Backend

```bash
cd backend
python -m venv .demo
source .demo/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables

Backend requires these in `backend/.env`:

```
ELASTIC_URL=...
ELASTIC_API_KEY=...
ASSEMBLY_API_KEY=...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
```

Frontend supports:

```
VITE_API_BASE_URL=http://localhost:8000
```

## High-Level Architecture

1. User enters a website URL and starts a crawl.
2. Backend triggers the Elastic crawler in Docker, creating an index per domain.
3. Frontend polls crawl status and document count.
4. On success, the user sees the assistant and an embed snippet.
5. For voice chat:
   - Frontend sends audio to `POST /stt`.
   - Backend transcribes audio via AssemblyAI.
   - Frontend sends message history to `POST /chat`.
   - Backend retrieves context from Elasticsearch and generates a response using Gemini.
   - Frontend sends text to `POST /tts` and plays audio via ElevenLabs.

## Current Checkpoints

- ✅ 3-step onboarding flow: URL input → crawl progress → success + embed.
- ✅ Crawl status polling with error handling.
- ✅ Pages indexed count via Elasticsearch.
- ✅ Cinematic orb AvatarWidget with glassmorphism response bubble.
- ✅ `/chat` returns `{ answer, summary, sources }`.
- ✅ Domain-based index routing for chat.

## API Endpoints

- `POST /crawl` — Start a crawl for a URL.
- `GET /crawl/status?url=...` — Crawl status (`pending | running | completed | failed`).
- `GET /crawl/count?url=...` — Count documents in the crawl index.
- `POST /stt` — Speech-to-text via AssemblyAI.
- `POST /chat` — Gemini + Elasticsearch RRF responses.
- `POST /tts` — ElevenLabs TTS.

## Notes

- Crawl status is stored in-memory for local demo.
- Embed snippet shown in the UI is a display-only example (`widget.js` is not hosted yet).
- Docker must be available for crawling.

## Directory Layout

```
./
├── backend/
├── frontend/
├── blog/
├── blogs.html
├── index.html
└── robots.txt
```

## Potential Improvements

### UI/UX
- Add a proper embed preview (real `widget.js` build).
- Animate step transitions and add progress bar with ETA.
- Allow theming (light/dark, accent color).
- Add inline validation for URL + domain preview.

### Frontend
- Move onboarding state to a small state machine (XState or reducers).
- Add error toasts and retries for crawl/TTs/STT.
- Extract UI into reusable layout components.

### Backend
- Persist crawl status in Redis or DB (multi-process safe).
- Add auth + rate limiting for non-local environments.
- Add index cleanup / retention policies.
- Improve Elasticsearch retrieval with configurable top-k.

## License

MIT. See `frontend/README.md` and `backend/README.MD` for component details.

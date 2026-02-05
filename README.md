# Voice Agent Project

This repo contains a voice-enabled AI assistant with a React frontend and a FastAPI backend. The system supports speech-to-text (STT), chat responses grounded in Elasticsearch, and text-to-speech (TTS) playback.

## Repos/Packages

- `frontend/`: React + Vite UI (AvatarWidget and ChatWidget)
- `backend/`: FastAPI API server for STT, chat, and TTS

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

## High-Level Architecture

1. User speaks in the UI.
2. Frontend sends audio to `POST /stt`.
3. Backend transcribes audio via AssemblyAI.
4. Frontend sends message history to `POST /chat`.
5. Backend retrieves context from Elasticsearch and generates a response using Gemini.
6. Frontend sends text to `POST /tts` and plays audio via ElevenLabs.

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

## License

MIT. See `frontend/README.md` and `backend/README.MD` for component details.

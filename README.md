# Team Pop Voice Agent

A voice-first AI assistant built with **React 19** and **FastAPI**. This system allows users to "train" an assistant on any website URL, which is then indexed by **Elasticsearch** and made accessible via a cinematic "Avatar Widget" that supports real-time voice interaction.

## 🚀 high-Level Architecture

The system consists of two main components:

1.  **Frontend (`/frontend`)**: A React application built with Vite.
    - **Onboarding Flow**: A 3-step timeline UI where users enter a URL, monitor the crawling process, and preview their assistant.
    - **Avatar Widget**: A floating, voice-enabled widget (Orb) that can be embedded on any site. It handles audio recording, playback, and chat UI.
2.  **Backend (`/backend`)**: A FastAPI server.
    - **Crawler Service**: Orchestrates web crawling using a Dockerized Elastic Crawler to index website content (Sitemaps, HTML).
    - **Orchestraion Layer**: Handles the `STT -> RAG -> LLM -> TTS` pipeline.
    - **Integrations**:
      - **AssemblyAI** (Speech-to-Text)
      - **Elasticsearch** (Vector Store + Hybrid Search)
      - **Google Gemini** (LLM for generation)
      - **ElevenLabs** (Text-to-Speech)

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, CSS Modules (Glassmorphism), Native Web Audio API.
- **Backend**: Python 3.10+, FastAPI, Pydantic, HTTPX.
- **Infrastructure**: Docker (for Elastic Crawler), Elasticsearch Cloud (or local).

## ⚡ Quick Start

### 1. Backend Setup

The backend requires several API keys. Create a `.env` file in `backend/` (see `backend/README_backend.MD`).

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

_Runs on `http://localhost:8000`_

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

_Runs on `http://localhost:5173`_

## 🌊 User Flow

1.  **Get Started**: User visits the frontend, enters `https://example.com`.
2.  **Crawling**: Backend instructs Elastic to crawl the site. Frontend polls for status.
3.  **Preview**: Once indexed, the **Avatar Widget** appears.
4.  **Integration**: User speaks "What is this site about?".
    - **STT**: Audio transribed by AssemblyAI.
    - **Retrieval**: Elastic finds relevant chunks from the crawled index.
    - **Generation**: Gemini answers using the retrieved context.
    - **TTS**: ElevenLabs generates audio, played back by the Widget.

## 📂 Repository Structure

- `frontend/`: React application source.
- `backend/`: FastAPI application source.
- `blog/`: Sample static site for testing the embed.

## 📄 License

MIT.

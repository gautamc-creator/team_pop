# Team Pop Frontend

The frontend for the Team Pop Voice Agent. Built with **React 19** and **Vite**, this application provides both the onboarding dashboard for creating an assistant and the actual widget that users interact with.

## ✨ Features

- **Get Started Timeline**: A guided 3-step vertical timeline (Enter URL -> Crawling -> Preview).
- **Avatar Widget**: A cinematic, voice-first UI component.
  - **Orb Mode**: A glowing, animated orb that reacts to "Listening", "Thinking", and "Speaking" states.
  - **Chat Mode**: A simplifed, glassmorphism-styled chat window that opens on interaction.
  - **Voice-First**: "Tap-to-Interrupt" logic, auto-open on speech, and real-time state visualization.
- **Smart Logic**:
  - **Simplified UI**: The widget is either **Open** (Full Chat) or **Closed** (Orb Only). No confusing intermediate states.
  - **Auto-Scroll**: Chat history automatically snaps to the newest message.

## 🚀 Setup & Run

### Prerequisites

- Node.js 18+
- Backend running on port 8000

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Access the app at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

## 🏗️ Project Structure

```
src/
├── components/
│   ├── AvatarWidget.jsx   # The core voice assistant widget
│   └── VoiceRecorder.jsx  # Hook for handling microphone input
├── pages/
│   └── GetStarted.jsx     # The 3-step onboarding timeline page
├── styles/
│   ├── AvatarWidget.css   # Animations, Glassmorphism, Layout
│   └── GetStarted.css     # Timeline specific styles
├── services/
│   └── api.js             # API client for Backend (STT, TTS, Chat)
└── App.jsx
```

## 🔌 API Integration

The frontend communicates with the backend via `src/services/api.js`.

- `POST /stt`: Uploads audio blob, receives text.
- `POST /chat`: Sends message history, receives `{ answer, summary, sources }`.
- `POST /tts`: Sends text, receives audio blob (streamed).
- `GET /crawl/*`: Polls for crawl status and verification.

## 🎨 Styling

We use raw CSS with CSS variables for theming (see `index.css`).

- **Font**: "Space Grotesk" for a modern, tech-forward look.
- **Glassmorphism**: Heavy use of `backdrop-filter: blur()` and transparent backgrounds.
- **Animations**: CSS keyframes for the Orb's "breathing" and "speaking" waves.

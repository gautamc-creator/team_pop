# Frontend for Voice Agent

This is a React + Vite frontend for the Voice Agent system. It provides two UI experiences:
- `AvatarWidget` (current default): a compact, voice-first assistant with animated avatar, speech bubble, and TTS playback.
- `ChatWidget` (legacy/alternate): a full chat interface with rich text formatting and source links.

The frontend talks to a FastAPI backend over HTTP for STT (`/stt`), chat (`/chat`), and TTS (`/tts`).

## Features

- **React 19 + Vite**: Fast dev server and optimized builds
- **Voice Input**: Record and send audio to the backend STT endpoint
- **Chat**: Conversational UI backed by the backend `/chat` endpoint
- **Text-to-Speech**: Plays synthesized audio from `/tts`
- **Responsive UI**: Widget layout that works on desktop and mobile
- **ESLint**: Enforced code quality

## Prerequisites

- Node.js 16+
- npm or yarn
- Backend API running on `http://localhost:8000`

## Installation

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

### Linting

```bash
npm run lint
```

Fix lint issues automatically:

```bash
npm run lint -- --fix
```

## Build and Preview

```bash
npm run build
npm run preview
```

`npm run preview` serves the production build locally (default `http://localhost:4173`).

## Project Structure

```
frontend/
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # Root component (uses AvatarWidget)
│   ├── App.css               # App styles
│   ├── index.css             # Global styles
│   ├── components/
│   │   ├── AvatarWidget.jsx  # Voice-first assistant (default)
│   │   ├── ChatWidget.jsx    # Full chat interface (optional)
│   │   └── VoiceRecorder.jsx # useVoiceRecorder hook
│   └── styles/               # Component styles
├── index.html                # HTML template
├── vite.config.js            # Vite config
├── eslint.config.js          # ESLint config
├── package.json              # Scripts and dependencies
└── README.md                 # This file
```

## Key Components

### AvatarWidget.jsx
Voice-first UI with:
- Tap-to-speak recording
- Loading states and speech bubble
- Calls `/chat` for responses and `/tts` for playback

### ChatWidget.jsx
Rich chat UI that:
- Displays message history
- Formats markdown-like responses
- Shows source links
- Sends history to `/chat`

### VoiceRecorder.jsx (Hook)
`useVoiceRecorder` handles:
- Microphone recording
- Uploading audio to `/stt`
- Returning transcribed text

## API Configuration

The frontend currently calls the backend at `http://localhost:8000`.
If you deploy the backend elsewhere, update the API base URL in:
- `frontend/src/components/ChatWidget.jsx`
- `frontend/src/components/AvatarWidget.jsx`
- `frontend/src/components/VoiceRecorder.jsx`

## Dependencies

### Runtime
- `react` ^19.2.0
- `react-dom` ^19.2.0

### Development
- `vite` ^7.2.4
- `@vitejs/plugin-react` ^5.1.1
- `eslint` ^9.39.1
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `vite-plugin-css-injected-by-js`

## Troubleshooting

- **Dev server not starting**: `node --version`, then reinstall `node_modules`.
- **STT not working**: Check mic permissions and backend `/stt` endpoint.
- **No audio playback**: Browser may block autoplay; click/tap the widget to enable audio.
- **CORS issues**: Ensure backend CORS is configured for your frontend domain.

## License

MIT. See the root project README for details.

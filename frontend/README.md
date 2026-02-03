# Frontend for Voice Agent

This is a React-based frontend for the Voice Agent application, built with Vite. It provides an interactive chat widget that enables users to query the website using voice and text input, powered by a FastAPI backend.

## Features

- **React 19**: Modern React with Vite for fast development and optimized production builds.
- **Voice Input**: Record and send voice messages to the backend for transcription and processing.
- **Text Chat**: Send text queries directly to the backend.
- **Responsive Design**: Clean, user-friendly chat widget interface.
- **Real-time Responses**: Get instant answers with source citations from the website.
- **ESLint Configuration**: Enforces code quality and best practices.

## Prerequisites

- Node.js 16 or higher
- npm or yarn package manager
- Backend API running on `http://localhost:8000`

## Installation

1. **Navigate to the Frontend Directory**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Development

### Running in Development Mode

Start the development server with Vite:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the next available port).

**Features in Development Mode**:
- Hot Module Replacement (HMR) for instant updates
- Vite's fast build pipeline
- React Fast Refresh for component updates without losing state

### Running Linting

Check for code quality issues:

```bash
npm run lint
```

Fix linting issues automatically (if applicable):

```bash
npm run lint -- --fix
```

## Building for Production

### Build the Application

Create an optimized production build:

```bash
npm run build
```

This generates a `dist/` folder with minified and optimized files ready for deployment.

### Running the Production Build

```bash
npx serve dist -p 3000
```

Then visit `http://localhost:3000` to view the production build.


## Project Structure

```
frontend/
├── src/
│   ├── main.jsx              # Entry point for React application
│   ├── App.jsx               # Root component
│   ├── App.css               # Styles for App component
│   ├── index.css             # Global styles
│   ├── components/
│   │   ├── ChatWidget.jsx    # Main chat interface component
│   │   └── VoiceRecorder.jsx # Voice recording functionality
│   └── styles/               # Additional style files
├── index.html                # HTML template
├── vite.config.js            # Vite configuration
├── eslint.config.js          # ESLint configuration
├── package.json              # Project metadata and dependencies
└── README.md                 # This file
```

## Components

### ChatWidget.jsx
The main chat interface component that:
- Displays chat messages between user and AI
- Handles text input for queries
- Integrates with VoiceRecorder for voice input
- Sends requests to the `/chat` endpoint on the backend
- Displays sources and responses

### VoiceRecorder.jsx
Handles voice recording functionality:
- Records audio from the user's microphone
- Sends audio to the `/stt` endpoint on the backend
- Converts speech to text
- Passes transcribed text to the chat input

## Environment Configuration

The frontend connects to the backend API at:
- **Development**: `http://localhost:8000`
- **Production**: Update the API base URL in your components if needed

If you need to use a different backend URL, update the API endpoint in:
- [src/components/ChatWidget.jsx](src/components/ChatWidget.jsx)
- [src/components/VoiceRecorder.jsx](src/components/VoiceRecorder.jsx)

## Dependencies

### Runtime
- **react** (^19.2.0): Core React library
- **react-dom** (^19.2.0): React DOM rendering

### Development
- **@vitejs/plugin-react** (^5.1.1): Vite React plugin
- **vite** (^7.2.4): Build tool and dev server
- **eslint** (^9.39.1): Code quality linter
- **eslint-plugin-react-hooks**: ESLint rules for React Hooks
- **eslint-plugin-react-refresh**: ESLint rules for React Fast Refresh

## Building and Deployment

### Steps to Deploy

1. **Build the Application**:
   ```bash
   npm run build
   ```

2. **Test the Build Locally**:
   ```bash
   npx serve dist -p 3000
   ```

3. **Deploy the `dist/` Folder**:
   Upload the contents of the `dist/` folder to your hosting provider (e.g., Vercel, Netlify, AWS S3, etc.).

4. **Update Backend URL** (if needed):
   If deploying to a different domain, ensure the backend API URL in your components points to the correct endpoint.



## Troubleshooting

### Development Server Not Starting
- Ensure Node.js is installed: `node --version`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Try a different port: `npm run dev -- --port 5174`

### Build Fails
- Check for TypeScript/ESLint errors: `npm run lint`
- Clear Vite cache: `rm -rf .vite` (if it exists)
- Verify all imports are correct

### Backend Connection Issues
- Ensure backend is running on `http://localhost:8000`
- Check network connectivity
- Verify CORS settings on the backend
- Check browser console for specific error messages

### Voice Recording Not Working
- Verify browser microphone permissions
- Check that the browser supports the Web Audio API
- Ensure microphone hardware is properly connected

## Development Tips

- Use React Developer Tools browser extension for debugging
- Check the browser console for API errors
- Use Vite's `define` option in `vite.config.js` for environment variables
- Keep components small and focused for better maintainability

## License

This project is licensed under the MIT License. See the main project README for details.

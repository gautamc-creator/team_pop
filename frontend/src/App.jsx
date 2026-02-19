import { useState, useCallback } from 'react';
import AvatarWidget from './components/AvatarWidget';
import './App.css';

const BACKEND_URL = 'http://localhost:8080';

function App() {
  const [token, setToken] = useState(null);
  const [serverUrl, setServerUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/get-livekit-token`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setToken(data.token);
      setServerUrl(data.serverUrl);
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch() throws TypeError when the server is completely unreachable
        setError('Could not reach the backend server. Make sure FastAPI is running on port 8000.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Render: Widget is active ---
  if (token && serverUrl) {
    return (
      <div className="app-container">
        <AvatarWidget token={token} serverUrl={serverUrl} />
      </div>
    );
  }

  // --- Render: Launch screen ---
  return (
    <div className="app-container launch-screen">
      <div className="launch-card">
        <h1 className="launch-title">TeamPop AI Assistant</h1>
        <p className="launch-subtitle">
          Your voice-powered shopping companion. Click below to connect.
        </p>

        {error && (
          <div className="launch-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        <button
          className="launch-btn"
          onClick={handleStart}
          disabled={isLoading}
        >
          {isLoading ? 'Connecting…' : '🎙 Start AI Assistant'}
        </button>
      </div>
    </div>
  );
}

export default App;

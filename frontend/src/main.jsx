// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AvatarWidget from './components/AvatarWidget';
import './index.css'; // Make sure your global styles (if any) are here
import App from './App';

// 1. Define IDs for mount points
const ROOT_ID = 'root';
const WIDGET_ID = 'voice-avatar-widget-root';

// 2. Function to inject the widget
const mountWidget = () => {
  // Prefer the main root if available (full-page app)
  let widgetRoot = document.getElementById(ROOT_ID) || document.getElementById(WIDGET_ID);
  if (!widgetRoot) {
    widgetRoot = document.createElement('div');
    widgetRoot.id = ROOT_ID;
    document.body.appendChild(widgetRoot);
  }

  // Mount React
  const root = ReactDOM.createRoot(widgetRoot);
  root.render(
    <React.StrictMode>
       <App/>
    </React.StrictMode>
  );
};

// 3. Auto-mount when script loads
mountWidget();

// Optional: Expose a global object if you want to control it later
window.VoiceAvatar = { mount: mountWidget };

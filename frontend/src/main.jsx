// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AvatarWidget from './components/AvatarWidget';
import './index.css'; // Make sure your global styles (if any) are here

// 1. Define a unique ID for the widget container
const WIDGET_ID = 'voice-avatar-widget-root';

// 2. Function to inject the widget
const mountWidget = () => {
  // Check if already mounted
  if (document.getElementById(WIDGET_ID)) return;

  // Create the container div
  const widgetRoot = document.createElement('div');
  widgetRoot.id = WIDGET_ID;
  document.body.appendChild(widgetRoot);

  // Mount React
  const root = ReactDOM.createRoot(widgetRoot);
  root.render(
    <React.StrictMode>
      <AvatarWidget />
    </React.StrictMode>
  );
};

// 3. Auto-mount when script loads
mountWidget();

// Optional: Expose a global object if you want to control it later
window.VoiceAvatar = { mount: mountWidget };
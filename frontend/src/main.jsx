import React from 'react';
import ReactDOM from 'react-dom/client';
import AvatarWidget from './components/AvatarWidget';
import App from './App';
import './index.css';

const MOUNT_POINT_ID = 'voice-widget-mount-point';

function mount() {
  // 1. Try to find the script tag that has the configuration
  const scriptTag = document.querySelector('script[data-domain]');
  
  // 2. Extract configuration
  const domain = scriptTag?.getAttribute('data-domain');
  
  // 3. DECISION: Widget Mode vs. Dashboard Mode
  if (domain) {
    // === WIDGET MODE ===
    console.log("Initializing Widget for domain:", domain);
    
    // Create a new div at the end of the body so we don't overwrite the site's content
    let widgetRoot = document.getElementById(MOUNT_POINT_ID);
    if (!widgetRoot) {
      widgetRoot = document.createElement('div');
      widgetRoot.id = MOUNT_POINT_ID;
      document.body.appendChild(widgetRoot);
    }
    
    ReactDOM.createRoot(widgetRoot).render(
      <React.StrictMode>
        {/* Pass the domain from the script tag to the widget */}
        <AvatarWidget domain={domain} />
      </React.StrictMode>
    );
    
  } else {
    // === DASHBOARD MODE ===
    // This runs when you open localhost:5173 directly (no data-domain script found)
    const rootElement = document.getElementById('root');
    if (rootElement) {
        ReactDOM.createRoot(rootElement).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
    }
  }
}

mount();
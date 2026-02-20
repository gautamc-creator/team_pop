
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  useVoiceAssistant,
  useRoomContext,
  useLocalParticipant,
  RoomAudioRenderer
} from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import '../styles/AvatarWidget.css';

const DUMMY_IMAGE = "/image.png";

// --- SHOPPING CARD (Style A) ---
const ShoppingCard = ({ product, isActive, highlightPrice }) => (
    <a href={product.url} target="_blank" rel="noopener noreferrer" className={`shopping-card ${isActive ? 'transform scale-105 border-2 border-blue-500' : ''}`}>
        <img 
            src={product.image || DUMMY_IMAGE} 
            alt={product.title} 
            className="shopping-card-img"
            onError={(e) => { e.target.src = DUMMY_IMAGE; }}
        />
        <div className="shopping-card-info">
            <div className="shopping-card-title">{product.title}</div>
            <div className={`shopping-card-price ${(isActive && highlightPrice) ? 'animate-pulse text-green-500 font-bold drop-shadow-md' : ''}`}>{product.price || "Check Price"}</div>
            <div className="shopping-cta">Shop Now</div>
        </div>
    </a>
);

// --- MARKDOWN FORMATTER ---
const formatMessage = (text) => {
    if (!text) return "";
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br />');
    formatted = formatted.replace(/(\d+\.)\s/g, '<br/>$1 ');
    return formatted;
};

// --- INNER COMPONENT INSIDE LIVEKIT CONTEXT ---
function AvatarInner({ isOpen, setIsOpen, latestProducts, setLatestProducts, activeIndex, setActiveIndex, carouselRef, handleCarouselScroll }) {
  const { state } = useVoiceAssistant();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [transientMessage, setTransientMessage] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [highlightPrice, setHighlightPrice] = useState(false);
  const transientTimeoutRef = useRef(null);

  // Map LiveKit agent state to UI visual state
  // state can be: "listening" | "thinking" | "speaking" | "idle" (or undefined)
  let visualState = 'IDLE';
  if (state === 'listening') visualState = 'LISTENING';
  else if (state === 'speaking') visualState = 'SPEAKING';
  else if (state === 'thinking' || state === 'processing') visualState = 'THINKING';
  else if (state === 'connecting') visualState = 'CONNECTING';

  const showTransientMessage = useCallback((text) => {
      if (isOpen) return; 
      if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
      
      setIsFadingOut(false);
      setTransientMessage(text);
      
      transientTimeoutRef.current = setTimeout(() => {
          setIsFadingOut(true); 
          setTimeout(() => setTransientMessage(null), 300);
      }, 5000);
  }, [isOpen]);

  // Data Channel Listener for products
  useEffect(() => {
    if (!room) return;

    const handleData = (payload) => {
      try {
        const textDecoder = new TextDecoder();
        const strData = textDecoder.decode(payload);
        const json = JSON.parse(strData);

        if (json.type === 'product_results' && json.products) {
          setLatestProducts(json.products);
          setActiveIndex(0);
          showTransientMessage(`Found ${json.products.length} products for you.`);
        }
      } catch (error) {
        console.error("Failed to parse data message", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, setLatestProducts, setActiveIndex, showTransientMessage]);

  // Handle Transcription Events for Dynamic Presentation
  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments, participant) => {
      // Only listen to the AI agent, not the local user
      if (participant.isLocal) return;

      const text = segments.map(s => s.text).join(' ').toLowerCase();
      
      // 1. Dynamic Scrolling based on ordinal keywords
      if (text.includes('first') || text.includes('one')) setActiveIndex(0);
      else if (text.includes('second') || text.includes('two')) setActiveIndex(1);
      else if (text.includes('third') || text.includes('three')) setActiveIndex(2);

      // 2. Dynamic Price Highlighting
      if (text.includes('price') || text.includes('₹') || text.includes('rupees') || text.includes('cost')) {
        setHighlightPrice(true);
        // Turn off highlight after 3 seconds
        setTimeout(() => setHighlightPrice(false), 3000); 
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => room.off(RoomEvent.TranscriptionReceived, handleTranscription);
  }, [room, setActiveIndex]);

  // Handle Programmatic Carousel Scrolling
  useEffect(() => {
      if (carouselRef.current && latestProducts.length > 0) {
          const width = carouselRef.current.clientWidth;
          carouselRef.current.scrollTo({
              left: activeIndex * width,
              behavior: 'smooth'
          });
      }
  }, [activeIndex, latestProducts, carouselRef]);

  // Handle interaction: toggle mic
  const handleInteraction = async () => {
    if (!localParticipant) return;
    const isMicEnabled = localParticipant.isMicrophoneEnabled;
    
    if (!isMicEnabled) {
      await localParticipant.setMicrophoneEnabled(true);
    } else {
      await localParticipant.setMicrophoneEnabled(false);
    }
  };

  const isShoppingMode = !isOpen && latestProducts.length > 0;

  return (
    <>
      {/* 1. SHOPPING MODE OVERLAY */}
      {isShoppingMode && (
          <div className="shopping-mode-overlay">
              <button className="close-shopping-btn" onClick={() => setLatestProducts([])}>&times;</button>
              
              <div className="pagination-dots">
                  {latestProducts.map((_, idx) => (
                      <div key={idx} className={`dot ${idx === activeIndex ? 'active' : ''}`}></div>
                  ))}
              </div>

              <div className="shopping-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
                  {latestProducts.map((p, idx) => (
                      <div key={idx} className="shopping-card-wrapper">
                          <ShoppingCard 
                              product={p} 
                              isActive={idx === activeIndex} 
                              highlightPrice={highlightPrice} 
                          />
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 2. MAIN WIDGET CONTAINER */}
      <div className={`avatar-widget ${isOpen ? 'mode-open' : 'mode-closed'}`}>
          
          {/* Always visible Dock Column */}
          <div className="avatar-controls-column">
              
              {/* A. TRANSIENT MESSAGE (Floating Bubble) */}
              {!isOpen && transientMessage && (
                  <div className={`transient-bubble ${isFadingOut ? 'fading-out' : ''}`}>
                      <span dangerouslySetInnerHTML={{ __html: formatMessage(transientMessage) }} />
                  </div>
              )}

              {/* B. THE FLOATING CAPSULE DOCK */}
              {!isOpen && (
                  <div className="orb-dock">
                      {/* Left: Status */}
                      <div className={`dock-status ${visualState !== 'IDLE' ? 'active' : ''}`}>
                          {visualState === 'IDLE' ? 'Ready' : 
                           visualState === 'THINKING' ? 'Thinking' :
                           visualState === 'SPEAKING' ? 'Speaking' :
                           visualState === 'LISTENING' ? 'Listening' :
                           visualState === 'CONNECTING' ? 'Connecting' :
                           visualState}
                      </div>

                      {/* Center: Pop-out Orb */}
                      <div className={`orb-wrapper ${visualState}`} onClick={handleInteraction}>
                          <div className="orb-core">
                            {/* Optional: Add Visualizer if speaking */}
                            {visualState === 'SPEAKING' && (
                                <div style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }}>
                                    {/* Placeholder for visualizer or just keep CSS animation */}
                                </div>
                            )}
                          </div>
                      </div>

                      {/* Right: View Chat */}
                      <button className="dock-action" onClick={() => setIsOpen(true)}>
                          View Chat
                      </button>
                  </div>
              )}
          </div>
      </div>

      {/* 3. FULL CHAT UI (Open State) - Reduced for now as chat history is not fully synced yet */}
      {isOpen && (
         <div className="bubble">
             <div className="bubble-header">
                 <span className="bubble-status">Live Session</span>
                 <button className="expand-btn" onClick={() => setIsOpen(false)}>&times;</button>
             </div>
             <div className="bubble-content chat-history">
                 <div className="message-bubble assistant-message">
                    Chat history is unavailable in this mode. Please use voice.
                 </div>
             </div>
         </div>
      )}
    </>
  );
}

export default function AvatarWidget({ serverUrl, token, preview = false }) {
    const [isOpen, setIsOpen] = useState(preview); 
    const [latestProducts, setLatestProducts] = useState([]); 
    const [activeIndex, setActiveIndex] = useState(0);
    const carouselRef = useRef(null);

    // Scroll Handler
    const handleCarouselScroll = () => {
        if (carouselRef.current) {
            const scrollLeft = carouselRef.current.scrollLeft;
            const width = carouselRef.current.clientWidth;
            const newIndex = Math.round(scrollLeft / width);
            setActiveIndex(newIndex);
        }
    };

    if (!token || !serverUrl) {
        return <div className="avatar-widget-error">Missing LiveKit Config</div>;
    }

    return (
        <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={true}
            audio={true} // Enable audio output
            video={false}
        >
            <AvatarInner 
                isOpen={isOpen} 
                setIsOpen={setIsOpen}
                latestProducts={latestProducts}
                setLatestProducts={setLatestProducts}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                carouselRef={carouselRef}
                handleCarouselScroll={handleCarouselScroll}
            />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
}
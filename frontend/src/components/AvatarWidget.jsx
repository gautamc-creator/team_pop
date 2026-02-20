
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
const ShoppingCard = ({ product, isActive, highlightPrice, highlightDesc }) => (
    <a 
        href={product.url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className={`shopping-card ${isActive ? 'card-active' : 'card-dimmed'}`}
    >
        <img 
            src={product.image || DUMMY_IMAGE} 
            alt={product.title} 
            className="shopping-card-img"
            onError={(e) => { e.target.src = DUMMY_IMAGE; }}
        />
        <div className="shopping-card-info">
            <div className="shopping-card-title">{product.title}</div>
            {product.description && (
                <div className={`shopping-card-desc ${(isActive && highlightDesc) ? 'desc-highlight' : ''}`}>
                    {product.description}
                </div>
            )}
            <div className={`shopping-card-price ${(isActive && highlightPrice) ? 'price-glow' : ''}`}>
                {product.price || "Check Price"}
            </div>
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
function AvatarInner({ isOpen, setIsOpen, latestProducts, setLatestProducts, activeIndex, setActiveIndex, carouselRef, handleCarouselScroll, isProgrammaticScrollRef }) {
  const { state } = useVoiceAssistant();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [transientMessage, setTransientMessage] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [highlightPrice, setHighlightPrice] = useState(false);
  const [highlightDesc, setHighlightDesc] = useState(false);
  const transientTimeoutRef = useRef(null);
  const priceTimerRef = useRef(null);
  const descTimerRef = useRef(null);

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
          // Task 4: Haptic feedback to physically hook user attention
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
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

  // Handle Transcription Events for Dynamic Presentation ("The Director")
  // KEY INSIGHT: LiveKit fires TranscriptionReceived with ALL segments (past + present).
  // We must only look at the LAST segment and diff against previous text to detect NEW words.
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments, participant) => {
      // Only listen to the AI agent, not the local user
      if (participant.isLocal) return;
      if (!segments || segments.length === 0) return;

      // Only examine the LAST segment — the one currently being spoken
      const latestSegment = segments[segments.length - 1];
      const fullText = latestSegment.text.toLowerCase();

      // Diff: extract only the NEW portion of text since last event
      const prevText = lastTranscriptRef.current;
      const newText = fullText.startsWith(prevText) 
        ? fullText.slice(prevText.length) 
        : fullText; // If segment changed entirely, process all of it
      lastTranscriptRef.current = fullText;

      // Reset tracking when a new segment starts (segment finalized, next one begins)
      if (latestSegment.final) {
        lastTranscriptRef.current = '';
      }

      if (!newText.trim()) return; // No new words, skip

      // 1. Auto-Scrolling — only trigger on NEWLY spoken ordinal words
      if (newText.includes('first') || /\bone\b/.test(newText)) setActiveIndex(0);
      else if (newText.includes('second') || /\btwo\b/.test(newText)) setActiveIndex(1);
      else if (newText.includes('third') || /\bthree\b/.test(newText)) setActiveIndex(2);

      // 2. Price Highlighting — glow effect for 2500ms
      if (newText.includes('price') || newText.includes('₹') || newText.includes('rupees') || newText.includes('cost')) {
        if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
        setHighlightPrice(true);
        priceTimerRef.current = setTimeout(() => setHighlightPrice(false), 2500);
      }

      // 3. Description Highlighting — soft highlight for 3500ms
      if (newText.includes('details') || newText.includes('fabric') || newText.includes('description') || newText.includes('features')) {
        if (descTimerRef.current) clearTimeout(descTimerRef.current);
        setHighlightDesc(true);
        descTimerRef.current = setTimeout(() => setHighlightDesc(false), 3500);
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
      lastTranscriptRef.current = '';
    };
  }, [room, setActiveIndex]);

  // Handle Programmatic Carousel Scrolling
  useEffect(() => {
      if (carouselRef.current && latestProducts.length > 0) {
          isProgrammaticScrollRef.current = true;
          const width = carouselRef.current.clientWidth;
          carouselRef.current.scrollTo({
              left: activeIndex * width,
              behavior: 'smooth'
          });
          // Keep the guard up for the duration of the smooth scroll animation
          setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
      }
  }, [activeIndex, latestProducts, carouselRef, isProgrammaticScrollRef]);

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
                              highlightDesc={highlightDesc}
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
    const isProgrammaticScrollRef = useRef(false);
    const scrollEndTimerRef = useRef(null);

    // Debounced Scroll Handler — only responds to USER swipes, not programmatic scrolls
    const handleCarouselScroll = useCallback(() => {
        if (isProgrammaticScrollRef.current) return; // Guard: skip during programmatic scroll
        if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = setTimeout(() => {
            if (carouselRef.current) {
                const scrollLeft = carouselRef.current.scrollLeft;
                const width = carouselRef.current.clientWidth;
                const newIndex = Math.round(scrollLeft / width);
                if (newIndex !== activeIndex) setActiveIndex(newIndex);
            }
        }, 150); // Wait 150ms after scroll stops to settle
    }, [activeIndex]);

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
                isProgrammaticScrollRef={isProgrammaticScrollRef}
            />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
}
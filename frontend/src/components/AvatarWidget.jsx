import { useState, useRef } from 'react';
import useVoiceRecorder from './VoiceRecorder';
import { api } from '../services/api';
import '../styles/AvatarWidget.css';

const DUMMY_IMAGE = "https://placehold.co/400x400/1a1a1a/white?text=No+Image"; 

// --- SHOPPING CARD COMPONENT ---
const ShoppingCard = ({ product }) => (
    <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="shopping-card">
        <img 
            src={product.image_url || DUMMY_IMAGE} 
            alt={product.name} 
            className="shopping-card-img"
            onError={(e) => { e.target.src = DUMMY_IMAGE; }}
        />
        <div className="shopping-card-info">
            <div className="shopping-card-title">{product.name}</div>
            <div className="shopping-card-price">{product.price || "Check Price"}</div>
            <div className="shopping-cta">View Details &rarr;</div>
        </div>
    </a>
);

export default function AvatarWidget({ domain, preview = false }) {
    const [visualState, setVisualState] = useState('IDLE');
    const [isOpen, setIsOpen] = useState(preview); 
    const [latestProducts, setLatestProducts] = useState([]); 
    
    // Carousel State
    const [activeIndex, setActiveIndex] = useState(0);
    const carouselRef = useRef(null);

    // History
    const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! Tap me to speak.' }]);

    // Transient Message
    const [transientMessage, setTransientMessage] = useState(null);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const transientTimeoutRef = useRef(null);
    
    const audioPlayerRef = useRef(new Audio());
    const chatContainerRef = useRef(null);

    // --- CAROUSEL SCROLL HANDLER (Option A: Visual Tracking) ---
    const handleCarouselScroll = () => {
        if (carouselRef.current) {
            const scrollLeft = carouselRef.current.scrollLeft;
            const width = carouselRef.current.clientWidth;
            // Calculate index based on scroll position
            const newIndex = Math.round(scrollLeft / width);
            setActiveIndex(newIndex);
        }
    };

    // Helper: Show Message
    const showTransientMessage = (text) => {
        if (isOpen) return; 
        if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
        
        setIsFadingOut(false);
        setTransientMessage(text);
        
        transientTimeoutRef.current = setTimeout(() => {
            setIsFadingOut(true); 
            setTimeout(() => setTransientMessage(null), 300);
        }, 5000);
    };

    const handleInteraction = () => {
        if (visualState === 'SPEAKING') {
            audioPlayerRef.current.pause();
            setVisualState('IDLE');
        }
        if (isRecording) {
            stopRecording();
        } else {
            audioPlayerRef.current.pause();
            showTransientMessage("Listening...");
            startRecording();
        }
    };

    const handleTranscript = async (text) => {
        if (!text) return;
        setVisualState('THINKING');
        showTransientMessage("Thinking...");

        const newHistory = [...messages, { role: 'user', content: text }];
        setMessages(newHistory);

        try {
            const data = await api.chat(newHistory, domain);
            const answerText = data.answer || "I couldn't find an answer.";
            const summaryText = data.summary || answerText; 
            const products = data.products || [];

            if (products.length > 0) {
                setLatestProducts(products);
                setActiveIndex(0); // Reset to first card on new search
            }

            setMessages(prev => [...prev, { role: 'assistant', content: answerText, products: products }]);
            
            showTransientMessage(summaryText);
            setVisualState('GENERATING_AUDIO');
            await playTTS(summaryText);

        } catch (error) {
            console.error(error);
            showTransientMessage("Error connecting.");
            setVisualState('IDLE');
        }
    };

    const playTTS = async (text) => {
        try {
            const ttsResponse = await api.tts(text);
            const audioBlob = await ttsResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayerRef.current.src = audioUrl;
            await audioPlayerRef.current.play();
            setVisualState('SPEAKING');
            audioPlayerRef.current.onended = () => {
                setVisualState('IDLE');
                URL.revokeObjectURL(audioUrl);
            };
        } catch (e) { setVisualState('IDLE'); console.log(e); }
    };

    const { isRecording, startRecording, stopRecording } = useVoiceRecorder({ onTranscript: handleTranscript });

    const isShoppingMode = !isOpen && latestProducts.length > 0;

    return (
        <>
            {/* 1. SHOPPING MODE OVERLAY (Full Screen) */}
            {isShoppingMode && (
                <div className="shopping-mode-overlay">
                    <button className="close-shopping-btn" onClick={() => setLatestProducts([])}>&times;</button>
                    
                    {/* PAGINATION DOTS (Visual Only) */}
                    <div className="pagination-dots">
                        {latestProducts.map((_, idx) => (
                            <div 
                                key={idx} 
                                className={`dot ${idx === activeIndex ? 'active' : ''}`}
                            ></div>
                        ))}
                    </div>

                    <div 
                        className="shopping-carousel" 
                        ref={carouselRef}
                        onScroll={handleCarouselScroll}
                    >
                        {latestProducts.map((p, idx) => (
                            <div key={idx} className="shopping-card-wrapper">
                                <ShoppingCard product={p} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. MAIN WIDGET UI */}
            <div className={`avatar-widget ${isOpen ? 'mode-open' : 'mode-closed'}`}>
                <div className="avatar-controls">
                    {/* TRANSIENT MESSAGE (Appears above dock) */}
                    {!isOpen && transientMessage && (
                        <div className={`transient-bubble ${isShoppingMode ? 'shopping-mode-msg' : ''} ${isFadingOut ? 'fading-out' : ''}`}>
                            {transientMessage}
                        </div>
                    )}

                    {/* ORB DOCK */}
                    <div className="orb-dock">
                        {/* 1. STATUS (Left) */}
                        <div className="dock-status">
                            {visualState === 'IDLE' ? 'READY' : visualState}
                        </div>

                        {/* 2. ORB (Center) */}
                        <div className={`orb-avatar ${visualState}`} onClick={handleInteraction}>
                            <div className="orb-core"></div>
                        </div>

                        {/* 3. ACTION (Right) */}
                        {isOpen ? (
                            <button className="dock-action" onClick={() => setIsOpen(false)}>Close</button>
                        ) : (
                            <button className="dock-action" onClick={() => setIsOpen(true)}>View Chat</button>
                        )}
                    </div>
                </div>
            </div>
            
             {/* 3. FULL CHAT UI */}
             {isOpen && (
               <div className="bubble">
                   <div className="bubble-header">
                       <span className="bubble-status">Conversation</span>
                       <button className="expand-btn" onClick={() => setIsOpen(false)}>Close</button>
                   </div>
                   <div className="bubble-content chat-history" ref={chatContainerRef}>
                       {messages.map((msg, idx) => (
                           <div key={idx} className={`message-bubble ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
                               <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                           </div>
                       ))}
                   </div>
               </div>
            )}
        </>
    );
}

import React, { useState, useRef } from 'react';
import useVoiceRecorder from './VoiceRecorder';
import { api } from '../services/api';
import '../styles/AvatarWidget.css';

const DUMMY_IMAGE = "/image.png"; 

// --- SHOPPING CARD (Style A) ---
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
            <div className="shopping-cta">Shop Now</div>
        </div>
    </a>
);

export default function AvatarWidget({ domain, preview = false }) {
    const [visualState, setVisualState] = useState('IDLE');
    const [isOpen, setIsOpen] = useState(preview); 
    const [latestProducts, setLatestProducts] = useState([]); 
    
    const [activeIndex, setActiveIndex] = useState(0);
    const carouselRef = useRef(null);

    const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! Tap me to speak.' }]);

    const [transientMessage, setTransientMessage] = useState(null);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const transientTimeoutRef = useRef(null);
    
    const audioPlayerRef = useRef(new Audio());
    const chatContainerRef = useRef(null);

    // Scroll Handler
    const handleCarouselScroll = () => {
        if (carouselRef.current) {
            const scrollLeft = carouselRef.current.scrollLeft;
            const width = carouselRef.current.clientWidth;
            const newIndex = Math.round(scrollLeft / width);
            setActiveIndex(newIndex);
        }
    };

    const showTransientMessage = (text) => {
        if (isOpen) return; 
        if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
        
        setIsFadingOut(false);
        setTransientMessage(text);
        
        transientTimeoutRef.current = setTimeout(() => {
            setIsFadingOut(true); 
            setTimeout(() => setTransientMessage(null), 300);
        }, 8000);
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
            setVisualState('LISTENING');
            startRecording();
        }
    };

    const handleTranscript = async (text) => {
        if (!text) return;
        setVisualState('THINKING');
        // Show user's transcribed text instead of "Thinking..."
        showTransientMessage(text);

        const newHistory = [...messages, { role: 'user', content: text }];
        setMessages(newHistory);

        try {
            const data = await api.chat(newHistory, domain);
            const answerText = data.answer || "I couldn't find an answer.";
            const summaryText = data.summary || answerText; 
            const products = data.products || [];

            if (products.length > 0) {
                setLatestProducts(products);
                setActiveIndex(0);
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
        } catch (e) { setVisualState('IDLE'); console.error(e); }
    };

    const { isRecording, startRecording, stopRecording } = useVoiceRecorder({ onTranscript: handleTranscript });
    const isShoppingMode = !isOpen && latestProducts.length > 0;

    // --- MARKDOWN FORMATTER ---
    const formatMessage = (text) => {
        if (!text) return "";
        let formatted = text
            // Bold: **text** -> <strong>text</strong>
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic: *text* -> <em>text</em>
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Line breaks: \n -> <br>
            .replace(/\n/g, '<br />');

        // Numbered Lists: 1. Item -> <br>1. Item (basic handling)
        // A full parser would be better, but for now simplistic:
        formatted = formatted.replace(/(\d+\.)\s/g, '<br/>$1 ');

        return formatted;
    };

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
                                <ShoppingCard product={p} />
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
                                 visualState === 'GENERATING_AUDIO' ? 'Preparing' : 
                                 visualState}
                            </div>

                            {/* Center: Pop-out Orb */}
                            <div className={`orb-wrapper ${visualState}`} onClick={handleInteraction}>
                                <div className="orb-core"></div>
                            </div>

                            {/* Right: View Chat */}
                            <button className="dock-action" onClick={() => setIsOpen(true)}>
                                View Chat
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. FULL CHAT UI (Open State) */}
            {isOpen && (
               <div className="bubble"> {/* Use existing bubble class but ensure full screen styling in CSS if needed */}
                   <div className="bubble-header">
                       <span className="bubble-status">History</span>
                       <button className="expand-btn" onClick={() => setIsOpen(false)}>&times;</button>
                   </div>
                   <div className="bubble-content chat-history" ref={chatContainerRef}>
                       {messages.map((msg, idx) => (
                           <div key={idx} className={`message-bubble ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
                               <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                           </div>
                       ))}
                   </div>
               </div>
            )}
        </>
    );
}
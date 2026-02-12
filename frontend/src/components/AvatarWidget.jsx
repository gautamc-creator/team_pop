import React, { useState, useRef, useEffect } from 'react';
import useVoiceRecorder from './VoiceRecorder'; // Import the new Hook
import { api } from '../services/api';
import '../styles/AvatarWidget.css';



const LOADING_PHRASES = [
    "Checking the inventory...", "Finding the best look...", "Asking the fashion gods..."
];

// --- CONSTANTS ---
// 1. DUMMY IMAGE: Use a placeholder or a local asset
const DUMMY_IMAGE = "https://placehold.co/400x400/1a1a1a/white?text=No+Image"; 

// --- SUB-COMPONENT: PRODUCT CARD (Carousel Item) ---
const ProductCard = ({ product }) => {
    // Logic: Use provided image, OR fallback to Dummy
    const displayImage = product.image_url || DUMMY_IMAGE;

    return (
        <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="product-card-link">
            <div className="product-card">
                <div className="card-image-container">
                    <img 
                        src={displayImage} 
                        alt={product.name} 
                        className="product-thumb" 
                        onError={(e) => { e.target.src = DUMMY_IMAGE; }} // Safety net if URL is broken
                    />
                </div>
                <div className="product-info">
                    <div className="product-name" title={product.name}>{product.name}</div>
                    <div className="product-footer">
                         {/* Display price if available, else 'View' */}
                        <span className="product-price">{product.price || "View Item"}</span>
                        <span className="shop-icon">→</span>
                    </div>
                </div>
            </div>
        </a>
    );
};

export default function AvatarWidget({ domain, preview = false }) {
    // --- STATE ---
    // Visual States: 'IDLE', 'LISTENING', 'TRANSCRIBING', 'THINKING', 'GENERATING_AUDIO', 'SPEAKING'
    const [visualState, setVisualState] = useState('IDLE');
    // const [bubbleText, setBubbleText] = useState("Hi! Tap me to speak.");
    // Changed: isExpanded -> isOpen. Default closed (false), unless preview (true)
    const [isOpen, setIsOpen] = useState(preview);
    const [latestProducts, setLatestProducts] = useState([]); // Store products for transient carousel

    // Chat History (Kept from your original ChatWidget to maintain context)
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi! I am your AI assistant.' }
    ]);


    const audioPlayerRef = useRef(new Audio());
    const chatContainerRef = useRef(null);


    const [transientMessage, setTransientMessage] = useState(null);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const transientTimeoutRef = useRef(null);

    // Auto-scroll to bottom of chat
   // ... (Keep auto-scroll useEffect) ...
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, visualState, isOpen]);

    // ... (Keep showTransientMessage helper) ...
    const showTransientMessage = (text) => {
        if (isOpen) return; 
        if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
        setIsFadingOut(false);
        setTransientMessage(text);
        transientTimeoutRef.current = setTimeout(() => {
            setIsFadingOut(true); 
            setTimeout(() => setTransientMessage(null), 300);
        }, 6000);
    };

    const getRandomLoadingPhrase = () => {
        return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
    };

    // --- INTERACTION HANDLER (The Brain) ---
    const handleInteraction = () => {
        // 1. INTERRUPT SPEAKING
        if (visualState === 'SPEAKING') {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
            audioPlayerRef.current.src = ""; // Clear to prevent replay
            setVisualState('IDLE');
            // Do NOT return. Fall through to start recording immediately.
        }

        // 2. TOGGLE RECORDING
        if (isRecording) {
            stopRecording();
        } else {
            // Start Listening
            // Ensure audio is stopped and cleared (in case coming from IDLE with old src)
            audioPlayerRef.current.pause();

            if (audioPlayerRef.current.src) {
                 audioPlayerRef.current.src = ""; 
            }

            // setBubbleText("Listening...");
            // setIsOpen(true); // Auto-open when interacting
            showTransientMessage("Listening...");
            // Note: We removed the 'warm up' play() call because it was causing replays of old audio.
            // Modern browsers usually allow AudioContext resume on user gesture (click), which startRecording handles.
            startRecording();
        }
    };


    // --- 1. HANDLE TRANSCRIPT (Callback from VoiceRecorder) ---
    const handleTranscript = async (text) => {
        if (!text) return;

        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";

        // 1. Update UI to Thinking
        setVisualState('THINKING');
        // setBubbleText(getRandomLoadingPhrase());
        showTransientMessage(getRandomLoadingPhrase());
        // setIsOpen(true); // Ensure open

        // 2. Add User Message to History
        const updatedMessages = [...messages, { role: 'user', content: text }];
        setMessages(updatedMessages);

        try {
            // 3. Call /chat (Elastic + Gemini)
            const data = await api.chat(updatedMessages, domain);
            
            // Backend now returns 'answer' for visual chat and 'summary' for TTS
            const answerText = data.answer || data.summary || "I'm sorry, I couldn't find an answer.";
            const summaryText = data.summary || answerText; // Fallback if summary missing
            const products  = data.products || []; 

            if (products.length > 0) {
                setLatestProducts(products); // Show carousel even if closed
            }

            // 1. TTS Text (Clean Summary)
            

            // 2. Display Text (Summary + HTML Links)
            // First, format the text (e.g. bolding)
            let formattedText = formatTextForDisplay(answerText);

            // Then, append sources if they exist
            // if (sources.length > 0) {
            //     formattedText += '<br/><div class="sources-container" style="margin-top:8px; font-size: 0.85em; border-top:1px solid rgba(255,255,255,0.2); padding-top:4px;">';
            //     formattedText += '<strong>Sources:</strong><ul style="padding-left: 20px; margin: 4px 0;">';

            //     sources.forEach((src, idx) => {
            //          // Create a clickable link for each source
            //          formattedText += `<li><a href="${src}" target="_blank" rel="noopener noreferrer" style="color: #61dafb; text-decoration: underline;">Source ${idx + 1}</a></li>`;
            //     });

            //     formattedText += '</ul></div>';
            // }

            // 3. Set State
            setMessages(prev => [...prev, { role: 'assistant', content: formattedText , products : products }]); // Store full HTML in history

            showTransientMessage(summaryText)
 
            // 4. Play TTS (using the clean text)
            setVisualState('GENERATING_AUDIO');
            await playTTS(summaryText);

        } catch (error) {
            console.error(error);
            showTransientMessage("Error connecting.");
            setVisualState('IDLE');
        }
    };

    // --- 2. INITIALIZE HOOK ---
    const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
        onTranscript: handleTranscript
    });

    const [prevIsRecording, setPrevIsRecording] = useState(false);
    const [prevIsTranscribing, setPrevIsTranscribing] = useState(false);

    // Sync Hook state with Visual State (during render to avoid effect/flicker)
    if (isRecording !== prevIsRecording) {
        setPrevIsRecording(isRecording);
        if (isRecording) {
             if (visualState !== 'LISTENING') setVisualState('LISTENING');
        } else {
             // If stopped recording, and NOT transcribing yet (transcribing state handles next transition)
             if (visualState === 'LISTENING' && !isTranscribing) {
                // If isTranscribing tracks closely, this might be skipped, but okay as fallback
             }
        }
    }

    if (isTranscribing !== prevIsTranscribing) {
        setPrevIsTranscribing(isTranscribing);
        if (isTranscribing) {
             setVisualState('TRANSCRIBING');
             // setBubbleText("Transcribing...");
        } else {
             // Finished transcribing, will move to THINKING via handleTranscript, 
             // or back to IDLE if error/no text. 
             // handleTranscript will override this to THINKING.
        }
    }


    // --- 3. TTS LOGIC ---
    const playTTS = async (text) => {
        try {
            const ttsResponse = await api.tts(text);

            //stop
            audioPlayerRef.current.pause()

            const audioBlob = await ttsResponse.blob();
            console.log("Audio Blob Size:", audioBlob.size);
            if (audioBlob.size < 100) {
                console.error("Audio file too small - likely an error message");
                setVisualState('IDLE');
                return;
            }

            const audioUrl = URL.createObjectURL(audioBlob);

            audioPlayerRef.current.src = audioUrl;
            const playPromise = audioPlayerRef.current.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Browser Blocked Audio:", error);
                    setVisualState('IDLE');
                })

            }
            setVisualState('SPEAKING');

            audioPlayerRef.current.onended = () => {
                setVisualState('IDLE');
                audioPlayerRef.current.src = ""; // Clear source
                URL.revokeObjectURL(audioUrl);
            };
        } catch (e) {
            console.error("TTS Error", e);
            setVisualState('IDLE'); // Fallback if audio fails
        }
    };

    // Helper: Strip complex HTML for the small speech bubble (optional)
    // const stripHtmlForBubble = (html) => {
    //     const tmp = document.createElement("DIV");
    //     tmp.innerHTML = html;
    //     let text = tmp.textContent || tmp.innerText || "";
    //     // Truncate if too long for a bubble
    //     return text.length > 150 ? text.substring(0, 150) + "..." : text;
    // };




    // 2. FORMATTER: Turn bold into HTML bold. Sources are handled separately now.
    const formatTextForDisplay = (text) => {
        if (!text) return "";

        // A. Convert Markdown Bold (**text**) to HTML Bold (<strong>text</strong>)
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // B. Handle Newlines (convert \n to <br>)
        formatted = formatted.replace(/\n/g, '<br />');

        return formatted;
    };




   // --- RENDER ---
    return (
        <div className={`avatar-widget ${isOpen ? 'mode-open' : 'mode-closed'}`}>

            {/* 3. TRANSIENT CAROUSEL (Centered Above Orb) */}
            {!isOpen && latestProducts.length > 0 && (
                <div className="transient-carousel-container">
                    <button className="close-carousel-btn" onClick={() => setLatestProducts([])}>×</button>
                    <div className="products-carousel">
                        {latestProducts.map((p, pIdx) => (
                            <ProductCard key={pIdx} product={p} />
                        ))}
                    </div>
                </div>
            )}

            {/* 4. ORB & CONTROLS CONTAINER */}
            <div className="avatar-controls">
                
                {/* STATUS BADGE (Above Orb) */}
                {!isOpen && (
                    <div className={`status-badge ${visualState === 'IDLE' ? 'status-idle' : 'status-active'}`}>
                        {visualState === 'IDLE' ? 'Ready' : visualState}
                    </div>
                )}

                <div className="orb-row">
                     {/* AVATAR */}
                    <div className={`orb-avatar ${visualState}`} onClick={handleInteraction}>
                        <div className="orb-core"></div>
                        <div className="orb-ring"></div>
                    </div>

                    {/* TRANSIENT MESSAGE (Right of Orb) */}
                    {!isOpen && transientMessage && (
                        <div className={`transient-bubble ${isFadingOut ? 'fading-out' : ''}`}>
                            {transientMessage}
                        </div>
                    )}

                    {/* VIEW CHAT BUTTON (Right of Orb) */}
                    {!isOpen && !transientMessage && (
                        <button 
                            className="view-chat-btn"
                            onClick={() => setIsOpen(true)}
                        >
                            View Chat
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

}


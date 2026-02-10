import React, { useState, useRef, useEffect } from 'react';
import useVoiceRecorder from './VoiceRecorder'; // Import the new Hook
import { api } from '../services/api';
import '../styles/AvatarWidget.css';



const LOADING_PHRASES = [
    "Consulting the universe...",
    "Decoding the matrix...",
    "Searching the knowledge base...",
    "Thinking really hard...",
    "Connecting the dots...",
    "Asking the elders..."
];

export default function AvatarWidget({ domain, preview = false }) {
    // --- STATE ---
    // Visual States: 'IDLE', 'LISTENING', 'TRANSCRIBING', 'THINKING', 'GENERATING_AUDIO', 'SPEAKING'
    const [visualState, setVisualState] = useState('IDLE');
    const [bubbleText, setBubbleText] = useState("Hi! Tap me to speak.");
    // Changed: isExpanded -> isOpen. Default closed (false), unless preview (true)
    const [isOpen, setIsOpen] = useState(preview);

    // Chat History (Kept from your original ChatWidget to maintain context)
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi! I am your AI assistant.' }
    ]);

    const audioPlayerRef = useRef(new Audio());
    const chatContainerRef = useRef(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, visualState, isOpen]);

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

            setBubbleText("Listening...");
            setIsOpen(true); // Auto-open when interacting
            
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
        setBubbleText(getRandomLoadingPhrase());
        setIsOpen(true); // Ensure open

        // 2. Add User Message to History
        const updatedMessages = [...messages, { role: 'user', content: text }];
        setMessages(updatedMessages);

        try {
            // 3. Call /chat (Elastic + Gemini)
            const data = await api.chat(updatedMessages, domain);
            
            // Backend now returns 'answer' for visual chat and 'summary' for TTS
            const answerText = data.answer || data.summary || "I'm sorry, I couldn't find an answer.";
            const summaryText = data.summary || answerText; // Fallback if summary missing
            const sources = data.sources || []; 

            // 1. TTS Text (Clean Summary)
            let ttsContent = summaryText; 

            // 2. Display Text (Summary + HTML Links)
            // First, format the text (e.g. bolding)
            let formattedText = formatTextForDisplay(answerText);

            // Then, append sources if they exist
            if (sources.length > 0) {
                formattedText += '<br/><div class="sources-container" style="margin-top:8px; font-size: 0.85em; border-top:1px solid rgba(255,255,255,0.2); padding-top:4px;">';
                formattedText += '<strong>Sources:</strong><ul style="padding-left: 20px; margin: 4px 0;">';

                sources.forEach((src, idx) => {
                     // Create a clickable link for each source
                     formattedText += `<li><a href="${src}" target="_blank" rel="noopener noreferrer" style="color: #61dafb; text-decoration: underline;">Source ${idx + 1}</a></li>`;
                });

                formattedText += '</ul></div>';
            }

            // 3. Set State
            setMessages(prev => [...prev, { role: 'assistant', content: formattedText }]); // Store full HTML in history

            // 4. Play TTS (using the clean text)
            setVisualState('GENERATING_AUDIO');
            await playTTS(ttsContent);

        } catch (error) {
            console.error(error);
            setBubbleText("Error connecting.");
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
             setBubbleText("Transcribing...");
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



    // --- 4. RENDER ---
    return (
        <div className={`avatar-widget ${preview ? 'preview' : ''} ${isOpen ? 'mode-open' : 'mode-closed'}`}>

            {/* 3. EXPANDABLE BUBBLE - Only render if OPEN */}
            {isOpen && (
                <div className={`bubble ${visualState === 'THINKING' || visualState === 'TRANSCRIBING' || visualState === 'GENERATING_AUDIO' ? 'pulse' : ''}`}>

                    {/* Header Actions */}
                    <div className="bubble-header">
                        <span className={`bubble-status pill ${visualState.toLowerCase()}`}>
                            {visualState === 'LISTENING' && 'Listening'}
                            {visualState === 'TRANSCRIBING' && 'Transcribing'}
                            {visualState === 'THINKING' && 'Thinking'}
                            {visualState === 'GENERATING_AUDIO' && 'Generating Audio'}
                            {visualState === 'SPEAKING' && 'Speaking'}
                            {visualState === 'IDLE' && 'Ready'}
                        </span>
                        
                        <button
                            className="expand-btn"
                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        >
                            Close
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="bubble-content chat-history" ref={chatContainerRef}>
                        {messages.map((msg, idx) => (
                            <div 
                                key={idx} 
                                className={`message-bubble ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                            >
                                {msg.role === 'assistant' ? (
                                    <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                                ) : (
                                    msg.content
                                )}
                            </div>
                        ))}
                        
                        {/* Transient State Indicators */}
                        {visualState === 'LISTENING' && (
                             <div className="status-message">
                                 <span>Listening...</span>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                             </div>
                        )}
                        
                        {visualState === 'TRANSCRIBING' && (
                             <div className="status-message">
                                 <span>Transcribing...</span>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                             </div>
                        )}

                        {(visualState === 'THINKING' || visualState === 'GENERATING_AUDIO') && (
                             <div className="status-message">
                                 <span>{visualState === 'GENERATING_AUDIO' ? "Generating Audio..." : bubbleText}</span>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                             </div>
                        )}
                    </div>

                    <div className="bubble-arrow"></div>
                </div>
            )}

            {/* ORB AVATAR */}
            <div
                className={`orb-avatar ${visualState}`}
                onClick={() => {
                     // Logic: If closed, open. If open and idle, handle interaction.
                     if (!isOpen) {
                         setIsOpen(true);
                     } else {
                         // If open, perform standard interaction (toggle recording/stop audio)
                         if (visualState !== 'THINKING' && visualState !== 'TRANSCRIBING' && visualState !== 'GENERATING_AUDIO') handleInteraction();
                     }
                }}
                style={{cursor: (visualState === "THINKING" || visualState === "TRANSCRIBING" || visualState === "GENERATING_AUDIO") ? 'wait' : 'pointer'}}
                title={visualState === 'SPEAKING' ? "Click to Stop" : "Click to Speak"}
            >
                <div className="orb-core"></div>
                <div className="orb-ring"></div>
            </div>

        </div>
    );
}

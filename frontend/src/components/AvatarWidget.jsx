import React, { useState, useRef } from 'react';
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
    // Visual States: 'IDLE', 'LISTENING', 'THINKING', 'SPEAKING'
    const [visualState, setVisualState] = useState('IDLE');
    const [bubbleText, setBubbleText] = useState("Hi! Tap me to speak.");
    const [isExpanded, setIsExpanded] = useState(false);

    // Chat History (Kept from your original ChatWidget to maintain context)
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi! I am your AI assistant.' }
    ]);

    const audioPlayerRef = useRef(new Audio());

    const getRandomLoadingPhrase = () => {
        return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
    };

    // --- INTERACTION HANDLER (The Brain) ---
    const handleInteraction = () => {
        // A. "Warm up" audio engine
        // audioPlayerRef.current.play().catch(() => { });

        // 2. STOP PREVIOUS AUDIO / RESET LOGIC
        if (visualState === 'SPEAKING') {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
            setVisualState('IDLE');
            return; // Stop here, don't record immediately
        }

        // Toggle Recording
        if (isRecording) {
            stopRecording();
        } else if(visualState === 'IDLE'){
            // 1. CLEAR CONTENT ON NEW QUESTION
            setBubbleText("Listening...");
            setIsExpanded(false); // Auto-shrink if it was open
            audioPlayerRef.current.play().catch(() => { });
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

        // 2. Add User Message to History
        const updatedMessages = [...messages, { role: 'user', content: text }];
        setMessages(updatedMessages);

        try {
            // 3. Call /chat (Elastic + Gemini)
            const data = await api.chat(updatedMessages, domain);
            const answerText = data.answer || "I'm not sure.";
            const sources = data.sources || []; // This is now an array ["url1", "url2"]

            // 1. TTS Text (Clean Summary)
            // No need to strip sources anymore, the backend sends clean text in 'answer'
            let ttsContent = answerText; 

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
            setBubbleText(formattedText); 
            setMessages(prev => [...prev, { role: 'assistant', content: formattedText }]); // Store full HTML in history

            // 4. Play TTS (using the clean text)
            await playTTS(ttsContent);

        } catch (error) {
            console.error(error);
            setBubbleText("Error connecting.");
            setVisualState('IDLE');
        }
    };

    // --- 2. INITIALIZE HOOK ---
    const { isRecording, startRecording, stopRecording } = useVoiceRecorder({
        onTranscript: handleTranscript
    });

    const [prevIsRecording, setPrevIsRecording] = useState(false);

    // Sync Hook state with Visual State (during render to avoid effect/flicker)
    if (isRecording !== prevIsRecording) {
        setPrevIsRecording(isRecording);
        if (isRecording) {
             // Only switch to listening if not already (though implicit here)
             if (visualState !== 'LISTENING') setVisualState('LISTENING');
        } else {
             // If stopped recording and was listening, go to thinking
             if (visualState === 'LISTENING') setVisualState('THINKING');
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
                return;
            }

            const audioUrl = URL.createObjectURL(audioBlob);

            audioPlayerRef.current.src = audioUrl;
            const playPromise = audioPlayerRef.current.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Browser Blocked Audio:", error);
                })

            }
            setVisualState('SPEAKING');

            audioPlayerRef.current.onended = () => {
                setVisualState('IDLE');
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

    const stripHtml = (html) => {
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    // --- 4. RENDER ---
    return (
        <div className={`avatar-widget ${preview ? 'preview' : ''} ${isExpanded ? 'mode-expanded' : ''}`}>

            {/* 3. EXPANDABLE BUBBLE */}
            {bubbleText && (
                <div className={`bubble ${visualState === 'THINKING' ? 'pulse' : ''}`}>

                    {/* Header Actions */}
                    <div className="bubble-header">
                        <span className={`bubble-status pill ${visualState.toLowerCase()}`}>
                            {visualState === 'LISTENING' && 'Listening'}
                            {visualState === 'THINKING' && 'Thinking'}
                            {visualState === 'SPEAKING' && 'Speaking'}
                            {visualState === 'IDLE' && 'Ready'}
                        </span>
                        {visualState !== 'THINKING' && (
                            <button
                                className="expand-btn"
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                            >
                                {isExpanded ? 'Minimize' : 'Expand'}
                            </button>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="bubble-content">
                        {isExpanded ? (
                            // Expanded: Show full HTML
                            <div dangerouslySetInnerHTML={{ __html: bubbleText }} />
                        ) : (
                            // Collapsed: Show truncated HTML (Requires a small trick or just truncate plain text)
                            // Ideally, for collapsed view, we strip HTML tags to avoid breaking layout
                            <div>
                                {stripHtml(bubbleText).substring(0, 100)}...
                                {visualState === "SPEAKING" ? <span style={{ color: '#888', fontSize: '10px' }}> ( Expand to see sources)</span> : ""}
                            </div>
                        )}
                    </div>

                    <div className="bubble-arrow"></div>
                </div>
            )}

            {/* ORB AVATAR */}
            <div
                className={`orb-avatar ${visualState}`}
                onClick={visualState === 'THINKING' ? null: handleInteraction}
                style={{cursor:visualState === "THINKING" ? 'wait' : 'pointer'}}
                title={visualState === 'SPEAKING' ? "Click to Stop" : "Click to Speak"}
            >
                <div className="orb-core"></div>
                <div className="orb-ring"></div>
            </div>

        </div>
    );
}

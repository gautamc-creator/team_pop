import React, { useState, useRef, useEffect } from 'react';
import useVoiceRecorder from './VoiceRecorder'; // Import the new Hook
import '../styles/AvatarWidget.css';

const LOADING_PHRASES = [
    "Consulting the universe...",
    "Decoding the matrix...",
    "Searching the knowledge base...",
    "Thinking really hard...",
    "Connecting the dots...",
    "Asking the elders..."
];

export default function AvatarWidget() {
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
        audioPlayerRef.current.play().catch(() => { });

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
        } else {
            // 1. CLEAR CONTENT ON NEW QUESTION
            setBubbleText("Listening...");
            setIsExpanded(false); // Auto-shrink if it was open
            startRecording();
        }
    };


    // --- 1. HANDLE TRANSCRIPT (Callback from VoiceRecorder) ---
    const handleTranscript = async (text) => {
        if (!text) return;

        // 1. Update UI to Thinking
        setVisualState('THINKING');
        setBubbleText(getRandomLoadingPhrase());

        // 2. Add User Message to History
        const updatedMessages = [...messages, { role: 'user', content: text }];
        setMessages(updatedMessages);

        try {
            // 3. Call /chat (Elastic + Gemini)
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages })
            });

            if (!response.ok) throw new Error('Chat API failed');

            const data = await response.json();
            const answerText = data.answer || "I'm not sure.";

            // 4. Format and Display Text
            // Note: We use a simplified formatter here for the bubble. 
            // If you need the complex HTML (tables/lists), the bubble might get too big.
            const displayText = formatTextForDisplay(answerText)
            setBubbleText(displayText);

            const audioText = cleanTextForTTS(answerText);

            // Update history with bot response
            setMessages(prev => [...prev, { role: 'assistant', content: answerText }]);

            // 5. Call /tts (Text to Speech)
            await playTTS(audioText);

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

    // Sync Hook state with Visual State
    useEffect(() => {
        if (isRecording) setVisualState('LISTENING');
        else if (visualState === 'LISTENING') setVisualState('THINKING');
        // Logic: If hook stops recording, we are now 'Thinking' until API returns
    }, [isRecording]);


    // --- 3. TTS LOGIC ---
    const playTTS = async (text) => {
        try {
            const ttsResponse = await fetch('http://localhost:8000/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (!ttsResponse.ok) throw new Error('TTS Failed');

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


    // 1. CLEANER: Removes sources so TTS doesn't read them
    const cleanTextForTTS = (text) => {
        if (!text) return "";
        // Remove [Source: URL] patterns entirely
        return text.replace(/\[Source:.*?\]/g, '');
    };

    // 2. FORMATTER: Turns sources into clickable links & handles bold text
    const formatTextForDisplay = (text) => {
        if (!text) return "";

        // A. Convert Markdown Bold (**text**) to HTML Bold (<strong>text</strong>)
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // B. Convert [Source: URL] to a clickable badge
        // We handle multiple URLs in one bracket if necessary, or just standard ones
        formatted = formatted.replace(
            /\[Source: (.*?)\]/g, // Capture EVERYTHING inside the brackets
            (match, content) => {
                // Split by comma to get individual URLs
                const urls = content.split(',').map(u => u.trim());

                // Generate a link button for EACH URL found
                return urls.map((url, index) => {
                    // Basic cleanup just in case
                    const cleanUrl = url.replace(/,$/, '');
                    return `<a href="${cleanUrl}" target="_blank" class="source-link">📄 Source ${urls.length > 1 ? index + 1 : ''}</a>`;
                }).join(' '); // Join them with a space
            }
        );
        // C. Handle Newlines (convert \n to <br>)
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
        <div className={`avatar-widget ${isExpanded ? 'mode-expanded' : ''}`}>

            {/* 3. EXPANDABLE BUBBLE */}
            {bubbleText && (
                <div className={`bubble ${visualState === 'THINKING' ? 'pulse' : ''}`}>

                    {/* Header Actions */}
                    <div className="bubble-header">
                        <span className="bubble-status">
                            {visualState === 'THINKING' ? '⚡ Processing' : '💬 Response'}
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

            {/* ROBOT AVATAR (Same SVG as before) */}
            <div
                className={`robot-avatar ${visualState}`}
                onClick={handleInteraction}
                title={visualState === 'SPEAKING' ? "Click to Stop" : "Click to Speak"}
            >
                <svg viewBox="0 0 100 100" className="robot-svg">
                    {/* ... Paste your SVG code from the previous step here ... */}
                    {/* If you lost it, I can paste it again below. Just let me know. */}
                    <defs><linearGradient id="robotGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4facfe" /><stop offset="100%" stopColor="#00f2fe" /></linearGradient></defs>
                    <g className="antenna-group"><line x1="50" y1="20" x2="50" y2="10" stroke="#333" strokeWidth="3" /><circle cx="50" cy="8" r="4" fill="#ff4757" className="antenna-bulb" /></g>
                    <rect x="20" y="20" width="60" height="50" rx="15" fill="url(#robotGrad)" stroke="#333" strokeWidth="3" />
                    <rect x="12" y="35" width="8" height="20" rx="4" fill="#333" />
                    <rect x="80" y="35" width="8" height="20" rx="4" fill="#333" />
                    <rect x="30" y="30" width="40" height="30" rx="8" fill="#fff" opacity="0.9" />
                    <g className="eyes-group"><circle cx="40" cy="42" r="3" fill="#333" /><circle cx="60" cy="42" r="3" fill="#333" /></g>
                    <rect id="robot-mouth" x="42" y="52" width="16" height="2" rx="1" fill="#333" />
                </svg>
            </div>

        </div>
    );
}
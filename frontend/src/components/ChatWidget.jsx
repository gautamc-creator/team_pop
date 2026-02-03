import React, { useState, useRef, useEffect } from 'react';
import VoiceRecorder from './VoiceRecorder';
import '../styles/ChatWidget.css';

export default function ChatWidget() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '<p>Hi! I\'m your AI assistant. How can I help you today?</p>',
      isHtml: true
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatResponse = (text, sources) => {
    // 1. Handle if text is undefined or null
    if (!text || typeof text !== 'string') {
      return '<p>Unable to format response</p>';
    }

    // 2. Make inline URLs clickable (Logic: Find http/https and wrap in <a> tags)
    // We do this BEFORE other HTML formatting to avoid breaking tags we add later.
    let formatted = text.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline;">$1</a>'
    );

    // 3. Convert Markdown-like formatting to HTML
    formatted = formatted
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      // List handling
      .replace(/^\s*-\s+(.*)/gm, '<li>$1</li>')
      // Wrap consecutive <li> items in <ul>
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Paragraph handling (double newline to paragraph)
      .replace(/\n\n/g, '</p><p>')
      // Ensure the whole thing is wrapped in p tags if not starting with h/ul
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    // 4. Handle Sources safely (Strings vs Objects)
    if (sources && Array.isArray(sources) && sources.length > 0) {
      formatted += '<div class="sources-inline" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;"><strong>Sources:</strong><ul style="margin-top: 5px;">';

      sources.forEach(source => {
        let url, title;

        // Check if source is just a string (URL) or an object
        if (typeof source === 'string') {
          url = source;
          // Create a cleaner title from the URL (e.g., "teampop.com/blog")
          try {
            title = new URL(source).hostname + new URL(source).pathname;
          } catch (e) {
            title = source;
          }
        } else {
          url = source.url;
          title = source.title || url;
        }

        // Only add if we have a valid URL
        if (url) {
          formatted += `<li><a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #007bff;">${title}</a></li>`;
        }
      });

      formatted += '</ul></div>';
    }

    return formatted;
  };

  const handleResponse = async (transcript) => {


    // 1. Get the query text safely
    const queryText = (typeof transcript === 'object' && transcript.text)
      ? transcript.text
      : transcript;

    if (!queryText || typeof queryText !== 'string') return;

    // 2. Optimistically update UI
    const newUserMessage = { role: 'user', content: queryText };
    const updatedMessages = [...messages, newUserMessage]; // Create the new history array

    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // --- CHANGE: Send the full history ---
        body: JSON.stringify({
          messages: updatedMessages
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      const answerText = data.answer || 'No response received';
      const sources = data.sources || [];
      const formattedResponse = formatResponse(answerText, sources);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: formattedResponse,
        isHtml: true
      }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '<p>Sorry, I encountered an error. Please try again.</p>',
        isHtml: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div className="chat-header-logo">
          <svg width="24" height="24" viewBox="0 0 78 34" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.92828 32.5404V13.3119H4.5627V15.3217C5.40463 13.9637 7.11564 13.0946 8.93529 13.0946C13.0634 13.0946 15.4263 16.1093 15.4263 20.156C15.4263 24.2026 13.0634 27.2173 8.96244 27.2173C7.11564 27.2173 5.37747 26.321 4.5627 24.9631V32.5404H1.92828ZM8.55506 24.9088C11.0808 24.9088 12.7647 23.0076 12.7647 20.156C12.7647 17.3043 11.0808 15.4031 8.55506 15.4031C6.02928 15.4031 4.34543 17.3043 4.34543 20.156C4.34543 23.0076 6.02928 24.9088 8.55506 24.9088Z" />
            <path d="M50.7393 13.562C51.977 12.0123 55.8203 13.0227 59.3223 15.8198C62.0841 18.0258 63.807 20.6841 63.8057 22.4692C63.8823 24.0706 62.6119 25.8899 60.5488 26.9077C58.0187 28.1559 55.2564 27.7254 54.3789 25.9468C53.7677 24.7073 54.2324 23.14 55.4268 21.8813C55.2305 21.7371 55.0345 21.5876 54.8398 21.4321C51.3382 18.6353 49.5022 15.112 50.7393 13.562Z" />
            <path d="M77.6133 13.6277C76.3755 12.078 72.5332 13.0884 69.0312 15.8855C66.2694 18.0915 64.5466 20.7498 64.5479 22.5349C64.4713 24.1363 65.7416 25.9556 67.8047 26.9734C70.3348 28.2215 73.0971 27.7911 73.9746 26.0125C74.5857 24.7732 74.1207 23.2065 72.9268 21.948C73.1232 21.8036 73.3189 21.6534 73.5137 21.4978C77.0157 18.7007 78.8511 15.1774 77.6133 13.6277Z" />
          </svg>
        </div>
        <div className="chat-header-text">
          <span className="chat-header-title">Pop AI Assistant</span>
          <span className="chat-header-status">Online</span>
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            {msg.isHtml ? (
              <div
                className="message-content formatted"
                dangerouslySetInnerHTML={{ __html: msg.content }}
              />
            ) : (
              <div className="message-content">{msg.content}</div>
            )}
          </div>
        ))}
        {loading && <div className="message message-assistant"><div className="typing">Thinking...</div></div>}
        <div ref={messagesEndRef} />
      </div>
      <VoiceRecorder onTranscript={handleResponse} disabled={loading} />
    </div>
  );
}

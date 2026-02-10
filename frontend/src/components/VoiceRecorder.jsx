// import React, { useState, useRef } from 'react';
// import '../styles/VoiceRecorder.css'

// export default function VoiceRecorder({ onTranscript, disabled }) {
//   const [isRecording, setIsRecording] = useState(false);
//   const mediaRecorderRef = useRef(null);
//   const audioChunksRef = useRef([]);

//   const startRecording = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       const mediaRecorder = new MediaRecorder(stream);
//       mediaRecorderRef.current = mediaRecorder;
//       audioChunksRef.current = [];

//       mediaRecorder.ondataavailable = (event) => {
//         audioChunksRef.current.push(event.data);
//       };

//       mediaRecorder.onstop = async () => {
//         const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
//         const formData = new FormData();
//         formData.append('file', audioBlob, 'audio.wav');

//         try {
//           const response = await fetch('http://localhost:8000/stt', {
//             method: 'POST',
//             body: formData
//           });

//           if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//           }

//           // onTranscript(response.text)
//           const data = await response.json();

//           // Backend returns 'text' not 'transcript'
//           if (onTranscript && typeof onTranscript === 'function') {
//               if (data.text) {
//                 onTranscript(data.text);
//               } else {
//                 console.error("No text found in response:", data);
//               }
//           }
//         } catch (error) {
//           console.error('Transcription error:', error);
//         }

//         // Stop all tracks
//         stream.getTracks().forEach(track => track.stop());
//       };

//       mediaRecorder.start();
//       setIsRecording(true);
//     } catch (error) {
//       console.error('Error accessing microphone:', error);
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && isRecording) {
//       mediaRecorderRef.current.stop();
//       setIsRecording(false);
//     }
//   };

//   return (
//     <div className="voice-recorder">
//       <button
//         onClick={isRecording ? stopRecording : startRecording}
//         disabled={disabled}
//         className={`record-button ${isRecording ? 'recording' : ''}`}
//       >
//         {isRecording ? 'Stop' : 'Speak to Ask'}
//       </button>
//     </div>
//   );
// }

import { useState, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * A Custom Hook that handles the Microphone and STT API.
 * Returns the recording state and start/stop functions.
 */
export default function useVoiceRecorder({ onTranscript }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true); // Start processing
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.wav');

        try {
          const response = await fetch(`${API_BASE_URL}/stt`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (onTranscript && typeof onTranscript === 'function') {
             // Ensure we pass the text string, just like your original code
             onTranscript(data.text || ""); 
          }

        } catch (error) {
          console.error('Transcription error:', error);
        } finally {
          setIsTranscribing(false); // End processing
        }

        // Cleanup tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording
  };
}

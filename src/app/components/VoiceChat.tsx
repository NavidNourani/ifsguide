import React, { useState, useRef, useEffect } from 'react';
import { playAudioData } from '../utils/audioUtils';

interface VoiceChatProps {
  onSendMessage: (message: { role: string; content: string }) => void;
  setIsLoading: (loading: boolean) => void;
  messages: Array<{ role: string; content: string }>;
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ onSendMessage, setIsLoading, setMessages }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | undefined>(undefined);
  const audioChunks = useRef<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [voiceQueue, setVoiceQueue] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);


  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
        if (timerRef.current){
      clearInterval(timerRef.current);
        }
      setRecordingTime(0);
    }

    return () => {
        if (timerRef.current){
            clearInterval(timerRef.current);
        }
    };
  }, [isRecording]);

  useEffect(() => {
    const playNextInQueue = async () => {
      if (voiceQueue.length > 0 && !isPlaying) {
        setIsPlaying(true);
        const nextAudio = voiceQueue[0];
        try {
          await playAudioData(nextAudio);
          setVoiceQueue(prev => prev.slice(1));
        } catch (error) {
          console.error('Error playing audio:', error);
        }
        setIsPlaying(false);
      }
    };

    playNextInQueue();
  }, [voiceQueue, isPlaying]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 32000
      };
      
      mediaRecorder.current = new MediaRecorder(stream, options);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        await sendAudioToServer(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onSendMessage({
        role: 'assistant',
        content: 'Unable to access microphone. Please check your permissions.'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };


  const sendAudioToServer = async (audioBlob: Blob) => {
    setIsLoading(true);
    let currentResponse = '';
    let transcriptionAdded = false;
    let buffer = '';
    let currentMarker = '';

    try {
      const formData = new FormData();
      formData.append('audioData', audioBlob);

      const response = await fetch('/api/chat/voice', {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        while (buffer.includes('\n')) {
          const lineEnd = buffer.indexOf('\n');
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);

          if (line.startsWith('$')) {
            currentMarker = line;
          } else if (line && currentMarker) {
            switch (currentMarker) {
              case '$transcript:':
                if (!transcriptionAdded) {
                  onSendMessage({ role: 'user', content: line });
                  onSendMessage({ role: 'assistant', content: '' });
                  transcriptionAdded = true;
                }
                break;

              case '$text:':
                currentResponse += line;
                setMessages(prevMessages => {
                  const newMessages = [...prevMessages];
                  if (newMessages.length > 0) {
                    newMessages[newMessages.length - 1] = {
                      ...newMessages[newMessages.length - 1],
                      content: currentResponse
                    };
                  }
                  return newMessages;
                });
                break;

              case '$voice:':
                try {
                  setVoiceQueue(prev => [...prev, line]);
                } catch (error) {
                  console.error('Error processing audio:', error);
                }
                break;

              case '$error:':
                console.error('Server error:', line);
                break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending audio:', error);
      onSendMessage({
        role: 'assistant',
        content: 'Sorry, there was an error processing your voice message. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`p-3 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500 animate-pulse' 
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        } text-white relative`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
      {isRecording && (
        <span className="text-sm text-gray-600">
          Recording: {recordingTime}s
        </span>
      )}
    </div>
  );
};

export default VoiceChat; 
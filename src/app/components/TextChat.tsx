import React, { useState } from 'react';
import { playAudioData, processStreamChunk } from '../utils/audioUtils';

interface TextChatProps {
  onSendMessage: (message: { role: string; content: string }) => void;
  setIsLoading: (loading: boolean) => void;
  messages: Array<{ role: string; content: string }>;
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>;
}

const TextChat: React.FC<TextChatProps> = ({ onSendMessage, setIsLoading, setMessages }) => {
  const [input, setInput] = useState('');

  const handleStreamResponse = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    // let fullResponse = '';

    try {
      // Add initial assistant message
      onSendMessage({
        role: 'assistant',
        content: ''
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        
        // Process the chunk and handle audio
        const { shouldContinue, audioData } = processStreamChunk(chunk, setMessages, onSendMessage);
        
        if (shouldContinue && audioData) {
          try {
            await playAudioData(audioData);
          } catch (error) {
            console.error('Error playing audio:', error);
            onSendMessage({
              role: 'assistant',
              content: 'Sorry, there was an error playing the audio response.'
            });
          }
          continue;
        }

        // Accumulate the response without audio tags
        // const cleanChunk = chunk.replace(/<AUDIO>.*?<\/AUDIO>/g, '').trim();
        // if (cleanChunk) {
        //   fullResponse += cleanChunk;
        // }
      }
    } catch (error) {
      console.error('Error processing stream:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    onSendMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [userMessage],
        }),
      });

      if (!response.ok) throw new Error(response.statusText);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      await handleStreamResponse(reader);
    } catch (error) {
      console.error('Error:', error);
      onSendMessage({
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          placeholder="پیام خود را بنویسید..."
          dir="rtl"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className=" h-6 w-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
};

export default TextChat; 
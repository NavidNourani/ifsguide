export const playAudioData = async (base64Audio: string): Promise<void> => {
  try {
    // Clean the base64 string from any HTML tags
    const cleanBase64 = base64Audio.replace(/<\/?AUDIO>/g, '').trim();
    console.log("aaaaaaaaaaaaaaa", cleanBase64)
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Convert base64 to array buffer
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Promise((resolve, reject) => {
      // Decode audio data
      audioContext.decodeAudioData(
        bytes.buffer,
        (buffer) => {
          // Create buffer source
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          
          // Handle completion
          source.onended = () => {
            audioContext.close();
            resolve();
          };
          
          // Start playing
          source.start(0);
        },
        (error) => {
          audioContext.close();
          reject(error);
        }
      );
    });
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
};

export const processStreamChunk = (
  chunk: string,
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>,
  onSendMessage: (message: { role: string; content: string }) => void,
): { shouldContinue: boolean; audioData?: string } => {
  // Remove any HTML tags from the displayed message
  const cleanChunk = chunk.replace(/<AUDIO>.*?<\/AUDIO>/g, '').trim();
  
  // Check for audio data
  const audioMatch = chunk.match(/<AUDIO>(.*?)<\/AUDIO>/);
    console.log("1111111111", audioMatch)
  if (audioMatch) {
    return { shouldContinue: true, audioData: audioMatch[1] };
  }
  
  // Update messages without audio tags
  if (cleanChunk) {
    // Update messages with accumulated response
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        const lastMessage = newMessages[newMessages.length - 1];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: lastMessage.content + cleanChunk
        };
      }
      return newMessages;
    });
  }
  
  return { shouldContinue: false };
};

// Queue for managing audio playback
let audioQueue: string[] = [];
let isPlaying = false;

export const queueAudioPlayback = async (base64Audio: string) => {
  audioQueue.push(base64Audio);
  
  if (!isPlaying) {
    await processAudioQueue();
  }
};

const processAudioQueue = async () => {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }
  
  isPlaying = true;
  const nextAudio = audioQueue.shift();
  
  if (nextAudio) {
    try {
      await playAudioData(nextAudio);
    } catch (error) {
      console.error('Error playing queued audio:', error);
    }
    await processAudioQueue();
  }
}; 
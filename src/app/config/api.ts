export const API_CONFIG = {
  AUDIO: {
    MAX_DURATION_SECONDS: 60,
    SAMPLE_RATE: 16000,
    BITS_PER_SECOND: 32000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
  MODELS: {
    WHISPER: 'whisper-1',
    CHAT: 'gpt-3.5-turbo', // Using a cheaper model than GPT-4
    TTS: 'tts-1',
  },
}; 
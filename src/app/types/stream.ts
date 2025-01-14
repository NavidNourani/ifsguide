export interface StreamChunk {
  type: 'transcription' | 'text' | 'voice';
  content: string;
} 
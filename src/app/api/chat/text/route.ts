import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Get streaming completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages.map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true,
    });

    // Create a transform stream to collect the full response
    const textEncoder = new TextEncoder();
    let fullResponse = '';

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        try {
          // Convert chunk to string and remove "data: " prefix
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            // Skip "data: [DONE]" messages
            if (line === 'data: [DONE]') continue;
            
            // Remove "data: " prefix and parse JSON
            const jsonString = line.replace(/^data: /, '');
            const data = JSON.parse(jsonString);
            
            const content = data.choices[0]?.delta?.content || '';
            fullResponse += content;
            controller.enqueue(textEncoder.encode(content));
          }
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      },
      async flush(controller) {
        // After text streaming is done, generate and stream audio
        try {
          const speechResponse = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: fullResponse,
          });

          const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
          const audioBase64 = audioBuffer.toString('base64');
          
          // Send audio data as a special message
          controller.enqueue(textEncoder.encode(`\n<AUDIO>${audioBase64}</AUDIO>`));
        } catch (error) {
          console.error('Error generating speech:', error);
        }
      }
    });

    // Create readable stream from completion
    const stream = completion.toReadableStream();
    
    // Pipe through transform stream
    const transformedStream = stream.pipeThrough(transformStream);
    
    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
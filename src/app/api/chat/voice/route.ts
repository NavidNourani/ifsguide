import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function splitIntoSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

export async function POST(req: Request) {
  // Create a readable stream that we can write to
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await req.formData();
        const audioFile = formData.get('audioData') as File;
        
        if (!audioFile) {
          controller.close();
          return NextResponse.json(
            { error: 'No audio file provided' },
            { status: 400 }
          );
        }

        const writeToStream = (marker: string, content: string) => {
          controller.enqueue(new TextEncoder().encode(`${marker}\n${content}\n`));
        };

        // Convert the audio file to a buffer
        const bytes = await audioFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Convert speech to text
        const transcription = await openai.audio.transcriptions.create({
          file: new File([buffer], 'audio.wav', { type: 'audio/wav' }),
          model: "whisper-1",
        });

        // Send transcription immediately
        writeToStream('$transcript:', transcription.text);

        // Get streaming completion
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { 
              role: "user", 
              content: transcription.text 
            }
          ],
          stream: true,
        });

        let fullResponse = '';

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullResponse += text;
            writeToStream('$text:', text);

            // Check if we have a complete sentence
            const sentences = splitIntoSentences(fullResponse);
            if (sentences.length > 0 && fullResponse.match(/[.!?]$/)) {
              const lastSentence = sentences[sentences.length - 1];
              try {
                const speechResponse = await openai.audio.speech.create({
                  model: "tts-1",
                  voice: "alloy",
                  input: lastSentence.trim(),
                });

                const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
                const audioBase64 = audioBuffer.toString('base64');
                writeToStream('$voice:', audioBase64);
                
                // Reset fullResponse to any remaining text after the last sentence
                fullResponse = fullResponse.slice(lastSentence.length);
              } catch (error) {
                console.error('Error generating speech:', error);
                writeToStream('$error:', 'Error generating speech');
              }
            }
          }
        }

        controller.close();
      } catch (error) {
        console.error('Error:', error);
        controller.enqueue(new TextEncoder().encode('$error:\nInternal server error\n'));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
}; 
import { GoogleGenAI } from "@google/genai";
import { Message, Sender, Persona } from '../types';

// Initialize the client
// The API key must be provided via the environment variable process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Helper to delay execution
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a streaming response for a specific persona based on chat history.
 * Includes retry logic for robustness.
 */
export const streamBotResponse = async (
  persona: Persona,
  chatHistory: Message[],
  onChunk: (text: string) => void
): Promise<string> => {
  let fullText = '';
  let lastError: any = null;

  const model = 'gemini-2.5-flash';
  
  // Transform chat history into the format Gemini expects
  const recentHistory = chatHistory.slice(-15);
  const contents = recentHistory.map(msg => ({
    role: msg.sender === Sender.USER ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  // Retry Loop
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create a timeout to ensure we don't hang indefinitely
      // Increased to 30s to handle high load scenarios
      const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Connection timed out")), 30000);
      });

      const streamPromise = ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: {
          systemInstruction: persona.systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 400, 
        }
      });

      // Race against timeout for the initial connection
      const responseStream = await Promise.race([streamPromise, timeoutPromise]) as any;

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          onChunk(fullText);
        }
      }
      
      // Fallback: If the stream finished but produced no text
      if (!fullText) {
          // If it was a safety block, it might not throw, but returns empty.
          // We can't really retry this as the content is blocked.
          const fallback = "*[The model remained silent. This may be due to safety filters.]*";
          onChunk(fallback);
          return fallback;
      }
      
      // Success! Return the text.
      return fullText;

    } catch (error: any) {
      console.warn(`Attempt ${attempt + 1} failed for ${persona.name}:`, error);
      lastError = error;

      // Check if we should retry
      const isRetryable = 
        error.message?.includes('429') || // Rate limit
        error.message?.includes('503') || // Service unavailable
        error.message?.includes('500') || // Internal server error
        error.message?.includes('fetch') || // Network error
        error.message?.includes('timed out'); // Timeout

      if (isRetryable && attempt < MAX_RETRIES) {
        // Calculate backoff: 2s, 4s, 8s
        const waitTime = RETRY_DELAY_MS * Math.pow(2, attempt);
        // Inform user via chunk if it's taking a while
        if (attempt === 0) {
             onChunk(fullText + " ... [Network congestion, retrying] ...");
        }
        await delay(waitTime);
        continue;
      }
      
      // If we run out of retries or it's a fatal error, break loop
      break;
    }
  }

  // If we get here, all retries failed.
  console.error(`Final error for ${persona.name}:`, lastError);
  
  // Provide specific, user-friendly error messages based on the LAST error
  let errorSuffix = "";
  
  if (lastError?.message?.includes('429')) {
      errorSuffix = "\n\n*[System: High traffic. Rate limit exceeded.]*";
  } else if (lastError?.message?.includes('timed out')) {
      errorSuffix = "\n\n*[System: Connection timed out.]*";
  } else {
      errorSuffix = `\n\n*[System: Connection failed (${lastError?.message || 'Unknown error'})]*`;
  }

  // If we have partial text, append the error. If empty, show just the error.
  const finalContent = fullText ? (fullText + errorSuffix) : errorSuffix;

  onChunk(finalContent);
  return finalContent;
};
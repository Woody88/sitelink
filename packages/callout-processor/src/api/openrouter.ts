/**
 * OpenRouter API client for Gemini models
 */

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
}

export async function callOpenRouter(
  prompt: string,
  images: string[], // base64 data URLs
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable not set");
  }

  const model = options.model || "google/gemini-2.5-flash";
  const temperature = options.temperature ?? 0;

  // Retry logic (3 attempts)
  let lastError: Error | null = null;
  const timeoutMs = 60000; // 60 second timeout
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/plan-ocr",
          "X-Title": "Plan OCR Detection"
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map(img => ({ 
                type: "image_url", 
                image_url: { url: img } 
              }))
            ]
          }],
          temperature
        })
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content in OpenRouter response");
      }

      return content;
    } catch (error: any) {
      lastError = error;
      if (error.name === 'AbortError') {
        throw new Error(`OpenRouter API request timed out after ${timeoutMs}ms`);
      }
      if (attempt < 3) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(`OpenRouter API failed after 3 attempts: ${lastError?.message}`);
}


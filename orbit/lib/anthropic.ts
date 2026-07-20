/**
 * LLM client — IBM ICA (watsonx) drop-in replacement for Anthropic.
 * Exposes the same callLLM / callLLMStream interface so no routes need changing.
 *
 * IBM ICA base URL:  https://nextgen-beta.ica.ibm.com/ica/services/apis
 * Auth header:       ZenApiKey <your-api-key>
 * Model IDs:         e.g. "mistralai/mistral-large" or "ibm/granite-13b-chat-v2"
 */

const ICA_BASE_URL = process.env.ICA_BASE_URL ?? 'https://nextgen-beta.ica.ibm.com/ica/services/apis';
const ICA_API_KEY  = process.env.ICA_API_KEY ?? '';
const DEFAULT_MODEL = process.env.ICA_MODEL ?? 'mistralai/mistral-large';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ICA_API_KEY}`,
  };
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function icaChat(
  messages: Message[],
  options?: { model?: string; maxTokens?: number; temperature?: number; stream?: boolean }
): Promise<Response> {
  const res = await fetch(`${ICA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: options?.model ?? DEFAULT_MODEL,
      messages,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: options?.stream ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ICA API error ${res.status}: ${text}`);
  }

  return res;
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<string> {
  const res = await icaChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    { ...options, stream: false }
  );

  const json = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return json.choices[0]?.message?.content ?? '';
}

export async function callLLMStream(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<ReadableStream> {
  const res = await icaChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    { ...options, stream: true }
  );

  const encoder = new TextEncoder();
  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // ICA returns OpenAI-style SSE: "data: {...}\n\n"
          const lines = chunk.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
          for (const line of lines) {
            try {
              const json = JSON.parse(line.slice('data: '.length)) as {
                choices: Array<{ delta: { content?: string } }>;
              };
              const text = json.choices[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // skip malformed lines
            }
          }
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

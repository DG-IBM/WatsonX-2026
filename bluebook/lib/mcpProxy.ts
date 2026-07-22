/**
 * Client-side MCP helper.
 *
 * Calls /api/mcp/proxy (same-origin, no CORS) which forwards to the MCP gateway.
 * The gateway does not send CORS headers so direct browser fetch is blocked.
 */

import type { MCPDocument } from '@/types/bluebook';

/** Extract context_id from a Context Studio JWT without signature verification */
export function extractContextId(apiKey: string): string {
  try {
    const payload = apiKey.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.contextId ?? decoded.context_id ?? '';
  } catch {
    return '';
  }
}

/** Call context-broker-hybrid-query via the server-side proxy */
async function callHybridQuery(
  url: string,
  token: string,
  apiKey: string,
  query: string,
  topK = 6,
): Promise<string> {
  const contextId = extractContextId(apiKey);
  if (!contextId) return '';

  const res = await fetch('/api/mcp/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      token,
      body: {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'context-broker-hybrid-query',
          arguments: {
            context_id: contextId,
            AgentPersona: 'OnboardingAssistant',
            query,
            sources: ['vector'],
            vector_params: { top_k: topK },
            'x-api-key': apiKey,
          },
        },
      },
    }),
  });

  if (!res.ok) return '';

  const json = await res.json() as {
    result?: { content?: Array<{ text?: string }> };
    error?: string;
  };

  if (json.error) {
    console.warn('[mcpProxy] tool error:', json.error);
    return '';
  }

  const content = json.result?.content;
  if (!Array.isArray(content)) return '';
  const rawText = content.map(c => c.text ?? '').join('\n');
  if (!rawText.trim()) return '';

  // Parse the inner JSON the context-broker wraps results in
  try {
    const inner = JSON.parse(rawText) as {
      items?: {
        vector?: Array<{ content?: string; metadata?: { title?: string; source_file?: string } }>;
      };
    };
    return (inner.items?.vector ?? [])
      .map(item => {
        const title = item.metadata?.title ?? item.metadata?.source_file ?? '';
        const body  = item.content ?? '';
        return title ? `[${title}]\n${body}` : body;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
  } catch {
    return rawText;
  }
}

/**
 * Fetch broad project knowledge for the architect phase.
 * Runs 4 parallel queries and returns them as MCPDocument[].
 */
export async function fetchProjectDocs(
  url: string,
  token: string,
  apiKey: string,
  roleDescription: string,
): Promise<MCPDocument[]> {
  if (!url || !token || !apiKey) return [];

  const queries = [
    'project overview purpose goals architecture',
    'team structure roles responsibilities contacts',
    `${roleDescription.slice(0, 120)} workflows processes`,
    'risks technical debt deployment testing',
  ];

  const results = await Promise.allSettled(
    queries.map((q, i) =>
      callHybridQuery(url, token, apiKey, q, 6).then(content =>
        content
          ? ({ id: `ctx-${i}`, source: 'Context Studio', title: q, content, metadata: { query: q } } as MCPDocument)
          : null
      )
    )
  );

  const docs: MCPDocument[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) docs.push(r.value);
  }
  console.log(`[mcpProxy] fetchProjectDocs → ${docs.length} docs`);
  return docs;
}

/**
 * Query Context Studio for a single chat question.
 * Returns extracted text chunks as a single string.
 */
export async function queryForChat(
  url: string,
  token: string,
  apiKey: string,
  question: string,
): Promise<string> {
  if (!url || !token || !apiKey) return '';
  const result = await callHybridQuery(url, token, apiKey, question, 8);
  console.log(`[mcpProxy] queryForChat "${question.slice(0, 50)}" → ${result.length} chars`);
  return result;
}

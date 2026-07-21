import { NextRequest, NextResponse } from 'next/server';
import { callLLMStream } from '@/lib/anthropic';
import { CHAT_SYSTEM } from '@/lib/prompts';
import type { Planet, UserProfile, MCPDocument, ChatMessage } from '@/types/bluebook';

// Allow this route handler up to 60 seconds — MCP query + LLM stream can be slow
export const maxDuration = 60;

const CHAT_MODEL = process.env.ICA_CHAT_MODEL ?? process.env.ICA_MODEL;

/**
 * Decode the context_id from the Context Studio JWT without verifying the signature.
 * The JWT payload contains { contextId: "ctx_..." }.
 */
function extractContextId(apiKey: string): string {
  try {
    const payload = apiKey.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.contextId ?? decoded.context_id ?? '';
  } catch {
    return '';
  }
}

/**
 * Call context-broker-hybrid-query on the MCP gateway.
 * Returns extracted text chunks as a single string.
 */
async function queryContextBroker(
  question: string,
  url: string,
  token: string,
  apiKey: string,
): Promise<string> {
  if (!url || !token || !apiKey) return '';

  const contextId = extractContextId(apiKey);
  if (!contextId) {
    console.warn('[chat/queryContextBroker] could not extract contextId from apiKey');
    return '';
  }

  const rawToken = token.replace(/^Bearer\s+/i, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${rawToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'context-broker-hybrid-query',
          arguments: {
            context_id: contextId,
            AgentPersona: 'OnboardingAssistant',
            query: question,
            sources: ['vector'],
            vector_params: { top_k: 8 },
            'x-api-key': apiKey,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[chat/queryContextBroker] HTTP ${res.status}`);
      return '';
    }

    // May be SSE or plain JSON
    const contentType = res.headers.get('content-type') ?? '';
    let result: unknown;

    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
      if (!lines.length) return '';
      result = JSON.parse(lines[lines.length - 1].slice('data: '.length));
    } else {
      result = await res.json();
    }

    // Extract text from jsonrpc result.content[].text
    const content = (result as { result?: { content?: Array<{ text?: string }> } })?.result?.content;
    if (!Array.isArray(content)) return '';
    const rawText = content.map(c => c.text ?? '').join('\n');

    // Parse the inner JSON payload that context-broker returns as a text string
    try {
      const inner = JSON.parse(rawText) as {
        items?: { vector?: Array<{ content?: string; metadata?: { title?: string } }>; graph?: Array<{ content?: string; metadata?: { title?: string } }> };
      };
      const chunks: string[] = [];
      for (const src of ['vector', 'graph'] as const) {
        for (const item of inner.items?.[src] ?? []) {
          const title = item.metadata?.title ?? '';
          const body  = item.content ?? '';
          if (body) chunks.push(title ? `[${title}]\n${body}` : body);
        }
      }
      const joined = chunks.join('\n\n---\n\n');
      console.log(`[chat/queryContextBroker] contextId=${contextId} → ${chunks.length} chunks, ${joined.length} chars`);
      return joined;
    } catch {
      // Not JSON — return raw text
      console.log(`[chat/queryContextBroker] raw text response, ${rawText.length} chars`);
      return rawText;
    }
  } catch (err) {
    console.error('[chat/queryContextBroker] error:', err);
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      message: string;
      chatHistory: ChatMessage[];
      userProfile: UserProfile;
      completedPlanets: Planet[];
      completedNodes?: Planet[];
      documents: MCPDocument[];
      liveKnowledge?: string;
      mcpUrl?: string;
      mcpToken?: string;
      mcpApiKey?: string;
      selectedNode?: Planet | null;
    };

    const { message, chatHistory, userProfile, completedPlanets, completedNodes, selectedNode, documents } = body;
    const resolvedCompleted = completedNodes ?? completedPlanets ?? [];

    if (!message || !userProfile) {
      return NextResponse.json({ error: 'message and userProfile are required' }, { status: 400 });
    }

    // Use client-fetched knowledge if available; fall back to server-side query
    let liveKnowledge = body.liveKnowledge ?? '';
    if (!liveKnowledge) {
      const mcpUrl    = body.mcpUrl    ?? '';
      const mcpToken  = body.mcpToken  ?? '';
      const mcpApiKey = body.mcpApiKey ?? '';
      liveKnowledge = await queryContextBroker(message, mcpUrl, mcpToken, mcpApiKey);
    }
    console.log(`[chat] liveKnowledge: ${liveKnowledge.length} chars (clientDocs=${(documents ?? []).length} completedNodes=${resolvedCompleted.length})`);

    // Build history string
    const historyText = chatHistory
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // Enriched node knowledge — full summaries + takeaways from completed nodes
    const enrichedNodeContext = resolvedCompleted
      .filter((p): p is Planet & { summary: string } => !!(p as { summary?: string }).summary)
      .map(p => {
        const node = p as { title?: string; name?: string; summary?: string; keyTakeaways?: string[]; roleRelevance?: string; keyContacts?: Array<{ name: string; role: string }> };
        const title = node.title ?? node.name ?? 'Unknown';
        const takeaways = (node.keyTakeaways ?? []).map(t => `  • ${t}`).join('\n');
        const contacts = (node.keyContacts ?? []).map(c => `  • ${c.name} (${c.role})`).join('\n');
        return [
          `TOPIC: ${title}`,
          node.summary ? `Summary: ${node.summary}` : '',
          takeaways ? `Key Takeaways:\n${takeaways}` : '',
          node.roleRelevance ? `Role Relevance: ${node.roleRelevance}` : '',
          contacts ? `Key Contacts:\n${contacts}` : '',
        ].filter(Boolean).join('\n');
      })
      .join('\n\n---\n\n');

    // Client-supplied documents (architect phase, if any)
    const clientDocContext = (documents ?? [])
      .slice(0, 6)
      .map(d => `SOURCE: ${d.title}\n${d.content.slice(0, 600)}`)
      .join('\n---\n');

    // Combine all knowledge sources
    const knowledgeContext = [
      liveKnowledge     ? `RELEVANT PROJECT KNOWLEDGE (live search):\n${liveKnowledge}` : '',
      clientDocContext  ? `PROJECT DOCUMENTS:\n${clientDocContext}` : '',
      enrichedNodeContext ? `ONBOARDING KNOWLEDGE MAP (what this person has already studied):\n${enrichedNodeContext}` : '',
    ].filter(Boolean).join('\n\n===\n\n');

    console.log(`[chat] knowledgeContext total: ${knowledgeContext.length} chars`);

    const nodeContextStr = selectedNode
      ? `\nCURRENTLY VIEWING TOPIC: "${(selectedNode as { title?: string; name?: string }).title ?? (selectedNode as { title?: string; name?: string }).name}"\n`
      : '';

    const userPrompt = `TEAM MEMBER:
- Role: ${userProfile.parsedRole}
- Experience: ${userProfile.experience ?? userProfile.experienceLevel ?? 'Not specified'}
${nodeContextStr}
KNOWLEDGE BASE:
${knowledgeContext || 'No project documentation available yet. Answer based on the role and general best practices, but be clear that you are working from general knowledge.'}

CONVERSATION HISTORY:
${historyText}

QUESTION: ${message}`;

    const stream = await callLLMStream(CHAT_SYSTEM, userPrompt, {
      maxTokens: 2048,
      ...(CHAT_MODEL ? { model: CHAT_MODEL } : {}),
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    );
  }
}

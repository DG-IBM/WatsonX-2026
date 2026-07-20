import { NextRequest, NextResponse } from 'next/server';
import { callLLMStream } from '@/lib/anthropic';
import { CHAT_SYSTEM } from '@/lib/prompts';
import type { Planet, UserProfile, MCPDocument, ChatMessage } from '@/types/orbit';

const MCP_URL     = process.env.NEXT_PUBLIC_MCP_URL ?? '';
const MCP_TOKEN   = process.env.NEXT_PUBLIC_MCP_TOKEN ?? '';
const MCP_API_KEY = process.env.NEXT_PUBLIC_MCP_API_KEY ?? '';
const CONTEXT_ID  = process.env.NEXT_PUBLIC_CONTEXT_ID ?? '';

/** Query Context Studio hybrid endpoint directly and return relevant text */
async function queryContextStudio(question: string): Promise<string> {
  if (!MCP_URL || !MCP_TOKEN) return '';

  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${MCP_TOKEN}`,
        ...(MCP_API_KEY ? { 'x-api-key': MCP_API_KEY } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'context-broker-hybrid-query',
          arguments: {
            context_id: CONTEXT_ID,
            AgentPersona: 'OnboardingAssistant',
            query: question,
            sources: ['graph', 'vector'],
            vector_params: { top_k: 8 },
            graph_params: { max_depth: 1, limit: 5 },
          },
        },
      }),
    });

    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') ?? '';

    // Handle SSE response
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
      if (!lines.length) return '';
      const last = lines[lines.length - 1].slice('data: '.length);
      const json = JSON.parse(last);
      const content = json?.result?.content;
      if (Array.isArray(content)) return content.map((c: { text?: string }) => c.text ?? '').join('\n');
      return typeof content === 'string' ? content : '';
    }

    const json = await res.json();
    const content = json?.result?.content;
    if (Array.isArray(content)) return content.map((c: { text?: string }) => c.text ?? '').join('\n');
    return typeof content === 'string' ? content : '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      message: string;
      chatHistory: ChatMessage[];
      userProfile: UserProfile;
      completedPlanets: Planet[];
      documents: MCPDocument[];
      mcpUrl?: string;
      mcpToken?: string;
    };

    const { message, chatHistory, userProfile, completedPlanets } = body;

    if (!message || !userProfile) {
      return NextResponse.json({ error: 'message and userProfile are required' }, { status: 400 });
    }

    // Query Context Studio for relevant knowledge about this question
    const contextKnowledge = await queryContextStudio(message);

    // Build history string
    const historyText = chatHistory
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Nova'}: ${m.content}`)
      .join('\n');

    // Build completed planets summary
    const completedSummary = completedPlanets.length > 0
      ? completedPlanets.map(p => `- ${p.name}: ${p.subtitle}`).join('\n')
      : 'None yet';

    const userPrompt = `You are CDR Nova, an expert onboarding assistant for the Helios Smart Energy Grid platform at Lumina Energy.
You have deep knowledge of the project and help new team members understand the codebase, team structure, architecture, and processes.

TEAM MEMBER:
- Role: ${userProfile.parsedRole}
- Experience level: ${userProfile.experienceLevel}

COMPLETED ONBOARDING TOPICS:
${completedSummary}

RELEVANT PROJECT KNOWLEDGE (retrieved from the Helios knowledge base):
${contextKnowledge || 'No specific context retrieved — answer from general knowledge about the project.'}

CONVERSATION HISTORY:
${historyText}

USER QUESTION: ${message}

Answer directly and specifically using the retrieved knowledge above. Be concrete — name actual team members, services, files, and processes from the Helios codebase. If the knowledge base contains the answer, use it. Keep your response concise and helpful.`;

    const stream = await callLLMStream(CHAT_SYSTEM, userPrompt, {
      maxTokens: 2048,
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

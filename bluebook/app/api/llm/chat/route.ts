import { NextRequest, NextResponse } from 'next/server';
import { callLLMStream } from '@/lib/anthropic';
import { CHAT_SYSTEM } from '@/lib/prompts';
import type { Planet, UserProfile, MCPDocument, ChatMessage } from '@/types/bluebook';

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
      completedNodes?: Planet[];
      documents: MCPDocument[];
      mcpUrl?: string;
      mcpToken?: string;
      selectedNode?: Planet | null;
    };

    const { message, chatHistory, userProfile, completedPlanets, completedNodes, selectedNode } = body;
    const resolvedCompleted = completedNodes ?? completedPlanets ?? [];

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

    // Build completed topics summary
    const completedSummary = resolvedCompleted.length > 0
      ? resolvedCompleted.map(p => `- ${(p as { title?: string; name?: string }).title ?? (p as { title?: string; name?: string }).name ?? 'Unknown'}`).join('\n')
      : 'None yet';

    const nodeContextStr = selectedNode
      ? `\nCURRENTLY VIEWING TOPIC: "${(selectedNode as { title?: string; name?: string }).title ?? (selectedNode as { title?: string; name?: string }).name}"\n`
      : '';

    const userPrompt = `You are Mission Control — an expert onboarding assistant with deep knowledge of this project. You help new team members understand the project's codebase, architecture, team structure, and processes.

TEAM MEMBER:
- Role: ${userProfile.parsedRole}
- Experience: ${userProfile.experience ?? userProfile.experienceLevel ?? 'Not specified'}

COMPLETED KNOWLEDGE TOPICS:
${completedSummary}
${nodeContextStr}
RELEVANT PROJECT KNOWLEDGE:
${contextKnowledge || 'No specific context retrieved — answer from general knowledge about the project.'}

CONVERSATION HISTORY:
${historyText}

QUESTION: ${message}

Answer directly and specifically using the retrieved knowledge above. Be concrete — name actual team members, services, files, and processes. Keep your response concise and helpful. If the knowledge base contains the answer, use it.`;

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

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/anthropic';
import { buildArchitectPrompt, ARCHITECT_SYSTEM } from '@/lib/prompts';
import type { MCPDocument, KnowledgeNode, UserProfile, OnboardingBriefingCard } from '@/types/orbit';
import { v4 as uuidv4 } from 'uuid';

const MCP_URL     = process.env.NEXT_PUBLIC_MCP_URL ?? '';
const MCP_TOKEN   = process.env.NEXT_PUBLIC_MCP_TOKEN ?? '';
const MCP_API_KEY = process.env.NEXT_PUBLIC_MCP_API_KEY ?? '';
const CONTEXT_ID  = process.env.NEXT_PUBLIC_CONTEXT_ID ?? '';

/** Query Context Studio via tools/call and return raw text */
async function queryContextStudio(query: string): Promise<string> {
  if (!MCP_URL || !MCP_TOKEN || !CONTEXT_ID) return '';

  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
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
            AgentPersona: 'OnboardingArchitect',
            query,
            sources: ['graph', 'vector'],
            vector_params: { top_k: 8 },
            graph_params: { max_depth: 1, limit: 4 },
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return '';

    const contentType = res.headers.get('content-type') ?? '';

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

/** Fetch project knowledge — 4 broad queries run in parallel */
async function fetchDocumentsFromContextStudio(roleDescription: string): Promise<MCPDocument[]> {
  const queries = [
    'project overview purpose goals architecture',
    'team structure roles responsibilities contacts',
    `${roleDescription.slice(0, 120)} workflows processes`,
    'risks technical debt deployment testing',
  ];

  const results = await Promise.allSettled(queries.map(q => queryContextStudio(q)));

  const documents: MCPDocument[] = [];
  const seen = new Set<string>();

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value.trim()) {
      const content = result.value.trim();
      if (!seen.has(content)) {
        seen.add(content);
        documents.push({
          id: `ctx-${i}`,
          source: 'Context Studio',
          title: queries[i],
          content,
          metadata: { query: queries[i] },
        });
      }
    }
  });

  return documents;
}

const DEFAULT_COLORS = [
  '#4a9eff', '#9b59b6', '#00b894', '#f4a460',
  '#cc3300', '#1a6b8a', '#ffb400', '#e74c3c',
  '#27ae60', '#6c5ce7',
];
const DEFAULT_EMISSIVE = [
  '#2255aa', '#6c3483', '#007a5e', '#b8620a',
  '#8b0000', '#0e3d50', '#a07800', '#8b0000',
  '#1a7a3c', '#4834a8',
];

function makeVisualConfig(idx: number, total: number, color?: string, emissiveColor?: string): KnowledgeNode['visualConfig'] {
  return {
    size: 1.0,
    color: color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    emissiveColor: emissiveColor ?? DEFAULT_EMISSIVE[idx % DEFAULT_EMISSIVE.length],
    orbitRadius: 4 + (idx / Math.max(total - 1, 1)) * 10,
    orbitSpeed: 0.008 - (idx / Math.max(total - 1, 1)) * 0.005,
  };
}

/** Strip markdown code fences from LLM output */
const stripFences = (s: string) =>
  s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

// ── Skeleton node shape returned from Phase 1 ─────────────────────────────────
interface SkeletonNode {
  id?: string;
  title: string;
  description?: string;
  order?: number;
  color?: string;
  emissiveColor?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      roleDescription: string;
      documents?: MCPDocument[];
    };

    const { roleDescription, documents: providedDocs } = body;

    if (!roleDescription) {
      return NextResponse.json({ error: 'roleDescription is required' }, { status: 400 });
    }

    // Fetch docs (parallel, fast)
    let documents: MCPDocument[] = providedDocs ?? [];
    if (documents.length === 0) {
      documents = await fetchDocumentsFromContextStudio(roleDescription);
    }

    // Phase 1 — skeleton only (~2,000 output tokens)
    const userPrompt = buildArchitectPrompt(roleDescription, documents);
    let rawResponse = await callLLM(ARCHITECT_SYSTEM, userPrompt, {
      maxTokens: 3000,
      temperature: 0.6,
    });

    let parsed: {
      userProfile: UserProfile;
      onboardingBriefingCard?: OnboardingBriefingCard;
      nodes: SkeletonNode[];
    };

    try {
      parsed = JSON.parse(stripFences(rawResponse));
    } catch {
      // One repair attempt with a tiny prompt
      const fixPrompt = `Fix this malformed JSON. Return only valid JSON, nothing else:\n\n${rawResponse.slice(0, 8000)}`;
      rawResponse = await callLLM(
        'You fix malformed JSON. Return only the fixed JSON, nothing else.',
        fixPrompt,
        { maxTokens: 3500 }
      );
      parsed = JSON.parse(stripFences(rawResponse));
    }

    const rawNodes: SkeletonNode[] = parsed.nodes ?? [];
    const totalNodes = rawNodes.length;

    // Build skeleton KnowledgeNodes — empty quiz/summary/etc., enriched later
    const skeletonNodes: KnowledgeNode[] = rawNodes.map((node, idx) => ({
      id: node.id || uuidv4(),
      title: node.title,
      summary: node.description ?? '',
      keyTakeaways: [],
      roleRelevance: '',
      diagrams: [],
      keyContacts: [],
      links: [],
      sources: [],
      quiz: { questions: [] },
      status: 'untouched' as const,
      score: null,
      order: node.order ?? idx + 1,
      visualConfig: makeVisualConfig(idx, totalNodes, node.color, node.emissiveColor),
    }));

    return NextResponse.json({
      nodes: skeletonNodes,
      planets: skeletonNodes,
      userProfile: parsed.userProfile,
      onboardingBriefingCard: parsed.onboardingBriefingCard ?? null,
      documents,
    });
  } catch (err) {
    console.error('[architect]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Architect failed' },
      { status: 500 }
    );
  }
}

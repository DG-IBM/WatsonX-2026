import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/anthropic';
import { buildArchitectPrompt, ARCHITECT_SYSTEM } from '@/lib/prompts';
import type { MCPDocument, KnowledgeNode, UserProfile, OnboardingBriefingCard } from '@/types/bluebook';
import { v4 as uuidv4 } from 'uuid';

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

    // Documents are fetched client-side and passed in — no server-side MCP needed
    const documents: MCPDocument[] = providedDocs ?? [];

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

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/anthropic';
import { buildEnrichNodePrompt, ENRICH_NODE_SYSTEM } from '@/lib/prompts';
import type { MCPDocument, KnowledgeNode } from '@/types/bluebook';
import { v4 as uuidv4 } from 'uuid';

const stripFences = (s: string) =>
  s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

interface EnrichResult {
  summary: string;
  keyTakeaways: string[];
  roleRelevance: string;
  diagrams: KnowledgeNode['diagrams'];
  keyContacts: KnowledgeNode['keyContacts'];
  links: KnowledgeNode['links'];
  sources: KnowledgeNode['sources'];
  quiz: KnowledgeNode['quiz'];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      nodeId: string;
      nodeTitle: string;
      nodeDescription: string;
      roleDescription: string;
      documents: MCPDocument[];
    };

    const { nodeId, nodeTitle, nodeDescription, roleDescription, documents } = body;

    if (!nodeId || !nodeTitle || !roleDescription) {
      return NextResponse.json({ error: 'nodeId, nodeTitle and roleDescription are required' }, { status: 400 });
    }

    const userPrompt = buildEnrichNodePrompt(nodeTitle, nodeDescription, roleDescription, documents ?? []);

    let rawResponse = await callLLM(ENRICH_NODE_SYSTEM, userPrompt, {
      maxTokens: 2500,
      temperature: 0.6,
    });

    let enriched: EnrichResult;
    try {
      enriched = JSON.parse(stripFences(rawResponse));
    } catch {
      const fixPrompt = `Fix this malformed JSON. Return only valid JSON, nothing else:\n\n${rawResponse.slice(0, 6000)}`;
      rawResponse = await callLLM(
        'You fix malformed JSON. Return only the fixed JSON, nothing else.',
        fixPrompt,
        { maxTokens: 2800 }
      );
      enriched = JSON.parse(stripFences(rawResponse));
    }

    // Ensure quiz question ids are unique
    const questions = (enriched.quiz?.questions ?? []).map((q, i) => ({
      ...q,
      id: q.id || uuidv4(),
      // Guarantee exactly 4 options for multiple_choice
      options: q.type === 'true_false'
        ? [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }]
        : (q.options?.length === 4 ? q.options : [
            { id: 'a', text: q.options?.[0]?.text ?? 'Option A' },
            { id: 'b', text: q.options?.[1]?.text ?? 'Option B' },
            { id: 'c', text: q.options?.[2]?.text ?? 'Option C' },
            { id: 'd', text: q.options?.[3]?.text ?? 'Option D' },
          ]),
    }));

    return NextResponse.json({
      nodeId,
      summary: enriched.summary ?? '',
      keyTakeaways: Array.isArray(enriched.keyTakeaways) ? enriched.keyTakeaways : [],
      roleRelevance: enriched.roleRelevance ?? '',
      diagrams: Array.isArray(enriched.diagrams) ? enriched.diagrams : [],
      keyContacts: Array.isArray(enriched.keyContacts) ? enriched.keyContacts : [],
      links: Array.isArray(enriched.links) ? enriched.links : [],
      sources: Array.isArray(enriched.sources) ? enriched.sources : [],
      quiz: { questions },
    });
  } catch (err) {
    console.error('[enrich-node]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Enrichment failed' },
      { status: 500 }
    );
  }
}

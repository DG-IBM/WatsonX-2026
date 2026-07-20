import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/anthropic';
import { buildArchitectPrompt, ARCHITECT_SYSTEM } from '@/lib/prompts';
import { validateAndNormalisePlanetConfig } from '@/lib/planetConfig';
import type { MCPDocument, Planet, UserProfile } from '@/types/orbit';
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
            vector_params: { top_k: 10 },
            graph_params: { max_depth: 1, limit: 5 },
          },
        },
      }),
      signal: AbortSignal.timeout(20000),
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

/** Fetch comprehensive project knowledge from Context Studio for a given role */
async function fetchDocumentsFromContextStudio(roleDescription: string): Promise<MCPDocument[]> {
  const queries = [
    `project overview purpose vision goals`,
    `architecture technical stack infrastructure`,
    `team structure roles responsibilities contacts`,
    `${roleDescription} workflows processes`,
    `risks known issues technical debt`,
    `deployment pipelines CI/CD testing`,
    `codebase conventions standards patterns`,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      roleDescription: string;
      mcpUrl: string;
      mcpToken: string;
      mcpApiKey?: string;
      documents?: MCPDocument[];
    };

    const { roleDescription, documents: providedDocs } = body;

    if (!roleDescription) {
      return NextResponse.json({ error: 'roleDescription is required' }, { status: 400 });
    }

    // Use provided documents if already cached, otherwise fetch from Context Studio
    let documents: MCPDocument[] = providedDocs ?? [];
    if (documents.length === 0) {
      documents = await fetchDocumentsFromContextStudio(roleDescription);
    }

    // Build and call LLM
    const userPrompt = buildArchitectPrompt(roleDescription, documents);

    let rawResponse = await callLLM(ARCHITECT_SYSTEM, userPrompt, {
      maxTokens: 8000,
      temperature: 0.7,
    });

    // Strip markdown code fences if the model wrapped the JSON
    const stripFences = (s: string) =>
      s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Parse JSON — retry once on failure
    let parsed: { userProfile: UserProfile; planets: Planet[] };
    try {
      parsed = JSON.parse(stripFences(rawResponse));
    } catch {
      const fixPrompt = `The following text contains JSON wrapped in markdown code fences or is malformed. Strip the fences and return only valid JSON, nothing else:\n\n${rawResponse}`;
      rawResponse = await callLLM(
        'You extract and fix JSON. Strip any markdown code fences. Return only valid JSON, nothing else.',
        fixPrompt,
        { maxTokens: 8000 }
      );
      parsed = JSON.parse(stripFences(rawResponse));
    }

    // Validate and normalise visual configs
    const totalPlanets = parsed.planets.length;
    const normalisedPlanets: Planet[] = parsed.planets.map((planet, idx) => ({
      ...planet,
      id: planet.id || uuidv4(),
      status: idx === 0 ? 'available' : (planet.status === 'completed' ? 'completed' : 'locked'),
      visualConfig: validateAndNormalisePlanetConfig(
        planet.visualConfig,
        idx + 1,
        totalPlanets
      ),
      debrief: null,
      xpAwarded: 0,
    }));

    return NextResponse.json({
      planets: normalisedPlanets,
      userProfile: parsed.userProfile,
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

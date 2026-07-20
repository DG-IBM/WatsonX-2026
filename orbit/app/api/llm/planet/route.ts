import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/anthropic';
import { buildDebriefPrompt, DEBRIEF_SYSTEM } from '@/lib/prompts';
import { selectRelevantDocuments } from '@/lib/gameUtils';
import type { Planet, UserProfile, MCPDocument, Debrief } from '@/types/orbit';
import { formatUserResponse } from '@/lib/gameUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      planet: Planet;
      userResponse: string;
      userProfile: UserProfile;
      documents: MCPDocument[];
    };

    const { planet, userResponse, userProfile, documents } = body;

    if (!planet || !userResponse || !userProfile) {
      return NextResponse.json({ error: 'planet, userResponse and userProfile are required' }, { status: 400 });
    }

    // Select most relevant documents for this planet domain
    const relevantDocs = selectRelevantDocuments(
      documents,
      `${planet.name} ${planet.subtitle} ${planet.domainType}`,
      8
    );

    const formattedResponse = planet.challenge
      ? formatUserResponse({ ...planet.challenge, userResponse })
      : userResponse;

    const userPrompt = buildDebriefPrompt(planet, formattedResponse, userProfile, relevantDocs);

    const rawResponse = await callLLM(DEBRIEF_SYSTEM, userPrompt, {
      maxTokens: 2048,
      temperature: 0.7,
    });

    let debrief: Debrief;
    try {
      debrief = JSON.parse(rawResponse);
    } catch {
      // Fallback debrief if parsing fails
      debrief = {
        strengths: 'You engaged thoughtfully with this mission challenge.',
        gaps: "There's more to explore in this domain as you settle into the project.",
        deeperContext: 'The documentation for this area contains valuable context worth revisiting.',
        xpAwarded: 90,
        personalisation: `As a ${userProfile.parsedRole}, this domain will become clearer as you work with the codebase.`,
      };
    }

    // Ensure minimum XP
    debrief.xpAwarded = Math.max(60, debrief.xpAwarded ?? 90);

    return NextResponse.json({ debrief });
  } catch (err) {
    console.error('[planet debrief]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Debrief failed' },
      { status: 500 }
    );
  }
}

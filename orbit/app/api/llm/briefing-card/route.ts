import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/anthropic';
import type { KnowledgeNode, UserProfile, MCPDocument, MissionBriefingCard } from '@/types/orbit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      userProfile: UserProfile;
      completedPlanets: KnowledgeNode[];
      documents: MCPDocument[];
    };

    const { userProfile, completedPlanets, documents } = body;

    if (!userProfile) {
      return NextResponse.json({ error: 'userProfile is required' }, { status: 400 });
    }

    const nodesSummary = completedPlanets.map((n) => `- ${n.title}`).join('\n');
    const docContext = documents.map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 500)}\n---`).join('\n');

    const userPrompt = `ROLE: ${userProfile.parsedRole}
FOCUS: ${userProfile.parsedFocus.join(', ')}

COMPLETED KNOWLEDGE NODES:
${nodesSummary}

PROJECT DOCUMENTATION:
${docContext}

Generate a Mission Briefing Card as JSON matching this interface exactly:
{
  "projectSnapshot": "string — 3 sentences summarising the project",
  "roleAndOwnership": "string — what this person owns and is responsible for",
  "topPriorities": ["string", "string", "string"],
  "topRisks": ["string", "string", "string"],
  "keyContacts": [
    { "name": "string", "role": "string", "owns": "string" }
  ],
  "thingsNotToBreak": ["string", "string", "string"],
  "firstWeekFocus": "string — specific, actionable first week guidance"
}`;

    const rawResponse = await callLLM('You generate briefing cards. Return only valid JSON.', userPrompt, {
      maxTokens: 3000,
      temperature: 0.6,
    });

    let briefingCard: MissionBriefingCard;
    try {
      briefingCard = JSON.parse(rawResponse);
    } catch {
      briefingCard = {
        projectSnapshot: 'You have completed your full onboarding mission and explored all key knowledge domains.',
        roleAndOwnership: `As a ${userProfile.parsedRole}, you own your designated area and are now equipped to contribute.`,
        topPriorities: ['Review the project documentation thoroughly', 'Connect with your team leads', 'Identify your first contribution opportunity'],
        topRisks: ['Knowledge gaps in unexplored areas', 'Team dynamics to navigate', 'Technical debt in legacy systems'],
        keyContacts: [{ name: 'Your Tech Lead', role: 'Technical Lead', owns: 'Architecture decisions' }],
        thingsNotToBreak: ['Core authentication flow', 'Production deployment pipeline', 'Data integrity constraints'],
        firstWeekFocus: 'Shadow team members, review open PRs, and identify your first meaningful contribution.',
      };
    }

    return NextResponse.json({ briefingCard });
  } catch (err) {
    console.error('[briefing-card]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Briefing card generation failed' },
      { status: 500 }
    );
  }
}

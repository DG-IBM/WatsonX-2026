import type { MCPDocument, UserProfile, Planet, Challenge } from '@/types/orbit';

// ─── Architect Prompt ─────────────────────────────────────────────────────────

export const ARCHITECT_SYSTEM = `You are the Architect — the intelligence responsible for building an astronaut's
personalised solar system onboarding experience. You have access to a complete
project knowledge base. Your job is to read all project documentation and transform
it into a structured learning journey through a space exploration game.

CRITICAL: You must respond with ONLY raw valid JSON. No markdown code fences (no \`\`\`json). No backticks. No commentary before or after. The very first character of your response must be { and the very last must be }.`;

export function buildArchitectPrompt(
  roleDescription: string,
  documents: MCPDocument[]
): string {
  const totalChars = documents.reduce((acc, d) => acc + d.content.length, 0);
  const truncate = totalChars > 60000;

  const docSummary = documents
    .map((d) => {
      const content = truncate
        ? d.content.slice(0, 800) + (d.content.length > 800 ? '\n[truncated]' : '')
        : d.content;
      return `SOURCE: ${d.source} | TITLE: ${d.title}\n${content}\n---`;
    })
    .join('\n');

  return `You are building a personalised solar system for the following team member:

ROLE DESCRIPTION:
${roleDescription}

PROJECT KNOWLEDGE BASE:
${docSummary}

YOUR TASK:
Create a solar system of 5 to 8 planets. Each planet represents a distinct knowledge
domain that this specific person needs to understand to be effective in their role.

PLANET SEQUENCING RULES:
- Planet 1 must always be "What is this project and why does it exist" — project
  purpose, vision and business context. Everyone needs this foundation first.
- Planet 2 must be directly relevant to the user's stated role and immediate work context.
- Subsequent planets build logically on each other — each planet's knowledge should
  make the next planet more understandable.
- The final planet should be either key risks/known issues OR team dynamics and
  collaboration patterns — something that only makes full sense once you understand
  the rest of the project.
- Order planets to build understanding progressively. Never put architecture before
  product purpose. Never put edge cases before core flows.

CHALLENGE TYPE SELECTION RULES:
- SCENARIO: best for process decisions, team dynamics, prioritisation situations
- ROLEPLAY: best for user-facing features, stakeholder domains, end-user workflows
- DETECTIVE: best for architecture decisions, technical debt, legacy patterns
- BUILD: best for coding conventions, technical implementations, codebase patterns
- TRANSMISSION_DECODE: best for requirements, specifications, project planning artefacts

VISUAL CONFIG RULES:
- Planet 1 (project core): warm golden/amber tones, medium-large size, rocky texture
- Technical/architecture planets: cool blue or purple tones, gas or storm texture
- Risk/problem planets: red or dark storm tones, lava or storm texture
- Legacy or frozen areas: icy blue, icy texture
- User-facing feature planets: ocean blue or teal, ocean texture
- Team/process planets: soft purple or green, gas texture
- Size reflects domain complexity — more complex = larger planet (scale 0.6 to 2.0)
- Orbit radius: space planets evenly from 4 to 14 scene units from sun
- Orbit speed: inner planets orbit faster (0.003–0.008), outer slower (0.001–0.003)

INSIDER TIP RULE:
Every planet's briefing must end with one INSIDER TIP. This must be something
INFERRED from the documentation — a pattern, implication, risk or relationship that
is not explicitly stated anywhere in the docs. It should feel like something a senior
team member would only tell you in a quiet moment. It must be specific to this project
and this role. Never generic advice.

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "userProfile": {
    "roleDescription": "string",
    "parsedRole": "string",
    "parsedFocus": ["array", "of", "focus", "areas"],
    "experience": "string"
  },
  "planets": [
    {
      "id": "uuid-string",
      "name": "string",
      "subtitle": "string",
      "order": 1,
      "status": "available",
      "domainType": "string",
      "visualConfig": {
        "size": 1.2,
        "color": "#f4a460",
        "secondaryColor": "#c8834a",
        "emissiveColor": "#ff6600",
        "orbitRadius": 5,
        "orbitSpeed": 0.006,
        "hasRings": false,
        "ringSeed": 42,
        "atmosphereColor": "#ff8800",
        "textureType": "rocky"
      },
      "briefing": "string — 150-200 word briefing as a senior colleague over coffee. Ends with: INSIDER TIP: [specific inferred tip]",
      "insiderTip": "string — the insider tip extracted separately",
      "challenge": {
        "type": "SCENARIO",
        "title": "string",
        "setup": "string",
        "prompt": "string",
        "options": [
          { "id": "a", "label": "Option Alpha", "text": "string" },
          { "id": "b", "label": "Option Beta", "text": "string" },
          { "id": "c", "label": "Option Gamma", "text": "string" }
        ],
        "clues": ["string", "string", "string"],
        "codeSnippets": [
          { "id": "a", "label": "Approach Alpha", "language": "typescript", "code": "string" },
          { "id": "b", "label": "Approach Beta", "language": "typescript", "code": "string" }
        ],
        "artefact": "string",
        "userResponse": ""
      },
      "debrief": null,
      "xpAwarded": 0
    }
  ]
}

Important: Only include options for SCENARIO type, clues for DETECTIVE, codeSnippets for BUILD, artefact for TRANSMISSION_DECODE. Omit irrelevant fields.
First planet status must be "available". All others must be "locked".`;
}

// ─── Debrief Prompt ───────────────────────────────────────────────────────────

export const DEBRIEF_SYSTEM = `You are the Mission Debrief Officer. An astronaut has just completed a mission
challenge on a knowledge domain about the project they are joining. Your job is
to give them personalised, specific feedback based on:
1. What they actually wrote or chose
2. What the project documentation actually says about this domain
3. Who they are and what their role is

You are NOT a harsh examiner. You are an encouraging senior colleague who
highlights what they understood well, fills in what they missed, and leaves
them more confident and informed than before. Your tone is direct, warm and
specific — never generic.

Always respond with valid JSON only. No markdown. No commentary.`;

export function buildDebriefPrompt(
  planet: Planet,
  userResponse: string,
  userProfile: UserProfile,
  relevantDocs: MCPDocument[]
): string {
  const docContext = relevantDocs
    .map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 600)}\n---`)
    .join('\n');

  return `ASTRONAUT ROLE: ${userProfile.parsedRole}
ASTRONAUT FOCUS: ${userProfile.parsedFocus.join(', ')}

PLANET DOMAIN: ${planet.name} — ${planet.subtitle}
CHALLENGE TYPE: ${planet.challenge?.type ?? 'SCENARIO'}
CHALLENGE PROMPT: ${planet.challenge?.prompt ?? ''}

ASTRONAUT'S RESPONSE:
${userResponse}

RELEVANT PROJECT DOCUMENTATION:
${docContext}

YOUR TASK:
Evaluate the astronaut's response against the project documentation and produce a debrief.

XP SCORING:
- 150 XP: Excellent — captured core understanding AND showed nuance
- 120 XP: Good — captured the main point with minor gaps
- 90 XP: Partial — got the direction right but missed important specifics
- 60 XP: Developing — showed engagement but missed key aspects
- Minimum 60 XP always — engagement is always rewarded

RESPOND WITH THIS JSON:
{
  "strengths": "string — 2-3 sentences on what they understood or identified correctly. Be specific. Reference what they wrote.",
  "gaps": "string — 1-2 sentences on what they missed or could deepen. Frame positively as 'something to explore'. Never harsh.",
  "deeperContext": "string — ONE piece of genuinely interesting context from the documentation that enriches their understanding. Something they could not have known without reading the docs carefully.",
  "xpAwarded": 120,
  "personalisation": "string — One sentence connecting this domain to their specific role and day-to-day work."
}`;
}

// ─── Briefing Card Prompt ─────────────────────────────────────────────────────

export const BRIEFING_CARD_SYSTEM = `You are generating a personalised project reference card for an onboarding
astronaut who has just completed their full project learning mission.

Based on ALL project documentation and their role, generate their Mission Briefing Card.

Return JSON matching the MissionBriefingCard interface exactly.
Make every field specific to this project and this person's role.
Top priorities must reflect current project state, not generic advice.
Risks must be real risks found in the documentation.
Key contacts must be real people named in the documentation.
Things not to break must reference specific components/modules/processes.

Always respond with valid JSON only. No markdown. No commentary.`;

export function buildBriefingCardPrompt(
  userProfile: UserProfile,
  completedPlanets: Planet[],
  documents: MCPDocument[]
): string {
  const planetSummary = completedPlanets
    .map((p) => `- ${p.name}: ${p.subtitle}`)
    .join('\n');

  const docContext = documents
    .map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 500)}\n---`)
    .join('\n');

  return `ASTRONAUT ROLE: ${userProfile.parsedRole}
ASTRONAUT FOCUS: ${userProfile.parsedFocus.join(', ')}

COMPLETED MISSION SECTORS:
${planetSummary}

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
}

// ─── Chat Prompt ──────────────────────────────────────────────────────────────

export const CHAT_SYSTEM = `You are Commander Nova — the Mission Control guide for an astronaut who is
onboarding onto a new project. You have complete access to the project's
knowledge base and you know everything about this astronaut's role and their
learning journey so far.

Your communication style:
- Conversational and direct, like a knowledgeable senior colleague
- Always specific to THIS project — never give generic advice
- Reference actual documents, decisions, people and components by name
- When you reference a document, end your response with:
  SOURCES: [comma-separated document titles]
- Keep responses focused — 150 words maximum unless a complex technical
  question genuinely requires more
- You know what the astronaut has already learned (their completed planets)
  so you can build on that knowledge without re-explaining it
- If asked about something not in the documentation, say so clearly:
  "That's not covered in the project docs I have access to — you'll want
  to ask the relevant team contact directly."`;

export function buildChatPrompt(
  message: string,
  userProfile: UserProfile,
  completedPlanets: Planet[],
  chatHistory: Array<{ role: string; content: string }>,
  documents: MCPDocument[]
): string {
  const planetsSummary = completedPlanets.length > 0
    ? completedPlanets.map((p) => `- ${p.name}: ${p.subtitle}`).join('\n')
    : 'None yet — astronaut is just starting their journey.';

  const historyText = chatHistory
    .slice(-10)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const docContext = documents
    .slice(0, 15)
    .map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 400)}\n---`)
    .join('\n');

  return `ASTRONAUT PROFILE:
Role: ${userProfile.parsedRole}
Focus: ${userProfile.parsedFocus.join(', ')}
Experience: ${userProfile.experience}

PLANETS COMPLETED:
${planetsSummary}

RECENT CONVERSATION:
${historyText || 'No prior conversation.'}

PROJECT DOCUMENTATION:
${docContext}

ASTRONAUT'S QUESTION:
${message}`;
}

// ─── Challenge response formatter ─────────────────────────────────────────────

export function formatChallengeResponse(challenge: Challenge): string {
  switch (challenge.type) {
    case 'SCENARIO': {
      const selected = challenge.options?.find((o) => o.id === challenge.userResponse);
      return selected
        ? `Selected: ${selected.label} — ${selected.text}\nResponse: ${challenge.userResponse}`
        : challenge.userResponse;
    }
    case 'BUILD': {
      const [choiceId, ...rest] = challenge.userResponse.split('\n');
      const snippet = challenge.codeSnippets?.find((s) => s.id === choiceId);
      return snippet
        ? `Chose: ${snippet.label}\nExplanation: ${rest.join('\n')}`
        : challenge.userResponse;
    }
    default:
      return challenge.userResponse;
  }
}

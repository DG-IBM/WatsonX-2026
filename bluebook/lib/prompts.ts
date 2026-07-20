import type { MCPDocument, UserProfile, KnowledgeNode } from '@/types/bluebook';

// ─── Architect — Phase 1: skeleton (titles + briefing card only) ──────────────
// Kept small so it never overflows the model's output token limit.
// Phase 2 enriches each node individually via /api/llm/enrich-node.

export const ARCHITECT_SYSTEM = `You are the Architect for IBM Bluebook — the intelligence responsible for planning a personalised knowledge verification system for a new team member.

CRITICAL: You must respond with ONLY raw valid JSON. No markdown code fences. No backticks. No commentary. The very first character must be { and the very last must be }.`;

export function buildArchitectPrompt(
  roleDescription: string,
  documents: MCPDocument[]
): string {
  // Hard-cap doc input to keep Phase 1 prompt small and fast
  const docSummary = documents
    .slice(0, 10)
    .map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 500)}\n---`)
    .join('\n');

  return `Build an IBM Bluebook knowledge map for this team member.

ROLE:
${roleDescription}

PROJECT KNOWLEDGE BASE (excerpts):
${docSummary}

YOUR TASK:
Identify 6 to 10 topic areas this person needs to understand. For each topic produce only a short title and one-sentence description. Do NOT write summaries, quiz questions, or contacts yet — those come later.

RESPOND WITH THIS EXACT JSON (nothing else):
{
  "userProfile": {
    "parsedRole": "string — job title inferred from role description",
    "parsedFocus": ["primary focus area", "secondary focus area"],
    "experience": "string — e.g. '3 years React'"
  },
  "onboardingBriefingCard": {
    "projectName": "string — short project name from docs",
    "projectIntro": "string — 2-3 sentences: what the project is, why it exists, who uses it",
    "roleIntro": "string — 1-2 sentences: what this person will be doing day-to-day",
    "yourResponsibilities": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
    "keyContacts": [
      { "name": "string", "role": "string", "contact": "string or 'Ask your manager'", "why": "string" }
    ],
    "firstWeekTips": ["tip 1", "tip 2", "tip 3", "tip 4", "tip 5"],
    "suggestedPath": ["title of node 1", "title of node 2", "title of node 3"],
    "doNotBreak": ["item 1", "item 2", "item 3"]
  },
  "nodes": [
    {
      "id": "unique-id-1",
      "title": "string — specific topic title",
      "description": "string — one sentence describing what this topic covers",
      "order": 1,
      "color": "#4a9eff",
      "emissiveColor": "#2255aa"
    }
  ]
}

RULES:
- 6 to 10 nodes, each with a specific project-relevant title
- suggestedPath must list all node titles in recommended reading order
- keyContacts: only include people actually named in the documents
- color: blue/purple for architecture, red/dark for risks, teal/green for process, amber for product`;
}

// ─── Architect — Phase 2: single-node enrichment ──────────────────────────────
// Called once per node after the skeleton is shown. Output fits in ~2,500 tokens.

export const ENRICH_NODE_SYSTEM = `You are the IBM Bluebook content writer. You write detailed, easy-to-follow knowledge node content for new team members joining a project. Be specific, concrete, and grounded in the provided documents.

CRITICAL: Respond with ONLY raw valid JSON. No markdown. No backticks. First character { last character }.`;

export function buildEnrichNodePrompt(
  nodeTitle: string,
  nodeDescription: string,
  roleDescription: string,
  documents: MCPDocument[]
): string {
  const docContext = documents
    .slice(0, 8)
    .map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 600)}\n---`)
    .join('\n');

  return `Write the full content for this knowledge node.

NODE TITLE: ${nodeTitle}
NODE DESCRIPTION: ${nodeDescription}

TEAM MEMBER ROLE: ${roleDescription}

PROJECT DOCUMENTS:
${docContext}

RESPOND WITH THIS EXACT JSON:
{
  "summary": "string — 120 to 180 words. Plain English. What is this topic, why does it matter, what should the person know. No jargon without explanation.",
  "keyTakeaways": ["actionable bullet 1", "actionable bullet 2", "actionable bullet 3", "actionable bullet 4"],
  "roleRelevance": "string — 2-3 sentences: how this topic directly affects this person's day-to-day work in their role",
  "diagrams": [],
  "keyContacts": [],
  "links": [],
  "sources": [
    { "documentTitle": "string", "source": "string", "excerpt": "string — 1-2 sentence excerpt from the doc" }
  ],
  "quiz": {
    "questions": [
      {
        "id": "q1",
        "question": "string — situational question testing understanding",
        "type": "multiple_choice",
        "options": [
          { "id": "a", "text": "string" },
          { "id": "b", "text": "string" },
          { "id": "c", "text": "string" },
          { "id": "d", "text": "string" }
        ],
        "correctOptionId": "a",
        "explanation": "string — why this answer is correct and why others are wrong"
      },
      {
        "id": "q2",
        "question": "string",
        "type": "multiple_choice",
        "options": [
          { "id": "a", "text": "string" },
          { "id": "b", "text": "string" },
          { "id": "c", "text": "string" },
          { "id": "d", "text": "string" }
        ],
        "correctOptionId": "b",
        "explanation": "string"
      },
      {
        "id": "q3",
        "question": "string",
        "type": "multiple_choice",
        "options": [
          { "id": "a", "text": "string" },
          { "id": "b", "text": "string" },
          { "id": "c", "text": "string" },
          { "id": "d", "text": "string" }
        ],
        "correctOptionId": "c",
        "explanation": "string"
      }
    ]
  }
}

RULES:
- summary must be plain English — explain any technical term the first time you use it
- keyTakeaways must be actionable ("Do X before Y", "Always check Z", "If you see X, it means Y")
- quiz questions must test understanding, not memorisation — use situational/applied scenarios
- sources: reference only documents provided above, never invent sources
- keyContacts/diagrams/links: leave as empty arrays [] unless the documents clearly support them`;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const CHAT_SYSTEM = `You are IBM Bluebook Mission Control — the onboarding intelligence guide for a team member
who is verifying their knowledge of a new project. You have complete access to the
project's knowledge base and you know the person's role.

Your communication style:
- Conversational and direct, like a knowledgeable senior colleague
- Always specific to THIS project — never give generic advice
- Reference actual documents, decisions, people and components by name
- When you reference a document, end your response with:
  SOURCES: [comma-separated document titles]
- Keep responses focused — 150 words maximum unless a complex technical
  question genuinely requires more
- You know which knowledge nodes the person has already reviewed (completed topics),
  so you can build on that knowledge without re-explaining it
- If asked about something not in the documentation, say so clearly:
  "That's not covered in the project docs I have access to — you'll want
  to ask the relevant team contact directly."`;

export function buildChatPrompt(
  message: string,
  userProfile: UserProfile,
  completedNodes: KnowledgeNode[],
  chatHistory: Array<{ role: string; content: string }>,
  documents: MCPDocument[],
  selectedNode?: KnowledgeNode | null
): string {
  const nodesSummary = completedNodes.length > 0
    ? completedNodes.map((n) => `- ${n.title} (${n.score?.nodeColour ?? 'in progress'})`).join('\n')
    : 'None yet — just starting.';

  const historyText = chatHistory
    .slice(-10)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const docContext = documents
    .slice(0, 15)
    .map((d) => `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, 400)}\n---`)
    .join('\n');

  const nodeContext = selectedNode
    ? `\nCURRENTLY VIEWING NODE: "${selectedNode.title}"\nNode summary: ${selectedNode.summary.slice(0, 300)}\n`
    : '';

  return `TEAM MEMBER PROFILE:
Role: ${userProfile.parsedRole}
Focus: ${userProfile.parsedFocus.join(', ')}
Experience: ${userProfile.experience}

COMPLETED KNOWLEDGE NODES:
${nodesSummary}
${nodeContext}
RECENT CONVERSATION:
${historyText || 'No prior conversation.'}

PROJECT DOCUMENTATION:
${docContext}

QUESTION:
${message}`;
}

// ─── Legacy prompts (kept for backward compat) ────────────────────────────────

export const DEBRIEF_SYSTEM = '';
export function buildDebriefPrompt() { return ''; }
export const BRIEFING_CARD_SYSTEM = '';
export function buildBriefingCardPrompt() { return ''; }
export function formatChallengeResponse() { return ''; }

import type { KnowledgeNode, MCPDocument, Challenge } from '@/types/orbit';

// ─── Node / Readiness utilities ────────────────────────────────────────────────

export function getCompletedCount(nodes: KnowledgeNode[]): number {
  return nodes.filter((n) => n.status === 'complete').length;
}

export function getAllNodesComplete(nodes: KnowledgeNode[]): boolean {
  return nodes.length > 0 && nodes.every((n) => n.status === 'complete');
}

export function getNextUnverifiedNode(nodes: KnowledgeNode[]): KnowledgeNode | null {
  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  return sorted.find((n) => n.status === 'untouched') ?? null;
}

// ─── Legacy XP / rank stubs (retained for backward compat) ────────────────────
// These are no longer the primary scoring mechanism — use OverallScore instead.

export function calculateRank(_totalXP: number): 'Not Started' {
  return 'Not Started'; // replaced by ReadinessLevel from OverallScore
}

export function getXPToNextRank(_totalXP: number): number {
  return 0;
}

export function getRankDescription(_rank: string): string {
  return '';
}

export function getRankIcon(_rank: string): string {
  return '';
}

// ─── Document utilities ───────────────────────────────────────────────────────

export function selectRelevantDocuments(
  documents: MCPDocument[],
  query: string,
  limit: number
): MCPDocument[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const scored = documents.map((doc) => {
    const haystack = `${doc.title} ${doc.content.slice(0, 3000)}`.toLowerCase();
    const score = terms.reduce((acc, term) => {
      const matches = (haystack.match(new RegExp(term, 'g')) ?? []).length;
      return acc + matches;
    }, 0);
    return { doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc);
}

export function summariseDocuments(documents: MCPDocument[]): string {
  const totalChars = documents.reduce((acc, d) => acc + d.content.length, 0);
  const perDocLimit = totalChars > 60000 ? 800 : 2000;

  return documents
    .map(
      (d) =>
        `SOURCE: ${d.source} | TITLE: ${d.title}\n${d.content.slice(0, perDocLimit)}${d.content.length > perDocLimit ? '\n[truncated]' : ''}\n---`
    )
    .join('\n');
}

// ─── Legacy challenge response formatter ──────────────────────────────────────

export function formatUserResponse(challenge: Challenge): string {
  switch (challenge.type) {
    case 'SCENARIO': {
      const opt = challenge.options?.find((o) => o.id === challenge.userResponse);
      return opt
        ? `Chose ${opt.label}: ${opt.text}`
        : `Response: ${challenge.userResponse}`;
    }
    case 'BUILD': {
      const lines = challenge.userResponse.split('\n');
      const choiceId = lines[0];
      const explanation = lines.slice(1).join('\n');
      const snippet = challenge.codeSnippets?.find((s) => s.id === choiceId);
      return snippet
        ? `Chose ${snippet.label}\nExplanation: ${explanation}`
        : challenge.userResponse;
    }
    default:
      return challenge.userResponse;
  }
}

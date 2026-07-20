import type { Planet, MCPDocument, Challenge, AstronautRank } from '@/types/orbit';

// ─── XP & Ranking ─────────────────────────────────────────────────────────────

export function calculateRank(totalXP: number): AstronautRank {
  if (totalXP >= 900) return 'Mission Veteran';
  if (totalXP >= 700) return 'Commander';
  if (totalXP >= 500) return 'Specialist';
  if (totalXP >= 300) return 'Explorer';
  return 'Cadet';
}

export function getXPToNextRank(totalXP: number): number {
  if (totalXP >= 900) return 0;
  if (totalXP >= 700) return 900 - totalXP;
  if (totalXP >= 500) return 700 - totalXP;
  if (totalXP >= 300) return 500 - totalXP;
  return 300 - totalXP;
}

export function getRankDescription(rank: AstronautRank): string {
  switch (rank) {
    case 'Cadet':          return 'Your journey begins.';
    case 'Explorer':       return 'Curiosity is your compass.';
    case 'Specialist':     return 'You know this terrain.';
    case 'Commander':      return 'This mission needed you.';
    case 'Mission Veteran': return 'The project has no secrets from you.';
  }
}

export function getRankIcon(rank: AstronautRank): string {
  switch (rank) {
    case 'Cadet':          return '🚀';
    case 'Explorer':       return '🌍';
    case 'Specialist':     return '⭐';
    case 'Commander':      return '🏆';
    case 'Mission Veteran': return '🌌';
  }
}

// ─── Planet utilities ──────────────────────────────────────────────────────────

export function getNextAvailablePlanet(planets: Planet[]): Planet | null {
  const sorted = [...planets].sort((a, b) => a.order - b.order);
  return sorted.find((p) => p.status === 'available') ?? null;
}

export function getAllPlanetsComplete(planets: Planet[]): boolean {
  return planets.length > 0 && planets.every((p) => p.status === 'completed');
}

export function getCompletedCount(planets: Planet[]): number {
  return planets.filter((p) => p.status === 'completed').length;
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

// ─── Challenge response formatter ─────────────────────────────────────────────

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

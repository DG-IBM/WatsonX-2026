'use client';

import type { KnowledgeNode } from '@/types/orbit';

interface DebriefPhaseProps {
  planet: KnowledgeNode;
  onReturn: () => void;
}

// Superseded by QuizOverlay results screen. Stub retained for backward compat.
export default function DebriefPhase({ planet: _planet, onReturn }: DebriefPhaseProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Quiz complete. Return to the map to see your results.
      </p>
      <button
        onClick={onReturn}
        className="w-full py-3 rounded-xl font-terminal text-sm tracking-widest font-bold"
        style={{ background: 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))', color: '#fff' }}
      >
        BACK TO MAP →
      </button>
    </div>
  );
}

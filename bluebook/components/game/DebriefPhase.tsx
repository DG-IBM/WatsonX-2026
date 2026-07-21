'use client';

import type { KnowledgeNode } from '@/types/bluebook';

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
        className="w-full py-3 font-terminal text-sm tracking-widest font-bold"
        style={{ background: 'var(--ibm-blue-60)', border: '1px solid var(--cds-border-interactive)', color: '#fff', borderRadius: 4 }}
      >
        BACK TO MAP →
      </button>
    </div>
  );
}

'use client';

import type { KnowledgeNode } from '@/types/orbit';

interface TransmissionPhaseProps {
  planet: KnowledgeNode;
  onAccept: () => void;
}

// Superseded by NodeDetailPanel. Stub retained for backward compat.
export default function TransmissionPhase({ planet, onAccept }: TransmissionPhaseProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
        {planet.summary}
      </p>
      <button
        onClick={onAccept}
        className="w-full py-3 rounded-xl font-terminal text-sm tracking-widest font-bold"
        style={{ background: 'linear-gradient(135deg, var(--color-gold), #ff8c00)', color: 'var(--color-void)' }}
      >
        GOT IT
      </button>
    </div>
  );
}

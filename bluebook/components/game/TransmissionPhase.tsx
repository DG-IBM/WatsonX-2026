'use client';

import type { KnowledgeNode } from '@/types/bluebook';

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
        className="w-full py-3 font-terminal text-sm tracking-widest font-bold"
        style={{ background: 'var(--ibm-blue-60)', border: '1px solid var(--cds-border-interactive)', color: '#fff', borderRadius: 4 }}
      >
        GOT IT
      </button>
    </div>
  );
}

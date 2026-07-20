'use client';

import type { KnowledgeNode } from '@/types/orbit';

interface MissionPhaseProps {
  planet: KnowledgeNode;
  onSubmit: (response: string) => void;
  isLoading: boolean;
}

// Superseded by QuizOverlay. Stub retained for backward compat.
export default function MissionPhase({ planet: _planet, onSubmit: _onSubmit, isLoading: _isLoading }: MissionPhaseProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        This challenge format has been replaced by the inline quiz system.
      </p>
    </div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { KnowledgeNode } from '@/types/bluebook';

interface PlanetModalProps {
  planet: KnowledgeNode;
  phase: 'transmission' | 'mission' | 'debrief';
  onClose: () => void;
  onAcceptMission: () => void;
  onSubmitChallenge: (response: string) => Promise<void>;
  onReturn: () => void;
  isLoading: boolean;
}

// This modal is no longer the primary node interaction UI.
// NodeDetailPanel + QuizOverlay replaced it.
// This file remains as a stub for backward compat.

export default function PlanetModal({
  planet,
  onClose,
}: PlanetModalProps) {
  return (
    <AnimatePresence>
      <div className="planet-modal-backdrop">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="glass-panel-bright w-full relative"
          style={{ maxWidth: 780, maxHeight: '85vh', overflowY: 'auto' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full transition-all z-10"
            style={{ background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.2)', color: 'var(--color-text-secondary)' }}
          >
            <X size={16} />
          </button>
          <div className="p-6">
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {planet.title}
            </h2>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import TransmissionPhase from './TransmissionPhase';
import MissionPhase from './MissionPhase';
import DebriefPhase from './DebriefPhase';
import type { Planet } from '@/types/orbit';

interface PlanetModalProps {
  planet: Planet;
  phase: 'transmission' | 'mission' | 'debrief';
  onClose: () => void;
  onAcceptMission: () => void;
  onSubmitChallenge: (response: string) => Promise<void>;
  onReturn: () => void;
  isLoading: boolean;
}

const PHASES = ['transmission', 'mission', 'debrief'] as const;

export default function PlanetModal({
  planet,
  phase,
  onClose,
  onAcceptMission,
  onSubmitChallenge,
  onReturn,
  isLoading,
}: PlanetModalProps) {
  const phaseIndex = PHASES.indexOf(phase);

  return (
    <AnimatePresence>
      <div className="planet-modal-backdrop">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="glass-panel-bright w-full relative"
          style={{
            maxWidth: 780,
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full transition-all z-10"
            style={{
              background: 'rgba(0,170,255,0.08)',
              border: '1px solid rgba(0,170,255,0.2)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <X size={16} />
          </button>

          {/* Modal header */}
          <div
            className="px-6 pt-6 pb-4"
            style={{ borderBottom: '1px solid rgba(0,170,255,0.12)' }}
          >
            <div className="flex items-start gap-4">
              {/* Planet colour dot */}
              <div
                className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  background: planet.visualConfig.color,
                  boxShadow: `0 0 8px ${planet.visualConfig.emissiveColor}`,
                }}
              />
              <div className="flex-1 min-w-0 pr-8">
                <h2 className="text-xl font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                  {planet.name}
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {planet.subtitle}
                </p>
              </div>
            </div>

            {/* Phase indicator */}
            <div className="flex items-center gap-2 mt-4">
              {PHASES.map((p, idx) => (
                <div key={p} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background:
                          idx < phaseIndex
                            ? 'var(--color-gold)'
                            : idx === phaseIndex
                            ? 'var(--color-orbit-blue)'
                            : 'rgba(255,255,255,0.15)',
                        boxShadow:
                          idx === phaseIndex ? '0 0 6px var(--color-orbit-blue)' : 'none',
                      }}
                    />
                    <span
                      className="font-terminal text-xs"
                      style={{
                        color:
                          idx < phaseIndex
                            ? 'var(--color-gold)'
                            : idx === phaseIndex
                            ? 'var(--color-orbit-blue)'
                            : 'var(--color-text-muted)',
                        fontSize: '10px',
                        letterSpacing: '1px',
                      }}
                    >
                      {p.toUpperCase()}
                    </span>
                  </div>
                  {idx < PHASES.length - 1 && (
                    <div
                      className="flex-1 h-px"
                      style={{
                        width: 20,
                        background:
                          idx < phaseIndex ? 'var(--color-gold-dim)' : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Phase content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {phase === 'transmission' && (
                <motion.div
                  key="transmission"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <TransmissionPhase planet={planet} onAccept={onAcceptMission} />
                </motion.div>
              )}
              {phase === 'mission' && (
                <motion.div
                  key="mission"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <MissionPhase
                    planet={planet}
                    onSubmit={onSubmitChallenge}
                    isLoading={isLoading}
                  />
                </motion.div>
              )}
              {phase === 'debrief' && planet.debrief && (
                <motion.div
                  key="debrief"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <DebriefPhase planet={planet} onReturn={onReturn} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

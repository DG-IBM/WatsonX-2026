'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Compass, Radio, User } from 'lucide-react';
import type { Planet } from '@/types/orbit';
import XPIndicator from '@/components/ui/XPIndicator';

interface DebriefPhaseProps {
  planet: Planet;
  onReturn: () => void;
}

export default function DebriefPhase({ planet, onReturn }: DebriefPhaseProps) {
  const debrief = planet.debrief!;
  const [displayXP, setDisplayXP] = useState(0);
  const [showXPFloat, setShowXPFloat] = useState(false);

  // Count-up animation
  useEffect(() => {
    const target = debrief.xpAwarded;
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayXP(target);
        clearInterval(interval);
        setShowXPFloat(true);
      } else {
        setDisplayXP(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [debrief.xpAwarded]);

  return (
    <div className="flex flex-col gap-5">
      <XPIndicator amount={debrief.xpAwarded} show={showXPFloat} onComplete={() => setShowXPFloat(false)} />

      {/* XP header */}
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="font-terminal text-xs tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
          MISSION DEBRIEF
        </p>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="font-terminal text-5xl font-bold"
          style={{
            color: 'var(--color-gold)',
            textShadow: '0 0 20px rgba(255,215,0,0.5)',
          }}
        >
          +{displayXP}
        </motion.div>
        <p className="font-terminal text-sm" style={{ color: 'var(--color-gold-dim)' }}>
          XP AWARDED
        </p>
      </div>

      {/* Strengths */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-xl"
        style={{
          background: 'rgba(0,255,136,0.05)',
          border: '1px solid rgba(0,255,136,0.2)',
        }}
      >
        <div
          className="flex items-center gap-2 mb-2 font-terminal text-xs tracking-widest"
          style={{ color: 'var(--color-signal)' }}
        >
          <CheckCircle size={14} />
          WHAT YOU GOT RIGHT
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
          {debrief.strengths}
        </p>
      </motion.div>

      {/* Gaps */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.45 }}
        className="p-4 rounded-xl"
        style={{
          background: 'rgba(255,180,0,0.05)',
          border: '1px solid rgba(255,180,0,0.2)',
        }}
      >
        <div
          className="flex items-center gap-2 mb-2 font-terminal text-xs tracking-widest"
          style={{ color: '#ffb400' }}
        >
          <Compass size={14} />
          DEEPER TO EXPLORE
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
          {debrief.gaps}
        </p>
      </motion.div>

      {/* Deeper context */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        className="p-4 rounded-xl orbit-glow"
        style={{
          background: 'rgba(0,170,255,0.06)',
          border: '1px solid rgba(0,170,255,0.25)',
        }}
      >
        <div
          className="flex items-center gap-2 mb-2 font-terminal text-xs tracking-widest"
          style={{ color: 'var(--color-orbit-blue)' }}
        >
          <Radio size={14} />
          SIGNAL FROM THE DOCS
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
          {debrief.deeperContext}
        </p>
      </motion.div>

      {/* Personalisation */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.75 }}
        className="p-4 rounded-xl"
        style={{
          background: 'rgba(155,89,182,0.06)',
          border: '1px solid rgba(155,89,182,0.2)',
        }}
      >
        <div
          className="flex items-center gap-2 mb-2 font-terminal text-xs tracking-widest"
          style={{ color: '#b06fe0' }}
        >
          <User size={14} />
          YOUR MISSION RELEVANCE
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
          {debrief.personalisation}
        </p>
      </motion.div>

      {/* Return button */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        onClick={onReturn}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
        style={{
          background: 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))',
          color: '#fff',
        }}
        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0,170,255,0.4)' }}
        whileTap={{ scale: 0.98 }}
      >
        RETURN TO ORBIT →
      </motion.button>
    </div>
  );
}

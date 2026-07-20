'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, SkipForward } from 'lucide-react';
import CommanderAvatar from '@/components/ui/CommanderAvatar';
import type { Planet } from '@/types/orbit';

interface TransmissionPhaseProps {
  planet: Planet;
  onAccept: () => void;
}

const TYPING_SPEED = 30; // ms per character

export default function TransmissionPhase({ planet, onAccept }: TransmissionPhaseProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showInsiderTip, setShowInsiderTip] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const briefing = planet.briefing ?? '';

  // Strip "INSIDER TIP: ..." from end for separate display
  const insiderTipMatch = briefing.match(/INSIDER TIP:\s*([\s\S]+)$/);
  const mainBriefing = briefing.replace(/\n?INSIDER TIP:\s*[\s\S]+$/, '').trim();
  const insiderTip = planet.insiderTip ?? insiderTipMatch?.[1] ?? '';

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    setIsComplete(false);
    setShowInsiderTip(false);

    intervalRef.current = setInterval(() => {
      i++;
      setDisplayedText(mainBriefing.slice(0, i));
      if (i >= mainBriefing.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsComplete(true);
        setTimeout(() => setShowInsiderTip(true), 600);
      }
    }, TYPING_SPEED);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [planet.id]);

  const skipTypewriter = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDisplayedText(mainBriefing);
    setIsComplete(true);
    setTimeout(() => setShowInsiderTip(true), 300);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Commander header */}
      <div
        className="flex items-center gap-4 pb-4"
        style={{ borderBottom: '1px solid rgba(0,170,255,0.15)' }}
      >
        <CommanderAvatar size="md" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full animate-pulse-glow"
              style={{ background: 'var(--color-signal)' }}
            />
            <span
              className="font-terminal text-xs tracking-widest"
              style={{ color: 'var(--color-signal)', fontSize: '10px' }}
            >
              INCOMING TRANSMISSION FROM MISSION CONTROL
            </span>
            {/* Signal bars */}
            <div className="flex gap-0.5 ml-2">
              {[4, 7, 10, 13].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-sm"
                  style={{
                    height: h,
                    background: 'var(--color-signal)',
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
          </div>
          <p className="font-terminal text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            CDR NOVA — MISSION CONTROL
          </p>
        </div>
      </div>

      {/* Briefing text with typewriter + scanline */}
      <div
        className="scanline rounded-xl p-5 relative min-h-36"
        style={{
          background: 'rgba(6,13,26,0.8)',
          border: '1px solid rgba(0,170,255,0.1)',
        }}
      >
        <p
          className="text-sm leading-relaxed"
          style={{
            color: 'var(--color-text-primary)',
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.8,
            fontSize: '15px',
          }}
        >
          {displayedText}
          {!isComplete && <span className="typewriter-cursor" />}
        </p>

        {/* Skip button */}
        {!isComplete && (
          <button
            onClick={skipTypewriter}
            className="absolute bottom-3 right-3 flex items-center gap-1 text-xs opacity-40 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-secondary)', fontFamily: "'Space Mono', monospace" }}
          >
            <SkipForward size={12} />
            skip
          </button>
        )}
      </div>

      {/* Insider tip */}
      <AnimatePresence>
        {showInsiderTip && insiderTip && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4"
            style={{
              background: 'rgba(255,215,0,0.04)',
              borderLeft: '3px solid var(--color-gold)',
              border: '1px solid rgba(255,215,0,0.2)',
              borderLeftWidth: '3px',
            }}
          >
            <div
              className="font-terminal text-xs tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-gold)', fontSize: '10px' }}
            >
              ⭐ INSIDER TIP
            </div>
            <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {insiderTip}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept button */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: showInsiderTip ? 0.2 : 0.5 }}
          >
            <button
              onClick={onAccept}
              disabled={!isComplete}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--color-gold), #ff8c00)',
                color: 'var(--color-void)',
              }}
            >
              ACCEPT MISSION
              <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

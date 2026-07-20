'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingSequenceProps {
  isVisible: boolean;
  messages?: string[];
}

const DEFAULT_MESSAGES = [
  'Scanning knowledge base...',
  'Analysing project documentation...',
  'Identifying knowledge areas...',
  'Calibrating to your role...',
  'Building your knowledge map...',
  'Generating quiz questions...',
  'Preparing verification system...',
  'Almost ready...',
];

export default function LoadingSequence({
  isVisible,
  messages = DEFAULT_MESSAGES,
}: LoadingSequenceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  // Cycle messages
  useEffect(() => {
    if (!isVisible) {
      setCurrentIndex(0);
      setDisplayedText('');
      setProgress(0);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % messages.length;
        return next;
      });
    }, 2500);

    // Progress bar fills over ~15s
    let p = 0;
    progressRef.current = setInterval(() => {
      p += 100 / 150; // 150 ticks × 100ms = 15s
      setProgress(Math.min(99, p));
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isVisible, messages.length]);

  // Typewriter effect per message
  useEffect(() => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    const msg = messages[currentIndex] ?? '';
    let i = 0;
    setDisplayedText('');
    typewriterRef.current = setInterval(() => {
      i++;
      setDisplayedText(msg.slice(0, i));
      if (i >= msg.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, 35);
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [currentIndex, messages]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex flex-col items-center justify-center z-50"
          style={{ background: 'var(--color-void)' }}
        >
          {/* Animated orbit rings */}
          <div className="relative w-48 h-48 mb-10">
            {[40, 65, 90].map((radius, i) => (
              <div
                key={i}
                className="orbit-ring"
                style={{
                  width: radius * 2,
                  height: radius * 2,
                  animationDuration: `${3 + i * 1.5}s`,
                  animation: `orbit-rotate ${3 + i * 1.5}s linear infinite`,
                }}
              >
                <div
                  className="orbit-dot"
                  style={{
                    background: i === 0
                      ? 'var(--color-orbit-blue)'
                      : i === 1
                      ? 'var(--color-signal)'
                      : 'var(--color-gold)',
                  }}
                />
              </div>
            ))}
            {/* Central sun dot */}
            <div
              className="absolute rounded-full animate-pulse-glow"
              style={{
                width: 14,
                height: 14,
                background: 'var(--color-gold)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 20px var(--color-gold)',
              }}
            />
          </div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold mb-6 tracking-widest"
            style={{ color: 'var(--color-text-primary)' }}
          >
            BUILDING YOUR KNOWLEDGE MAP
          </motion.h1>

          {/* Typewriter message */}
          <div
            className="font-terminal text-sm h-6 mb-8"
            style={{ color: 'var(--color-text-terminal)', minWidth: 280, textAlign: 'center' }}
          >
            {displayedText}
            <span className="typewriter-cursor" />
          </div>

          {/* Progress bar */}
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 320,
              height: 3,
              background: 'rgba(0,170,255,0.1)',
              border: '1px solid rgba(0,170,255,0.2)',
            }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--color-orbit-blue), var(--color-signal))',
                width: `${progress}%`,
              }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span
            className="font-terminal text-xs mt-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {Math.round(progress)}%
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

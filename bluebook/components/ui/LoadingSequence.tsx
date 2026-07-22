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
  'Generating verification questions...',
  'Preparing knowledge system...',
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

  useEffect(() => {
    if (!isVisible) {
      setCurrentIndex(0);
      setDisplayedText('');
      setProgress(0);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    let p = 0;
    progressRef.current = setInterval(() => {
      p += 100 / 150;
      setProgress(Math.min(99, p));
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isVisible, messages.length]);

  useEffect(() => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    const msg = messages[currentIndex] ?? '';
    let i = 0;
    setDisplayedText('');
    typewriterRef.current = setInterval(() => {
      i++;
      setDisplayedText(msg.slice(0, i));
      if (i >= msg.length && typewriterRef.current) clearInterval(typewriterRef.current);
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
          style={{ background: 'var(--cds-background)' }}
        >
          {/* IBM Carbon loading spinner — concentric squares style */}
          <div className="relative mb-10" style={{ width: 80, height: 80 }}>
            {/* Outer rotating ring */}
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                border: '3px solid var(--cds-border-subtle)',
                borderTopColor: 'var(--ibm-blue-60)',
                borderRadius: '50%',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.0, ease: 'linear', repeat: Infinity }}
            />
            {/* Middle ring */}
            <motion.div
              style={{
                position: 'absolute',
                inset: 14,
                border: '2px solid var(--cds-border-subtle)',
                borderTopColor: 'var(--ibm-blue-40)',
                borderRadius: '50%',
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 1.6, ease: 'linear', repeat: Infinity }}
            />
            {/* Inner IBM blue dot */}
            <div
              className="animate-pulse-glow"
              style={{
                position: 'absolute',
                inset: 28,
                background: 'var(--ibm-blue-60)',
                borderRadius: '50%',
              }}
            />
          </div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold mb-6 tracking-widest"
            style={{ color: 'var(--cds-text-primary)', letterSpacing: '0.1em' }}
          >
            BUILDING YOUR KNOWLEDGE MAP
          </motion.h1>

          {/* Typewriter message */}
          <div
            className="font-terminal text-sm h-6 mb-8"
            style={{ color: 'var(--cds-text-secondary)', minWidth: 280, textAlign: 'center' }}
          >
            {displayedText}
            <span className="typewriter-cursor" />
          </div>

          {/* Progress bar — Carbon style (no rounded caps) */}
          <div
            style={{
              width: 320,
              height: 4,
              background: 'var(--cds-border-subtle)',
            }}
          >
            <motion.div
              style={{
                background: 'var(--ibm-blue-60)',
                height: '100%',
                width: `${progress}%`,
              }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span
            className="font-terminal text-xs mt-2"
            style={{ color: 'var(--cds-text-placeholder)' }}
          >
            {Math.round(progress)}%
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

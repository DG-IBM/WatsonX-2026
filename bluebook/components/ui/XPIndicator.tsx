'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XPIndicatorProps {
  amount: number;
  show: boolean;
  onComplete?: () => void;
}

export default function XPIndicator({ amount, show, onComplete }: XPIndicatorProps) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onComplete?.(), 1600);
    return () => clearTimeout(t);
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={`xp-${amount}`}
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-0, -20, -40, -70], scale: [0.5, 1.2, 1, 0.8] }}
          transition={{ duration: 1.5, times: [0, 0.3, 0.7, 1] }}
          className="pointer-events-none fixed top-1/3 left-1/2 z-50 font-terminal font-bold text-2xl"
          style={{
            color: 'var(--cds-support-warning)',
            transform: 'translateX(-50%)',
          }}
        >
          +{amount} XP
        </motion.div>
      )}
    </AnimatePresence>
  );
}

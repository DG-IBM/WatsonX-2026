'use client';

import { motion } from 'framer-motion';
import { getRankIcon, getRankDescription } from '@/lib/gameUtils';
import type { AstronautRank } from '@/types/orbit';

interface AstronautRankProps {
  rank: AstronautRank;
  totalXP: number;
  size?: 'sm' | 'lg';
}

export default function AstronautRankDisplay({ rank, totalXP, size = 'sm' }: AstronautRankProps) {
  const icon = getRankIcon(rank);
  const description = getRankDescription(rank);

  if (size === 'sm') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel"
        style={{ border: '1px solid rgba(255,215,0,0.2)' }}
      >
        <span className="text-sm">{icon}</span>
        <span className="font-terminal text-xs" style={{ color: 'var(--color-gold)' }}>
          {rank}
        </span>
        <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)' }}>
          ·
        </span>
        <span className="font-terminal text-xs" style={{ color: 'var(--color-gold)' }}>
          {totalXP} XP
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, delay: 0.5 }}
      className="flex flex-col items-center gap-4 p-8 glass-panel-bright rounded-2xl"
      style={{ border: '1px solid rgba(255,215,0,0.4)' }}
    >
      <motion.div
        className="text-7xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: 2 }}
      >
        {icon}
      </motion.div>
      <div className="text-center">
        <p className="font-terminal text-xs tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
          ASTRONAUT RANK
        </p>
        <h2 className="text-4xl font-bold mb-1 text-gradient-gold">{rank}</h2>
        <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      </div>
      <motion.div
        className="font-terminal text-2xl font-bold"
        style={{ color: 'var(--color-gold)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ⬡ {totalXP} XP TOTAL
      </motion.div>
    </motion.div>
  );
}

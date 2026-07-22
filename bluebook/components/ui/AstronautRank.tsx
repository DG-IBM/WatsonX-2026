'use client';

import { motion } from 'framer-motion';
import { getRankIcon, getRankDescription } from '@/lib/gameUtils';
import type { AstronautRank } from '@/types/bluebook';

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
        className="flex items-center gap-2 px-3 py-1.5 glass-panel"
        style={{ border: '1px solid rgba(241,194,27,0.25)' }}
      >
        <span className="text-sm">{icon}</span>
        <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-warning)' }}>
          {rank}
        </span>
        <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)' }}>
          ·
        </span>
        <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-warning)' }}>
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
      className="flex flex-col items-center gap-4 p-8 glass-panel-bright"
      style={{ border: '1px solid rgba(241,194,27,0.3)' }}
    >
      <motion.div
        className="text-7xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: 2 }}
      >
        {icon}
      </motion.div>
      <div className="text-center">
        <p className="font-terminal text-xs tracking-widest mb-1" style={{ color: 'var(--cds-text-placeholder)' }}>
          KNOWLEDGE LEVEL
        </p>
        <h2 className="text-4xl font-bold mb-1" style={{ color: 'var(--cds-support-warning)' }}>{rank}</h2>
        <p className="text-sm italic" style={{ color: 'var(--cds-text-secondary)' }}>
          {description}
        </p>
      </div>
      <motion.div
        className="font-terminal text-2xl font-bold"
        style={{ color: 'var(--cds-support-warning)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ⬡ {totalXP} XP TOTAL
      </motion.div>
    </motion.div>
  );
}

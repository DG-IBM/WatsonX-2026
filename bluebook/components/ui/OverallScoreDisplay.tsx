'use client';

import { motion } from 'framer-motion';
import type { OverallScore } from '@/types/bluebook';

interface OverallScoreDisplayProps {
  score: OverallScore;
}

export default function OverallScoreDisplay({ score }: OverallScoreDisplayProps) {
  if (score.totalNodes === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel px-4 py-3 flex flex-col gap-1.5"
      style={{ minWidth: 160 }}
    >
      {/* Completed fraction */}
      <div className="flex items-center justify-between gap-4">
        <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
          SCORE
        </span>
        <span className="font-terminal text-xs font-bold" style={{ color: 'var(--color-orbit-blue)' }}>
          {score.completedNodes}/{score.totalNodes}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(score.completedNodes / score.totalNodes) * 100}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
          style={{ background: 'var(--color-orbit-blue)' }}
        />
      </div>

      {/* Score breakdown dots */}
      {score.completedNodes > 0 && (
        <div className="flex items-center gap-2">
          {score.greenNodes > 0 && (
            <span className="font-terminal text-xs" style={{ color: '#22c55e', fontSize: '10px' }}>
              ● {score.greenNodes}
            </span>
          )}
          {score.yellowNodes > 0 && (
            <span className="font-terminal text-xs" style={{ color: '#f59e0b', fontSize: '10px' }}>
              ● {score.yellowNodes}
            </span>
          )}
          {score.redNodes > 0 && (
            <span className="font-terminal text-xs" style={{ color: '#ef4444', fontSize: '10px' }}>
              ● {score.redNodes}
            </span>
          )}
          {score.averagePercentage > 0 && (
            <span className="font-terminal text-xs ml-auto" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              avg {score.averagePercentage}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

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
        <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px' }}>
          SCORE
        </span>
        <span className="font-terminal text-xs font-bold" style={{ color: 'var(--ibm-blue-40)' }}>
          {score.completedNodes}/{score.totalNodes}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full overflow-hidden"
        style={{ height: 4, background: 'var(--cds-border-subtle)', borderRadius: 2 }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(score.completedNodes / score.totalNodes) * 100}%` }}
          transition={{ duration: 0.5 }}
          className="h-full"
          style={{ background: 'var(--ibm-blue-60)', borderRadius: 2 }}
        />
      </div>

      {/* Score breakdown dots */}
      {score.completedNodes > 0 && (
        <div className="flex items-center gap-2">
          {score.greenNodes > 0 && (
            <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-success)', fontSize: '10px' }}>
              ● {score.greenNodes}
            </span>
          )}
          {score.yellowNodes > 0 && (
            <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-warning)', fontSize: '10px' }}>
              ● {score.yellowNodes}
            </span>
          )}
          {score.redNodes > 0 && (
            <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-error)', fontSize: '10px' }}>
              ● {score.redNodes}
            </span>
          )}
          {score.averagePercentage > 0 && (
            <span className="font-terminal text-xs ml-auto" style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px' }}>
              avg {score.averagePercentage}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

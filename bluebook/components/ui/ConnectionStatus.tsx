'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Database, ArrowRight } from 'lucide-react';
import type { MCPConnection } from '@/types/bluebook';

interface ConnectionStatusProps {
  connection: MCPConnection;
  onLaunch: () => void;
  onRetry: () => void;
}

export default function ConnectionStatus({ connection, onLaunch, onRetry }: ConnectionStatusProps) {
  const { status, sources, documentCount } = connection;

  return (
    <AnimatePresence mode="wait">
      {status === 'connecting' && (
        <motion.div
          key="connecting"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center gap-3 py-2"
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse-glow"
            style={{ background: 'var(--color-orbit-blue)' }}
          />
          <span
            className="font-terminal text-sm"
            style={{ color: 'var(--color-orbit-blue)' }}
          >
            Establishing secure link
            <AnimatedDots />
          </span>
        </motion.div>
      )}

      {status === 'connected' && (
        <motion.div
          key="connected"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          {/* Success header */}
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            >
              <CheckCircle size={22} style={{ color: 'var(--color-signal)' }} />
            </motion.div>
            <span
              className="font-terminal text-sm tracking-widest"
              style={{ color: 'var(--color-signal)' }}
            >
              CONNECTION ESTABLISHED
            </span>
          </div>

          {/* Sources grid */}
          <div className="grid grid-cols-3 gap-2">
            {sources.map((src) => (
              <motion.div
                key={src.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center gap-1 rounded p-3"
                style={{
                  background: 'rgba(0,255,136,0.05)',
                  border: '1px solid rgba(0,255,136,0.2)',
                }}
              >
                <Database size={14} style={{ color: 'var(--color-signal)' }} />
                <span className="font-terminal text-xs" style={{ color: 'var(--color-text-primary)' }}>
                  {src.name}
                </span>
                <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {src.count} {src.count === 1 ? 'document' : 'documents'}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Total count */}
          <p className="font-terminal text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
            {documentCount} document{documentCount !== 1 ? 's' : ''} indexed and ready
          </p>

          {/* Launch button */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onLaunch}
            className="w-full flex items-center justify-center gap-2 py-3 rounded font-terminal text-sm tracking-widest font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--color-signal), var(--color-orbit-blue))',
              color: 'var(--color-void)',
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0,255,136,0.4)' }}
            whileTap={{ scale: 0.98 }}
          >
            LAUNCH MISSION
            <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      )}

      {status === 'failed' && (
        <motion.div
          key="failed"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <XCircle size={20} style={{ color: 'var(--color-alert)' }} />
            <span className="font-terminal text-sm" style={{ color: 'var(--color-alert)' }}>
              CONNECTION FAILED
            </span>
          </div>
          {connection.sources.length === 0 && (
            <p className="font-terminal text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Could not reach the MCP server. Check the URL and token.
            </p>
          )}
          <button
            onClick={onRetry}
            className="w-full py-2 rounded font-terminal text-sm transition-all"
            style={{
              border: '1px solid var(--color-alert)',
              color: 'var(--color-alert)',
              background: 'rgba(255,68,68,0.05)',
            }}
          >
            RETRY CONNECTION
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AnimatedDots() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1.2, repeat: Infinity }}
    >
      ...
    </motion.span>
  );
}

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
            className="w-2 h-2 animate-pulse-glow"
            style={{ background: 'var(--ibm-blue-40)', borderRadius: 1 }}
          />
          <span
            className="font-terminal text-sm"
            style={{ color: 'var(--ibm-blue-40)' }}
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
              <CheckCircle size={22} style={{ color: 'var(--cds-support-success)' }} />
            </motion.div>
            <span
              className="font-terminal text-sm tracking-widest"
              style={{ color: 'var(--cds-support-success)' }}
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
                className="flex flex-col items-center gap-1 p-3"
                style={{
                  background: 'var(--cds-support-success-bg)',
                  border: '1px solid rgba(66,190,101,0.25)',
                }}
              >
                <Database size={14} style={{ color: 'var(--cds-support-success)' }} />
                <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-primary)' }}>
                  {src.name}
                </span>
                <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)' }}>
                  {src.count} {src.count === 1 ? 'document' : 'documents'}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Total count */}
          <p className="font-terminal text-xs text-center" style={{ color: 'var(--cds-text-secondary)' }}>
            {documentCount} document{documentCount !== 1 ? 's' : ''} indexed and ready
          </p>

          {/* Launch button */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onLaunch}
            className="w-full flex items-center justify-center gap-2 py-3 font-terminal text-sm tracking-widest font-bold transition-all"
            style={{
              background: 'var(--ibm-blue-60)',
              color: '#ffffff',
              border: '1px solid var(--cds-border-interactive)',
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            START VERIFICATION
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
            <XCircle size={20} style={{ color: 'var(--cds-support-error)' }} />
            <span className="font-terminal text-sm" style={{ color: 'var(--cds-support-error)' }}>
              CONNECTION FAILED
            </span>
          </div>
          {connection.sources.length === 0 && (
            <p className="font-terminal text-xs" style={{ color: 'var(--cds-text-secondary)' }}>
              Could not reach the MCP server. Check the URL and token.
            </p>
          )}
          <button
            onClick={onRetry}
            className="w-full py-2 font-terminal text-sm transition-all"
            style={{
              border: '1px solid var(--cds-support-error)',
              color: 'var(--cds-support-error)',
              background: 'var(--cds-support-error-bg)',
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

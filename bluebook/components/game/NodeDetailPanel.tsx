'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, BookOpen, Target, Users, FileText,
  ChevronDown, ChevronUp, AlertTriangle, RotateCcw,
  CheckCircle, Hash
} from 'lucide-react';
import type { KnowledgeNode } from '@/types/bluebook';

interface NodeDetailPanelProps {
  node: KnowledgeNode;
  onClose: () => void;
  onStartQuiz: () => void;
}

const SECTION_LABEL = (
  icon: React.ReactNode,
  text: string,
  color = 'var(--ibm-blue-40)'
) => (
  <div className="flex items-center gap-2 mb-3">
    <span style={{ color, flexShrink: 0 }}>{icon}</span>
    <span
      className="font-terminal text-xs tracking-widest"
      style={{ color, fontSize: '11px', letterSpacing: '0.14em' }}
    >
      {text}
    </span>
    <div className="flex-1 h-px" style={{ background: 'var(--cds-border-subtle)' }} />
  </div>
);

// A node is enriched once the LLM has filled in its content.
// The skeleton from the architect only has a one-sentence description and empty arrays.
function isNodeEnriched(node: KnowledgeNode): boolean {
  return node.keyTakeaways.length > 0 || !!node.roleRelevance;
}

// Animated shimmer skeleton block
function SkeletonBlock({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 2,
        background: 'var(--cds-layer-03)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export default function NodeDetailPanel({ node, onClose, onStartQuiz }: NodeDetailPanelProps) {
  const [sourcesOpen, setSourcesOpen] = useState(node.sources.length > 0);
  const [showQuizButton, setShowQuizButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasScore = node.score !== null;
  const enriched = isNodeEnriched(node);

  // Show quiz button after 20 seconds or near-bottom scroll — only once enriched
  useEffect(() => {
    setShowQuizButton(hasScore); // immediately show if retaking
    if (!hasScore && enriched) {
      timerRef.current = setTimeout(() => setShowQuizButton(true), 20000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [node.id, hasScore, enriched]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) setShowQuizButton(true);
  };

  const nodeColourStyle = hasScore
    ? node.score!.nodeColour === 'green'
      ? { color: 'var(--cds-support-success)', bg: 'var(--cds-support-success-bg)', border: 'rgba(66,190,101,0.3)' }
      : node.score!.nodeColour === 'yellow'
      ? { color: 'var(--cds-support-warning)', bg: 'var(--cds-support-warning-bg)', border: 'rgba(241,194,27,0.3)' }
      : { color: 'var(--cds-support-error)', bg: 'var(--cds-support-error-bg)', border: 'rgba(250,77,86,0.3)' }
    : null;

  return (
    <div
      className="planet-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass-panel-bright w-full relative flex flex-col"
        style={{ maxWidth: 880, maxHeight: '92vh' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 z-10 transition-all"
          style={{ background: 'var(--cds-layer-03)', border: '1px solid var(--cds-border-subtle)', color: 'var(--cds-text-secondary)', borderRadius: 4 }}
        >
          <X size={16} />
        </button>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="px-7 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--cds-border-subtle)' }}>
          <div className="flex items-start gap-3 pr-10">
            <div
              className="w-3 h-3 mt-2 flex-shrink-0"
              style={{ background: node.visualConfig.color, borderRadius: 2 }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px' }}>
                  TOPIC {String(node.order).padStart(2, '0')}
                </span>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--cds-text-primary)', lineHeight: 1.2 }}>
                {node.title}
              </h2>
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--cds-text-secondary)' }}>
                  <Hash size={10} />
                  {node.sources.length} source{node.sources.length !== 1 ? 's' : ''}
                </span>
                {node.keyContacts.length > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--cds-text-secondary)' }}>
                    <Users size={10} />
                    {node.keyContacts.length} contact{node.keyContacts.length !== 1 ? 's' : ''}
                  </span>
                )}
                {/* Status badge */}
                {hasScore && nodeColourStyle ? (
                  <span
                    className="font-terminal text-xs px-2 py-0.5"
                    style={{ background: nodeColourStyle.bg, border: `1px solid ${nodeColourStyle.border}`, color: nodeColourStyle.color, fontSize: '10px', borderRadius: 2 }}
                  >
                    {node.score!.nodeColour.toUpperCase()} · {node.score!.percentage}%  ({node.score!.correctAnswers}/{node.score!.totalQuestions})
                  </span>
                ) : node.status === 'reading' ? (
                  <span className="font-terminal text-xs px-2 py-0.5" style={{ background: 'var(--cds-support-info-bg)', border: '1px solid rgba(69,137,255,0.3)', color: 'var(--ibm-blue-40)', fontSize: '10px', borderRadius: 2 }}>
                    READING
                  </span>
                ) : (
                  <span className="font-terminal text-xs px-2 py-0.5" style={{ background: 'var(--cds-layer-03)', border: '1px solid var(--cds-border-subtle)', color: 'var(--cds-text-placeholder)', fontSize: '10px', borderRadius: 2 }}>
                    NEW
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body (two-column on wide screens) ───────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="px-7 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* LEFT COLUMN — main content (2/3) */}
            <div className="md:col-span-2 flex flex-col gap-6">

              {/* Score recap for completed nodes */}
              {hasScore && nodeColourStyle && (
                <div
                  className="p-4 flex items-start gap-4"
                  style={{ background: nodeColourStyle.bg, border: `1px solid ${nodeColourStyle.border}` }}
                >
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <span className="font-terminal font-bold text-2xl" style={{ color: nodeColourStyle.color }}>
                      {node.score!.percentage}%
                    </span>
                    <span className="font-terminal text-xs" style={{ color: nodeColourStyle.color, fontSize: '9px' }}>
                      {node.score!.correctAnswers}/{node.score!.totalQuestions}
                    </span>
                  </div>
                  <div>
                    <div className="font-terminal text-xs mb-1" style={{ color: nodeColourStyle.color, fontSize: '11px' }}>
                      {node.score!.nodeColour === 'green' ? 'STRONG UNDERSTANDING'
                        : node.score!.nodeColour === 'yellow' ? 'PARTIAL — REVIEW RECOMMENDED'
                        : 'NEEDS REVISIT'}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--cds-text-secondary)', lineHeight: 1.6 }}>
                      {node.score!.nodeColour === 'green'
                        ? "You demonstrated solid understanding of this topic. You're ready to work with this area."
                        : node.score!.nodeColour === 'yellow'
                        ? "Good start — a few gaps remain. Re-read the key takeaways and retake the quiz when ready."
                        : "This area needs more attention before you work with it. Review the summary and talk to the key contacts."}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Loading skeleton shown until enrichment arrives ── */}
              {!enriched ? (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 animate-pulse-glow" style={{ background: 'var(--ibm-blue-40)', borderRadius: 1 }} />
                    <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)', fontSize: '11px' }}>
                      GENERATING CONTENT...
                    </span>
                  </div>
                  <SkeletonBlock height={14} width="90%" />
                  <SkeletonBlock height={14} width="100%" />
                  <SkeletonBlock height={14} width="75%" />
                  <SkeletonBlock height={14} width="85%" />
                  <SkeletonBlock height={14} width="60%" />
                  <div className="flex flex-col gap-2 mt-2">
                    <SkeletonBlock height={44} />
                    <SkeletonBlock height={44} />
                    <SkeletonBlock height={44} />
                  </div>
                </section>
              ) : (
                <>
              {/* Summary */}
              <section>
                {SECTION_LABEL(<BookOpen size={13} />, 'OVERVIEW')}
                <p className="text-sm leading-relaxed" style={{ color: 'var(--cds-text-primary)', lineHeight: 1.85 }}>
                  {node.summary}
                </p>
              </section>

              {/* Key Takeaways */}
              {node.keyTakeaways.length > 0 && (
                <section>
                  {SECTION_LABEL(<CheckCircle size={13} />, 'KEY TAKEAWAYS', 'var(--cds-support-success)')}
                  <ul className="flex flex-col gap-3">
                    {node.keyTakeaways.map((t, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className="font-terminal flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs"
                          style={{ background: 'var(--cds-support-success-bg)', color: 'var(--cds-support-success)', border: '1px solid rgba(66,190,101,0.25)', marginTop: 1 }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--cds-text-primary)', lineHeight: 1.75 }}>
                          {t}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Role Relevance */}
              <section>
                <div
                  className="p-4"
                  style={{ background: 'rgba(190,149,255,0.07)', border: '1px solid rgba(190,149,255,0.2)', borderLeft: '3px solid var(--ibm-purple-40)', borderRadius: 4 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={13} style={{ color: 'var(--ibm-purple-40)' }} />
                    <span className="font-terminal text-xs tracking-widest" style={{ color: 'var(--ibm-purple-40)', fontSize: '11px' }}>
                      WHY THIS MATTERS FOR YOUR ROLE
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--cds-text-primary)', lineHeight: 1.75 }}>
                    {node.roleRelevance}
                  </p>
                </div>
              </section>

              {/* Diagrams */}
              {node.diagrams.length > 0 && (
                <section>
                  {SECTION_LABEL(<span style={{ fontSize: 13 }}>◈</span>, 'DIAGRAMS', 'var(--cds-support-warning)')}
                  <div className="flex flex-col gap-4">
                    {node.diagrams.map((d, i) => (
                      <div key={i} className="overflow-hidden" style={{ border: '1px solid var(--cds-border-subtle)', borderRadius: 4 }}>
                        <div className="px-4 py-2 font-terminal text-xs flex items-center justify-between"
                          style={{ background: 'var(--cds-layer-03)', color: 'var(--ibm-blue-40)', borderBottom: '1px solid var(--cds-border-subtle)', fontSize: '11px' }}>
                          {d.title}
                        </div>
                        <pre className="px-4 py-4 overflow-x-auto text-xs leading-relaxed"
                          style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ibm-blue-20)', background: 'var(--cds-background)', margin: 0, lineHeight: 1.7 }}>
                          {d.content}
                        </pre>
                        {d.caption && (
                          <div className="px-4 py-2 text-xs italic" style={{ color: 'var(--cds-text-secondary)', background: 'var(--cds-layer-03)' }}>
                            {d.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sources — always expanded by default */}
              <section>
                <button
                  onClick={() => setSourcesOpen((o) => !o)}
                  className="w-full flex items-center gap-2 py-2.5 px-3 transition-all mb-0"
                  style={{ background: 'var(--cds-layer-03)', border: '1px solid var(--cds-border-subtle)', borderRadius: 4 }}
                >
                  <FileText size={13} style={{ color: 'var(--cds-text-placeholder)' }} />
                  <span className="font-terminal text-xs flex-1 text-left" style={{ color: 'var(--cds-text-secondary)', fontSize: '11px' }}>
                    SOURCES USED ({node.sources.length})
                  </span>
                  {sourcesOpen
                    ? <ChevronUp size={13} style={{ color: 'var(--cds-text-placeholder)' }} />
                    : <ChevronDown size={13} style={{ color: 'var(--cds-text-placeholder)' }} />}
                </button>
                <AnimatePresence initial={false}>
                  {sourcesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-2 pt-2">
                        {node.sources.map((s, i) => (
                          <div key={i} className="p-3" style={{ background: 'var(--cds-layer-03)', border: '1px solid var(--cds-border-subtle)', borderRadius: 4 }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-terminal text-xs px-1.5 py-0.5" style={{ background: 'var(--cds-support-info-bg)', color: 'var(--ibm-blue-40)', fontSize: '9px', borderRadius: 2 }}>
                                {s.source}
                              </span>
                              <span className="text-sm font-medium" style={{ color: 'var(--cds-text-primary)' }}>
                                {s.documentTitle}
                              </span>
                            </div>
                            {s.excerpt && (
                              <p className="text-xs italic pl-2" style={{ color: 'var(--cds-text-placeholder)', lineHeight: 1.65, borderLeft: '2px solid var(--cds-border-interactive)' }}>
                                &ldquo;{s.excerpt}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
                </>
              )}
            </div>

            {/* RIGHT COLUMN — context (1/3) */}
            <div className="flex flex-col gap-5">

              {/* Key Contacts */}
              {node.keyContacts.length > 0 && (
                <section>
                  {SECTION_LABEL(<Users size={13} />, 'KEY CONTACTS', 'var(--cds-support-warning)')}
                  <div className="flex flex-col gap-2">
                    {node.keyContacts.map((c, i) => (
                      <div key={i} className="p-3" style={{ background: 'var(--cds-support-warning-bg)', border: '1px solid rgba(241,194,27,0.2)', borderRadius: 4 }}>
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-7 h-7 flex-shrink-0 flex items-center justify-center font-terminal font-bold text-xs"
                            style={{ background: 'rgba(241,194,27,0.2)', color: 'var(--cds-support-warning)', marginTop: 1, borderRadius: 2 }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm" style={{ color: 'var(--cds-text-primary)' }}>{c.name}</div>
                            <div className="text-xs mb-1" style={{ color: 'var(--cds-text-secondary)', fontSize: '11px' }}>{c.role}</div>
                            <div className="text-xs" style={{ color: 'var(--cds-text-placeholder)', lineHeight: 1.55 }}>{c.relevance}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Revisit warning for flagged nodes */}
              {hasScore && node.score!.nodeColour !== 'green' && (
                <div
                  className="p-3 flex items-start gap-2.5"
                  style={{
                    background: node.score!.nodeColour === 'red' ? 'var(--cds-support-error-bg)' : 'var(--cds-support-warning-bg)',
                    border: `1px solid ${node.score!.nodeColour === 'red' ? 'rgba(250,77,86,0.3)' : 'rgba(241,194,27,0.3)'}`,
                    borderRadius: 4,
                  }}
                >
                  {node.score!.nodeColour === 'red'
                    ? <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                    : <RotateCcw size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />}
                  <p className="text-xs" style={{ color: 'var(--cds-text-secondary)', lineHeight: 1.6 }}>
                    {node.score!.nodeColour === 'red'
                      ? 'Flagged for revisit. Review the summary and retake.'
                      : 'Review recommended. Retake to improve your score.'}
                  </p>
                </div>
              )}

              {/* Spacer */}
              <div style={{ height: 8 }} />
            </div>
          </div>

          {/* Bottom padding for quiz button */}
          <div style={{ height: 88 }} />
        </div>

        {/* ── Sticky quiz CTA ─────────────────────────────────── */}
        <div
          className="px-7 pb-5 pt-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--cds-border-subtle)' }}
        >
          <AnimatePresence mode="wait">
            {showQuizButton || hasScore ? (
              <motion.button
                key="quiz-btn"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onStartQuiz}
                className="w-full flex items-center justify-center gap-2 py-3.5 font-terminal text-sm tracking-widest font-bold transition-all"
                style={{
                  background: hasScore ? 'var(--cds-layer-03)' : 'var(--ibm-blue-60)',
                  color: '#fff',
                  border: hasScore
                    ? '1px solid var(--cds-border-strong)'
                    : '1px solid var(--cds-border-interactive)',
                  borderRadius: 4,
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {hasScore ? (
                  <><RotateCcw size={15} /> RETAKE QUIZ</>
                ) : (
                  'GOT IT — START QUIZ'
                )}
              </motion.button>
            ) : (
              <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
                <p className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)', fontSize: '11px' }}>
                  Read through the content above — quiz unlocks as you scroll.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

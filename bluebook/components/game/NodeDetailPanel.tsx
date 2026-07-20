'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, BookOpen, Target, Users, Link2, FileText,
  ChevronDown, ChevronUp, AlertTriangle, RotateCcw,
  CheckCircle, ExternalLink, Hash
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
  color = 'var(--color-orbit-blue)'
) => (
  <div className="flex items-center gap-2 mb-3">
    <span style={{ color, flexShrink: 0 }}>{icon}</span>
    <span
      className="font-terminal text-xs tracking-widest"
      style={{ color, fontSize: '11px', letterSpacing: '0.14em' }}
    >
      {text}
    </span>
    <div className="flex-1 h-px" style={{ background: `${color}22` }} />
  </div>
);

export default function NodeDetailPanel({ node, onClose, onStartQuiz }: NodeDetailPanelProps) {
  const [sourcesOpen, setSourcesOpen] = useState(node.sources.length > 0);
  const [showQuizButton, setShowQuizButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasScore = node.score !== null;

  // Show quiz button after 20 seconds or near-bottom scroll
  useEffect(() => {
    setShowQuizButton(hasScore); // immediately show if retaking
    if (!hasScore) {
      timerRef.current = setTimeout(() => setShowQuizButton(true), 20000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [node.id, hasScore]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) setShowQuizButton(true);
  };

  const nodeColourStyle = hasScore
    ? node.score!.nodeColour === 'green'
      ? { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' }
      : node.score!.nodeColour === 'yellow'
      ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' }
      : { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' }
    : null;

  const linkTypeLabel: Record<string, string> = {
    document: 'DOC', ticket: 'TICKET', repo: 'REPO', confluence: 'WIKI', other: 'LINK',
  };

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
          className="absolute top-4 right-4 p-2 rounded-full z-10 transition-all"
          style={{ background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.2)', color: 'var(--color-text-secondary)' }}
        >
          <X size={16} />
        </button>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="px-7 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,170,255,0.12)' }}>
          <div className="flex items-start gap-3 pr-10">
            <div
              className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
              style={{ background: node.visualConfig.color, boxShadow: `0 0 8px ${node.visualConfig.emissiveColor}` }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                  TOPIC {String(node.order).padStart(2, '0')}
                </span>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {node.title}
              </h2>
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <Hash size={10} />
                  {node.sources.length} source{node.sources.length !== 1 ? 's' : ''}
                </span>
                {node.keyContacts.length > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <Users size={10} />
                    {node.keyContacts.length} contact{node.keyContacts.length !== 1 ? 's' : ''}
                  </span>
                )}
                {/* Status badge */}
                {hasScore && nodeColourStyle ? (
                  <span
                    className="font-terminal text-xs px-2 py-0.5 rounded-full"
                    style={{ background: nodeColourStyle.bg, border: `1px solid ${nodeColourStyle.border}`, color: nodeColourStyle.color, fontSize: '10px' }}
                  >
                    {node.score!.nodeColour.toUpperCase()} · {node.score!.percentage}%  ({node.score!.correctAnswers}/{node.score!.totalQuestions})
                  </span>
                ) : node.status === 'reading' ? (
                  <span className="font-terminal text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,170,255,0.1)', border: '1px solid rgba(0,170,255,0.3)', color: 'var(--color-orbit-blue)', fontSize: '10px' }}>
                    READING
                  </span>
                ) : (
                  <span className="font-terminal text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-muted)', fontSize: '10px' }}>
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
                  className="rounded-xl p-4 flex items-start gap-4"
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
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      {node.score!.nodeColour === 'green'
                        ? "You demonstrated solid understanding of this topic. You're ready to work with this area."
                        : node.score!.nodeColour === 'yellow'
                        ? "Good start — a few gaps remain. Re-read the key takeaways and retake the quiz when ready."
                        : "This area needs more attention before you work with it. Review the summary and talk to the key contacts."}
                    </p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <section>
                {SECTION_LABEL(<BookOpen size={13} />, 'OVERVIEW')}
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.85 }}>
                  {node.summary}
                </p>
              </section>

              {/* Key Takeaways */}
              {node.keyTakeaways.length > 0 && (
                <section>
                  {SECTION_LABEL(<CheckCircle size={13} />, 'KEY TAKEAWAYS', 'var(--color-signal)')}
                  <ul className="flex flex-col gap-3">
                    {node.keyTakeaways.map((t, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className="font-terminal flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs"
                          style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-signal)', border: '1px solid rgba(0,255,136,0.2)', marginTop: 1 }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--color-text-primary)', lineHeight: 1.75 }}>
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
                  className="p-4 rounded-xl"
                  style={{ background: 'rgba(155,89,182,0.07)', border: '1px solid rgba(155,89,182,0.25)', borderLeft: '3px solid #9b59b6' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={13} style={{ color: '#b06fe0' }} />
                    <span className="font-terminal text-xs tracking-widest" style={{ color: '#b06fe0', fontSize: '11px' }}>
                      WHY THIS MATTERS FOR YOUR ROLE
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.75 }}>
                    {node.roleRelevance}
                  </p>
                </div>
              </section>

              {/* Diagrams */}
              {node.diagrams.length > 0 && (
                <section>
                  {SECTION_LABEL(<span style={{ fontSize: 13 }}>◈</span>, 'DIAGRAMS', 'var(--color-gold)')}
                  <div className="flex flex-col gap-4">
                    {node.diagrams.map((d, i) => (
                      <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,170,255,0.15)' }}>
                        <div className="px-4 py-2 font-terminal text-xs flex items-center justify-between"
                          style={{ background: 'rgba(0,170,255,0.06)', color: 'var(--color-orbit-blue)', borderBottom: '1px solid rgba(0,170,255,0.15)', fontSize: '11px' }}>
                          {d.title}
                        </div>
                        <pre className="px-4 py-4 overflow-x-auto text-xs leading-relaxed"
                          style={{ fontFamily: "'Space Mono', monospace", color: '#a0c8e8', background: 'rgba(4,10,20,0.8)', margin: 0, lineHeight: 1.7 }}>
                          {d.content}
                        </pre>
                        {d.caption && (
                          <div className="px-4 py-2 text-xs italic" style={{ color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.2)' }}>
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
                  className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl transition-all mb-0"
                  style={{ background: 'rgba(0,170,255,0.04)', border: '1px solid rgba(0,170,255,0.1)' }}
                >
                  <FileText size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="font-terminal text-xs flex-1 text-left" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                    SOURCES USED ({node.sources.length})
                  </span>
                  {sourcesOpen
                    ? <ChevronUp size={13} style={{ color: 'var(--color-text-muted)' }} />
                    : <ChevronDown size={13} style={{ color: 'var(--color-text-muted)' }} />}
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
                          <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(6,13,26,0.6)', border: '1px solid rgba(0,170,255,0.1)' }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-terminal text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,170,255,0.1)', color: 'var(--color-orbit-blue)', fontSize: '9px' }}>
                                {s.source}
                              </span>
                              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {s.documentTitle}
                              </span>
                            </div>
                            {s.excerpt && (
                              <p className="text-xs italic pl-2" style={{ color: 'var(--color-text-muted)', lineHeight: 1.65, borderLeft: '2px solid rgba(0,170,255,0.2)' }}>
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
            </div>

            {/* RIGHT COLUMN — context (1/3) */}
            <div className="flex flex-col gap-5">

              {/* Key Contacts */}
              {node.keyContacts.length > 0 && (
                <section>
                  {SECTION_LABEL(<Users size={13} />, 'KEY CONTACTS', '#ffb400')}
                  <div className="flex flex-col gap-2">
                    {node.keyContacts.map((c, i) => (
                      <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.15)' }}>
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center font-terminal font-bold text-xs"
                            style={{ background: 'rgba(255,180,0,0.15)', color: '#ffb400', marginTop: 1 }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.name}</div>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{c.role}</div>
                            <div className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.55 }}>{c.relevance}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Links */}
              {node.links.length > 0 && (
                <section>
                  {SECTION_LABEL(<Link2 size={13} />, 'REFERENCES')}
                  <div className="flex flex-col gap-1.5">
                    {node.links.map((l, i) => (
                      <a
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                        style={{ background: 'rgba(0,170,255,0.05)', border: '1px solid rgba(0,170,255,0.15)', color: 'var(--color-orbit-blue)', textDecoration: 'none' }}
                      >
                        <span className="font-terminal text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(0,170,255,0.12)', fontSize: '9px' }}>
                          {linkTypeLabel[l.type] ?? 'LINK'}
                        </span>
                        <span className="text-xs flex-1 min-w-0 truncate">{l.label}</span>
                        <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Revisit warning for flagged nodes */}
              {hasScore && node.score!.nodeColour !== 'green' && (
                <div
                  className="p-3 rounded-xl flex items-start gap-2.5"
                  style={{
                    background: node.score!.nodeColour === 'red' ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
                    border: `1px solid ${node.score!.nodeColour === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}
                >
                  {node.score!.nodeColour === 'red'
                    ? <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                    : <RotateCcw size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />}
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
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
          style={{ borderTop: '1px solid rgba(0,170,255,0.1)' }}
        >
          <AnimatePresence mode="wait">
            {showQuizButton || hasScore ? (
              <motion.button
                key="quiz-btn"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onStartQuiz}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
                style={{
                  background: hasScore
                    ? 'linear-gradient(135deg, #2a2a4a, #1a1a32)'
                    : 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))',
                  color: '#fff',
                  border: hasScore ? '1px solid rgba(255,255,255,0.12)' : 'none',
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
                <p className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
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

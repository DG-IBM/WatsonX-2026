'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useBluebookStore } from '@/store/bluebookStore';
import NodeMap from '@/components/game/NodeMap';
import NodeDetailPanel from '@/components/game/NodeDetailPanel';
import QuizOverlay from '@/components/game/QuizOverlay';
import ChatSidebar from '@/components/layout/ChatSidebar';
import OverallScoreDisplay from '@/components/ui/OverallScoreDisplay';
import OnboardingBriefingCard from '@/components/layout/OnboardingBriefingCard';
import type { KnowledgeNode, QuizScore } from '@/types/bluebook';

export default function SolarSystemScreen() {
  const {
    nodes,
    overallScore,
    selectedNodeId,
    userProfile,
    onboardingBriefingCard,
    selectNode,
    updateNodeScore,
    updateNodeStatus,
    setChatOpen,
  } = useBluebookStore();

  const [quizNodeId, setQuizNodeId] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const quizNode = nodes.find((n) => n.id === quizNodeId) ?? null;
  const completedCount = nodes.filter((n) => n.status === 'complete').length;

  const handleNodeClick = useCallback(
    (node: KnowledgeNode) => { selectNode(node.id); },
    [selectNode]
  );

  const handleCloseDetail = useCallback(() => { selectNode(null); }, [selectNode]);

  const handleStartQuiz = useCallback(() => {
    if (!selectedNodeId) return;
    setQuizNodeId(selectedNodeId);
    selectNode(null);
  }, [selectedNodeId, selectNode]);

  const handleQuizComplete = useCallback(
    (score: QuizScore) => {
      if (!quizNodeId) return;
      updateNodeScore(quizNodeId, score);
    },
    [quizNodeId, updateNodeScore]
  );

  const handleQuizBack = useCallback(() => {
    const nodeId = quizNodeId;
    setQuizNodeId(null);
    if (nodeId) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node && node.status !== 'complete') {
        updateNodeStatus(nodeId, 'complete');
      }
    }
  }, [quizNodeId, nodes, updateNodeStatus]);

  const readinessColour = {
    'Not Started':     { fg: 'var(--cds-text-placeholder)', bg: 'rgba(255,255,255,0.04)' },
    'In Progress':     { fg: 'var(--ibm-blue-40)',          bg: 'var(--cds-support-info-bg)' },
    'Partially Ready': { fg: 'var(--cds-support-warning)',  bg: 'var(--cds-support-warning-bg)' },
    'Ready':           { fg: 'var(--cds-support-success)',  bg: 'var(--cds-support-success-bg)' },
    'Fully Prepared':  { fg: 'var(--cds-support-success)',  bg: 'var(--cds-support-success-bg)' },
  };
  const rc = readinessColour[overallScore.readinessLevel];

  const hasBriefing = !!onboardingBriefingCard && !!userProfile;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: 'var(--cds-background)' }}
    >

      {/* ── Onboarding briefing card (left sidebar) ──────── */}
      {hasBriefing && (
        <OnboardingBriefingCard
          card={onboardingBriefingCard!}
          userProfile={userProfile!}
          nodes={nodes}
          onNodeClick={handleNodeClick}
        />
      )}

      {/* ── Main content area (node map) ──────────────────── */}
      <div className="absolute inset-0 transition-all duration-300">
        {/* Subtle Carbon grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(var(--cds-border-subtle) 1px, transparent 1px),
              linear-gradient(90deg, var(--cds-border-subtle) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            opacity: 0.35,
          }}
        />

        <NodeMap
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* ── HUD overlay ───────────────────────────────────── */}
      <div className="hud-overlay no-print">
        {/* TOP LEFT — brand */}
        <div
          className="absolute top-4 left-4 flex items-center gap-3 px-3 py-2"
          style={{
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle)',
            borderRadius: 4,
          }}
        >
          <span
            className="font-bold tracking-widest"
            style={{ color: 'var(--ibm-blue-40)', fontSize: '14px', letterSpacing: '0.1em' }}
          >
            IBM BLUEBOOK
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 animate-pulse-glow" style={{ background: 'var(--cds-support-success)', borderRadius: 1 }} />
            <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-success)', fontSize: '10px' }}>
              ACTIVE
            </span>
          </div>
        </div>

        {/* TOP RIGHT — readiness + chat */}
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <div
            className="px-3 py-1.5 font-terminal text-xs font-bold"
            style={{
              background: rc.bg,
              color: rc.fg,
              border: `1px solid ${rc.fg}44`,
              fontSize: '11px',
              borderRadius: 4,
            }}
          >
            {overallScore.readinessLevel.toUpperCase()}
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="p-2.5 transition-all"
            style={{
              background: 'var(--cds-layer-01)',
              border: '1px solid var(--cds-border-subtle)',
              borderRadius: 4,
            }}
          >
            <MessageSquare size={18} style={{ color: 'var(--ibm-blue-40)' }} />
          </button>
        </div>

        {/* BOTTOM LEFT — progress indicators */}
        <div
          className="absolute bottom-6 left-4 flex flex-col gap-2 px-3 py-2"
          style={{
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle)',
            borderRadius: 4,
          }}
        >
          <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px' }}>
            {completedCount} / {nodes.length} TOPICS VERIFIED
          </span>
          <div className="flex gap-1.5">
            {nodes.map((n) => {
              const dotColor = n.status === 'complete'
                ? (n.score?.nodeColour === 'green'
                  ? 'var(--cds-support-success)'
                  : n.score?.nodeColour === 'red'
                  ? 'var(--cds-support-error)'
                  : 'var(--cds-support-warning)')
                : n.status === 'reading'
                ? 'var(--ibm-blue-40)'
                : 'var(--cds-border-strong)';
              return (
                <div
                  key={n.id}
                  title={n.title}
                  className="w-2 h-2 transition-all cursor-pointer"
                  style={{ background: dotColor, borderRadius: 2 }}
                  onClick={() => handleNodeClick(n)}
                />
              );
            })}
          </div>
        </div>

        {/* BOTTOM RIGHT — overall score */}
        <div className="absolute bottom-6 right-4">
          <OverallScoreDisplay score={overallScore} />
        </div>
      </div>

      {/* ── Node detail panel ─────────────────────────────── */}
      <AnimatePresence>
        {selectedNode && !quizNodeId && (
          <NodeDetailPanel
            node={selectedNode}
            onClose={handleCloseDetail}
            onStartQuiz={handleStartQuiz}
          />
        )}
      </AnimatePresence>

      {/* ── Quiz overlay ──────────────────────────────────── */}
      <AnimatePresence>
        {quizNode && (
          <QuizOverlay
            node={quizNode}
            onComplete={handleQuizComplete}
            onBack={handleQuizBack}
          />
        )}
      </AnimatePresence>

      {/* ── Chat sidebar ──────────────────────────────────── */}
      <ChatSidebar />
    </div>
  );
}

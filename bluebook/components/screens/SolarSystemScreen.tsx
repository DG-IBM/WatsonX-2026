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
    // updateNodeScore already marks the node complete; only set status if quiz was abandoned
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
    'Not Started':     { fg: 'var(--color-text-muted)',  bg: 'rgba(255,255,255,0.03)' },
    'In Progress':     { fg: 'var(--color-orbit-blue)',  bg: 'rgba(0,170,255,0.08)' },
    'Partially Ready': { fg: '#f59e0b',                  bg: 'rgba(245,158,11,0.08)' },
    'Ready':           { fg: '#22c55e',                  bg: 'rgba(34,197,94,0.08)' },
    'Fully Prepared':  { fg: '#22c55e',                  bg: 'rgba(34,197,94,0.12)' },
  };
  const rc = readinessColour[overallScore.readinessLevel];

  // Whether the briefing sidebar takes up space (affects map left offset)
  const hasBriefing = !!onboardingBriefingCard && !!userProfile;

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: 'var(--color-void)' }}>

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
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{ left: hasBriefing ? 0 : 0 }} // briefing is overlay, map fills screen
      >
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,170,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,170,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
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
        <div className="absolute top-4 left-4 flex items-center gap-3">
          <span className="text-gradient-orbit font-bold text-xl tracking-widest">IBM BLUEBOOK</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: 'var(--color-signal)' }} />
            <span className="font-terminal text-xs" style={{ color: 'var(--color-signal)', fontSize: '10px' }}>
              CONNECTED
            </span>
          </div>
        </div>

        {/* TOP RIGHT — readiness + chat */}
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <div
            className="px-3 py-1.5 rounded-xl font-terminal text-xs font-bold"
            style={{ background: rc.bg, color: rc.fg, border: `1px solid ${rc.fg}33`, fontSize: '11px' }}
          >
            {overallScore.readinessLevel.toUpperCase()}
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="glass-panel p-2.5 rounded-xl transition-all"
            style={{ border: '1px solid rgba(0,170,255,0.2)' }}
          >
            <MessageSquare size={18} style={{ color: 'var(--color-orbit-blue)' }} />
          </button>
        </div>

        {/* BOTTOM LEFT — progress indicators */}
        <div className="absolute bottom-6 left-4 flex flex-col gap-2">
          <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
            {completedCount} / {nodes.length} TOPICS VERIFIED
          </span>
          <div className="flex gap-1.5">
            {nodes.map((n) => {
              const dotColor = n.status === 'complete'
                ? (n.score?.nodeColour === 'green' ? '#22c55e' : n.score?.nodeColour === 'red' ? '#ef4444' : '#f59e0b')
                : n.status === 'reading' ? 'var(--color-orbit-blue)'
                : 'rgba(255,255,255,0.12)';
              return (
                <div
                  key={n.id}
                  title={n.title}
                  className="w-2 h-2 rounded-full transition-all cursor-pointer"
                  style={{ background: dotColor, boxShadow: n.status !== 'untouched' ? `0 0 5px ${dotColor}` : 'none' }}
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

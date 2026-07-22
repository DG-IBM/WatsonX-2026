'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import type { KnowledgeNode, QuizScore, QuizQuestion } from '@/types/bluebook';

interface QuizOverlayProps {
  node: KnowledgeNode;
  onComplete: (score: QuizScore) => void;
  onBack: () => void;
}

type AnswerState = 'unanswered' | 'correct' | 'incorrect';

function calculateScore(questions: QuizQuestion[], answers: Record<string, string>): QuizScore {
  const total = questions.length;
  const correct = questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  const pct = Math.round((correct / total) * 100);
  const nodeColour = pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red';
  return {
    totalQuestions: total,
    correctAnswers: correct,
    percentage: pct,
    nodeColour,
    completedAt: new Date().toISOString(),
  };
}

const COLOUR_MESSAGES = {
  green:  'Strong understanding. You\'re ready to work with this area.',
  yellow: 'Good start. Review the flagged areas before diving in.',
  red:    'This area needs more attention. Revisit the summary and ask your team.',
};

export default function QuizOverlay({ node, onComplete, onBack }: QuizOverlayProps) {
  const questions = node.quiz.questions;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [finalScore, setFinalScore] = useState<QuizScore | null>(null);

  const current = questions[currentIdx];
  const selectedAnswer = answers[current?.id ?? ''] ?? null;
  const answerState: AnswerState = selectedAnswer === null
    ? 'unanswered'
    : selectedAnswer === current?.correctOptionId
    ? 'correct'
    : 'incorrect';

  const isLastQuestion = currentIdx === questions.length - 1;

  const handleSelectAnswer = (optionId: string) => {
    if (selectedAnswer !== null) return; // already answered
    setAnswers((prev) => ({ ...prev, [current.id]: optionId }));
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      const score = calculateScore(questions, { ...answers });
      setFinalScore(score);
      onComplete(score);
    } else {
      setCurrentIdx((i) => i + 1);
      setShowExplanation(false);
    }
  };

  const optionStyle = (optId: string) => {
    if (selectedAnswer === null) {
      return {
        background: 'var(--cds-layer-03)',
        border: '1px solid var(--cds-border-subtle)',
        color: 'var(--cds-text-primary)',
        cursor: 'pointer',
        borderRadius: 4,
      } as React.CSSProperties;
    }
    if (optId === current.correctOptionId) {
      return {
        background: 'var(--cds-support-success-bg)',
        border: '2px solid rgba(66,190,101,0.6)',
        color: 'var(--cds-support-success)',
        cursor: 'default',
        borderRadius: 4,
      } as React.CSSProperties;
    }
    if (optId === selectedAnswer) {
      return {
        background: 'var(--cds-support-error-bg)',
        border: '2px solid rgba(250,77,86,0.5)',
        color: 'var(--cds-support-error)',
        cursor: 'default',
        borderRadius: 4,
      } as React.CSSProperties;
    }
    return {
      background: 'var(--cds-layer-01)',
      border: '1px solid var(--cds-border-subtle)',
      color: 'var(--cds-text-placeholder)',
      cursor: 'default',
      opacity: 0.55,
      borderRadius: 4,
    } as React.CSSProperties;
  };

  // ── Results screen ─────────────────────────────────────────────────────────
  if (finalScore) {
    const colourMap = {
      green:  { fg: 'var(--cds-support-success)', bg: 'var(--cds-support-success-bg)',  border: 'rgba(66,190,101,0.4)' },
      yellow: { fg: 'var(--cds-support-warning)', bg: 'var(--cds-support-warning-bg)', border: 'rgba(241,194,27,0.4)' },
      red:    { fg: 'var(--cds-support-error)',   bg: 'var(--cds-support-error-bg)',   border: 'rgba(250,77,86,0.4)' },
    };
    const c = colourMap[finalScore.nodeColour];

    return (
      <div className="planet-modal-backdrop">
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel-bright w-full relative"
          style={{ maxWidth: 560, borderRadius: 4 }}
        >
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <p className="font-terminal text-xs tracking-widest" style={{ color: 'var(--cds-text-placeholder)', fontSize: '11px' }}>
              QUIZ COMPLETE
            </p>

            {/* Score block — Carbon flat tile */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="flex flex-col items-center justify-center"
              style={{
                width: 140, height: 140,
                background: c.bg,
                border: `2px solid ${c.fg}`,
                borderRadius: 4,
              }}
            >
              <span className="font-terminal font-bold text-4xl" style={{ color: c.fg }}>
                {finalScore.percentage}%
              </span>
              <span className="font-terminal text-xs" style={{ color: c.fg, fontSize: '10px' }}>
                {finalScore.correctAnswers}/{finalScore.totalQuestions} CORRECT
              </span>
            </motion.div>

            {/* Colour result badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="px-4 py-2 font-terminal text-sm font-bold"
              style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.fg, borderRadius: 4 }}
            >
              {finalScore.nodeColour === 'green' ? '● STRONG UNDERSTANDING'
                : finalScore.nodeColour === 'yellow' ? '● PARTIAL UNDERSTANDING'
                : '● NEEDS REVISIT'}
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="text-sm"
              style={{ color: 'var(--cds-text-secondary)', lineHeight: 1.7, maxWidth: 380 }}
            >
              {COLOUR_MESSAGES[finalScore.nodeColour]}
            </motion.p>

            {/* Back to map */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 py-3.5 font-terminal text-sm tracking-widest font-bold transition-all"
              style={{ background: 'var(--ibm-blue-60)', border: '1px solid var(--cds-border-interactive)', color: '#fff', borderRadius: 4 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              BACK TO MAP
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Question screen ────────────────────────────────────────────────────────
  return (
    <div className="planet-modal-backdrop">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-panel-bright w-full relative"
        style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', borderRadius: 4 }}
      >
        <div className="p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-terminal text-xs tracking-widest" style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px' }}>
                {node.title.toUpperCase()}
              </p>
              <p className="font-terminal text-xs mt-0.5" style={{ color: 'var(--ibm-blue-40)', fontSize: '11px' }}>
                Question {currentIdx + 1} of {questions.length}
              </p>
            </div>
            {/* Progress bar */}
            <div className="flex gap-1">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 transition-all"
                  style={{
                    width: 24,
                    borderRadius: 2,
                    background: i < currentIdx
                      ? (answers[questions[i].id] === questions[i].correctOptionId
                        ? 'var(--cds-support-success)'
                        : 'var(--cds-support-error)')
                      : i === currentIdx
                      ? 'var(--ibm-blue-60)'
                      : 'var(--cds-border-strong)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <div
                className="p-4"
                style={{ background: 'var(--cds-layer-03)', border: '1px solid var(--cds-border-subtle)', borderRadius: 4 }}
              >
                <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--cds-text-primary)', lineHeight: 1.65 }}>
                  {current.question}
                </p>
                {current.type === 'true_false' && (
                  <span
                    className="inline-block mt-2 font-terminal text-xs px-2 py-0.5"
                    style={{ background: 'var(--cds-support-info-bg)', color: 'var(--ibm-blue-40)', fontSize: '9px', borderRadius: 2 }}
                  >
                    TRUE / FALSE
                  </span>
                )}
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2">
                {current.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectAnswer(opt.id)}
                    disabled={selectedAnswer !== null}
                    className="flex items-start gap-3 p-4 text-left transition-all"
                    style={optionStyle(opt.id)}
                  >
                    <span
                      className="font-terminal text-xs flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center"
                      style={{
                        background: 'var(--cds-layer-01)',
                        color: selectedAnswer !== null
                          ? opt.id === current.correctOptionId
                            ? 'var(--cds-support-success)'
                            : opt.id === selectedAnswer
                            ? 'var(--cds-support-error)'
                            : 'var(--cds-text-placeholder)'
                          : 'var(--cds-text-secondary)',
                        border: '1px solid var(--cds-border-subtle)',
                        fontSize: '10px',
                        borderRadius: 2,
                      }}
                    >
                      {opt.id.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm" style={{ lineHeight: 1.6 }}>{opt.text}</span>
                      {selectedAnswer !== null && opt.id === current.correctOptionId && (
                        <CheckCircle size={14} className="inline ml-2" style={{ color: 'var(--cds-support-success)', verticalAlign: 'middle' }} />
                      )}
                      {selectedAnswer !== null && opt.id === selectedAnswer && selectedAnswer !== current.correctOptionId && (
                        <XCircle size={14} className="inline ml-2" style={{ color: 'var(--cds-support-error)', verticalAlign: 'middle' }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4"
                    style={{
                      background: answerState === 'correct' ? 'var(--cds-support-success-bg)' : 'var(--cds-support-error-bg)',
                      border: `1px solid ${answerState === 'correct' ? 'rgba(66,190,101,0.3)' : 'rgba(250,77,86,0.3)'}`,
                      borderRadius: 4,
                    }}
                  >
                    <div
                      className="font-terminal text-xs mb-2"
                      style={{ color: answerState === 'correct' ? 'var(--cds-support-success)' : 'var(--cds-support-error)', fontSize: '11px' }}
                    >
                      {answerState === 'correct' ? '✓ CORRECT' : '✗ INCORRECT'}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--cds-text-primary)', lineHeight: 1.7 }}>
                      {current.explanation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next button */}
              <AnimatePresence>
                {showExplanation && (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleNext}
                    className="w-full flex items-center justify-center gap-2 py-3.5 font-terminal text-sm tracking-widest font-bold transition-all"
                    style={{ background: 'var(--ibm-blue-60)', border: '1px solid var(--cds-border-interactive)', color: '#fff', borderRadius: 4 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLastQuestion ? 'SEE RESULTS' : (
                      <>
                        NEXT QUESTION
                        <ArrowRight size={16} />
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

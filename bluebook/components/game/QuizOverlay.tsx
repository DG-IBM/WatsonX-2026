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
        background: 'rgba(0,170,255,0.05)',
        border: '1px solid rgba(0,170,255,0.2)',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
      } as React.CSSProperties;
    }
    if (optId === current.correctOptionId) {
      return {
        background: 'rgba(34,197,94,0.12)',
        border: '2px solid rgba(34,197,94,0.6)',
        color: '#22c55e',
        cursor: 'default',
      } as React.CSSProperties;
    }
    if (optId === selectedAnswer) {
      return {
        background: 'rgba(239,68,68,0.12)',
        border: '2px solid rgba(239,68,68,0.5)',
        color: '#ef4444',
        cursor: 'default',
      } as React.CSSProperties;
    }
    return {
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      color: 'var(--color-text-muted)',
      cursor: 'default',
      opacity: 0.55,
    } as React.CSSProperties;
  };

  // ── Results screen ─────────────────────────────────────────────────────────
  if (finalScore) {
    const colourMap = {
      green:  { fg: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.35)' },
      yellow: { fg: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)' },
      red:    { fg: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.35)' },
    };
    const c = colourMap[finalScore.nodeColour];

    return (
      <div className="planet-modal-backdrop">
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel-bright w-full relative"
          style={{ maxWidth: 560 }}
        >
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <p className="font-terminal text-xs tracking-widest" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
              QUIZ COMPLETE
            </p>

            {/* Score circle */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="flex flex-col items-center justify-center rounded-full"
              style={{
                width: 140, height: 140,
                background: c.bg,
                border: `3px solid ${c.fg}`,
                boxShadow: `0 0 32px ${c.bg}`,
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
              className="px-4 py-2 rounded-full font-terminal text-sm font-bold"
              style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.fg }}
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
              style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, maxWidth: 380 }}
            >
              {COLOUR_MESSAGES[finalScore.nodeColour]}
            </motion.p>

            {/* Back to map */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))', color: '#fff' }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0,170,255,0.4)' }}
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
        style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-terminal text-xs tracking-widest" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                {node.title.toUpperCase()}
              </p>
              <p className="font-terminal text-xs mt-0.5" style={{ color: 'var(--color-orbit-blue)', fontSize: '11px' }}>
                Question {currentIdx + 1} of {questions.length}
              </p>
            </div>
            {/* Progress bar */}
            <div className="flex gap-1">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: 24,
                    background: i < currentIdx
                      ? (answers[questions[i].id] === questions[i].correctOptionId ? '#22c55e' : '#ef4444')
                      : i === currentIdx
                      ? 'var(--color-orbit-blue)'
                      : 'rgba(255,255,255,0.1)',
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
                className="p-4 rounded-xl"
                style={{ background: 'rgba(6,13,26,0.7)', border: '1px solid rgba(0,170,255,0.12)' }}
              >
                <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.65 }}>
                  {current.question}
                </p>
                {current.type === 'true_false' && (
                  <span
                    className="inline-block mt-2 font-terminal text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(0,170,255,0.08)', color: 'var(--color-orbit-blue)', fontSize: '9px' }}
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
                    className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                    style={optionStyle(opt.id)}
                  >
                    <span
                      className="font-terminal text-xs flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: selectedAnswer !== null
                          ? opt.id === current.correctOptionId ? '#22c55e' : opt.id === selectedAnswer ? '#ef4444' : 'var(--color-text-muted)'
                          : 'var(--color-text-secondary)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '10px',
                      }}
                    >
                      {opt.id.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm" style={{ lineHeight: 1.6 }}>{opt.text}</span>
                      {selectedAnswer !== null && opt.id === current.correctOptionId && (
                        <CheckCircle size={14} className="inline ml-2" style={{ color: '#22c55e', verticalAlign: 'middle' }} />
                      )}
                      {selectedAnswer !== null && opt.id === selectedAnswer && selectedAnswer !== current.correctOptionId && (
                        <XCircle size={14} className="inline ml-2" style={{ color: '#ef4444', verticalAlign: 'middle' }} />
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
                    className="p-4 rounded-xl"
                    style={{
                      background: answerState === 'correct' ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                      border: `1px solid ${answerState === 'correct' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}
                  >
                    <div
                      className="font-terminal text-xs mb-2"
                      style={{ color: answerState === 'correct' ? '#22c55e' : '#ef4444', fontSize: '11px' }}
                    >
                      {answerState === 'correct' ? '✓ CORRECT' : '✗ INCORRECT'}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
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
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
                    style={{ background: 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))', color: '#fff' }}
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

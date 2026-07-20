'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { Planet } from '@/types/orbit';

interface MissionPhaseProps {
  planet: Planet;
  onSubmit: (response: string) => void;
  isLoading: boolean;
}

const BADGE_CLASSES: Record<string, string> = {
  SCENARIO:           'badge-scenario',
  ROLEPLAY:           'badge-roleplay',
  DETECTIVE:          'badge-detective',
  BUILD:              'badge-build',
  TRANSMISSION_DECODE: 'badge-transmission',
};

const BORDER_COLORS: Record<string, string> = {
  SCENARIO:           '#00aaff',
  ROLEPLAY:           '#b06fe0',
  DETECTIVE:          '#ffb400',
  BUILD:              '#00ff88',
  TRANSMISSION_DECODE: '#ff6b35',
};

export default function MissionPhase({ planet, onSubmit, isLoading }: MissionPhaseProps) {
  const challenge = planet.challenge!;
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [textResponse, setTextResponse] = useState('');
  const [revealedClues, setRevealedClues] = useState<number>(0);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [codeExplanation, setCodeExplanation] = useState('');
  const accentColor = BORDER_COLORS[challenge.type] ?? '#00aaff';

  const handleSubmit = () => {
    if (challenge.type === 'SCENARIO' && selectedOption) {
      onSubmit(selectedOption);
    } else if (challenge.type === 'BUILD' && selectedCode) {
      onSubmit(`${selectedCode}\n${codeExplanation}`);
    } else if (textResponse.trim().length >= 30) {
      onSubmit(textResponse);
    }
  };

  const isSubmitEnabled = () => {
    switch (challenge.type) {
      case 'SCENARIO': return !!selectedOption;
      case 'BUILD': return !!selectedCode && codeExplanation.length >= 10;
      case 'DETECTIVE': return revealedClues >= (challenge.clues?.length ?? 0) && textResponse.length >= 30;
      default: return textResponse.length >= 30;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Challenge type badge + title */}
      <div className="flex flex-col gap-2">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full font-terminal text-xs tracking-widest w-fit ${BADGE_CLASSES[challenge.type]}`}
        >
          [{challenge.type.replace('_', ' ')}]
        </span>
        <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {challenge.title}
        </h3>
      </div>

      {/* Setup text */}
      <div
        className="p-4 rounded-xl text-sm leading-relaxed"
        style={{
          background: `rgba(${hexToRgb(accentColor)}, 0.06)`,
          borderLeft: `3px solid ${accentColor}`,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.7,
        }}
      >
        {challenge.setup}
      </div>

      {/* Prompt */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
        {challenge.prompt}
      </p>

      {/* ── SCENARIO ── */}
      {challenge.type === 'SCENARIO' && challenge.options && (
        <div className="flex flex-col gap-3">
          {challenge.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedOption(opt.id)}
              className="text-left p-4 rounded-xl transition-all"
              style={{
                background: selectedOption === opt.id ? `rgba(${hexToRgb(accentColor)}, 0.12)` : 'var(--color-nebula)',
                border: `1px solid ${selectedOption === opt.id ? accentColor : 'rgba(0,170,255,0.15)'}`,
                boxShadow: selectedOption === opt.id ? `0 0 12px rgba(${hexToRgb(accentColor)}, 0.2)` : 'none',
              }}
            >
              <div className="font-terminal text-xs mb-1" style={{ color: accentColor }}>{opt.label}</div>
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{opt.text}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── ROLEPLAY / default textarea ── */}
      {(challenge.type === 'ROLEPLAY' || (challenge.type !== 'SCENARIO' && challenge.type !== 'BUILD' && challenge.type !== 'DETECTIVE' && challenge.type !== 'TRANSMISSION_DECODE')) && (
        <textarea
          value={textResponse}
          onChange={(e) => setTextResponse(e.target.value)}
          rows={5}
          placeholder="Step into their shoes. What do you do, think, and notice?"
          className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none leading-relaxed"
          style={{
            background: 'var(--color-panel)',
            border: `1px solid rgba(${hexToRgb(accentColor)}, 0.2)`,
            color: 'var(--color-text-primary)',
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.7,
          }}
        />
      )}

      {/* ── DETECTIVE ── */}
      {challenge.type === 'DETECTIVE' && challenge.clues && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {challenge.clues.map((clue, idx) => (
              <div key={idx}>
                {idx < revealedClues ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl"
                    style={{
                      background: `rgba(${hexToRgb(accentColor)}, 0.06)`,
                      border: `1px solid rgba(${hexToRgb(accentColor)}, 0.2)`,
                    }}
                  >
                    <div className="font-terminal text-xs mb-1" style={{ color: accentColor }}>
                      CLUE {idx + 1}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{clue}</p>
                  </motion.div>
                ) : idx === revealedClues ? (
                  <button
                    onClick={() => setRevealedClues((n) => n + 1)}
                    className="w-full py-3 rounded-xl font-terminal text-xs tracking-widest transition-all"
                    style={{
                      border: `1px solid ${accentColor}`,
                      color: accentColor,
                      background: `rgba(${hexToRgb(accentColor)}, 0.05)`,
                    }}
                  >
                    ▸ REVEAL CLUE {idx + 1}
                  </button>
                ) : (
                  <div
                    className="py-3 rounded-xl text-center font-terminal text-xs"
                    style={{
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    CLUE {idx + 1} — LOCKED
                  </div>
                )}
              </div>
            ))}
          </div>
          {revealedClues >= challenge.clues.length && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="font-terminal text-xs mb-2" style={{ color: accentColor }}>
                WHAT IS YOUR THEORY?
              </p>
              <textarea
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={4}
                placeholder="Describe what you believe is happening based on the clues..."
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={{
                  background: 'var(--color-panel)',
                  border: `1px solid rgba(${hexToRgb(accentColor)}, 0.2)`,
                  color: 'var(--color-text-primary)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  lineHeight: 1.7,
                }}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* ── BUILD ── */}
      {challenge.type === 'BUILD' && challenge.codeSnippets && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {challenge.codeSnippets.map((snippet) => (
              <button
                key={snippet.id}
                onClick={() => setSelectedCode(snippet.id)}
                className="text-left rounded-xl overflow-hidden transition-all"
                style={{
                  border: `1px solid ${selectedCode === snippet.id ? accentColor : 'rgba(0,170,255,0.15)'}`,
                  boxShadow: selectedCode === snippet.id ? `0 0 12px rgba(${hexToRgb(accentColor)}, 0.2)` : 'none',
                }}
              >
                <div
                  className="px-4 py-2 font-terminal text-xs"
                  style={{
                    background: `rgba(${hexToRgb(accentColor)}, 0.1)`,
                    color: accentColor,
                  }}
                >
                  {snippet.label}
                </div>
                <pre
                  className="p-4 text-xs overflow-x-auto"
                  style={{
                    background: 'rgba(6,13,26,0.9)',
                    color: '#a0c0ff',
                    fontFamily: "'Space Mono', monospace",
                    lineHeight: 1.5,
                  }}
                >
                  <code>{snippet.code}</code>
                </pre>
              </button>
            ))}
          </div>
          {selectedCode && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="font-terminal text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                EXPLAIN WHY THIS APPROACH FITS THIS PROJECT:
              </p>
              <textarea
                value={codeExplanation}
                onChange={(e) => setCodeExplanation(e.target.value)}
                rows={3}
                placeholder="Why does this approach suit the project's constraints and conventions?"
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={{
                  background: 'var(--color-panel)',
                  border: `1px solid rgba(${hexToRgb(accentColor)}, 0.2)`,
                  color: 'var(--color-text-primary)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  lineHeight: 1.7,
                }}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* ── TRANSMISSION DECODE ── */}
      {challenge.type === 'TRANSMISSION_DECODE' && (
        <div className="flex flex-col gap-4">
          <div
            className="scanline rounded-xl p-4 animate-transmission-flicker relative"
            style={{
              background: 'rgba(2,4,8,0.95)',
              border: '1px solid rgba(255,107,53,0.3)',
            }}
          >
            <div
              className="font-terminal text-xs mb-3 flex items-center gap-2"
              style={{ color: '#ff6b35' }}
            >
              ⚠ CORRUPTED ARTEFACT — ANALYSIS REQUIRED
            </div>
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap"
              style={{
                color: '#e0d8d0',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {challenge.artefact}
            </pre>
          </div>
          <p className="font-terminal text-xs" style={{ color: '#ff6b35' }}>
            WHAT IS MISSING OR WRONG WITH THIS ARTEFACT?
          </p>
          <textarea
            value={textResponse}
            onChange={(e) => setTextResponse(e.target.value)}
            rows={4}
            placeholder="Analyse the artefact. What gaps, inconsistencies or issues do you find?"
            className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
            style={{
              background: 'var(--color-panel)',
              border: '1px solid rgba(255,107,53,0.2)',
              color: 'var(--color-text-primary)',
              fontFamily: "'Space Grotesk', sans-serif",
              lineHeight: 1.7,
            }}
          />
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!isSubmitEnabled() || isLoading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
        style={{
          background: isSubmitEnabled() && !isLoading
            ? `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`
            : 'rgba(0,170,255,0.1)',
          color: isSubmitEnabled() && !isLoading ? '#fff' : 'rgba(255,255,255,0.3)',
          cursor: isSubmitEnabled() && !isLoading ? 'pointer' : 'not-allowed',
        }}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            EVALUATING RESPONSE...
          </>
        ) : (
          <>
            {challenge.type === 'SCENARIO' ? 'COMMIT TO THIS APPROACH' :
             challenge.type === 'BUILD' ? 'COMMIT TO THIS BUILD' :
             challenge.type === 'ROLEPLAY' ? 'SUBMIT YOUR EXPERIENCE' :
             challenge.type === 'DETECTIVE' ? 'SUBMIT THEORY' :
             'SUBMIT ANALYSIS'}
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

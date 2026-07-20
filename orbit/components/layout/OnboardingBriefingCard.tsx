'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Printer, User, Briefcase,
  AlertTriangle, Users, Lightbulb, MapPin, CheckSquare
} from 'lucide-react';
import type { OnboardingBriefingCard, UserProfile, KnowledgeNode } from '@/types/orbit';

interface Props {
  card: OnboardingBriefingCard;
  userProfile: UserProfile;
  nodes: KnowledgeNode[];
  onNodeClick: (node: KnowledgeNode) => void;
}

const SECTION = {
  label: (icon: React.ReactNode, text: string) => (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color: 'var(--color-orbit-blue)', flexShrink: 0 }}>{icon}</span>
      <span
        className="font-terminal text-xs tracking-widest"
        style={{ color: 'var(--color-orbit-blue)', fontSize: '10px', letterSpacing: '0.15em' }}
      >
        {text}
      </span>
    </div>
  ),
};

export default function OnboardingBriefingCard({ card, userProfile, nodes, onNodeClick }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const nodeStatusColour = (n: KnowledgeNode): string => {
    if (n.status === 'complete') {
      return n.score?.nodeColour === 'green' ? '#22c55e'
        : n.score?.nodeColour === 'red' ? '#ef4444'
        : '#f59e0b';
    }
    if (n.status === 'reading') return 'var(--color-orbit-blue)';
    return 'rgba(255,255,255,0.18)';
  };

  // Shared scrollable content — rendered both in screen sidebar and print layout
  const content = (
    <div className="flex flex-col gap-5">

      {/* ── Role & Project intro ──────────────────── */}
      <section>
        {SECTION.label(<User size={12} />, 'YOUR ROLE')}
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(0,170,255,0.06)', border: '1px solid rgba(0,170,255,0.15)' }}
        >
          <div className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {userProfile.parsedRole}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
            {card.roleIntro}
          </p>
        </div>
      </section>

      {/* ── Project intro ─────────────────────────── */}
      <section>
        {SECTION.label(<Briefcase size={12} />, 'THE PROJECT')}
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          {card.projectIntro}
        </p>
      </section>

      {/* ── Your responsibilities ─────────────────── */}
      {card.yourResponsibilities.length > 0 && (
        <section>
          {SECTION.label(<CheckSquare size={12} />, 'YOUR RESPONSIBILITIES')}
          <ul className="flex flex-col gap-1.5">
            {card.yourResponsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="font-terminal flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--color-signal)', fontSize: '9px' }}
                >
                  ▸
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  {r}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Suggested learning path ───────────────── */}
      <section>
        {SECTION.label(<MapPin size={12} />, 'SUGGESTED PATH')}
        <div className="flex flex-col gap-1.5">
          {card.suggestedPath.map((title, i) => {
            const node = nodes.find((n) => n.title === title);
            return (
              <button
                key={i}
                onClick={() => node && onNodeClick(node)}
                className="flex items-center gap-2.5 text-left px-3 py-2 rounded-lg transition-all no-print"
                style={{
                  background: node ? 'rgba(0,170,255,0.05)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(0,170,255,0.12)',
                  cursor: node ? 'pointer' : 'default',
                }}
              >
                {/* Step number */}
                <span
                  className="font-terminal flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(0,170,255,0.12)',
                    color: 'var(--color-orbit-blue)',
                    fontSize: '9px',
                  }}
                >
                  {i + 1}
                </span>
                {/* Title */}
                <span className="text-xs flex-1 min-w-0" style={{ color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                  {title}
                </span>
                {/* Status dot */}
                {node && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: nodeStatusColour(node) }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Key contacts ─────────────────────────── */}
      {card.keyContacts.length > 0 && (
        <section>
          {SECTION.label(<Users size={12} />, 'KEY CONTACTS')}
          <div className="flex flex-col gap-2">
            {card.keyContacts.map((c, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.12)' }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center font-terminal font-bold"
                    style={{ background: 'rgba(255,180,0,0.15)', color: '#ffb400', fontSize: '9px', marginTop: 1 }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs" style={{ color: 'var(--color-text-primary)' }}>
                      {c.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                      {c.role}
                    </div>
                    {c.contact && c.contact !== 'Ask your manager' && (
                      <div
                        className="font-terminal text-xs mt-0.5"
                        style={{ color: 'var(--color-orbit-blue)', fontSize: '9px' }}
                      >
                        {c.contact}
                      </div>
                    )}
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                      {c.why}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── First week tips ───────────────────────── */}
      {card.firstWeekTips.length > 0 && (
        <section>
          {SECTION.label(<Lightbulb size={12} />, 'FIRST WEEK')}
          <ul className="flex flex-col gap-1.5">
            {card.firstWeekTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="font-terminal flex-shrink-0"
                  style={{ color: 'var(--color-gold)', fontSize: '9px', marginTop: 2 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Do not break ─────────────────────────── */}
      {card.doNotBreak.length > 0 && (
        <section>
          {SECTION.label(<AlertTriangle size={12} />, "DON'T TOUCH WITHOUT ASKING")}
          <ul className="flex flex-col gap-1.5">
            {card.doNotBreak.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span style={{ color: '#ef4444', fontSize: '9px', marginTop: 2, flexShrink: 0 }}>⚠</span>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* bottom padding */}
      <div style={{ height: 16 }} />
    </div>
  );

  return (
    <>
      {/* ── Collapsed tab (screen only) ───────────────────────── */}
      <AnimatePresence>
        {collapsed && (
          <motion.button
            key="tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => setCollapsed(false)}
            className="no-print fixed left-0 top-1/2 z-30 flex flex-col items-center gap-1 py-4 px-2 rounded-r-xl"
            style={{
              background: 'rgba(10,22,40,0.95)',
              border: '1px solid rgba(0,170,255,0.25)',
              borderLeft: 'none',
              transform: 'translateY(-50%)',
              color: 'var(--color-orbit-blue)',
            }}
          >
            <ChevronRight size={14} />
            <span
              className="font-terminal"
              style={{
                fontSize: '9px',
                letterSpacing: '0.15em',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                color: 'var(--color-text-secondary)',
              }}
            >
              BRIEFING
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Sidebar panel (screen only) ───────────────────────── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.aside
            key="panel"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="no-print fixed left-0 top-0 h-full z-30 flex flex-col"
            style={{
              width: 340,
              background: 'rgba(6,13,26,0.97)',
              borderRight: '1px solid rgba(0,170,255,0.22)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(0,170,255,0.12)' }}
            >
              <div>
                <div className="font-terminal text-xs font-bold" style={{ color: 'var(--color-orbit-blue)', fontSize: '11px', letterSpacing: '0.15em' }}>
                  YOUR BLUEBOOK
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                  {card.projectName}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrint}
                  title="Print briefing"
                  className="p-1.5 rounded-lg transition-opacity opacity-50 hover:opacity-100"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <Printer size={13} />
                </button>
                <button
                  onClick={() => setCollapsed(true)}
                  className="p-1.5 rounded-lg transition-opacity opacity-50 hover:opacity-100"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {content}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Print-only full briefing ───────────────────────────── */}
      {/*
        This element is always in the DOM but hidden on screen via CSS.
        At print time, all .no-print elements are hidden (including the dark sidebar)
        and this white-background layout is shown instead.
      */}
      <div
        className="print-only"
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          padding: '32px 40px',
          color: '#111',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        {/* Cover header */}
        <div style={{ borderBottom: '2px solid #1a56db', paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: '#1a56db', marginBottom: 4 }}>
            IBM BLUEBOOK — ONBOARDING BRIEFING
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#111' }}>
            {card.projectName}
          </h1>
          <p style={{ fontSize: 13, color: '#555', margin: '4px 0 0 0' }}>
            Role: {userProfile.parsedRole}
          </p>
        </div>

        {/* The Project */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', marginBottom: 6, textTransform: 'uppercase' }}>
            The Project
          </h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: '#222' }}>{card.projectIntro}</p>
        </section>

        {/* Your Role */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', marginBottom: 6, textTransform: 'uppercase' }}>
            Your Role
          </h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: '#222', marginBottom: 8 }}>{card.roleIntro}</p>
          {card.yourResponsibilities.length > 0 && (
            <ul style={{ fontSize: 12, lineHeight: 1.75, paddingLeft: 20, color: '#222' }}>
              {card.yourResponsibilities.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </section>

        {/* Suggested Learning Path */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', marginBottom: 6, textTransform: 'uppercase' }}>
            Suggested Learning Path
          </h2>
          <ol style={{ fontSize: 12, lineHeight: 1.75, paddingLeft: 20, color: '#222' }}>
            {card.suggestedPath.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </section>

        {/* Key Contacts */}
        {card.keyContacts.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', marginBottom: 8, textTransform: 'uppercase' }}>
              Key Contacts
            </h2>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#eef2ff' }}>
                  {['Name', 'Role', 'Contact', 'Why they matter'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 700, border: '1px solid #c7d2fe', color: '#1a56db' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.keyContacts.map((c, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '5px 8px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e5e7eb' }}>{c.role}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e5e7eb', color: '#1a56db' }}>{c.contact}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e5e7eb', color: '#555' }}>{c.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* First Week */}
        {card.firstWeekTips.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', marginBottom: 6, textTransform: 'uppercase' }}>
              First Week
            </h2>
            <ol style={{ fontSize: 12, lineHeight: 1.75, paddingLeft: 20, color: '#222' }}>
              {card.firstWeekTips.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </section>
        )}

        {/* Don't Touch */}
        {card.doNotBreak.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#c0392b', marginBottom: 6, textTransform: 'uppercase' }}>
              ⚠ Don&apos;t Touch Without Asking
            </h2>
            <ul style={{ fontSize: 12, lineHeight: 1.75, paddingLeft: 20, color: '#222' }}>
              {card.doNotBreak.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </section>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#999', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
          IBM BLUEBOOK — CONFIDENTIAL ONBOARDING DOCUMENT — {new Date().toLocaleDateString()}
        </div>
      </div>
    </>
  );
}

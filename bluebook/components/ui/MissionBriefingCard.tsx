'use client';

import { motion } from 'framer-motion';
import { Printer, Shield, AlertTriangle, Star, Users, Zap } from 'lucide-react';
import type { MissionBriefingCard as MBCard, AstronautRank } from '@/types/bluebook';
import { getRankIcon } from '@/lib/gameUtils';

interface MissionBriefingCardProps {
  card: MBCard;
  rank: AstronautRank;
  totalXP: number;
}

export default function MissionBriefingCardView({
  card,
  rank,
  totalXP,
}: MissionBriefingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="max-w-2xl mx-auto"
    >
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--cds-layer-02)',
          border: '1px solid rgba(241,194,27,0.3)',
          borderRadius: 4,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: 'var(--cds-support-warning-bg)',
            borderBottom: '1px solid rgba(241,194,27,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-bold text-xl tracking-widest"
              style={{ color: 'var(--ibm-blue-40)', letterSpacing: '0.1em' }}
            >
              IBM BLUEBOOK
            </span>
            <span className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)' }}>
              KNOWLEDGE DOSSIER
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-terminal text-xs" style={{ color: 'var(--cds-support-warning)' }}>
                {getRankIcon(rank)} {rank}
              </div>
              <div className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)' }}>
                {totalXP} XP
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 text-xs font-terminal transition-all"
              style={{
                border: '1px solid rgba(241,194,27,0.3)',
                color: 'var(--cds-support-warning)',
                background: 'var(--cds-support-warning-bg)',
                borderRadius: 4,
              }}
            >
              <Printer size={12} />
              PRINT
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Project snapshot */}
          <section>
            <h3
              className="font-terminal text-xs tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--ibm-blue-40)' }}
            >
              <Zap size={12} />
              PROJECT SNAPSHOT
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--cds-text-primary)' }}>
              {card.projectSnapshot}
            </p>
          </section>

          {/* Role & ownership */}
          <section>
            <h3
              className="font-terminal text-xs tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--ibm-blue-40)' }}
            >
              <Users size={12} />
              YOUR ROLE & OWNERSHIP
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--cds-text-primary)' }}>
              {card.roleAndOwnership}
            </p>
          </section>

          {/* Priority / Risk grid */}
          <div className="grid grid-cols-2 gap-4">
            <section
              className="p-4"
              style={{
                background: 'var(--cds-support-info-bg)',
                border: '1px solid rgba(69,137,255,0.2)',
                borderRadius: 4,
              }}
            >
              <h3
                className="font-terminal text-xs tracking-widest mb-3 flex items-center gap-2"
                style={{ color: 'var(--ibm-blue-40)' }}
              >
                <Star size={12} />
                TOP PRIORITIES
              </h3>
              <ol className="space-y-1.5">
                {card.topPriorities.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--cds-text-primary)' }}>
                    <span className="font-terminal" style={{ color: 'var(--ibm-blue-40)' }}>
                      {i + 1}.
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="p-4"
              style={{
                background: 'var(--cds-support-error-bg)',
                border: '1px solid rgba(250,77,86,0.2)',
                borderRadius: 4,
              }}
            >
              <h3
                className="font-terminal text-xs tracking-widest mb-3 flex items-center gap-2"
                style={{ color: 'var(--cds-support-error)' }}
              >
                <AlertTriangle size={12} />
                TOP RISKS
              </h3>
              <ol className="space-y-1.5">
                {card.topRisks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--cds-text-primary)' }}>
                    <span className="font-terminal" style={{ color: 'var(--cds-support-error)' }}>
                      {i + 1}.
                    </span>
                    {r}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Key contacts */}
          {card.keyContacts.length > 0 && (
            <section>
              <h3
                className="font-terminal text-xs tracking-widest mb-3 flex items-center gap-2"
                style={{ color: 'var(--cds-support-warning)' }}
              >
                KEY CONTACTS
              </h3>
              <div className="overflow-hidden" style={{ border: '1px solid rgba(241,194,27,0.2)', borderRadius: 4 }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--cds-support-warning-bg)', borderBottom: '1px solid rgba(241,194,27,0.15)' }}>
                      <th className="font-terminal text-left px-3 py-2" style={{ color: 'var(--cds-text-placeholder)' }}>NAME</th>
                      <th className="font-terminal text-left px-3 py-2" style={{ color: 'var(--cds-text-placeholder)' }}>ROLE</th>
                      <th className="font-terminal text-left px-3 py-2" style={{ color: 'var(--cds-text-placeholder)' }}>OWNS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.keyContacts.map((c, i) => (
                      <tr key={i} style={{ borderBottom: i < card.keyContacts.length - 1 ? '1px solid rgba(241,194,27,0.08)' : 'none' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--cds-text-primary)' }}>{c.name}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--cds-text-secondary)' }}>{c.role}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--cds-text-secondary)' }}>{c.owns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Things not to break */}
          {card.thingsNotToBreak.length > 0 && (
            <section>
              <h3
                className="font-terminal text-xs tracking-widest mb-3 flex items-center gap-2"
                style={{ color: 'var(--cds-support-error)' }}
              >
                <Shield size={12} />
                THINGS NOT TO BREAK
              </h3>
              <div className="flex flex-wrap gap-2">
                {card.thingsNotToBreak.map((t, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 text-xs"
                    style={{
                      background: 'var(--cds-support-error-bg)',
                      border: '1px solid rgba(250,77,86,0.25)',
                      color: 'var(--cds-support-error)',
                      borderRadius: 20,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* First week focus */}
          <section
            className="p-4"
            style={{
              background: 'var(--cds-support-success-bg)',
              border: '1px solid rgba(66,190,101,0.25)',
              borderRadius: 4,
            }}
          >
            <h3
              className="font-terminal text-xs tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--cds-support-success)' }}
            >
              FIRST WEEK FOCUS
            </h3>
            <p className="text-sm" style={{ color: 'var(--cds-text-primary)' }}>
              {card.firstWeekFocus}
            </p>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

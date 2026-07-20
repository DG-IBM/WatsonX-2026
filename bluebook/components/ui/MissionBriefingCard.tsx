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
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-nebula)',
          border: '1px solid rgba(255,215,0,0.4)',
          boxShadow: '0 0 40px rgba(255,215,0,0.1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: 'rgba(255,215,0,0.05)',
            borderBottom: '1px solid rgba(255,215,0,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-gradient-orbit font-bold text-xl tracking-widest">IBM BLUEBOOK</span>
            <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)' }}>
              KNOWLEDGE DOSSIER
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-terminal text-xs" style={{ color: 'var(--color-gold)' }}>
                {getRankIcon(rank)} {rank}
              </div>
              <div className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {totalXP} XP
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-terminal transition-all"
              style={{
                border: '1px solid rgba(255,215,0,0.3)',
                color: 'var(--color-gold)',
                background: 'rgba(255,215,0,0.05)',
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
              style={{ color: 'var(--color-orbit-blue)' }}
            >
              <Zap size={12} />
              PROJECT SNAPSHOT
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              {card.projectSnapshot}
            </p>
          </section>

          {/* Role & ownership */}
          <section>
            <h3
              className="font-terminal text-xs tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-orbit-blue)' }}
            >
              <Users size={12} />
              YOUR ROLE & OWNERSHIP
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              {card.roleAndOwnership}
            </p>
          </section>

          {/* Priority / Risk grid */}
          <div className="grid grid-cols-2 gap-4">
            <section
              className="rounded-xl p-4"
              style={{
                background: 'rgba(0,170,255,0.05)',
                border: '1px solid rgba(0,170,255,0.15)',
              }}
            >
              <h3
                className="font-terminal text-xs tracking-widest mb-3 flex items-center gap-2"
                style={{ color: 'var(--color-orbit-blue)' }}
              >
                <Star size={12} />
                TOP PRIORITIES
              </h3>
              <ol className="space-y-1.5">
                {card.topPriorities.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="font-terminal" style={{ color: 'var(--color-orbit-blue)' }}>
                      {i + 1}.
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,68,68,0.05)',
                border: '1px solid rgba(255,68,68,0.15)',
              }}
            >
              <h3
                className="font-terminal text-xs tracking-widest mb-3 flex items-center gap-2"
                style={{ color: 'var(--color-alert)' }}
              >
                <AlertTriangle size={12} />
                TOP RISKS
              </h3>
              <ol className="space-y-1.5">
                {card.topRisks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="font-terminal" style={{ color: 'var(--color-alert)' }}>
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
                style={{ color: 'var(--color-gold)' }}
              >
                KEY CONTACTS
              </h3>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,215,0,0.15)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'rgba(255,215,0,0.05)', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
                      <th className="font-terminal text-left px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>NAME</th>
                      <th className="font-terminal text-left px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>ROLE</th>
                      <th className="font-terminal text-left px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>OWNS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.keyContacts.map((c, i) => (
                      <tr key={i} style={{ borderBottom: i < card.keyContacts.length - 1 ? '1px solid rgba(255,215,0,0.08)' : 'none' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{c.name}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>{c.role}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>{c.owns}</td>
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
                style={{ color: 'var(--color-alert)' }}
              >
                <Shield size={12} />
                THINGS NOT TO BREAK
              </h3>
              <div className="flex flex-wrap gap-2">
                {card.thingsNotToBreak.map((t, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: 'rgba(255,68,68,0.08)',
                      border: '1px solid rgba(255,68,68,0.2)',
                      color: '#ff8888',
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
            className="rounded-xl p-4"
            style={{
              background: 'rgba(0,255,136,0.05)',
              border: '1px solid rgba(0,255,136,0.2)',
            }}
          >
            <h3
              className="font-terminal text-xs tracking-widest mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-signal)' }}
            >
              FIRST WEEK FOCUS
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {card.firstWeekFocus}
            </p>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useBluebookStore } from '@/store/bluebookStore';
import AstronautRankDisplay from '@/components/ui/AstronautRank';
import MissionBriefingCardView from '@/components/ui/MissionBriefingCard';
import ParticleBackground from '@/components/ui/ParticleBackground';
import LoadingSequence from '@/components/ui/LoadingSequence';
import type { MissionBriefingCard } from '@/types/bluebook';

type Step = 'cinematic' | 'rank' | 'briefing';

export default function MissionCompleteScreen() {
  const router = useRouter();
  const {
    planets,
    totalXP,
    astronautRank,
    userProfile,
    mcpDocuments,
    missionBriefingCard,
    setMissionBriefingCard,
    setCurrentScreen,
  } = useBluebookStore();

  const [step, setStep] = useState<Step>('cinematic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cinematicText, setCinematicText] = useState<'mapping' | 'complete' | null>('mapping');

  const rank = astronautRank ?? 'Not Started';

  useEffect(() => {
    // Cinematic sequence
    const t1 = setTimeout(() => setCinematicText('complete'), 1500);
    const t2 = setTimeout(() => {
      setStep('rank');
      setCinematicText(null);
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    // Auto-generate briefing card if not already done
    if (step === 'rank' && !missionBriefingCard && !isGenerating && userProfile) {
      generateBriefingCard();
    }
  }, [step]);

  const generateBriefingCard = async () => {
    if (!userProfile) return;
    setIsGenerating(true);
    try {
      const completedPlanets = planets.filter((p) => p.status === 'complete');
      const res = await fetch('/api/llm/briefing-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userProfile, completedPlanets, documents: mcpDocuments }),
      });
      const data = await res.json();
      setMissionBriefingCard(data.briefingCard as MissionBriefingCard);
    } catch {
      // Fallback briefing card
      setMissionBriefingCard({
        projectSnapshot: 'You have completed all mission sectors and gained a comprehensive understanding of the project.',
        roleAndOwnership: `As a ${userProfile?.parsedRole ?? 'team member'}, you are now equipped to make meaningful contributions.`,
        topPriorities: ['Establish your first sprint contribution', 'Connect with key stakeholders', 'Review open pull requests'],
        topRisks: ['Potential knowledge gaps in undocumented areas', 'Team dependencies to navigate', 'Technical debt in legacy modules'],
        keyContacts: [{ name: 'Your Tech Lead', role: 'Technical Lead', owns: 'Architecture decisions' }],
        thingsNotToBreak: ['Production deployment pipeline', 'Authentication flow', 'Core data models'],
        firstWeekFocus: 'Shadow team members, review the codebase, and identify your first meaningful contribution.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnterMissionControl = () => {
    setCurrentScreen('mission-control');
    router.push('/mission-control');
  };

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--color-void)' }}>
      <ParticleBackground />

      {/* Cinematic overlay */}
      <AnimatePresence>
        {step === 'cinematic' && (
          <motion.div
            key="cinematic"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: 'var(--color-void)' }}
          >
            <AnimatePresence mode="wait">
              {cinematicText === 'mapping' && (
                <motion.h1
                  key="mapping"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="text-4xl font-bold tracking-widest"
                  style={{ color: 'var(--color-orbit-blue)' }}
                >
                  ALL SECTORS MAPPED
                </motion.h1>
              )}
              {cinematicText === 'complete' && (
                <motion.h1
                  key="complete"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-5xl font-bold tracking-widest text-gradient-gold"
                >
                  MISSION COMPLETE
                </motion.h1>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      {step !== 'cinematic' && (
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-12">
          {/* Step 2 — Rank */}
          {step === 'rank' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-8"
            >
              <AstronautRankDisplay rank={rank} totalXP={totalXP} size="lg" />

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                onClick={() => setStep('briefing')}
                className="px-8 py-3 rounded-xl font-terminal text-sm tracking-widest transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))',
                  color: '#fff',
                }}
                whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(0,170,255,0.4)' }}
              >
                VIEW MISSION BRIEFING CARD →
              </motion.button>
            </motion.div>
          )}

          {/* Step 3 — Briefing Card */}
          {step === 'briefing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-8"
            >
              <div className="text-center">
                <p
                  className="font-terminal text-xs tracking-widest mb-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  MISSION DOSSIER GENERATED
                </p>
                <h2 className="text-3xl font-bold text-gradient-gold">YOUR MISSION BRIEFING</h2>
              </div>

              {isGenerating ? (
                <LoadingSequence
                  isVisible={true}
                  messages={['Compiling mission dossier...', 'Synthesising project intelligence...', 'Generating your briefing card...']}
                />
              ) : missionBriefingCard ? (
                <MissionBriefingCardView
                  card={missionBriefingCard}
                  rank={rank}
                  totalXP={totalXP}
                />
              ) : null}

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={handleEnterMissionControl}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-terminal text-sm tracking-widest font-bold"
                style={{
                  background: 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))',
                  color: '#fff',
                }}
                whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0,170,255,0.4)' }}
              >
                ENTER MISSION CONTROL →
              </motion.button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

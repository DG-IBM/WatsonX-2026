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
    const t1 = setTimeout(() => setCinematicText('complete'), 1500);
    const t2 = setTimeout(() => {
      setStep('rank');
      setCinematicText(null);
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
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
      setMissionBriefingCard({
        projectSnapshot: 'You have completed all knowledge areas and gained a comprehensive understanding of the project.',
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

  const handleEnterChat = () => {
    setCurrentScreen('mission-control');
    router.push('/mission-control');
  };

  return (
    <div
      className="relative min-h-screen"
      style={{ background: 'var(--cds-background)' }}
    >
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
            style={{ background: 'var(--cds-background)' }}
          >
            <AnimatePresence mode="wait">
              {cinematicText === 'mapping' && (
                <motion.div
                  key="mapping"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <p className="font-terminal text-xs tracking-widest mb-2" style={{ color: 'var(--cds-text-placeholder)' }}>
                    IBM BLUEBOOK
                  </p>
                  <h1
                    className="text-4xl font-bold tracking-widest"
                    style={{ color: 'var(--ibm-blue-40)', letterSpacing: '0.1em' }}
                  >
                    ALL TOPICS VERIFIED
                  </h1>
                </motion.div>
              )}
              {cinematicText === 'complete' && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <p className="font-terminal text-xs tracking-widest mb-2" style={{ color: 'var(--cds-text-placeholder)' }}>
                    IBM BLUEBOOK
                  </p>
                  <h1
                    className="text-5xl font-bold tracking-widest"
                    style={{ color: 'var(--cds-support-warning)', letterSpacing: '0.08em' }}
                  >
                    ONBOARDING COMPLETE
                  </h1>
                </motion.div>
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
                className="px-8 py-3 font-terminal text-sm tracking-widest transition-all"
                style={{
                  background: 'var(--ibm-blue-60)',
                  border: '1px solid var(--cds-border-interactive)',
                  color: '#fff',
                  borderRadius: 4,
                }}
                whileHover={{ scale: 1.01 }}
              >
                VIEW KNOWLEDGE BRIEFING CARD →
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
                  style={{ color: 'var(--cds-text-placeholder)' }}
                >
                  KNOWLEDGE DOSSIER GENERATED
                </p>
                <h2
                  className="text-3xl font-bold"
                  style={{ color: 'var(--cds-support-warning)' }}
                >
                  YOUR BLUEBOOK BRIEFING
                </h2>
              </div>

              {isGenerating ? (
                <LoadingSequence
                  isVisible={true}
                  messages={['Compiling knowledge dossier...', 'Synthesising project intelligence...', 'Generating your briefing card...']}
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
                onClick={handleEnterChat}
                className="w-full flex items-center justify-center gap-2 py-4 font-terminal text-sm tracking-widest font-bold"
                style={{
                  borderRadius: 4,
                  background: 'var(--ibm-blue-60)',
                  border: '1px solid var(--cds-border-interactive)',
                  color: '#fff',
                }}
                whileHover={{ scale: 1.01 }}
              >
                OPEN KNOWLEDGE ASSISTANT →
              </motion.button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

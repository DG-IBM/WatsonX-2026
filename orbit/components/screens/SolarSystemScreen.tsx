'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { MessageSquare, Zap } from 'lucide-react';
import { useOrbitStore } from '@/store/orbitStore';
import PlanetModal from '@/components/game/PlanetModal';
import ChatSidebar from '@/components/layout/ChatSidebar';
import AstronautRankDisplay from '@/components/ui/AstronautRank';
import type { Planet } from '@/types/orbit';

const SolarSystem = dynamic(() => import('@/components/game/SolarSystem'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#020408' }}>
      <div className="font-terminal text-sm animate-pulse-glow" style={{ color: 'var(--color-orbit-blue)' }}>
        INITIALISING SOLAR SYSTEM...
      </div>
    </div>
  ),
});

export default function SolarSystemScreen() {
  const router = useRouter();
  const {
    planets,
    activePlanetId,
    activePlanetPhase,
    totalXP,
    astronautRank,
    mcpDocuments,
    userProfile,
    setActivePlanet,
    setActivePlanetPhase,
    completePlanet,
    updatePlanet,
    setChatOpen,
    setCurrentScreen,
  } = useOrbitStore();

  const [hoveredPlanet, setHoveredPlanet] = useState<Planet | null>(null);
  const [isDebriefLoading, setIsDebriefLoading] = useState(false);
  const [unlockNotif, setUnlockNotif] = useState<string | null>(null);

  const activePlanet = planets.find((p) => p.id === activePlanetId) ?? null;
  const completedCount = planets.filter((p) => p.status === 'completed').length;

  // Check if all planets complete → redirect
  useEffect(() => {
    if (planets.length > 0 && planets.every((p) => p.status === 'completed')) {
      const t = setTimeout(() => {
        setCurrentScreen('mission-complete');
        router.push('/mission-complete');
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [planets, router, setCurrentScreen]);

  const handlePlanetClick = useCallback(
    (planet: Planet) => {
      if (planet.status === 'locked') return;
      setActivePlanet(planet.id);
    },
    [setActivePlanet]
  );

  const handleAcceptMission = useCallback(() => {
    setActivePlanetPhase('mission');
  }, [setActivePlanetPhase]);

  const handleSubmitChallenge = useCallback(
    async (response: string) => {
      if (!activePlanet || !userProfile) return;
      setIsDebriefLoading(true);

      try {
        const updatedPlanet = {
          ...activePlanet,
          challenge: activePlanet.challenge
            ? { ...activePlanet.challenge, userResponse: response }
            : activePlanet.challenge,
        };
        updatePlanet(activePlanet.id, { challenge: updatedPlanet.challenge ?? undefined });

        const res = await fetch('/api/llm/planet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planet: updatedPlanet,
            userResponse: response,
            userProfile,
            documents: mcpDocuments,
          }),
        });

        const data = await res.json();
        updatePlanet(activePlanet.id, { debrief: data.debrief });
        setActivePlanetPhase('debrief');
      } catch (err) {
        console.error(err);
        // Show debrief with fallback data
        updatePlanet(activePlanet.id, {
          debrief: {
            strengths: 'You engaged with this mission challenge.',
            gaps: 'There is more to explore in this domain.',
            deeperContext: 'Review the documentation for deeper context.',
            xpAwarded: 90,
            personalisation: 'This domain is relevant to your daily work.',
          },
        });
        setActivePlanetPhase('debrief');
      } finally {
        setIsDebriefLoading(false);
      }
    },
    [activePlanet, userProfile, mcpDocuments, updatePlanet, setActivePlanetPhase]
  );

  const handleReturn = useCallback(() => {
    if (!activePlanet?.debrief) return;

    // Find next planet before completing (for notification)
    const sortedPlanets = [...planets].sort((a, b) => a.order - b.order);
    const nextPlanet = sortedPlanets.find(
      (p) => activePlanet && p.order === activePlanet.order + 1 && p.status === 'locked'
    );

    completePlanet(activePlanet.id, activePlanet.debrief);

    if (nextPlanet) {
      setUnlockNotif(nextPlanet.name);
      setTimeout(() => setUnlockNotif(null), 3000);
    }
  }, [activePlanet, planets, completePlanet]);

  const handleCloseModal = useCallback(() => {
    setActivePlanet(null);
  }, [setActivePlanet]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Three.js Canvas fills full screen */}
      <div className="absolute inset-0">
        <SolarSystem
          planets={planets}
          onPlanetHover={setHoveredPlanet}
          onPlanetClick={handlePlanetClick}
        />
      </div>

      {/* HUD overlay */}
      <div className="hud-overlay">
        {/* TOP LEFT */}
        <div className="absolute top-4 left-4 flex items-center gap-3">
          <span className="text-gradient-orbit font-bold text-xl tracking-widest">ORBIT</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: 'var(--color-signal)' }} />
            <span className="font-terminal text-xs" style={{ color: 'var(--color-signal)', fontSize: '10px' }}>
              CONNECTED
            </span>
          </div>
        </div>

        {/* TOP RIGHT */}
        <div className="absolute top-4 right-4 flex items-center gap-3">
          {astronautRank && (
            <AstronautRankDisplay rank={astronautRank} totalXP={totalXP} size="sm" />
          )}
          <div className="glass-panel px-3 py-1.5 flex items-center gap-1.5">
            <Zap size={12} style={{ color: 'var(--color-gold)' }} />
            <span className="font-terminal text-sm font-bold" style={{ color: 'var(--color-gold)' }}>
              {totalXP} XP
            </span>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="glass-panel p-2.5 rounded-xl transition-all"
            style={{ border: '1px solid rgba(0,170,255,0.2)' }}
          >
            <MessageSquare size={18} style={{ color: 'var(--color-orbit-blue)' }} />
          </button>
        </div>

        {/* BOTTOM LEFT — progress */}
        <div className="absolute bottom-6 left-4 flex flex-col gap-2">
          <span className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
            {completedCount} / {planets.length} PLANETS EXPLORED
          </span>
          <div className="flex gap-1.5">
            {planets.map((p) => (
              <div
                key={p.id}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background:
                    p.status === 'completed'
                      ? 'var(--color-gold)'
                      : p.status === 'available'
                      ? 'var(--color-orbit-blue)'
                      : 'rgba(255,255,255,0.1)',
                  boxShadow:
                    p.status === 'completed'
                      ? '0 0 6px var(--color-gold)'
                      : p.status === 'available'
                      ? '0 0 6px var(--color-orbit-blue)'
                      : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* BOTTOM CENTRE — hovered planet info */}
        <AnimatePresence>
          {hoveredPlanet && !activePlanetId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-6 left-1/2 transform -translate-x-1/2 glass-panel px-5 py-3 text-center"
            >
              <div className="font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {hoveredPlanet.name}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {hoveredPlanet.subtitle}
              </div>
              <span
                className="inline-block mt-1 font-terminal text-xs px-2 py-0.5 rounded-full"
                style={{
                  background:
                    hoveredPlanet.status === 'available'
                      ? 'rgba(0,170,255,0.1)'
                      : hoveredPlanet.status === 'completed'
                      ? 'rgba(255,215,0,0.1)'
                      : 'rgba(255,255,255,0.05)',
                  color:
                    hoveredPlanet.status === 'available'
                      ? 'var(--color-orbit-blue)'
                      : hoveredPlanet.status === 'completed'
                      ? 'var(--color-gold)'
                      : 'var(--color-text-muted)',
                  border: '1px solid currentColor',
                  fontSize: '9px',
                }}
              >
                {hoveredPlanet.status.toUpperCase()}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unlock notification */}
        <AnimatePresence>
          {unlockNotif && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="absolute top-16 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl font-terminal text-sm"
              style={{
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.4)',
                color: 'var(--color-gold)',
                boxShadow: '0 0 20px rgba(255,215,0,0.2)',
              }}
            >
              🌍 NEW PLANET UNLOCKED — {unlockNotif}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Planet modal */}
      {activePlanet && activePlanetPhase && (
        <PlanetModal
          planet={activePlanet}
          phase={activePlanetPhase}
          onClose={handleCloseModal}
          onAcceptMission={handleAcceptMission}
          onSubmitChallenge={handleSubmitChallenge}
          onReturn={handleReturn}
          isLoading={isDebriefLoading}
        />
      )}

      {/* Chat sidebar */}
      <ChatSidebar />
    </div>
  );
}

'use client';

import Particles, { ParticlesProvider, useParticlesProvider } from '@tsparticles/react';
import type { ISourceOptions, Engine } from '@tsparticles/engine';

const OPTIONS: ISourceOptions = {
  background: { color: { value: 'transparent' } },
  fpsLimit: 30,
  particles: {
    number: { value: 100, density: { enable: true } },
    color: { value: ['#ffffff', '#00aaff', '#00ff88'] },
    opacity: { value: { min: 0.1, max: 0.6 } },
    size: { value: { min: 0.5, max: 2 } },
    move: {
      enable: true,
      speed: 0.15,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
  },
  detectRetina: true,
};

// Stable init function hoisted outside any component so it never changes reference
async function initEngine(engine: Engine) {
  const { loadSlim } = await import('@tsparticles/slim');
  await loadSlim(engine);
}

function ParticlesInner() {
  const { loaded } = useParticlesProvider();
  if (!loaded) return null;
  return (
    <Particles
      id="orbit-particles"
      options={OPTIONS}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

export default function ParticleBackground() {
  return (
    <ParticlesProvider init={initEngine}>
      <ParticlesInner />
    </ParticlesProvider>
  );
}

'use client';

import Particles, { ParticlesProvider, useParticlesProvider } from '@tsparticles/react';
import type { ISourceOptions, Engine } from '@tsparticles/engine';

// Very subtle IBM-style dot field — sparse, monochromatic, no colour
const OPTIONS: ISourceOptions = {
  background: { color: { value: 'transparent' } },
  fpsLimit: 30,
  particles: {
    number: { value: 40, density: { enable: true } },
    color: { value: '#393939' },
    opacity: { value: { min: 0.3, max: 0.7 } },
    size: { value: { min: 0.5, max: 1.5 } },
    move: {
      enable: true,
      speed: 0.08,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
  },
  detectRetina: true,
};

async function initEngine(engine: Engine) {
  const { loadSlim } = await import('@tsparticles/slim');
  await loadSlim(engine);
}

function ParticlesInner() {
  const { loaded } = useParticlesProvider();
  if (!loaded) return null;
  return (
    <Particles
      id="bluebook-particles"
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

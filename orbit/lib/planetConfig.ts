import type { MCPDocument, Planet, PlanetStatus, PlanetVisualConfig } from '@/types/orbit';
import * as THREE from 'three';

// ─── Domain visual presets ────────────────────────────────────────────────────

export const DOMAIN_VISUAL_PRESETS: Record<string, Partial<PlanetVisualConfig>> = {
  'Project Foundation': { color: '#f4a460', textureType: 'rocky', size: 1.4 },
  'Architecture':       { color: '#7b68ee', textureType: 'gas',   size: 1.2 },
  'Core Features':      { color: '#20b2aa', textureType: 'ocean', size: 1.3 },
  'Risks':              { color: '#cc3300', textureType: 'lava',  size: 1.0 },
  'Legacy':             { color: '#a8d4e6', textureType: 'icy',   size: 0.8 },
  'Team & Process':     { color: '#9b59b6', textureType: 'gas',   size: 1.1 },
  'Data & APIs':        { color: '#2196f3', textureType: 'storm', size: 1.2 },
  'Security & Auth':    { color: '#ff6b35', textureType: 'storm', size: 1.0 },
};

// ─── Validation & normalisation ───────────────────────────────────────────────

export function validateAndNormalisePlanetConfig(
  config: Partial<PlanetVisualConfig>,
  order: number,
  totalPlanets: number
): PlanetVisualConfig {
  const orbitRadius = config.orbitRadius ?? 4 + (order - 1) * (10 / Math.max(totalPlanets - 1, 1));
  const orbitSpeed = config.orbitSpeed ?? 0.008 - (order - 1) * 0.001;
  const clampedSpeed = Math.max(0.001, Math.min(0.008, orbitSpeed));
  const clampedRadius = Math.max(4, Math.min(14, orbitRadius));

  return {
    size: Math.max(0.6, Math.min(2.0, config.size ?? 1.0)),
    color: config.color ?? '#7b68ee',
    secondaryColor: config.secondaryColor ?? config.color ?? '#5a4db0',
    emissiveColor: config.emissiveColor ?? '#220044',
    orbitRadius: clampedRadius,
    orbitSpeed: clampedSpeed,
    hasRings: config.hasRings ?? false,
    ringSeed: config.ringSeed ?? Math.floor(Math.random() * 100),
    atmosphereColor: config.atmosphereColor ?? config.color ?? '#7b68ee',
    textureType: config.textureType ?? 'rocky',
  };
}

// ─── Orbit position ───────────────────────────────────────────────────────────

export function generateOrbitPath(
  planet: Planet,
  progress: number
): { x: number; y: number; z: number } {
  const angle = progress * Math.PI * 2;
  const r = planet.visualConfig.orbitRadius;
  return {
    x: Math.cos(angle) * r,
    y: 0,
    z: Math.sin(angle) * r,
  };
}

// ─── Three.js material factory ────────────────────────────────────────────────

export function getPlanetMaterial(
  config: PlanetVisualConfig,
  status: PlanetStatus
): THREE.MeshStandardMaterial {
  if (status === 'locked') {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a2e'),
      emissive: new THREE.Color('#0a0a1a'),
      emissiveIntensity: 0.1,
      roughness: 0.9,
      metalness: 0.1,
    });
  }

  const baseProps: THREE.MeshStandardMaterialParameters = {
    color: new THREE.Color(config.color),
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: 0.15,
  };

  switch (config.textureType) {
    case 'icy':
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        roughness: 0.2,
        metalness: 0.3,
        emissiveIntensity: 0.1,
      });
    case 'lava':
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        roughness: 0.8,
        emissiveIntensity: 0.6,
      });
    case 'gas':
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        roughness: 0.6,
        transparent: true,
        opacity: 0.92,
        emissiveIntensity: 0.2,
      });
    case 'storm':
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        roughness: 0.95,
        emissiveIntensity: 0.05,
      });
    case 'ocean':
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        roughness: 0.3,
        metalness: 0.2,
        emissiveIntensity: 0.2,
      });
    default: // rocky
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        roughness: 0.8,
        metalness: 0.05,
      });
  }
}

// ─── Keyword-based document selection ────────────────────────────────────────

export function selectRelevantDocumentsForPlanet(
  documents: MCPDocument[],
  planetName: string,
  domainType: string,
  limit: number
): MCPDocument[] {
  const terms = `${planetName} ${domainType}`.toLowerCase().split(/\s+/);

  const scored = documents.map((doc) => {
    const haystack = `${doc.title} ${doc.content.slice(0, 2000)}`.toLowerCase();
    const score = terms.reduce((acc, term) => {
      const matches = (haystack.match(new RegExp(term, 'g')) ?? []).length;
      return acc + matches;
    }, 0);
    return { doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc);
}

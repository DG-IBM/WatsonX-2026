'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import type { KnowledgeNode } from '@/types/bluebook';

interface PlanetMeshProps {
  planet: KnowledgeNode;
  initialAngle: number;
  onHover: (planet: KnowledgeNode | null) => void;
  onClick: (planet: KnowledgeNode) => void;
}

/** Derive the glow colour for a completed node based on its score */
function getCompletedGlowColor(node: KnowledgeNode): string {
  switch (node.score?.nodeColour) {
    case 'green':  return '#22c55e';
    case 'yellow': return '#f59e0b';
    case 'red':    return '#ef4444';
    default:       return '#ffd700';
  }
}

export default function PlanetMesh({ planet, initialAngle, onHover, onClick }: PlanetMeshProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const angleRef = useRef(initialAngle);
  const { visualConfig, status } = planet;

  // Build material based on status
  const material = useMemo(() => {
    if (status === 'untouched') {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(visualConfig.color),
        emissive: new THREE.Color(visualConfig.emissiveColor),
        emissiveIntensity: 0.08,
        roughness: 0.85,
        opacity: 0.6,
        transparent: true,
      });
    }

    if (status === 'reading') {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(visualConfig.color),
        emissive: new THREE.Color(visualConfig.emissiveColor),
        emissiveIntensity: 0.35,
        roughness: 0.6,
      });
    }

    // complete
    const glowColor = getCompletedGlowColor(planet);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
  }, [status, visualConfig, planet.score?.nodeColour]); // eslint-disable-line react-hooks/exhaustive-deps

  // Completed ring material
  const completedRingMat = useMemo(() => {
    const glowColor = getCompletedGlowColor(planet);
    return new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.75,
    });
  }, [planet.score?.nodeColour]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return;

    // Orbit
    angleRef.current += visualConfig.orbitSpeed * delta;
    const r = visualConfig.orbitRadius;
    groupRef.current.position.x = Math.cos(angleRef.current) * r;
    groupRef.current.position.z = Math.sin(angleRef.current) * r;

    // Self rotation
    meshRef.current.rotation.y += 0.002;

    // Hover scale
    const targetScale = hovered ? 1.15 : 1;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    // Pulse for reading state
    if (status === 'reading' && material instanceof THREE.MeshStandardMaterial) {
      const pulse = 0.25 + Math.abs(Math.sin(Date.now() * 0.002)) * 0.25;
      material.emissiveIntensity = pulse;
    }

    // Hover emissive boost
    if (status !== 'reading' && material instanceof THREE.MeshStandardMaterial) {
      const baseIntensity = status === 'untouched' ? 0.08 : 0.45;
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        hovered ? baseIntensity + 0.25 : baseIntensity,
        0.1
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Planet mesh */}
      <mesh
        ref={meshRef}
        material={material}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(planet); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
        onClick={(e) => { e.stopPropagation(); onClick(planet); }}
        castShadow
      >
        <sphereGeometry args={[visualConfig.size, 32, 32]} />
      </mesh>

      {/* Completed glow ring */}
      {status === 'complete' && (
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[visualConfig.size * 1.45, 0.045, 2, 64]} />
          <primitive object={completedRingMat} />
        </mesh>
      )}

      {/* Revisit warning ring for red/yellow nodes */}
      {status === 'complete' && (planet.score?.nodeColour === 'red' || planet.score?.nodeColour === 'yellow') && (
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[visualConfig.size * 1.75, 0.025, 2, 64]} />
          <meshStandardMaterial
            color={planet.score.nodeColour === 'red' ? '#ef4444' : '#f59e0b'}
            emissive={planet.score.nodeColour === 'red' ? '#ef4444' : '#f59e0b'}
            emissiveIntensity={0.5}
            transparent
            opacity={0.45}
          />
        </mesh>
      )}

      {/* Hover label */}
      {hovered && (
        <Html center position={[0, -(visualConfig.size + 0.8), 0]} distanceFactor={8}>
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '9px',
              color: status === 'complete'
                ? (planet.score?.nodeColour === 'green' ? '#22c55e' : planet.score?.nodeColour === 'red' ? '#ef4444' : '#f59e0b')
                : status === 'reading'
                ? '#00aaff'
                : 'rgba(200,220,240,0.6)',
              background: 'rgba(2,4,8,0.88)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {planet.title}
          </div>
        </Html>
      )}

      {/* Untouched dim overlay label — always visible */}
      {!hovered && status === 'untouched' && (
        <Html center position={[0, -(visualConfig.size + 0.8), 0]} distanceFactor={8}>
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '8px',
              color: 'rgba(160,190,220,0.35)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {planet.title}
          </div>
        </Html>
      )}
    </group>
  );
}

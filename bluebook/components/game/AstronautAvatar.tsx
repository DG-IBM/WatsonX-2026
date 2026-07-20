'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import type { Planet } from '@/types/bluebook';

interface AstronautAvatarProps {
  targetPlanet: Planet | null;
}

export default function AstronautAvatar({ targetPlanet }: AstronautAvatarProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    // Float animation
    groupRef.current.position.y = Math.sin(timeRef.current * 1.5) * 0.2;

    // Move toward target
    if (targetPlanet) {
      const r = targetPlanet.visualConfig.orbitRadius;
      const target = new THREE.Vector3(r * 1.1, 0, 0);
      groupRef.current.position.lerp(target, delta * 0.5);
    }
  });

  return (
    <group ref={groupRef} position={[4, 0, 0]}>
      <Billboard>
        <group scale={0.3}>
          {/* Helmet */}
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="#e8f4fd" roughness={0.3} />
          </mesh>
          {/* Visor */}
          <mesh position={[0, 1.2, 0.3]}>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshStandardMaterial
              color="#004466"
              transparent
              opacity={0.7}
              roughness={0.1}
              metalness={0.3}
            />
          </mesh>
          {/* Torso */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.7, 0.9, 0.45]} />
            <meshStandardMaterial color="#d0e8f0" roughness={0.5} />
          </mesh>
          {/* Arms */}
          <mesh position={[-0.55, 0.2, 0]} rotation-z={0.3}>
            <cylinderGeometry args={[0.14, 0.14, 0.7, 8]} />
            <meshStandardMaterial color="#c8dce8" />
          </mesh>
          <mesh position={[0.55, 0.2, 0]} rotation-z={-0.3}>
            <cylinderGeometry args={[0.14, 0.14, 0.7, 8]} />
            <meshStandardMaterial color="#c8dce8" />
          </mesh>
          {/* Legs */}
          <mesh position={[-0.2, -0.7, 0]}>
            <cylinderGeometry args={[0.16, 0.14, 0.75, 8]} />
            <meshStandardMaterial color="#b8ccd8" />
          </mesh>
          <mesh position={[0.2, -0.7, 0]}>
            <cylinderGeometry args={[0.16, 0.14, 0.75, 8]} />
            <meshStandardMaterial color="#b8ccd8" />
          </mesh>
          {/* Backpack */}
          <mesh position={[0, 0.25, -0.35]}>
            <boxGeometry args={[0.5, 0.6, 0.2]} />
            <meshStandardMaterial color="#90a8b8" />
          </mesh>
          {/* Chest light */}
          <mesh position={[0, 0.3, 0.23]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color="#00ff88"
              emissive="#00ff88"
              emissiveIntensity={2}
            />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

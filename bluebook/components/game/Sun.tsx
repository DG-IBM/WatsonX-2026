'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Mesh } from 'three';

export default function Sun() {
  const meshRef = useRef<Mesh>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += delta;
    if (meshRef.current) {
      const scale = 1 + Math.sin(time.current) * 0.03;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Core — IBM Blue node hub */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial
          color="#0f62fe"
          emissive="#4589ff"
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      {/* Outer subtle atmosphere */}
      <mesh scale={1.2}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial
          color="#4589ff"
          emissive="#0f62fe"
          emissiveIntensity={0.3}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light — neutral white-blue */}
      <pointLight color="#c8d8ff" intensity={2} distance={50} decay={2} />

      {/* HTML label */}
      <Html center position={[0, 3.5, 0]} distanceFactor={12}>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: '#78a9ff',
            letterSpacing: '2px',
            background: 'rgba(22,22,22,0.85)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(69,137,255,0.35)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          PROJECT CORE
        </div>
      </Html>
    </group>
  );
}

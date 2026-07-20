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
      {/* Core sun */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial
          color="#ff9900"
          emissive="#ff6600"
          emissiveIntensity={1.5}
          roughness={0.4}
        />
      </mesh>

      {/* Outer glow atmosphere */}
      <mesh scale={1.2}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={0.8}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light from sun */}
      <pointLight color="#fff4e0" intensity={3} distance={50} decay={2} />

      {/* HTML label */}
      <Html center position={[0, 3.5, 0]} distanceFactor={12}>
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: '9px',
            color: '#ffd700',
            letterSpacing: '2px',
            background: 'rgba(2,4,8,0.7)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,215,0,0.3)',
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

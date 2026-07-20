'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import type { Planet } from '@/types/orbit';

interface PlanetMeshProps {
  planet: Planet;
  initialAngle: number;
  onHover: (planet: Planet | null) => void;
  onClick: (planet: Planet) => void;
}

export default function PlanetMesh({ planet, initialAngle, onHover, onClick }: PlanetMeshProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const angleRef = useRef(initialAngle);
  const { visualConfig, status } = planet;

  // Build material based on status and texture type
  const material = useMemo(() => {
    if (status === 'locked') {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1a1a2e'),
        emissive: new THREE.Color('#0a0a1a'),
        emissiveIntensity: 0.1,
        roughness: 0.9,
      });
    }

    const c = new THREE.Color(visualConfig.color);
    const e = new THREE.Color(visualConfig.emissiveColor);

    switch (visualConfig.textureType) {
      case 'icy':
        return new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.1, roughness: 0.2, metalness: 0.3 });
      case 'lava':
        return new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.6, roughness: 0.8 });
      case 'gas':
        return new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.2, roughness: 0.6, transparent: true, opacity: 0.92 });
      case 'storm':
        return new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.05, roughness: 0.95 });
      case 'ocean':
        return new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.2 });
      default:
        return new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.15, roughness: 0.8 });
    }
  }, [status, visualConfig]);

  // Completed ring material
  const completedRingMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffd700',
        emissive: '#ffd700',
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
      }),
    []
  );

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

    // Hover emissive boost
    if (material instanceof THREE.MeshStandardMaterial) {
      const baseIntensity = status === 'locked' ? 0.1 : 0.15;
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        hovered ? baseIntensity + 0.3 : baseIntensity,
        0.1
      );
    }
  });

  const handleClick = () => {
    if (status === 'locked') {
      // Brief red flash
      if (material instanceof THREE.MeshStandardMaterial) {
        const orig = material.color.clone();
        material.color.set('#440000');
        setTimeout(() => material.color.copy(orig), 200);
      }
      return;
    }
    onClick(planet);
  };

  return (
    <group ref={groupRef}>
      {/* Planet mesh */}
      <mesh
        ref={meshRef}
        material={material}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(planet); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
        onClick={(e) => { e.stopPropagation(); handleClick(); }}
        castShadow
      >
        <sphereGeometry args={[visualConfig.size, 32, 32]} />
      </mesh>

      {/* Gas atmosphere layer */}
      {visualConfig.textureType === 'gas' && status !== 'locked' && (
        <mesh scale={1.08}>
          <sphereGeometry args={[visualConfig.size, 16, 16]} />
          <meshStandardMaterial
            color={new THREE.Color(visualConfig.atmosphereColor)}
            transparent
            opacity={0.12}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Rings */}
      {visualConfig.hasRings && status !== 'locked' && (
        <mesh rotation-x={Math.PI / 3}>
          <torusGeometry args={[
            visualConfig.size * 1.6,
            visualConfig.size * 0.15,
            2,
            64,
          ]} />
          <meshStandardMaterial
            color={new THREE.Color(visualConfig.secondaryColor)}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Completed glow ring */}
      {status === 'completed' && (
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[visualConfig.size * 1.4, 0.04, 2, 64]} />
          <primitive object={completedRingMat} />
        </mesh>
      )}

      {/* Lock icon for locked planets */}
      {status === 'locked' && (
        <Html center position={[0, visualConfig.size + 0.5, 0]} distanceFactor={8}>
          <div
            style={{
              fontSize: '14px',
              pointerEvents: 'none',
              opacity: 0.7,
            }}
          >
            🔒
          </div>
        </Html>
      )}

      {/* Hover label */}
      {hovered && status !== 'locked' && (
        <Html center position={[0, -(visualConfig.size + 0.8), 0]} distanceFactor={8}>
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '9px',
              color: status === 'completed' ? '#ffd700' : '#00aaff',
              background: 'rgba(2,4,8,0.85)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${status === 'completed' ? 'rgba(255,215,0,0.4)' : 'rgba(0,170,255,0.3)'}`,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {planet.name}
          </div>
        </Html>
      )}
    </group>
  );
}

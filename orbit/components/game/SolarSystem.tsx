'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Sun from './Sun';
import PlanetMesh from './Planet';
import StarField from './StarField';
import AstronautAvatar from './AstronautAvatar';
import type { Planet } from '@/types/orbit';

interface SolarSystemProps {
  planets: Planet[];
  onPlanetHover: (planet: Planet | null) => void;
  onPlanetClick: (planet: Planet) => void;
}

export default function SolarSystem({ planets, onPlanetHover, onPlanetClick }: SolarSystemProps) {
  const lastCompleted = [...planets].filter((p) => p.status === 'completed').sort((a, b) => b.order - a.order)[0] ?? null;

  return (
    <Canvas
      camera={{ position: [0, 18, 22], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#020408' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[20, 20, 10]} intensity={0.4} color="#a0c0ff" />
      <directionalLight position={[-20, -10, -10]} intensity={0.2} color="#ffa040" />

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={10}
        maxDistance={35}
        autoRotate={true}
        autoRotateSpeed={0.2}
        enableDamping={true}
        dampingFactor={0.05}
      />

      {/* Sun */}
      <Sun />

      {/* Orbit path rings */}
      {planets.map((planet) => {
        const color =
          planet.status === 'completed'
            ? '#ffd700'
            : planet.status === 'locked'
            ? '#ffffff'
            : '#00aaff';
        const opacity =
          planet.status === 'completed' ? 0.3 : planet.status === 'locked' ? 0.05 : 0.2;

        return (
          <mesh key={`orbit-${planet.id}`} rotation-x={Math.PI / 2}>
            <torusGeometry args={[planet.visualConfig.orbitRadius, 0.015, 2, 128]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} />
          </mesh>
        );
      })}

      {/* Planets */}
      {planets.map((planet, idx) => (
        <PlanetMesh
          key={planet.id}
          planet={planet}
          initialAngle={(idx / planets.length) * Math.PI * 2}
          onHover={onPlanetHover}
          onClick={onPlanetClick}
        />
      ))}

      {/* Astronaut */}
      <AstronautAvatar targetPlanet={lastCompleted} />

      {/* Stars */}
      <StarField />
    </Canvas>
  );
}

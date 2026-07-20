'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Sun from './Sun';
import PlanetMesh from './Planet';
import StarField from './StarField';
import type { KnowledgeNode } from '@/types/orbit';

interface SolarSystemProps {
  nodes: KnowledgeNode[];
  onNodeHover: (node: KnowledgeNode | null) => void;
  onNodeClick: (node: KnowledgeNode) => void;
}

export default function SolarSystem({ nodes, onNodeHover, onNodeClick }: SolarSystemProps) {
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
      {nodes.map((node) => {
        const colour =
          node.status === 'complete'
            ? (node.score?.nodeColour === 'green' ? '#22c55e' : node.score?.nodeColour === 'red' ? '#ef4444' : '#f59e0b')
            : node.status === 'reading'
            ? '#00aaff'
            : '#334455';
        const opacity = node.status === 'complete' ? 0.3 : node.status === 'reading' ? 0.2 : 0.07;

        return (
          <mesh key={`orbit-${node.id}`} rotation-x={Math.PI / 2}>
            <torusGeometry args={[node.visualConfig.orbitRadius, 0.015, 2, 128]} />
            <meshBasicMaterial color={colour} transparent opacity={opacity} />
          </mesh>
        );
      })}

      {/* Nodes */}
      {nodes.map((node, idx) => (
        <PlanetMesh
          key={node.id}
          planet={node}
          initialAngle={(idx / nodes.length) * Math.PI * 2}
          onHover={onNodeHover}
          onClick={onNodeClick}
        />
      ))}

      {/* Stars */}
      <StarField />
    </Canvas>
  );
}

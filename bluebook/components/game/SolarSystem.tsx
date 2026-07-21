'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Sun from './Sun';
import PlanetMesh from './Planet';
import StarField from './StarField';
import type { KnowledgeNode } from '@/types/bluebook';

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
      style={{ background: '#161616' }}
    >
      {/* Lighting — neutral, IBM dark-mode palette */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[20, 20, 10]} intensity={0.5} color="#c8d8ff" />
      <directionalLight position={[-20, -10, -10]} intensity={0.15} color="#a0b8e0" />

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

      {/* Orbit path rings — IBM Carbon colour tokens */}
      {nodes.map((node) => {
        const colour =
          node.status === 'complete'
            ? (node.score?.nodeColour === 'green' ? '#42be65' : node.score?.nodeColour === 'red' ? '#fa4d56' : '#f1c21b')
            : node.status === 'reading'
            ? '#4589ff'
            : '#393939';
        const opacity = node.status === 'complete' ? 0.28 : node.status === 'reading' ? 0.18 : 0.06;

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

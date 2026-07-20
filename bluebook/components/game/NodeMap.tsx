'use client';

import { useRef, useState, useCallback } from 'react';
import type { KnowledgeNode } from '@/types/bluebook';

interface NodeMapProps {
  nodes: KnowledgeNode[];
  selectedNodeId: string | null;
  onNodeClick: (node: KnowledgeNode) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const NODE_W = 180;
const NODE_H = 80;
const COL_GAP = 64;    // gap between nodes (between right edge of one and left edge of next)
const ROW_GAP = 72;    // vertical gap between rows
const COLS = 3;        // nodes per row
const PAD_X = 48;
const PAD_Y = 60;

interface LayoutNode {
  node: KnowledgeNode;
  cx: number;
  cy: number;
}

function layout(nodes: KnowledgeNode[]): { placed: LayoutNode[]; width: number; height: number } {
  const placed: LayoutNode[] = nodes.map((node, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      node,
      cx: PAD_X + col * (NODE_W + COL_GAP) + NODE_W / 2,
      cy: PAD_Y + row * (NODE_H + ROW_GAP) + NODE_H / 2,
    };
  });

  const maxCols = Math.min(nodes.length, COLS);
  const rows = Math.ceil(nodes.length / COLS);
  const width = PAD_X * 2 + maxCols * (NODE_W + COL_GAP) - COL_GAP;
  const height = PAD_Y * 2 + rows * NODE_H + (rows - 1) * ROW_GAP;

  return { placed, width, height };
}

// ─── Status colours ───────────────────────────────────────────────────────────
function nodeColors(node: KnowledgeNode) {
  if (node.status === 'complete') {
    const c = node.score?.nodeColour;
    if (c === 'green')  return { fill: '#0d2e1a', border: '#22c55e', text: '#86efac', glow: '#22c55e' };
    if (c === 'red')    return { fill: '#2d0f0f', border: '#ef4444', text: '#fca5a5', glow: '#ef4444' };
                        return { fill: '#2a1f06', border: '#f59e0b', text: '#fcd34d', glow: '#f59e0b' };
  }
  if (node.status === 'reading') {
    return { fill: '#06131f', border: '#00aaff', text: '#7dd3fc', glow: '#00aaff' };
  }
  // Skeleton = untouched with no summary yet
  const isSkeleton = !node.summary;
  if (isSkeleton) {
    return { fill: '#080f1a', border: 'rgba(0,170,255,0.12)', text: 'rgba(122,172,204,0.4)', glow: 'none' };
  }
  return { fill: '#0a1628', border: 'rgba(0,170,255,0.22)', text: '#7aaccc', glow: 'none' };
}

// ─── Path between nodes ───────────────────────────────────────────────────────
// Same row: connect right edge of from to left edge of to (horizontal flow)
function edgePath(from: LayoutNode, to: LayoutNode): string {
  const x1 = from.cx + NODE_W / 2;
  const y1 = from.cy;
  const x2 = to.cx - NODE_W / 2;
  const y2 = to.cy;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

// Row wrap: connect bottom edge of last in row to top edge of first in next row
function rowConnectorPath(from: LayoutNode, to: LayoutNode): string {
  const x1 = from.cx;
  const y1 = from.cy + NODE_H / 2;
  const x2 = to.cx;
  const y2 = to.cy - NODE_H / 2;
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

export default function NodeMap({ nodes, selectedNodeId, onNodeClick }: NodeMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const { placed, width, height } = layout(nodes);

  // ── Build edge segments ────────────────────────────────────────────────────
  const edges: { path: string; completed: boolean; key: string }[] = [];
  for (let i = 0; i < placed.length - 1; i++) {
    const from = placed[i];
    const to = placed[i + 1];
    const toCol = (i + 1) % COLS;
    const isRowWrap = toCol === 0; // to is the first of a new row
    const path = isRowWrap ? rowConnectorPath(from, to) : edgePath(from, to);
    const completed = from.node.status === 'complete';
    edges.push({ path, completed, key: `${from.node.id}-${to.node.id}` });
  }

  const handleClick = useCallback((node: KnowledgeNode) => {
    onNodeClick(node);
  }, [onNodeClick]);

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
          No knowledge nodes loaded yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-auto no-print"
      style={{ background: 'var(--color-void)' }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,170,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,170,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}
      >
        <defs>
          {/* Glow filters */}
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Arrow marker */}
          <marker id="arrow-dim" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(0,170,255,0.2)" />
          </marker>
          <marker id="arrow-active" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(0,170,255,0.6)" />
          </marker>
          <marker id="arrow-done" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#22c55e" />
          </marker>
        </defs>

        {/* ── Edges / path connectors ──────────────────────────────── */}
        {edges.map((e) => (
          <path
            key={e.key}
            d={e.path}
            fill="none"
            stroke={e.completed ? '#22c55e' : 'rgba(0,170,255,0.2)'}
            strokeWidth={e.completed ? 1.5 : 1}
            strokeDasharray={e.completed ? 'none' : '4 4'}
            markerEnd={e.completed ? 'url(#arrow-done)' : 'url(#arrow-dim)'}
            opacity={0.7}
          />
        ))}

        {/* ── Nodes ────────────────────────────────────────────────── */}
        {placed.map(({ node, cx, cy }) => {
          const colors = nodeColors(node);
          const isSelected = node.id === selectedNodeId;
          const isHovered = node.id === hovered;
          const x = cx - NODE_W / 2;
          const y = cy - NODE_H / 2;
          const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;
          const filterAttr = node.status === 'complete'
            ? node.score?.nodeColour === 'green' ? 'url(#glow-green)'
              : node.score?.nodeColour === 'red' ? 'url(#glow-red)'
              : 'url(#glow-blue)'
            : node.status === 'reading' || isHovered ? 'url(#glow-blue)'
            : undefined;

          return (
            <g
              key={node.id}
              transform={`translate(${cx}, ${cy}) scale(${scale}) translate(${-cx}, ${-cy})`}
              style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
              onClick={() => handleClick(node)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              filter={filterAttr}
            >
              {/* Node card background */}
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                ry={10}
                fill={colors.fill}
                stroke={isSelected ? '#ffffff' : colors.border}
                strokeWidth={isSelected ? 2 : 1.5}
              />

              {/* Status indicator strip on left edge */}
              <rect
                x={x}
                y={y + 10}
                width={3}
                height={NODE_H - 20}
                rx={2}
                fill={colors.border}
                opacity={node.status === 'untouched' ? 0.3 : 0.9}
              />

              {/* Order number */}
              <text
                x={x + 12}
                y={y + 14}
                fontSize={9}
                fontFamily="'Space Mono', monospace"
                fill={colors.border}
                opacity={0.7}
              >
                {String(node.order).padStart(2, '0')}
              </text>

              {/* Score badge (top right) */}
              {node.status === 'complete' && node.score && (
                <text
                  x={x + NODE_W - 8}
                  y={y + 14}
                  fontSize={9}
                  fontFamily="'Space Mono', monospace"
                  fill={colors.border}
                  textAnchor="end"
                >
                  {node.score.percentage}%
                </text>
              )}

              {/* Reading pulse ring */}
              {node.status === 'reading' && (
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={NODE_W + 6}
                  height={NODE_H + 6}
                  rx={13}
                  fill="none"
                  stroke="#00aaff"
                  strokeWidth={1}
                  opacity={0.35}
                  strokeDasharray="3 3"
                />
              )}

              {/* Node title — wrapped to 3 lines via SVG text elements */}
              {(() => {
                const words = node.title.split(' ');
                const lines: string[] = [];
                let current = '';
                const maxChars = 20;
                for (const word of words) {
                  if ((current + ' ' + word).trim().length <= maxChars) {
                    current = (current + ' ' + word).trim();
                  } else {
                    if (current) lines.push(current);
                    current = word;
                  }
                }
                if (current) lines.push(current);
                const display = lines.slice(0, 3);
                const lineH = 14;
                const totalH = display.length * lineH;
                const startY = cy + 8 - totalH / 2 + 12; // vertically centred in lower 3/4
                return display.map((line, li) => (
                  <text
                    key={li}
                    x={x + NODE_W / 2}
                    y={startY + li * lineH}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="'Space Grotesk', system-ui, sans-serif"
                    fill={colors.text}
                  >
                    {line}
                  </text>
                ));
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

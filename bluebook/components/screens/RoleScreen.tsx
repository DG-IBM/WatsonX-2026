'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useBluebookStore } from '@/store/bluebookStore';
import LoadingSequence from '@/components/ui/LoadingSequence';
import ParticleBackground from '@/components/ui/ParticleBackground';
import type { KnowledgeNode, UserProfile } from '@/types/bluebook';

/** Fire-and-forget: enrich one node after the map is shown */
async function enrichNodeInBackground(
  node: KnowledgeNode,
  roleDescription: string,
  documents: unknown[],
  onDone: (nodeId: string, patch: Partial<KnowledgeNode>) => void
) {
  try {
    const res = await fetch('/api/llm/enrich-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeDescription: node.summary,
        roleDescription,
        documents,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    onDone(node.id, {
      summary: data.summary,
      keyTakeaways: data.keyTakeaways,
      roleRelevance: data.roleRelevance,
      diagrams: data.diagrams,
      keyContacts: data.keyContacts,
      links: data.links,
      sources: data.sources,
      quiz: data.quiz,
    });
  } catch {
    // silently ignore — node stays as skeleton
  }
}

const ROLE_TEMPLATES: Record<string, string> = {
  '+ Frontend Developer':
    'I am a frontend developer joining mid-sprint. I have 3 years of React experience and will be working on the dashboard module. I report to the tech lead and my primary focus is the data visualisation components.',
  '+ Backend Engineer':
    'I am a backend engineer with 5 years of experience in Node.js and Python. I will be working on the API services and database layer, focusing on performance optimisation and new feature endpoints.',
  '+ Delivery Manager':
    'I am a delivery manager responsible for sprint planning and stakeholder communication. I have 6 years of agile delivery experience and will be coordinating across frontend, backend and QA teams.',
  '+ UX Designer':
    'I am a UX designer with 4 years of experience in product design. I will be working on user research, wireframing and design system improvements, working closely with the frontend team.',
  '+ DevOps Engineer':
    'I am a DevOps engineer joining to improve CI/CD pipelines and cloud infrastructure. I have expertise in Kubernetes, Terraform and AWS and will be owning the deployment and monitoring stack.',
};

export default function RoleScreen() {
  const router = useRouter();
  const {
    mcpDocuments, setMCPDocuments, setUserProfile, setNodes,
    setOnboardingBriefingCard, setLoading, isLoading, setCurrentScreen,
    enrichNode, resetForNewSession,
  } = useBluebookStore();
  const [roleText, setRoleText] = useState('');

  const charCount = roleText.length;
  const canSubmit = charCount >= 30 && !isLoading;

  const insertTemplate = (template: string) => {
    setRoleText(ROLE_TEMPLATES[template] ?? '');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // Clear any stale state from a previous failed run
    resetForNewSession();
    setLoading(true, 'Building your knowledge map...');

    try {
      // ── Phase 1: skeleton (fast, ~10s) ───────────────────────────
      const res = await fetch('/api/llm/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleDescription: roleText,
          documents: mcpDocuments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Architecture failed');

      const freshDocs = Array.isArray(data.documents) && data.documents.length > 0
        ? data.documents : mcpDocuments;
      if (freshDocs !== mcpDocuments) setMCPDocuments(freshDocs);

      setUserProfile(data.userProfile as UserProfile);
      const nodes = (data.nodes ?? data.planets) as KnowledgeNode[];
      setNodes(nodes);
      if (data.onboardingBriefingCard) {
        setOnboardingBriefingCard(data.onboardingBriefingCard);
      }

      // Navigate to map immediately — user sees nodes straight away
      setCurrentScreen('solar-system');
      setLoading(false);
      router.push('/solar-system');

      // ── Phase 2: enrich each node in background (non-blocking) ───
      // Stagger requests 400ms apart so we don't hammer the LLM gateway
      nodes.forEach((node, idx) => {
        setTimeout(() => {
          enrichNodeInBackground(node, roleText, freshDocs, enrichNode);
        }, idx * 400);
      });

    } catch (err) {
      console.error(err);
      setLoading(false);
      // Don't navigate — show error in place so user can retry
      alert('Failed to generate your knowledge map. Please check your connection and try again.');
    }
  };

  return (
    <>
      <LoadingSequence isVisible={isLoading} />

      {!isLoading && (
        <div className="relative min-h-screen flex items-center justify-center p-4">
          <ParticleBackground />

          <div className="relative z-10 w-full max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
              {/* Left column — astronaut */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="md:col-span-2 flex flex-col items-center gap-6"
              >
                {/* SVG Astronaut */}
                <div className="animate-float">
                  <svg viewBox="0 0 180 240" width="180" height="240" xmlns="http://www.w3.org/2000/svg">
                    {/* Helmet */}
                    <circle cx="90" cy="65" r="45" fill="#d0e8f8" />
                    <circle cx="90" cy="65" r="45" fill="none" stroke="rgba(0,170,255,0.3)" strokeWidth="2" />
                    {/* Visor */}
                    <ellipse cx="90" cy="63" rx="28" ry="24" fill="#003355" opacity="0.85" />
                    <ellipse cx="90" cy="63" rx="28" ry="24" fill="url(#vg2)" />
                    {/* Visor reflection */}
                    <ellipse cx="80" cy="53" rx="9" ry="6" fill="rgba(0,170,255,0.2)" />
                    {/* Torso */}
                    <rect x="55" y="115" width="70" height="80" rx="12" fill="#c0d8ec" />
                    {/* Suit detail */}
                    <rect x="72" y="130" width="36" height="20" rx="4" fill="rgba(0,170,255,0.2)" stroke="rgba(0,170,255,0.4)" strokeWidth="1" />
                    {/* Arms */}
                    <rect x="28" y="118" width="26" height="55" rx="12" fill="#b8cce0" transform="rotate(-6, 41, 145)" />
                    <rect x="126" y="118" width="26" height="55" rx="12" fill="#b8cce0" transform="rotate(6, 139, 145)" />
                    {/* Gloves */}
                    <circle cx="36" cy="176" r="12" fill="#99b8d0" />
                    <circle cx="144" cy="176" r="12" fill="#99b8d0" />
                    {/* Legs */}
                    <rect x="62" y="190" width="22" height="45" rx="10" fill="#b0c8dc" />
                    <rect x="96" y="190" width="22" height="45" rx="10" fill="#b0c8dc" />
                    {/* Boots */}
                    <ellipse cx="73" cy="232" rx="18" ry="8" fill="#8aafc8" />
                    <ellipse cx="107" cy="232" rx="18" ry="8" fill="#8aafc8" />
                    {/* Backpack */}
                    <rect x="95" y="120" width="28" height="45" rx="6" fill="#a0b8cc" />
                    {/* Antenna */}
                    <line x1="118" y1="22" x2="128" y2="5" stroke="#00aaff" strokeWidth="2" />
                    <circle cx="128" cy="4" r="4" fill="#00ff88" />
                    {/* Chest light */}
                    <circle cx="90" cy="155" r="5" fill="#00ff88" opacity="0.9" />
                    <defs>
                      <radialGradient id="vg2" cx="50%" cy="40%" r="60%">
                        <stop offset="0%" stopColor="#00aaff" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#001133" stopOpacity="0.7" />
                      </radialGradient>
                    </defs>
                  </svg>
                </div>

                <div className="text-center">
                  <p
                    className="text-sm italic"
                    style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
                  >
                    &quot;Describe your role and we&apos;ll build a personalised knowledge map from your project docs.&quot;
                  </p>
                  <p
                    className="mt-2 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Your Bluebook is generated uniquely for your role.
                  </p>
                </div>
              </motion.div>

              {/* Right column — form */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="md:col-span-3"
              >
                <div className="glass-panel-bright p-6 flex flex-col gap-5">
                  {/* Panel header */}
                  <div>
                    <p
                      className="font-terminal text-xs tracking-widest"
                      style={{ color: 'var(--color-text-terminal)', fontSize: '11px' }}
                    >
                      IBM BLUEBOOK — WHO ARE YOU?
                    </p>
                    <div
                      className="mt-2"
                      style={{ height: 1, background: 'rgba(0,255,136,0.2)' }}
                    />
                  </div>

                  {/* Textarea */}
                  <div className="relative">
                    <textarea
                      value={roleText}
                      onChange={(e) => setRoleText(e.target.value.slice(0, 500))}
                      rows={7}
                      placeholder={'Example: I am a frontend developer joining mid-sprint. I have 3 years of React experience and will be working on the dashboard module. I report to James Chen.'}
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none leading-relaxed"
                      style={{
                        background: 'var(--color-panel)',
                        border: '1px solid rgba(0,170,255,0.2)',
                        color: 'var(--color-text-primary)',
                        fontFamily: "'Space Grotesk', sans-serif",
                        lineHeight: 1.7,
                      }}
                    />
                    <span
                      className="absolute bottom-3 right-3 font-terminal text-xs"
                      style={{
                        color: charCount > 450 ? 'var(--color-gold)' : 'var(--color-text-muted)',
                      }}
                    >
                      {charCount} / 500
                    </span>
                  </div>

                  {/* Helper tags */}
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(ROLE_TEMPLATES).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => insertTemplate(tag)}
                        className="px-3 py-1.5 rounded-full font-terminal text-xs transition-all"
                        style={{
                          background: 'rgba(0,170,255,0.06)',
                          border: '1px solid rgba(0,170,255,0.2)',
                          color: 'var(--color-orbit-blue)',
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-terminal text-sm tracking-widest font-bold transition-all"
                    style={{
                      background: canSubmit
                        ? 'linear-gradient(135deg, var(--color-orbit-blue), var(--color-orbit-glow))'
                        : 'rgba(0,170,255,0.1)',
                      color: canSubmit ? '#fff' : 'rgba(255,255,255,0.25)',
                      cursor: canSubmit ? 'pointer' : 'not-allowed',
                    }}
                  >
                    BUILD MY KNOWLEDGE MAP
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

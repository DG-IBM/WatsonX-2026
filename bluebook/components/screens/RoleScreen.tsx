'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useBluebookStore } from '@/store/bluebookStore';
import LoadingSequence from '@/components/ui/LoadingSequence';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { fetchProjectDocs } from '@/lib/mcpProxy';
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
    'I am a frontend developer with 3 years of experience. I am joining this project to contribute to the UI and will need to understand the codebase structure, component patterns, team workflows and any areas I should avoid changing without consultation.',
  '+ Backend Engineer':
    'I am a backend engineer with 5 years of experience. I am joining this project to work on server-side services and will need to understand the system architecture, data flows, APIs, deployment processes and any critical areas of the codebase.',
  '+ Delivery Manager':
    'I am a delivery manager with 6 years of agile experience. I am joining this project to own sprint planning and stakeholder communication and will need to understand the team structure, current priorities, processes, risks and how decisions are made.',
  '+ UX Designer':
    'I am a UX designer with 4 years of product design experience. I am joining this project to contribute to user experience and will need to understand the product vision, existing design patterns, user research, the design system and how design feeds into development.',
  '+ DevOps Engineer':
    'I am a DevOps engineer joining to own the deployment and infrastructure side of this project. I will need to understand the current CI/CD setup, cloud infrastructure, monitoring, incident response processes and any platform constraints.',
  '+ QA Engineer':
    'I am a QA engineer with 3 years of testing experience. I am joining this project to own quality assurance and will need to understand the testing strategy, existing test coverage, release processes, known defects and acceptance criteria standards.',
  '+ Data Analyst':
    'I am a data analyst with 4 years of experience. I am joining this project to support data-driven decisions and will need to understand the data sources, reporting tools, existing metrics, data governance policies and key stakeholders who consume my work.',
};

export default function RoleScreen() {
  const router = useRouter();
  const {
    mcpDocuments, mcpConnection, setMCPDocuments, setUserProfile, setNodes,
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

    resetForNewSession();
    setLoading(true, 'Fetching project knowledge...');

    // Fetch docs via same-origin proxy (avoids CORS + server-side network blocks)
    const fetchedDocs = await fetchProjectDocs(
      mcpConnection.url,
      mcpConnection.token,
      mcpConnection.apiKey ?? '',
      roleText,
    );

    console.log(`[RoleScreen] fetchedDocs=${fetchedDocs.length} url="${mcpConnection.url}" apiKey=${mcpConnection.apiKey ? 'present' : 'MISSING'}`);

    if (fetchedDocs.length === 0 && mcpConnection.url) {
      // MCP is connected but we got no docs — likely missing API key or network issue
      console.warn('[RoleScreen] No docs fetched from MCP. Map will be generated without project context.');
    }

    const docsToUse = fetchedDocs.length > 0 ? fetchedDocs : mcpDocuments;
    if (fetchedDocs.length > 0) setMCPDocuments(fetchedDocs);

    setLoading(true, 'Building your knowledge map...');

    try {
      const res = await fetch('/api/llm/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleDescription: roleText,
          documents: docsToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Architecture failed');

      setUserProfile(data.userProfile as UserProfile);
      const nodes = (data.nodes ?? data.planets) as KnowledgeNode[];
      setNodes(nodes);
      if (data.onboardingBriefingCard) {
        setOnboardingBriefingCard(data.onboardingBriefingCard);
      }

      setCurrentScreen('solar-system');
      setLoading(false);
      router.push('/solar-system');

      // Enrich each node with the real project docs
      nodes.forEach((node, idx) => {
        setTimeout(() => {
          enrichNodeInBackground(node, roleText, docsToUse, enrichNode);
        }, idx * 400);
      });

    } catch (err) {
      console.error(err);
      setLoading(false);
      alert('Failed to generate your knowledge map. Please check your connection and try again.');
    }
  };

  return (
    <>
      <LoadingSequence isVisible={isLoading} />

      {!isLoading && (
        <div
          className="relative min-h-screen flex items-center justify-center p-4"
          style={{ background: 'var(--cds-background)' }}
        >
          <ParticleBackground />

          {/* Subtle grid */}
          <div
            className="pointer-events-none fixed inset-0"
            style={{
              backgroundImage: `
                linear-gradient(var(--cds-border-subtle) 1px, transparent 1px),
                linear-gradient(90deg, var(--cds-border-subtle) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
              opacity: 0.18,
              zIndex: 1,
            }}
          />

          <div className="relative z-10 w-full max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">

              {/* Left column — IBM branding + intro */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="md:col-span-2 flex flex-col items-center gap-6 pt-6"
              >
                {/* IBM mark */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background: 'var(--ibm-blue-60)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="48" height="22" viewBox="0 0 48 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0"  y="0"  width="48" height="3.5" rx="1" fill="white" />
                    <rect x="0"  y="5.5" width="48" height="3.5" rx="1" fill="white" />
                    <rect x="6"  y="11" width="36" height="3.5" rx="1" fill="white" />
                    <rect x="6"  y="16.5" width="36" height="3.5" rx="1" fill="white" />
                  </svg>
                </div>

                <div className="text-center">
                  <h2
                    className="text-2xl font-bold mb-1"
                    style={{ color: 'var(--ibm-blue-40)', letterSpacing: '0.08em' }}
                  >
                    IBM BLUEBOOK
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--cds-text-secondary)', lineHeight: 1.6 }}
                  >
                    Describe your role and we&apos;ll build a personalised knowledge map from your project docs.
                  </p>
                  <p className="mt-2 text-xs" style={{ color: 'var(--cds-text-placeholder)' }}>
                    Your Bluebook is generated uniquely for your role.
                  </p>
                </div>

                {/* Decorative divider */}
                <div
                  style={{
                    width: '100%',
                    height: 1,
                    background: 'var(--cds-border-subtle)',
                  }}
                />

                <div className="text-center text-xs" style={{ color: 'var(--cds-text-placeholder)', lineHeight: 1.7 }}>
                  <p>AI-powered onboarding</p>
                  <p>Powered by IBM watsonx</p>
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
                       style={{ color: 'var(--cds-text-placeholder)', fontSize: '11px' }}
                     >
                       IBM BLUEBOOK — YOUR ROLE
                     </p>
                    <div className="mt-2" style={{ height: 1, background: 'var(--cds-border-subtle)' }} />
                  </div>

                  {/* Textarea */}
                  <div className="relative">
                    <textarea
                      value={roleText}
                      onChange={(e) => setRoleText(e.target.value.slice(0, 500))}
                      rows={7}
                      placeholder="Describe your role, experience level, and what you'll be working on. The more context you give, the more tailored your knowledge map will be."
                      className="w-full px-4 py-3 text-sm resize-none outline-none leading-relaxed"
                      style={{
                        background: 'var(--cds-layer-01)',
                        border: '1px solid var(--cds-border-subtle)',
                        borderRadius: 4,
                        color: 'var(--cds-text-primary)',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        lineHeight: 1.7,
                      }}
                    />
                    <span
                      className="absolute bottom-3 right-3 font-terminal text-xs"
                      style={{
                        color: charCount > 450
                          ? 'var(--cds-support-warning)'
                          : 'var(--cds-text-placeholder)',
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
                        className="px-3 py-1.5 font-terminal text-xs transition-all"
                        style={{
                          background: 'var(--cds-support-info-bg)',
                          border: '1px solid rgba(69,137,255,0.25)',
                          color: 'var(--ibm-blue-40)',
                          borderRadius: 20,
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
                    className="w-full flex items-center justify-center gap-2 py-3.5 font-terminal text-sm tracking-widest font-bold transition-all"
                    style={{
                      borderRadius: 4,
                      background: canSubmit ? 'var(--ibm-blue-60)' : 'var(--cds-layer-03)',
                      border: canSubmit
                        ? '1px solid var(--cds-border-interactive)'
                        : '1px solid var(--cds-border-subtle)',
                      color: canSubmit ? '#fff' : 'var(--cds-text-disabled)',
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

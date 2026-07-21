'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useBluebookStore } from '@/store/bluebookStore';
import LoadingSequence from '@/components/ui/LoadingSequence';
import ParticleBackground from '@/components/ui/ParticleBackground';
import type { KnowledgeNode, MCPDocument, UserProfile } from '@/types/bluebook';

/** Extract context_id from a Context Studio JWT */
function extractContextId(apiKey: string): string {
  try {
    const payload = apiKey.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.contextId ?? decoded.context_id ?? '';
  } catch { return ''; }
}

/** Query Context Studio from the browser for a set of broad queries, return docs */
async function fetchDocsFromContextStudio(
  url: string,
  token: string,
  apiKey: string,
  roleDescription: string,
): Promise<MCPDocument[]> {
  if (!url || !token || !apiKey) return [];
  const contextId = extractContextId(apiKey);
  if (!contextId) return [];

  const rawToken = token.replace(/^Bearer\s+/i, '');
  const queries = [
    'project overview purpose goals architecture',
    'team structure roles responsibilities contacts',
    `${roleDescription.slice(0, 120)} workflows processes`,
    'risks technical debt deployment testing',
  ];

  const results = await Promise.allSettled(
    queries.map(async (query, i) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0', id: Date.now() + i,
          method: 'tools/call',
          params: {
            name: 'context-broker-hybrid-query',
            arguments: {
              context_id: contextId,
              AgentPersona: 'OnboardingArchitect',
              query,
              sources: ['vector'],
              vector_params: { top_k: 6 },
              'x-api-key': apiKey,
            },
          },
        }),
      });
      if (!res.ok) return null;

      const contentType = res.headers.get('content-type') ?? '';
      let result: unknown;
      if (contentType.includes('text/event-stream')) {
        const text = await res.text();
        const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
        if (!lines.length) return null;
        result = JSON.parse(lines[lines.length - 1].slice('data: '.length));
      } else {
        result = await res.json();
      }

      const content = (result as { result?: { content?: Array<{ text?: string }> } })?.result?.content;
      if (!Array.isArray(content)) return null;
      const rawText = content.map((c: { text?: string }) => c.text ?? '').join('\n');
      if (!rawText.trim()) return null;

      // Parse chunks and join as plain text
      try {
        const inner = JSON.parse(rawText) as {
          items?: { vector?: Array<{ content?: string; metadata?: { title?: string; source_file?: string } }> };
        };
        const chunks = (inner.items?.vector ?? [])
          .map(item => {
            const title = item.metadata?.title ?? item.metadata?.source_file ?? '';
            return title ? `[${title}]\n${item.content ?? ''}` : (item.content ?? '');
          })
          .filter(Boolean)
          .join('\n\n');
        if (!chunks) return null;
        return { id: `ctx-${i}`, source: 'Context Studio', title: query, content: chunks, metadata: { query } } satisfies MCPDocument;
      } catch {
        return { id: `ctx-${i}`, source: 'Context Studio', title: query, content: rawText, metadata: { query } } satisfies MCPDocument;
      }
    })
  );

  const docs: MCPDocument[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) {
      docs.push(r.value);
    }
  }
  return docs;
}

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

    // Fetch docs client-side (browser can reach MCP; server-side Node cannot)
    const fetchedDocs = await fetchDocsFromContextStudio(
      mcpConnection.url,
      mcpConnection.token,
      mcpConnection.apiKey,
      roleText,
    );
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
                      placeholder="Example: I am a frontend developer joining mid-sprint. I have 3 years of React experience and will be working on the dashboard module. I report to James Chen."
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

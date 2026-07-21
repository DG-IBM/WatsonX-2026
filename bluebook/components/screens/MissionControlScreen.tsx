'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useBluebookStore } from '@/store/bluebookStore';
import ChatInterface from '@/components/ui/ChatInterface';
import ParticleBackground from '@/components/ui/ParticleBackground';
import type { ChatMessage } from '@/types/bluebook';

export default function MissionControlScreen() {
  const router = useRouter();
  const {
    chatMessages,
    userProfile,
    planets,
    mcpDocuments,
    mcpConnection,
    addChatMessage,
    setCurrentScreen,
  } = useBluebookStore();

  const hasWelcomed = useRef(false);
  const completedPlanets = planets.filter((p) => p.status === 'complete');

  useEffect(() => {
    if (hasWelcomed.current || chatMessages.length > 0 || !userProfile) return;
    hasWelcomed.current = true;

    const projectName = mcpConnection.url
      ? new URL(mcpConnection.url).pathname.split('/').filter(Boolean).pop() ?? 'your project'
      : 'your project';

    const welcome: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: `Welcome to your knowledge assistant. You're verifying your understanding of ${projectName} — I have full access to the project knowledge base and know your role as ${userProfile.parsedRole}.\n\nAsk me anything. I'm here to explain context, fill gaps, and help you understand this project thoroughly.`,
      timestamp: new Date(),
    };
    addChatMessage(welcome);
  }, [userProfile]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--cds-background)' }}
    >
      <ParticleBackground />

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-6 pt-4 pb-2"
        style={{ borderBottom: '1px solid var(--cds-border-subtle)' }}
      >
        <button
          onClick={() => { setCurrentScreen('solar-system'); router.push('/solar-system'); }}
          className="font-terminal text-xs transition-opacity opacity-60 hover:opacity-100"
          style={{ color: 'var(--cds-text-secondary)' }}
        >
          ← BACK TO MAP
        </button>
        <span
          className="font-bold text-xl tracking-widest"
          style={{ color: 'var(--ibm-blue-40)', letterSpacing: '0.12em' }}
        >
          IBM BLUEBOOK
        </span>
        <div className="w-24" />
      </div>

      {/* Full-screen chat */}
      <div className="relative z-10 flex-1 flex items-stretch max-w-4xl mx-auto w-full px-4 pb-6 pt-4">
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle)',
            borderRadius: 4,
          }}
        >
          {userProfile && (
            <ChatInterface
              messages={chatMessages}
              userProfile={userProfile}
              completedNodes={completedPlanets}
              documents={mcpDocuments}
              onSendMessage={addChatMessage}
              mcpUrl={mcpConnection.url}
              mcpToken={mcpConnection.token}
              mcpApiKey={mcpConnection.apiKey}
              projectName={
                mcpConnection.url
                  ? new URL(mcpConnection.url).pathname.split('/').filter(Boolean).pop() ?? 'your project'
                  : 'your project'
              }
              mode="full"
            />
          )}
          {!userProfile && (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-terminal text-sm" style={{ color: 'var(--cds-text-placeholder)' }}>
                Complete your onboarding first.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

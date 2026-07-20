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

  // Send welcome message on first open
  useEffect(() => {
    if (hasWelcomed.current || chatMessages.length > 0 || !userProfile) return;
    hasWelcomed.current = true;

    const projectName = mcpConnection.url
      ? new URL(mcpConnection.url).pathname.split('/').filter(Boolean).pop() ?? 'your project'
      : 'your project';

    const welcome: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: `Mission Control here. You're verifying your knowledge of ${projectName} — I have full access to the project knowledge base and know your role as ${userProfile.parsedRole}.\n\nAsk me anything. I'm here to explain context, fill gaps, and help you understand this project thoroughly. What would you like to know?`,
      timestamp: new Date(),
    };
    addChatMessage(welcome);
  }, [userProfile]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-void)' }}
    >
      <ParticleBackground />

      {/* Back button */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-4 pb-2">
        <button
          onClick={() => { setCurrentScreen('solar-system'); router.push('/solar-system'); }}
          className="font-terminal text-xs transition-opacity opacity-50 hover:opacity-100"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ← BACK TO MAP
        </button>
        <span className="text-gradient-orbit font-bold text-xl tracking-widest">IBM BLUEBOOK</span>
        <div className="w-24" />
      </div>

      {/* Full-screen chat */}
      <div className="relative z-10 flex-1 flex items-stretch max-w-4xl mx-auto w-full px-4 pb-6">
        <div className="flex-1 glass-panel-bright rounded-2xl overflow-hidden flex flex-col">
          {userProfile && (
            <ChatInterface
              messages={chatMessages}
              userProfile={userProfile}
              completedNodes={completedPlanets}
              documents={mcpDocuments}
              onSendMessage={addChatMessage}
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
              <p className="font-terminal text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Complete your onboarding first.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

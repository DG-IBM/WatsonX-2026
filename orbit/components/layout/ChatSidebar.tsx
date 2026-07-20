'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useOrbitStore } from '@/store/orbitStore';
import ChatInterface from '@/components/ui/ChatInterface';

export default function ChatSidebar() {
  const {
    isChatOpen,
    setChatOpen,
    chatMessages,
    userProfile,
    planets,
    mcpDocuments,
    mcpConnection,
    addChatMessage,
  } = useOrbitStore();

  const completedPlanets = planets.filter((p) => p.status === 'completed');

  if (!userProfile) return null;

  return (
    <AnimatePresence>
      {isChatOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setChatOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(2,4,8,0.4)' }}
          />

          {/* Sidebar panel */}
          <motion.div
            key="sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed right-0 top-0 h-full z-50 flex flex-col glass-panel-bright"
            style={{
              width: 'min(560px, 100vw)',
              borderLeft: '1px solid rgba(0,170,255,0.25)',
              borderRadius: '0 0 0 0',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setChatOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full z-10 transition-all"
              style={{
                background: 'rgba(0,170,255,0.08)',
                border: '1px solid rgba(0,170,255,0.2)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <X size={16} />
            </button>

            <ChatInterface
              messages={chatMessages}
              userProfile={userProfile}
              completedPlanets={completedPlanets}
              documents={mcpDocuments}
              onSendMessage={addChatMessage}
              projectName={
                mcpConnection.url
                  ? (() => {
                      try {
                        return new URL(mcpConnection.url).pathname.split('/').filter(Boolean).pop() ?? 'your project';
                      } catch {
                        return 'your project';
                      }
                    })()
                  : 'your project'
              }
              mode="sidebar"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

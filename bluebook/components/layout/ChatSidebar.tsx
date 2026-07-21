'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useBluebookStore } from '@/store/bluebookStore';
import ChatInterface from '@/components/ui/ChatInterface';

export default function ChatSidebar() {
  const {
    isChatOpen,
    setChatOpen,
    chatMessages,
    userProfile,
    nodes,
    mcpDocuments,
    mcpConnection,
    selectedNodeId,
    addChatMessage,
  } = useBluebookStore();

  const completedNodes = nodes.filter((n) => n.status === 'complete');
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;

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
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />

          {/* Sidebar panel */}
          <motion.div
            key="sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed right-0 top-0 h-full z-50 flex flex-col"
            style={{
              width: 'min(560px, 100vw)',
              background: 'var(--cds-layer-02)',
              borderLeft: '1px solid var(--cds-border-subtle)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setChatOpen(false)}
              className="absolute top-4 right-4 p-2 z-10 transition-all"
              style={{
                background: 'var(--cds-layer-03)',
                border: '1px solid var(--cds-border-subtle)',
                color: 'var(--cds-text-secondary)',
                borderRadius: 4,
              }}
            >
              <X size={16} />
            </button>

            <ChatInterface
              messages={chatMessages}
              userProfile={userProfile}
              completedNodes={completedNodes}
              documents={mcpDocuments}
              selectedNode={selectedNode}
              onSendMessage={addChatMessage}
              mcpUrl={mcpConnection.url}
              mcpToken={mcpConnection.token}
              mcpApiKey={mcpConnection.apiKey}
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

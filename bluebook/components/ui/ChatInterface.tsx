'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import CommanderAvatar from './CommanderAvatar';
import type { ChatMessage, UserProfile, KnowledgeNode, MCPDocument } from '@/types/bluebook';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  userProfile: UserProfile | null;
  completedNodes: KnowledgeNode[];
  documents: MCPDocument[];
  selectedNode?: KnowledgeNode | null;
  onSendMessage: (msg: ChatMessage) => void;
  projectName?: string;
  mode?: 'sidebar' | 'full';
}

const DEFAULT_PROMPTS = [
  'What should I avoid changing here?',
  'Who owns this area of the project?',
  "What's the current sprint focus?",
  'Summarise what I still need to learn',
];

function getNodePrompts(node: KnowledgeNode): string[] {
  return [
    `Can you explain ${node.title} in more detail?`,
    `What should I avoid doing in this area?`,
    `Who should I talk to about ${node.title}?`,
    `What are the biggest risks here?`,
    `Summarise what I need to know before touching this`,
  ];
}

export default function ChatInterface({
  messages,
  userProfile,
  completedNodes,
  documents,
  selectedNode,
  onSendMessage,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const suggestedPrompts = selectedNode ? getNodePrompts(selectedNode) : DEFAULT_PROMPTS;

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !userProfile) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    onSendMessage(userMsg);
    setInput('');
    setIsLoading(true);
    setStreamingText('');

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          chatHistory: messages.slice(-10),
          userProfile,
          completedNodes,
          completedPlanets: completedNodes, // legacy compat
          documents,
          selectedNode: selectedNode ?? null,
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }
      }

      // Extract sources if present
      const sourcesMatch = fullText.match(/SOURCES:\s*(.+)$/m);
      const referencedDocuments = sourcesMatch
        ? sourcesMatch[1].split(',').map((s) => s.trim())
        : [];
      const cleanContent = fullText.replace(/\nSOURCES:.+$/m, '').trim();

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        referencedDocuments,
      };
      onSendMessage(assistantMsg);
    } catch {
      const errMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: 'I lost signal for a moment. Please try again.',
        timestamp: new Date(),
      };
      onSendMessage(errMsg);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mdComponents: Record<string, any> = {
    p: ({ children }: { children?: React.ReactNode }) => <p style={{ marginBottom: '0.5em', lineHeight: 1.6 }}>{children}</p>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ color: 'var(--color-orbit-blue)', fontWeight: 700 }}>{children}</strong>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul style={{ paddingLeft: '1.2em', marginBottom: '0.5em', listStyleType: 'disc' }}>{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol style={{ paddingLeft: '1.2em', marginBottom: '0.5em', listStyleType: 'decimal' }}>{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li style={{ marginBottom: '0.25em', lineHeight: 1.5 }}>{children}</li>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={{ fontSize: '1em', fontWeight: 700, marginBottom: '0.4em' }}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={{ fontSize: '0.95em', fontWeight: 700, marginBottom: '0.4em' }}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: '0.3em', color: 'var(--color-text-secondary)' }}>{children}</h3>,
    code: ({ children }: { children?: React.ReactNode }) => <code style={{ background: 'rgba(0,170,255,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: '0.85em', fontFamily: 'monospace' }}>{children}</code>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(0,170,255,0.15)', margin: '0.6em 0' }} />,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,170,255,0.15)' }}
      >
        <CommanderAvatar size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-terminal text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
            MISSION CONTROL
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {selectedNode ? (
              <span style={{ color: 'var(--color-orbit-blue)' }}>
                Viewing: {selectedNode.title}
              </span>
            ) : (
              'Your project guide'
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: 'var(--color-signal)' }} />
          <span className="font-terminal text-xs" style={{ color: 'var(--color-signal)' }}>
            CONNECTED
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 mt-1">
                <CommanderAvatar size="sm" />
              </div>
            )}
            <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className="px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'var(--color-orbit-blue)' : 'var(--color-nebula)',
                  border: msg.role === 'assistant' ? '1px solid rgba(0,170,255,0.15)' : 'none',
                  color: 'var(--color-text-primary)',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                }}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.referencedDocuments && msg.referencedDocuments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {msg.referencedDocuments.map((doc) => (
                    <span
                      key={doc}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.2)', color: 'var(--color-text-secondary)' }}
                    >
                      <FileText size={10} />
                      {doc}
                    </span>
                  ))}
                </div>
              )}
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Streaming */}
        {isLoading && streamingText && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 mt-1"><CommanderAvatar size="sm" /></div>
            <div
              className="px-4 py-3 text-sm max-w-[85%] leading-relaxed"
              style={{ background: 'var(--color-nebula)', border: '1px solid rgba(0,170,255,0.15)', color: 'var(--color-text-primary)', borderRadius: '18px 18px 18px 4px' }}
            >
              <ReactMarkdown components={mdComponents}>{streamingText}</ReactMarkdown>
              <span className="typewriter-cursor" />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && !streamingText && (
          <div className="flex gap-2 items-center">
            <CommanderAvatar size="sm" />
            <div className="flex gap-1 px-4 py-3 rounded-2xl" style={{ background: 'var(--color-nebula)', border: '1px solid rgba(0,170,255,0.15)' }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-orbit-blue)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {input.length === 0 && messages.length < 3 && (
        <div className="px-4 pb-2 flex flex-col gap-1.5">
          {selectedNode && (
            <p className="font-terminal text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginBottom: 2 }}>
              ASK ABOUT: {selectedNode.title.toUpperCase()}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full transition-all text-left"
                style={{ background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.2)', color: 'var(--color-text-secondary)' }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div
        className="flex gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(0,170,255,0.15)' }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Mission Control anything..."
          rows={1}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm resize-none outline-none"
          style={{
            background: 'var(--color-panel)',
            border: '1px solid rgba(0,170,255,0.2)',
            color: 'var(--color-text-primary)',
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all self-end"
          style={{
            background: input.trim() && !isLoading ? 'var(--color-orbit-blue)' : 'rgba(0,170,255,0.2)',
            color: input.trim() && !isLoading ? 'white' : 'rgba(0,170,255,0.4)',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

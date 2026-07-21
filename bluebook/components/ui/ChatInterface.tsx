'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import CommanderAvatar from './CommanderAvatar';
import type { ChatMessage, UserProfile, KnowledgeNode, MCPDocument } from '@/types/bluebook';
import { useEffect } from 'react';

/** Extract context_id from a Context Studio JWT (client-side, no verification needed) */
function extractContextId(apiKey: string): string {
  try {
    const payload = apiKey.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.contextId ?? decoded.context_id ?? '';
  } catch {
    return '';
  }
}

/** Query Context Studio directly from the browser — avoids server-side network issues */
async function clientQueryContextBroker(
  question: string,
  url: string,
  token: string,
  apiKey: string,
): Promise<string> {
  if (!url || !token || !apiKey) return '';
  const contextId = extractContextId(apiKey);
  if (!contextId) return '';

  const rawToken = token.replace(/^Bearer\s+/i, '');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${rawToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'context-broker-hybrid-query',
          arguments: {
            context_id: contextId,
            AgentPersona: 'OnboardingAssistant',
            query: question,
            sources: ['vector'],
            vector_params: { top_k: 8 },
            'x-api-key': apiKey,
          },
        },
      }),
    });

    if (!res.ok) return '';

    const contentType = res.headers.get('content-type') ?? '';
    let result: unknown;

    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
      if (!lines.length) return '';
      result = JSON.parse(lines[lines.length - 1].slice('data: '.length));
    } else {
      result = await res.json();
    }

    const content = (result as { result?: { content?: Array<{ text?: string }> } })?.result?.content;
    if (!Array.isArray(content)) return '';
    const rawText = content.map((c: { text?: string }) => c.text ?? '').join('\n');

    // Parse inner JSON payload
    const inner = JSON.parse(rawText) as {
      items?: { vector?: Array<{ content?: string; metadata?: { title?: string } }> };
    };
    return (inner.items?.vector ?? [])
      .map(item => item.metadata?.title ? `[${item.metadata.title}]\n${item.content ?? ''}` : (item.content ?? ''))
      .filter(Boolean)
      .join('\n\n---\n\n');
  } catch {
    return '';
  }
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  userProfile: UserProfile | null;
  completedNodes: KnowledgeNode[];
  documents: MCPDocument[];
  selectedNode?: KnowledgeNode | null;
  onSendMessage: (msg: ChatMessage) => void;
  projectName?: string;
  mode?: 'sidebar' | 'full';
  mcpUrl?: string;
  mcpToken?: string;
  mcpApiKey?: string;
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
  mcpUrl,
  mcpToken,
  mcpApiKey,
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
      // Query Context Studio from the browser (avoids server-side network restrictions)
      const liveKnowledge = await clientQueryContextBroker(text, mcpUrl ?? '', mcpToken ?? '', mcpApiKey ?? '');

      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          chatHistory: messages.slice(-10),
          userProfile,
          completedNodes,
          completedPlanets: completedNodes,
          documents,
          selectedNode: selectedNode ?? null,
          liveKnowledge,
          // still send credentials so server can retry if needed
          mcpUrl:    mcpUrl    ?? '',
          mcpToken:  mcpToken  ?? '',
          mcpApiKey: mcpApiKey ?? '',
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
        content: 'Connection interrupted. Please try again.',
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mdComponents: Record<string, any> = {
    p:      ({ children }: { children?: React.ReactNode }) => <p style={{ marginBottom: '0.5em', lineHeight: 1.6 }}>{children}</p>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ color: 'var(--ibm-blue-40)', fontWeight: 700 }}>{children}</strong>,
    ul:     ({ children }: { children?: React.ReactNode }) => <ul style={{ paddingLeft: '1.2em', marginBottom: '0.5em', listStyleType: 'disc' }}>{children}</ul>,
    ol:     ({ children }: { children?: React.ReactNode }) => <ol style={{ paddingLeft: '1.2em', marginBottom: '0.5em', listStyleType: 'decimal' }}>{children}</ol>,
    li:     ({ children }: { children?: React.ReactNode }) => <li style={{ marginBottom: '0.25em', lineHeight: 1.5 }}>{children}</li>,
    h1:     ({ children }: { children?: React.ReactNode }) => <h1 style={{ fontSize: '1em', fontWeight: 700, marginBottom: '0.4em' }}>{children}</h1>,
    h2:     ({ children }: { children?: React.ReactNode }) => <h2 style={{ fontSize: '0.95em', fontWeight: 700, marginBottom: '0.4em' }}>{children}</h2>,
    h3:     ({ children }: { children?: React.ReactNode }) => <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: '0.3em', color: 'var(--cds-text-secondary)' }}>{children}</h3>,
    code:   ({ children }: { children?: React.ReactNode }) => <code style={{ background: 'var(--cds-support-info-bg)', padding: '1px 5px', borderRadius: 2, fontSize: '0.85em', fontFamily: 'IBM Plex Mono, monospace' }}>{children}</code>,
    hr:     () => <hr style={{ border: 'none', borderTop: '1px solid var(--cds-border-subtle)', margin: '0.6em 0' }} />,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--cds-border-subtle)' }}
      >
        <CommanderAvatar size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-terminal text-sm font-bold" style={{ color: 'var(--cds-text-primary)' }}>
            KNOWLEDGE ASSISTANT
          </div>
          <div className="text-xs" style={{ color: 'var(--cds-text-secondary)' }}>
            {selectedNode ? (
              <span style={{ color: 'var(--ibm-blue-40)' }}>
                Viewing: {selectedNode.title}
              </span>
            ) : (
              'Your project guide'
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 animate-pulse-glow" style={{ background: 'var(--cds-support-success)', borderRadius: 1 }} />
          <span className="font-terminal text-xs" style={{ color: 'var(--cds-support-success)' }}>
            ACTIVE
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
                  background: msg.role === 'user' ? 'var(--ibm-blue-60)' : 'var(--cds-layer-03)',
                  border: msg.role === 'assistant' ? '1px solid var(--cds-border-subtle)' : 'none',
                  color: 'var(--cds-text-primary)',
                  borderRadius: 4,
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
                      className="flex items-center gap-1 px-2 py-0.5 text-xs"
                      style={{
                        background: 'var(--cds-support-info-bg)',
                        border: '1px solid rgba(69,137,255,0.25)',
                        color: 'var(--cds-text-secondary)',
                        borderRadius: 2,
                      }}
                    >
                      <FileText size={10} />
                      {doc}
                    </span>
                  ))}
                </div>
              )}
              <span className="text-xs" style={{ color: 'var(--cds-text-placeholder)' }}>
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
              style={{
                background: 'var(--cds-layer-03)',
                border: '1px solid var(--cds-border-subtle)',
                color: 'var(--cds-text-primary)',
                borderRadius: 4,
              }}
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
            <div
              className="flex gap-1 px-4 py-3"
              style={{
                background: 'var(--cds-layer-03)',
                border: '1px solid var(--cds-border-subtle)',
                borderRadius: 4,
              }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2"
                  style={{ background: 'var(--ibm-blue-40)' }}
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
            <p className="font-terminal text-xs" style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px', marginBottom: 2 }}>
              ASK ABOUT: {selectedNode.title.toUpperCase()}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 transition-all text-left"
                style={{
                  background: 'var(--cds-support-info-bg)',
                  border: '1px solid rgba(69,137,255,0.2)',
                  color: 'var(--cds-text-secondary)',
                  borderRadius: 2,
                }}
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
        style={{ borderTop: '1px solid var(--cds-border-subtle)' }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your knowledge assistant anything..."
          rows={1}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 text-sm resize-none outline-none"
          style={{
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle)',
            color: 'var(--cds-text-primary)',
            fontFamily: "'IBM Plex Sans', sans-serif",
            lineHeight: 1.5,
            borderRadius: 4,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center transition-all self-end"
          style={{
            background: input.trim() && !isLoading ? 'var(--ibm-blue-60)' : 'var(--cds-layer-03)',
            color: input.trim() && !isLoading ? 'white' : 'var(--cds-text-placeholder)',
            borderRadius: 4,
            border: input.trim() && !isLoading
              ? '1px solid var(--cds-border-interactive)'
              : '1px solid var(--cds-border-subtle)',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

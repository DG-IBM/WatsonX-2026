'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, Wifi, Database, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useBluebookStore } from '@/store/bluebookStore';
import ParticleBackground from '@/components/ui/ParticleBackground';
import type { MCPSource } from '@/types/bluebook';

export default function ConnectScreen() {
  const router = useRouter();
  const { mcpConnection, setMCPConnection, setCurrentScreen } = useBluebookStore();
  const [url, setUrl] = useState(mcpConnection.url);
  const [token, setToken] = useState(mcpConnection.token);
  const [apiKey, setApiKey] = useState(mcpConnection.apiKey ?? '');
  const [showToken, setShowToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const [tokenFocused, setTokenFocused] = useState(false);
  const [apiKeyFocused, setApiKeyFocused] = useState(false);

  const status = mcpConnection.status;
  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';
  const isFailed = status === 'failed';
  const canConnect = url.trim().length > 0 && token.trim().length > 0 && !isConnecting && !isConnected;

  const handleConnect = async () => {
    if (!canConnect) return;
    const rawToken = token.trim().replace(/^Bearer\s+/i, '');
    const rawApiKey = apiKey.trim();
    setMCPConnection({ url: url.trim(), token: rawToken, apiKey: rawApiKey, status: 'connecting' });
    try {
      const res = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), token: rawToken, apiKey: rawApiKey }),
      });
      const data = await res.json();
      if (data.success) {
        setMCPConnection({ status: 'connected', sources: data.sources ?? [], documentCount: data.totalDocuments ?? 0 });
      } else {
        setMCPConnection({ status: 'failed' });
      }
    } catch {
      setMCPConnection({ status: 'failed' });
    }
  };

  const handleLaunch = () => {
    setCurrentScreen('role');
    router.push('/role');
  };

  const handleRetry = () => {
    setMCPConnection({ status: 'idle' });
  };

  const inputStyle = (focused: boolean) => ({
    borderRadius: 4,
    border: focused
      ? '2px solid var(--cds-border-interactive)'
      : '1px solid var(--cds-border-subtle)',
    transition: 'border-color 0.15s',
    background: 'var(--cds-layer-01)',
  });

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--cds-background)' }}
    >
      <ParticleBackground />

      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--cds-border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--cds-border-subtle) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.2,
          zIndex: 1,
        }}
      />

      {/* Main content */}
      <div className="relative w-full max-w-lg px-5" style={{ zIndex: 10 }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          {/* IBM Logo mark */}
          <div className="flex justify-center mb-6">
            <div
              style={{
                width: 72,
                height: 72,
                background: 'var(--ibm-blue-60)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
              }}
            >
              {/* IBM 8-bar logo simplified */}
              <svg width="44" height="20" viewBox="0 0 44 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0"  y="0"  width="44" height="3" rx="1" fill="white" />
                <rect x="0"  y="5"  width="44" height="3" rx="1" fill="white" />
                <rect x="6"  y="10" width="32" height="3" rx="1" fill="white" />
                <rect x="6"  y="15" width="32" height="3" rx="1" fill="white" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span
              className="font-terminal text-xs tracking-widest"
              style={{ color: 'var(--cds-text-placeholder)', fontSize: '10px', letterSpacing: '0.25em' }}
            >
              IBM
            </span>
            <h1
              className="font-bold tracking-widest"
              style={{ fontSize: 42, letterSpacing: '0.12em', lineHeight: 1, color: 'var(--ibm-blue-40)' }}
            >
              BLUEBOOK
            </h1>
          </div>
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: 14, marginTop: 8 }}>
            Knowledge Verification System
          </p>
        </motion.div>

        {/* ── Panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel-bright"
          style={{
            padding: '28px 32px 32px',
            border: isConnected
              ? '1px solid rgba(66,190,101,0.4)'
              : isFailed
              ? '1px solid rgba(250,77,86,0.3)'
              : '1px solid var(--cds-border-subtle)',
            transition: 'border-color 0.3s',
          }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-3 mb-6">
            <span
              className="font-terminal"
              style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--cds-text-placeholder)' }}
            >
              IBM BLUEBOOK — CONNECT
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--cds-border-subtle)' }} />
          </div>

          <div className="flex flex-col gap-5">
            {/* URL Input */}
            <div className="flex flex-col gap-2">
              <label
                className="font-terminal"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--cds-text-secondary)' }}
              >
                MCP SERVER ENDPOINT
              </label>
              <div className="relative" style={inputStyle(urlFocused)}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--cds-icon-secondary)' }}>
                  <Wifi size={14} />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  placeholder="https://context-studio.ibm.com/mcp/your-team-id"
                  disabled={isConnected}
                  className="w-full font-terminal bg-transparent outline-none"
                  style={{
                    padding: '12px 14px 12px 38px',
                    fontSize: 12,
                    color: 'var(--cds-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Token Input */}
            <div className="flex flex-col gap-2">
              <label
                className="font-terminal"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--cds-text-secondary)' }}
              >
                AUTHENTICATION TOKEN
              </label>
              <div className="relative" style={inputStyle(tokenFocused)}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--cds-icon-secondary)' }}>
                  <Database size={14} />
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onFocus={() => setTokenFocused(true)}
                  onBlur={() => setTokenFocused(false)}
                  placeholder="Bearer xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={isConnected}
                  className="w-full font-terminal bg-transparent outline-none pr-12"
                  style={{
                    padding: '12px 44px 12px 38px',
                    fontSize: 12,
                    color: 'var(--cds-text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity"
                  style={{ color: 'var(--cds-icon-secondary)', opacity: 0.7 }}
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Context Studio API Key */}
            <div className="flex flex-col gap-2">
              <label
                className="font-terminal"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--cds-text-secondary)' }}
              >
                CONTEXT STUDIO API KEY
                <span style={{ color: 'var(--cds-text-placeholder)', fontWeight: 400, marginLeft: 6 }}>(optional — enables live knowledge search)</span>
              </label>
              <div className="relative" style={inputStyle(apiKeyFocused)}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--cds-icon-secondary)' }}>
                  <Database size={14} />
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onFocus={() => setApiKeyFocused(true)}
                  onBlur={() => setApiKeyFocused(false)}
                  placeholder="eyJ... (Context Studio API key)"
                  disabled={isConnected}
                  className="w-full font-terminal bg-transparent outline-none pr-12"
                  style={{
                    padding: '12px 44px 12px 38px',
                    fontSize: 12,
                    color: 'var(--cds-text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity"
                  style={{ color: 'var(--cds-icon-secondary)', opacity: 0.7 }}
                  tabIndex={-1}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Connect button */}
            <AnimatePresence mode="wait">
              {!isConnected && (
                <motion.button
                  key="connect-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleConnect}
                  disabled={!canConnect}
                  className="w-full flex items-center justify-center gap-2.5 font-terminal"
                  style={{
                    padding: '13px 20px',
                    borderRadius: 4,
                    fontSize: 14,
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    cursor: canConnect ? 'pointer' : 'not-allowed',
                    background: canConnect ? 'var(--ibm-blue-60)' : 'var(--cds-layer-03)',
                    border: canConnect
                      ? '1px solid var(--cds-border-interactive)'
                      : '1px solid var(--cds-border-subtle)',
                    color: canConnect ? '#ffffff' : 'var(--cds-text-disabled)',
                    transition: 'all 0.15s',
                  }}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      CONNECTING...
                    </>
                  ) : (
                    <>
                      <Wifi size={14} />
                      CONNECT TO MCP SERVER
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            {/* ── Status feedback ── */}
            <AnimatePresence mode="wait">

              {/* Connecting */}
              {isConnecting && (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5"
                          style={{ background: 'var(--ibm-blue-40)', borderRadius: 1 }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                        />
                      ))}
                    </div>
                    <span className="font-terminal" style={{ fontSize: 11, color: 'var(--ibm-blue-40)' }}>
                      Establishing secure connection...
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Connected */}
              {isConnected && (
                <motion.div
                  key="connected"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-4"
                >
                  {/* Success badge */}
                  <div
                    className="flex items-center gap-2.5 py-2 px-3"
                    style={{
                      background: 'var(--cds-support-success-bg)',
                      border: '1px solid rgba(66,190,101,0.3)',
                      borderRadius: 4,
                    }}
                  >
                    <CheckCircle size={16} style={{ color: 'var(--cds-support-success)', flexShrink: 0 }} />
                    <span className="font-terminal" style={{ fontSize: 11, color: 'var(--cds-support-success)', letterSpacing: '0.1em' }}>
                      CONNECTION ESTABLISHED
                    </span>
                  </div>

                  {/* Sources grid */}
                  {mcpConnection.sources.length > 0 && (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(mcpConnection.sources.length, 3)}, 1fr)` }}>
                      {mcpConnection.sources.map((src: MCPSource) => (
                        <div
                          key={src.name}
                          className="flex flex-col items-center gap-1 py-3 px-2"
                          style={{
                            background: 'var(--cds-support-success-bg)',
                            border: '1px solid rgba(66,190,101,0.2)',
                            borderRadius: 4,
                          }}
                        >
                          <Database size={13} style={{ color: 'var(--cds-support-success)', opacity: 0.8 }} />
                          <span className="font-terminal" style={{ fontSize: 10, color: 'var(--cds-text-primary)', letterSpacing: '0.08em' }}>{src.name}</span>
                          <span className="font-terminal" style={{ fontSize: 9, color: 'var(--cds-text-placeholder)' }}>{src.count} docs</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p
                    className="font-terminal text-center"
                    style={{ fontSize: 10, color: 'var(--cds-text-placeholder)', letterSpacing: '0.08em' }}
                  >
                    {mcpConnection.documentCount} document{mcpConnection.documentCount !== 1 ? 's' : ''} indexed and ready
                  </p>

                  {/* Launch button */}
                  <motion.button
                    onClick={handleLaunch}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-2.5 font-terminal"
                    style={{
                      padding: '13px 20px',
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      background: 'var(--ibm-blue-60)',
                      border: '1px solid var(--cds-border-interactive)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    BEGIN VERIFICATION
                    <ArrowRight size={14} />
                  </motion.button>
                </motion.div>
              )}

              {/* Failed */}
              {isFailed && (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3"
                >
                  <div
                    className="flex items-center gap-2.5 py-2 px-3"
                    style={{
                      background: 'var(--cds-support-error-bg)',
                      border: '1px solid rgba(250,77,86,0.3)',
                      borderRadius: 4,
                    }}
                  >
                    <XCircle size={16} style={{ color: 'var(--cds-support-error)', flexShrink: 0 }} />
                    <span className="font-terminal" style={{ fontSize: 11, color: 'var(--cds-support-error)', letterSpacing: '0.1em' }}>
                      CONNECTION FAILED
                    </span>
                  </div>
                  <p className="font-terminal" style={{ fontSize: 11, color: 'var(--cds-text-secondary)', lineHeight: 1.6 }}>
                    Could not reach the MCP server. Check the URL and token, then retry.
                  </p>
                  <button
                    onClick={handleRetry}
                    className="w-full font-terminal py-2.5 transition-all"
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.1em',
                      borderRadius: 4,
                      border: '1px solid var(--cds-support-error)',
                      color: 'var(--cds-support-error)',
                      background: 'var(--cds-support-error-bg)',
                    }}
                  >
                    RETRY CONNECTION
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Skip link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center mt-5"
          style={{ fontSize: 12, color: 'var(--cds-text-placeholder)' }}
        >
          No MCP server?{' '}
          <button
            onClick={handleLaunch}
            className="underline transition-colors"
            style={{ color: 'var(--cds-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            Continue without one →
          </button>
        </motion.p>
      </div>
    </div>
  );
}

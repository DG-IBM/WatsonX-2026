'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, Wifi, Database, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useOrbitStore } from '@/store/orbitStore';
import ParticleBackground from '@/components/ui/ParticleBackground';
import type { MCPSource } from '@/types/orbit';

export default function ConnectScreen() {
  const router = useRouter();
  const { mcpConnection, setMCPConnection, setCurrentScreen } = useOrbitStore();
  const [url, setUrl] = useState(mcpConnection.url);
  const [token, setToken] = useState(mcpConnection.token);
  const [showToken, setShowToken] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const [tokenFocused, setTokenFocused] = useState(false);

  const status = mcpConnection.status;
  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';
  const isFailed = status === 'failed';
  const canConnect = url.trim().length > 0 && token.trim().length > 0 && !isConnecting && !isConnected;

  const handleConnect = async () => {
    if (!canConnect) return;
    setMCPConnection({ url: url.trim(), token: token.trim(), status: 'connecting' });
    try {
      // Context Studio needs both Bearer token (Authorization) and x-api-key
      // The user pastes the MCP Gateway Token into the token field —
      // the Context Studio Key is embedded in the token JWT itself (same value used as apiKey)
      const rawToken = token.trim().replace(/^Bearer\s+/i, '');
      const res = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), token: rawToken, apiKey: rawToken }),
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

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-void)' }}>

      {/* Stars background */}
      <ParticleBackground />

      {/* Deep radial glow behind panel */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
        <div style={{
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,100,200,0.06) 0%, transparent 70%)',
        }} />
      </div>

      {/* ORBIT watermark */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
        <span style={{ fontSize: '22vw', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(0,170,255,0.018)', userSelect: 'none', fontFamily: "'Space Grotesk', sans-serif" }}>
          ORBIT
        </span>
      </div>

      {/* Main content */}
      <div className="relative w-full max-w-lg px-5" style={{ zIndex: 10 }}>

        {/* ── Logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,100,200,0.3), rgba(0,170,255,0.15))',
                border: '1px solid rgba(0,170,255,0.35)',
                boxShadow: '0 0 32px rgba(0,170,255,0.2), inset 0 0 32px rgba(0,170,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  {/* orbit rings */}
                  <ellipse cx="17" cy="17" rx="16" ry="6" stroke="#00aaff" strokeWidth="1.2" strokeOpacity="0.6"/>
                  <ellipse cx="17" cy="17" rx="10" ry="16" stroke="#00ff88" strokeWidth="1.2" strokeOpacity="0.4" transform="rotate(60 17 17)"/>
                  {/* center dot */}
                  <circle cx="17" cy="17" r="3" fill="#ffd700" />
                  {/* planet dot */}
                  <circle cx="33" cy="17" r="2.5" fill="#00aaff" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full animate-pulse-glow"
                style={{ background: 'var(--color-signal)', boxShadow: '0 0 8px var(--color-signal)' }} />
            </div>
          </div>

          <h1 className="text-gradient-orbit font-bold tracking-widest mb-2"
            style={{ fontSize: 52, letterSpacing: '0.18em', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>
            ORBIT
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, letterSpacing: '0.04em' }}>
            AI-Powered Project Onboarding
          </p>
          <div className="flex justify-center mt-2 gap-1">
            <span style={{ display: 'inline-block', width: 2, height: 2, borderRadius: '50%', background: 'var(--color-text-muted)' }} />
            <span style={{ display: 'inline-block', width: 2, height: 2, borderRadius: '50%', background: 'var(--color-text-muted)' }} />
            <span style={{ display: 'inline-block', width: 2, height: 2, borderRadius: '50%', background: 'var(--color-text-muted)' }} />
          </div>
        </motion.div>

        {/* ── Panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel-bright"
          style={{
            padding: '28px 32px 32px',
            border: isConnected
              ? '1px solid rgba(0,255,136,0.35)'
              : isFailed
              ? '1px solid rgba(255,68,68,0.25)'
              : '1px solid rgba(0,170,255,0.28)',
            boxShadow: isConnected
              ? '0 0 40px rgba(0,255,136,0.08), 0 24px 48px rgba(0,0,0,0.5)'
              : '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,170,255,0.04)',
            transition: 'border-color 0.4s, box-shadow 0.4s',
          }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f56' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#27c93f' }} />
            </div>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,170,255,0.1)' }} />
            <span className="font-terminal" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-text-muted)' }}>
              MISSION CONTROL
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,170,255,0.1)' }} />
          </div>

          <div className="flex flex-col gap-5">
            {/* URL Input */}
            <div className="flex flex-col gap-2">
              <label className="font-terminal" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--color-text-terminal)' }}>
                MCP SERVER ENDPOINT
              </label>
              <div className="relative" style={{
                borderRadius: 10,
                border: urlFocused ? '1px solid rgba(0,170,255,0.6)' : '1px solid rgba(0,170,255,0.18)',
                boxShadow: urlFocused ? '0 0 0 3px rgba(0,170,255,0.08)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                background: 'rgba(6,13,26,0.8)',
              }}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,170,255,0.4)' }}>
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
                    color: 'var(--color-text-terminal)',
                    letterSpacing: '0.02em',
                  }}
                />
              </div>
            </div>

            {/* Token Input */}
            <div className="flex flex-col gap-2">
              <label className="font-terminal" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--color-text-terminal)' }}>
                AUTHENTICATION TOKEN
              </label>
              <div className="relative" style={{
                borderRadius: 10,
                border: tokenFocused ? '1px solid rgba(0,170,255,0.6)' : '1px solid rgba(0,170,255,0.18)',
                boxShadow: tokenFocused ? '0 0 0 3px rgba(0,170,255,0.08)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                background: 'rgba(6,13,26,0.8)',
              }}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,170,255,0.4)' }}>
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
                    color: 'var(--color-text-terminal)',
                    letterSpacing: '0.02em',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity"
                  style={{ color: 'rgba(0,170,255,0.45)', opacity: 0.7 }}
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
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
                  whileHover={canConnect ? { scale: 1.015 } : {}}
                  whileTap={canConnect ? { scale: 0.985 } : {}}
                  className="w-full flex items-center justify-center gap-2.5 font-terminal relative overflow-hidden"
                  style={{
                    padding: '13px 20px',
                    borderRadius: 10,
                    fontSize: 12,
                    letterSpacing: '0.14em',
                    fontWeight: 700,
                    cursor: canConnect ? 'pointer' : 'not-allowed',
                    background: canConnect
                      ? 'linear-gradient(135deg, #0077cc 0%, #004d99 100%)'
                      : 'rgba(0,100,180,0.1)',
                    border: canConnect
                      ? '1px solid rgba(0,150,255,0.4)'
                      : '1px solid rgba(0,100,180,0.15)',
                    color: canConnect ? '#ffffff' : 'rgba(255,255,255,0.2)',
                    boxShadow: canConnect ? '0 4px 20px rgba(0,100,200,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      ESTABLISHING LINK...
                    </>
                  ) : (
                    <>
                      <Wifi size={14} />
                      INITIATE CONNECTION
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
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: 'var(--color-orbit-blue)' }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                        />
                      ))}
                    </div>
                    <span className="font-terminal" style={{ fontSize: 11, color: 'var(--color-orbit-blue)' }}>
                      Establishing secure link...
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
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                    style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.18)' }}>
                    <CheckCircle size={16} style={{ color: 'var(--color-signal)', flexShrink: 0 }} />
                    <span className="font-terminal" style={{ fontSize: 11, color: 'var(--color-signal)', letterSpacing: '0.14em' }}>
                      CONNECTION ESTABLISHED
                    </span>
                  </div>

                  {/* Sources grid */}
                  {mcpConnection.sources.length > 0 && (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(mcpConnection.sources.length, 3)}, 1fr)` }}>
                      {mcpConnection.sources.map((src: MCPSource) => (
                        <div key={src.name} className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl"
                          style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.12)' }}>
                          <Database size={13} style={{ color: 'var(--color-signal)', opacity: 0.7 }} />
                          <span className="font-terminal" style={{ fontSize: 10, color: 'var(--color-text-primary)', letterSpacing: '0.1em' }}>{src.name}</span>
                          <span className="font-terminal" style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{src.count} docs</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="font-terminal text-center"
                    style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>
                    {mcpConnection.documentCount} document{mcpConnection.documentCount !== 1 ? 's' : ''} indexed and ready
                  </p>

                  {/* Launch button */}
                  <motion.button
                    onClick={handleLaunch}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2.5 font-terminal"
                    style={{
                      padding: '13px 20px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      background: 'linear-gradient(135deg, #00cc66 0%, #007744 100%)',
                      border: '1px solid rgba(0,255,136,0.4)',
                      color: '#fff',
                      boxShadow: '0 4px 20px rgba(0,200,100,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                    }}
                  >
                    LAUNCH MISSION
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
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                    style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)' }}>
                    <XCircle size={16} style={{ color: 'var(--color-alert)', flexShrink: 0 }} />
                    <span className="font-terminal" style={{ fontSize: 11, color: 'var(--color-alert)', letterSpacing: '0.12em' }}>
                      CONNECTION FAILED
                    </span>
                  </div>
                  <p className="font-terminal" style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Could not reach the MCP server. Check the URL and token, then retry.
                  </p>
                  <button
                    onClick={handleRetry}
                    className="w-full font-terminal py-2.5 rounded-lg transition-all"
                    style={{
                      fontSize: 11, letterSpacing: '0.12em',
                      border: '1px solid rgba(255,68,68,0.3)',
                      color: 'var(--color-alert)',
                      background: 'rgba(255,68,68,0.05)',
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
          transition={{ delay: 0.8 }}
          className="text-center mt-5"
          style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
        >
          No MCP server?{' '}
          <button
            onClick={handleLaunch}
            className="underline transition-colors"
            style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            Continue without one →
          </button>
        </motion.p>
      </div>
    </div>
  );
}

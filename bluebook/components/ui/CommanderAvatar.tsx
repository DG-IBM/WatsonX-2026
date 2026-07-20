'use client';

export default function CommanderAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 32 : size === 'md' ? 56 : 80;

  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0"
      style={{
        width: dims,
        height: dims,
        border: '2px solid var(--color-orbit-blue)',
        boxShadow: '0 0 12px rgba(0,170,255,0.3)',
      }}
    >
      <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        {/* Background */}
        <circle cx="40" cy="40" r="40" fill="#060d1a" />
        {/* Suit torso */}
        <ellipse cx="40" cy="62" rx="18" ry="16" fill="#1a3a5c" />
        {/* Helmet outer */}
        <circle cx="40" cy="34" r="18" fill="#1e4d70" />
        {/* Visor */}
        <ellipse cx="40" cy="33" rx="12" ry="10" fill="#004466" opacity="0.9" />
        <ellipse cx="40" cy="33" rx="12" ry="10" fill="url(#visor-grad)" />
        {/* Visor reflection */}
        <ellipse cx="37" cy="29" rx="4" ry="3" fill="rgba(0,170,255,0.3)" />
        {/* Suit chest patch */}
        <rect x="34" y="56" width="12" height="8" rx="2" fill="#00aaff" opacity="0.4" />
        {/* Name badge */}
        <rect x="27" y="56" width="8" height="3" rx="1" fill="#00ff88" opacity="0.6" />
        {/* Shoulder accents */}
        <rect x="23" y="50" width="6" height="10" rx="3" fill="#1a3a5c" stroke="#00aaff" strokeWidth="0.5" />
        <rect x="51" y="50" width="6" height="10" rx="3" fill="#1a3a5c" stroke="#00aaff" strokeWidth="0.5" />
        {/* Antenna */}
        <line x1="52" y1="18" x2="56" y2="10" stroke="#00aaff" strokeWidth="1.5" opacity="0.8" />
        <circle cx="56" cy="9" r="2" fill="#00ff88" />
        <defs>
          <radialGradient id="visor-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#00aaff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#001133" stopOpacity="0.8" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

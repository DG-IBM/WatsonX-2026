'use client';

export default function CommanderAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 32 : size === 'md' ? 56 : 80;

  return (
    <div
      className="rounded flex-shrink-0 flex items-center justify-center"
      style={{
        width: dims,
        height: dims,
        background: 'var(--ibm-blue-60)',
        border: '1px solid var(--cds-border-interactive)',
      }}
    >
      {/* IBM-style simplified person icon */}
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        width={dims * 0.65}
        height={dims * 0.65}
        fill="#ffffff"
      >
        {/* Head */}
        <circle cx="16" cy="9" r="4.5" />
        {/* Shoulders / torso */}
        <path d="M8 28v-3a8 8 0 0116 0v3H8z" />
      </svg>
    </div>
  );
}

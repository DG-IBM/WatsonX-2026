'use client';

import { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface TerminalInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  disabled?: boolean;
}

export default function TerminalInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: TerminalInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1">
      <label
        className="font-terminal text-xs tracking-widest"
        style={{ color: 'var(--cds-text-secondary)', fontSize: '11px' }}
      >
        {label}
      </label>
      <div
        className="relative flex items-center"
        style={{
          background: 'var(--cds-layer-01)',
          border: focused
            ? '2px solid var(--cds-border-interactive)'
            : '1px solid var(--cds-border-subtle)',
          transition: 'border-color 0.15s',
          borderRadius: 4,
        }}
      >
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full px-4 py-3 bg-transparent font-terminal text-sm outline-none"
          style={{
            color: 'var(--cds-text-primary)',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        />
        {focused && value.length === 0 && (
          <span
            className="absolute pointer-events-none animate-blink-cursor"
            style={{
              left: '16px',
              width: '2px',
              height: '16px',
              background: 'var(--ibm-blue-40)',
              opacity: 0.8,
            }}
          />
        )}
        {type === 'password' && (
          <button
            type="button"
            className="absolute right-3 p-1 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--cds-icon-secondary)' }}
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

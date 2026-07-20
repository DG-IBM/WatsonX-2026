import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        terminal: ['Space Mono', 'monospace'],
      },
      colors: {
        void: '#020408',
        'deep-space': '#060d1a',
        nebula: '#0d1f35',
        panel: '#0f2340',
        'orbit-blue': '#00aaff',
        'orbit-glow': '#0066cc',
        'orbit-dim': '#003d7a',
        gold: '#ffd700',
        'gold-dim': '#b8960a',
        alert: '#ff4444',
        'alert-dim': '#8b0000',
        signal: '#00ff88',
        'signal-dim': '#006633',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'orbit-rotate': 'orbit-rotate 20s linear infinite',
        float: 'float 3s ease-in-out infinite',
        'blink-cursor': 'blink-cursor 1s step-end infinite',
        'xp-float': 'xp-float 1.5s ease-out forwards',
        'planet-unlock': 'planet-unlock 1.2s ease-in-out forwards',
        'transmission-flicker': 'transmission-flicker 5s linear infinite',
        typewriter: 'typewriter 2s steps(40) forwards',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'orbit-rotate': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'blink-cursor': {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'var(--color-text-terminal)' },
        },
        'xp-float': {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '30%': { opacity: '1', transform: 'translateY(-20px) scale(1.2)' },
          '70%': { opacity: '1', transform: 'translateY(-40px) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-70px) scale(0.8)' },
        },
        'planet-unlock': {
          '0%': { filter: 'grayscale(100%) brightness(0.3)', transform: 'scale(1)' },
          '50%': { filter: 'grayscale(0%) brightness(1.5)', transform: 'scale(1.2)' },
          '100%': { filter: 'grayscale(0%) brightness(1)', transform: 'scale(1)' },
        },
        'transmission-flicker': {
          '0%, 95%, 100%': { opacity: '1' },
          '96%': { opacity: '0.6' },
          '97%': { opacity: '1' },
          '98%': { opacity: '0.4' },
          '99%': { opacity: '0.9' },
        },
        typewriter: {
          from: { width: '0' },
          to: { width: '100%' },
        },
      },
    },
  },
  plugins: [],
}

export default config

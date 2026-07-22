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
        sans:     ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono:     ['IBM Plex Mono', 'monospace'],
        terminal: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        // IBM Carbon Dark token surface
        'cds-background':        '#161616',
        'cds-layer-01':          '#1c1c1c',
        'cds-layer-02':          '#282828',
        'cds-layer-03':          '#353535',
        // IBM Blue
        'ibm-blue-60':           '#0f62fe',
        'ibm-blue-50':           '#4589ff',
        'ibm-blue-40':           '#78a9ff',
        'ibm-blue-20':           '#d0e2ff',
        // IBM Cyan
        'ibm-cyan-40':           '#33b1ff',
        // IBM Teal
        'ibm-teal-40':           '#08bdba',
        // IBM Purple
        'ibm-purple-40':         '#be95ff',
        // IBM Magenta
        'ibm-magenta-40':        '#ff7eb6',
        // Support
        'cds-success':           '#42be65',
        'cds-warning':           '#f1c21b',
        'cds-error':             '#fa4d56',
        'cds-info':              '#4589ff',
        // Borders
        'cds-border-subtle':     '#393939',
        'cds-border-strong':     '#525252',
        'cds-border-interactive':'#4589ff',
        // Text
        'cds-text-primary':      '#f4f4f4',
        'cds-text-secondary':    '#c6c6c6',
        'cds-text-placeholder':  '#6f6f6f',
        // Legacy aliases — component code may still reference these
        void:                    '#161616',
        'deep-space':            '#1c1c1c',
        nebula:                  '#282828',
        panel:                   '#1c1c1c',
        'orbit-blue':            '#78a9ff',
        'orbit-glow':            '#0f62fe',
        'orbit-dim':             '#4589ff',
        gold:                    '#f1c21b',
        'gold-dim':              '#a98700',
        alert:                   '#fa4d56',
        'alert-dim':             '#750e13',
        signal:                  '#42be65',
        'signal-dim':            '#198038',
      },
      animation: {
        'pulse-glow':              'pulse-glow 2s ease-in-out infinite',
        'orbit-rotate':            'orbit-rotate 20s linear infinite',
        float:                     'float 3s ease-in-out infinite',
        'blink-cursor':            'blink-cursor 1s step-end infinite',
        'xp-float':                'xp-float 1.5s ease-out forwards',
        'planet-unlock':           'planet-unlock 1.2s ease-in-out forwards',
        'transmission-flicker':    'transmission-flicker 5s linear infinite',
        typewriter:                'typewriter 2s steps(40) forwards',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.6' },
        },
        'orbit-rotate': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'blink-cursor': {
          '0%, 100%': { borderColor: 'transparent' },
          '50%':       { borderColor: 'var(--ibm-blue-40)' },
        },
        'xp-float': {
          '0%':   { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '30%':  { opacity: '1', transform: 'translateY(-20px) scale(1.2)' },
          '70%':  { opacity: '1', transform: 'translateY(-40px) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-70px) scale(0.8)' },
        },
        'planet-unlock': {
          '0%':   { filter: 'grayscale(100%) brightness(0.3)', transform: 'scale(1)' },
          '50%':  { filter: 'grayscale(0%) brightness(1.5)',   transform: 'scale(1.2)' },
          '100%': { filter: 'grayscale(0%) brightness(1)',     transform: 'scale(1)' },
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
          to:   { width: '100%' },
        },
      },
    },
  },
  plugins: [],
}

export default config

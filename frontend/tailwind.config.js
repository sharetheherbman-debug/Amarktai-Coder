/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Editor-grade dark palette
        ink: {
          950: '#08090d',
          900: '#0b0d12',
          850: '#10131a',
          800: '#151924',
          750: '#1a1f2c',
          700: '#222837',
          600: '#2e3547',
          500: '#3b4358',
        },
        line: '#1f2433',
        muted: '#7a8296',
        accent: {
          // sharp lime accent for terminal feel
          DEFAULT: '#c6f24e',
          dim: '#9ec635',
          glow: '#dcff7a',
        },
        danger: '#ff6b6b',
        warn: '#f6c34e',
        ok: '#5bd896',
        info: '#7aa8ff',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(198,242,78,0.22), 0 8px 32px -8px rgba(198,242,78,0.18)',
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0A0A0F',
        surface:  '#13131A',
        surface2: '#1A1A26',
        accent:   '#6366F1',
        'accent-glow': '#818CF8',
        success:  '#10B981',
        subtext:  '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0' },
        },
        'pulse-dot': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.5)' },
          '50%':       { boxShadow: '0 0 0 5px rgba(16,185,129,0)' },
        },
        'msg-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'typing': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%':            { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'msg-in':    'msg-in 0.2s ease-out forwards',
        'typing-1':  'typing 1.2s 0s infinite',
        'typing-2':  'typing 1.2s 0.2s infinite',
        'typing-3':  'typing 1.2s 0.4s infinite',
        'blink':     'blink 1s step-start infinite',
      },
    },
  },
  plugins: [],
};

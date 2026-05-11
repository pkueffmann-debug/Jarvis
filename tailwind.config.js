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
        cyan:     '#06B6D4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'spin-slow-reverse': {
          from: { transform: 'rotate(360deg)' },
          to:   { transform: 'rotate(0deg)' },
        },
        'hud-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px 4px rgba(99,102,241,0.35), 0 0 60px 10px rgba(99,102,241,0.12), inset 0 0 30px rgba(99,102,241,0.08)' },
          '50%':      { boxShadow: '0 0 30px 8px rgba(99,102,241,0.55), 0 0 80px 16px rgba(99,102,241,0.2),  inset 0 0 40px rgba(99,102,241,0.15)' },
        },
        'hud-pulse-cyan': {
          '0%, 100%': { boxShadow: '0 0 14px 3px rgba(6,182,212,0.4), 0 0 40px 8px rgba(6,182,212,0.12)' },
          '50%':      { boxShadow: '0 0 22px 6px rgba(6,182,212,0.6), 0 0 60px 14px rgba(6,182,212,0.22)' },
        },
        'hud-fade-in': {
          from: { opacity: '0', transform: 'scale(0.85)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'chat-slide-up': {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
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
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'typing': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%':            { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
      animation: {
        'spin-slow':         'spin-slow 22s linear infinite',
        'spin-slow-reverse': 'spin-slow-reverse 16s linear infinite',
        'hud-pulse':         'hud-pulse 3s ease-in-out infinite',
        'hud-pulse-cyan':    'hud-pulse-cyan 2.5s ease-in-out infinite',
        'hud-fade-in':       'hud-fade-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'chat-slide-up':     'chat-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'pulse-dot':         'pulse-dot 2s ease-in-out infinite',
        'msg-in':            'msg-in 0.2s ease-out forwards',
        'typing-1':          'typing 1.2s 0s infinite',
        'typing-2':          'typing 1.2s 0.2s infinite',
        'typing-3':          'typing 1.2s 0.4s infinite',
        'blink':             'blink 1s step-start infinite',
        'slide-in-right':    'slide-in-right 0.22s ease-out forwards',
      },
    },
  },
  plugins: [],
};

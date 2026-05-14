import React from 'react';
import HUD from './HUD';

// Compact 420×420 floating window — just the arc-reactor HUD.
// Used when window mode is "hud". Clicking the center "J" expands to chat mode.
export default function HudWindow({ statusMap, voiceState, onExpand, onClose }) {
  return (
    <div style={{
      width: 420, height: 420,
      position: 'relative',
      // Transparent body — the BrowserWindow's transparent flag makes
      // anything outside the circle see straight through to the desktop.
      background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      WebkitAppRegion: 'drag',
    }}>
      {/* X close button — top-right, fades in on hover via CSS */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitAppRegion: 'no-drag',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.4)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
        }}
      >×</button>

      <HUD
        statusMap={statusMap}
        voiceState={voiceState}
        onFocusChat={onExpand}
      />
    </div>
  );
}

import React from 'react';

// JARVIS Electron is a background process. This is the only UI it shows —
// a 300×60 floating black bar with a pulsing cyan dot and the "JARVIS"
// wordmark. The full chat/HUD lives at daylens.dev/brain.
//
// Click "Open →" → open brain in default browser. Drag bar → reposition.

const BRAIN_URL = 'https://daylens.dev/brain';

export default function App() {
  function openBrain() {
    if (window.jarvis?.openExternal) {
      window.jarvis.openExternal(BRAIN_URL);
    } else {
      window.open(BRAIN_URL, '_blank');
    }
  }

  return (
    <>
      <style>{`
        html, body, #root {
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          background: transparent;
          overflow: hidden;
          font-family: -apple-system, 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          user-select: none;
        }
        #jarvis-indicator {
          width: 100%; height: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 18px;
          background: #000;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.55);
          -webkit-app-region: drag;
          cursor: default;
        }
        #jarvis-indicator .dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          background: #22D3EE;
          box-shadow: 0 0 12px rgba(34,211,238,0.85),
                      0 0 28px rgba(34,211,238,0.35);
          animation: jarvis-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes jarvis-pulse {
          0%, 100% { opacity: 1;    transform: scale(1);    }
          50%      { opacity: 0.45; transform: scale(0.78); }
        }
        #jarvis-indicator .label {
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        #jarvis-indicator .label .v { color: #818CF8; }
        #jarvis-indicator .open {
          margin-left: auto;
          color: #52525B;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          -webkit-app-region: no-drag;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        #jarvis-indicator .open:hover {
          color: #fff;
          border-color: rgba(34,211,238,0.4);
          background: rgba(34,211,238,0.08);
        }
      `}</style>
      <div id="jarvis-indicator">
        <span className="dot" aria-hidden="true" />
        <span className="label">JAR<span className="v">V</span>IS</span>
        <span className="open" onClick={openBrain} title="Open daylens.dev/brain">
          Open →
        </span>
      </div>
    </>
  );
}

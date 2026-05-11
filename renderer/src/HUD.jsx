import React, { useState, useEffect } from 'react';

// ── Segment definitions ──────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'gmail',    label: 'MAIL',   angle: -90 },
  { id: 'calendar', label: 'CAL',    angle: -30 },
  { id: 'voice',    label: 'VOICE',  angle: 30  },
  { id: 'memory',   label: 'MEM',    angle: 90  },
  { id: 'screen',   label: 'VISION', angle: 150 },
  { id: 'system',   label: 'SYS',    angle: 210 },
];

// ── Arc path helper ──────────────────────────────────────────────────────────
function arcPath(cx, cy, r, startDeg, endDeg) {
  const toRad = d => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// ── Tick marks ───────────────────────────────────────────────────────────────
function Ticks({ cx, cy, r, count = 72, bigEvery = 9 }) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const rad   = (angle * Math.PI) / 180;
    const big   = i % bigEvery === 0;
    const len   = big ? 8 : 4;
    const r1    = r;
    const r2    = r - len;
    ticks.push(
      <line
        key={i}
        x1={cx + r1 * Math.cos(rad)} y1={cy + r1 * Math.sin(rad)}
        x2={cx + r2 * Math.cos(rad)} y2={cy + r2 * Math.sin(rad)}
        stroke={big ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.2)'}
        strokeWidth={big ? 1.5 : 0.8}
      />
    );
  }
  return <>{ticks}</>;
}

// ── Main HUD ─────────────────────────────────────────────────────────────────
export default function HUD({ onOpenChat, statusMap = {}, visible }) {
  const [hovered, setHovered] = useState(false);
  const [time,    setTime]    = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });

  const CX = 190, CY = 190;
  const R_OUTER_TICK = 178;
  const R_SEG        = 152;
  const R_DATA       = 130;
  const R_MAIN       = 105;
  const R_INNER      = 74;
  const R_CENTER     = 48;

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
        visible ? 'animate-hud-fade-in' : 'opacity-0 pointer-events-none scale-90'
      }`}
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Outer rotating dashes */}
      <div
        className="absolute animate-spin-slow rounded-full"
        style={{
          width: 372, height: 372,
          border: '1px dashed rgba(99,102,241,0.25)',
          boxShadow: '0 0 20px rgba(99,102,241,0.08)',
          WebkitAppRegion: 'no-drag',
        }}
      />

      {/* SVG layer — all rings and segments */}
      <svg
        width={380} height={380}
        viewBox="0 0 380 380"
        style={{ position: 'absolute', WebkitAppRegion: 'no-drag' }}
      >
        {/* ── Tick marks ring ── */}
        <Ticks cx={CX} cy={CY} r={R_OUTER_TICK} />

        {/* ── Status segments ── */}
        {SEGMENTS.map((seg) => {
          const active = statusMap[seg.id] !== false;
          const color  = active ? '#10B981' : 'rgba(99,102,241,0.2)';
          const glow   = active ? 'drop-shadow(0 0 4px rgba(16,185,129,0.7))' : 'none';
          const half   = 20;
          return (
            <g key={seg.id} style={{ filter: glow }}>
              <path
                d={arcPath(CX, CY, R_SEG, seg.angle - half, seg.angle + half)}
                fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* ── Segment labels ── */}
        {SEGMENTS.map((seg) => {
          const rad    = ((seg.angle) * Math.PI) / 180;
          const lx     = CX + (R_SEG + 14) * Math.cos(rad);
          const ly     = CY + (R_SEG + 14) * Math.sin(rad);
          const active = statusMap[seg.id] !== false;
          return (
            <text
              key={seg.id + '-label'}
              x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={7} fontWeight={600} letterSpacing={1}
              fill={active ? 'rgba(16,185,129,0.9)' : 'rgba(99,102,241,0.35)'}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {seg.label}
            </text>
          );
        })}

        {/* ── Data ring (counter-rotating) ── */}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'spin-slow-reverse 16s linear infinite' }}>
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * 360;
            const rad   = (angle * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={CX + R_DATA * Math.cos(rad)}
                cy={CY + R_DATA * Math.sin(rad)}
                r={i % 4 === 0 ? 2.5 : 1.2}
                fill={i % 4 === 0 ? 'rgba(6,182,212,0.7)' : 'rgba(6,182,212,0.3)'}
              />
            );
          })}
        </g>

        {/* ── Main circle border ── */}
        <circle cx={CX} cy={CY} r={R_MAIN}
          fill="none"
          stroke="rgba(99,102,241,0.35)"
          strokeWidth={1.5}
        />

        {/* ── Inner ring ── */}
        <circle cx={CX} cy={CY} r={R_INNER}
          fill="none"
          stroke="rgba(6,182,212,0.4)"
          strokeWidth={1}
          strokeDasharray="4 6"
        />

        {/* ── Arc reactor lines ── */}
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line key={angle}
              x1={CX + (R_CENTER + 6) * Math.cos(rad)} y1={CY + (R_CENTER + 6) * Math.sin(rad)}
              x2={CX + (R_INNER - 6) * Math.cos(rad)}  y2={CY + (R_INNER - 6) * Math.sin(rad)}
              stroke="rgba(99,102,241,0.2)" strokeWidth={0.8}
            />
          );
        })}

        {/* ── Time display ── */}
        <text x={CX} y={CY - 22} textAnchor="middle" fontSize={13} fontWeight={700}
          fill="rgba(129,140,248,0.9)" fontFamily="Inter, monospace" letterSpacing={2}>
          {timeStr}
        </text>
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize={7} fontWeight={500}
          fill="rgba(99,102,241,0.5)" fontFamily="Inter, system-ui" letterSpacing={1.5}>
          {dateStr.toUpperCase()}
        </text>

        {/* ── "CLICK TO CHAT" label ── */}
        <text x={CX} y={CY + 20} textAnchor="middle" fontSize={6.5} fontWeight={600}
          fill={hovered ? 'rgba(6,182,212,0.9)' : 'rgba(99,102,241,0.4)'}
          fontFamily="Inter, system-ui" letterSpacing={2}
          style={{ transition: 'fill 0.2s' }}>
          CHAT STARTEN
        </text>

        {/* ── JARVIS label at bottom ── */}
        <text x={CX} y={CY + 62} textAnchor="middle" fontSize={8} fontWeight={800}
          fill="rgba(99,102,241,0.6)" fontFamily="Inter, system-ui" letterSpacing={4}>
          JARVIS
        </text>
      </svg>

      {/* ── Main pulsing circle (background glow) ── */}
      <div
        className="absolute rounded-full animate-hud-pulse"
        style={{
          width:  R_MAIN * 2, height: R_MAIN * 2,
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.02) 60%, transparent 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
        }}
      />

      {/* ── Inner cyan ring ── */}
      <div
        className="absolute rounded-full animate-hud-pulse-cyan"
        style={{
          width:  R_INNER * 2, height: R_INNER * 2,
          background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.06) 0%, transparent 70%)',
          border: '1px solid rgba(6,182,212,0.3)',
        }}
      />

      {/* ── Clickable center button ── */}
      <button
        onClick={onOpenChat}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="absolute rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          width:  R_CENTER * 2, height: R_CENTER * 2,
          background: hovered
            ? 'radial-gradient(ellipse at center, rgba(6,182,212,0.25) 0%, rgba(99,102,241,0.15) 100%)'
            : 'radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)',
          border: `1px solid ${hovered ? 'rgba(6,182,212,0.7)' : 'rgba(99,102,241,0.5)'}`,
          boxShadow: hovered
            ? '0 0 20px rgba(6,182,212,0.4), 0 0 40px rgba(6,182,212,0.15), inset 0 0 20px rgba(6,182,212,0.1)'
            : '0 0 12px rgba(99,102,241,0.3), inset 0 0 12px rgba(99,102,241,0.08)',
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
          transform: hovered ? 'scale(1.06)' : 'scale(1)',
        }}
      >
        <span style={{
          fontSize: 24, fontWeight: 900, letterSpacing: 2,
          background: hovered
            ? 'linear-gradient(135deg, #06B6D4, #818CF8)'
            : 'linear-gradient(135deg, #6366F1, #818CF8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: hovered ? 'drop-shadow(0 0 8px rgba(6,182,212,0.6))' : 'drop-shadow(0 0 6px rgba(99,102,241,0.5))',
          transition: 'all 0.3s',
        }}>J</span>
      </button>

      {/* ── Outer deco dots ── */}
      {[45, 135, 225, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const ox  = 190 + 185 * Math.cos(rad);
        const oy  = 190 + 185 * Math.sin(rad);
        return (
          <div key={angle} className="absolute rounded-full"
            style={{
              width: 5, height: 5,
              background: 'rgba(99,102,241,0.5)',
              boxShadow: '0 0 6px rgba(99,102,241,0.6)',
              left: ox - 2.5, top: oy - 2.5,
            }}
          />
        );
      })}
    </div>
  );
}

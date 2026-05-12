import React, { useState, useEffect } from 'react';

const SEGMENTS = [
  { id: 'gmail',    label: 'MAIL',   angle: -90 },
  { id: 'calendar', label: 'CAL',    angle: -30 },
  { id: 'voice',    label: 'VOICE',  angle: 30  },
  { id: 'memory',   label: 'MEM',    angle: 90  },
  { id: 'screen',   label: 'VIS',    angle: 150 },
  { id: 'system',   label: 'SYS',    angle: 210 },
];

function arcPath(cx, cy, r, startDeg, endDeg) {
  const toRad = d => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function Ticks({ cx, cy, r, count = 60, bigEvery = 10 }) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const rad   = (angle * Math.PI) / 180;
    const big   = i % bigEvery === 0;
    const len   = big ? 6 : 3;
    ticks.push(
      <line key={i}
        x1={cx + r * Math.cos(rad)}          y1={cy + r * Math.sin(rad)}
        x2={cx + (r - len) * Math.cos(rad)}  y2={cy + (r - len) * Math.sin(rad)}
        stroke={big ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.18)'}
        strokeWidth={big ? 1.2 : 0.7}
      />
    );
  }
  return <>{ticks}</>;
}

export default function HUD({ onOpenChat, statusMap = {}, visible }) {
  const [hovered, setHovered] = useState(false);
  const [time,    setTime]    = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });

  // All coordinates based on 300×300 viewport
  const CX = 150, CY = 150;
  const R_TICK   = 138;
  const R_SEG    = 118;
  const R_DATA   = 100;
  const R_MAIN   = 82;
  const R_INNER  = 58;
  const R_CENTER = 38;

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-90'
      }`}
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Outer glow ring */}
      <div className="absolute rounded-full animate-spin-slow" style={{
        width: 278, height: 278,
        border: '1px dashed rgba(99,102,241,0.22)',
        boxShadow: '0 0 18px rgba(99,102,241,0.06)',
        WebkitAppRegion: 'no-drag',
      }} />

      {/* SVG — all rings, ticks, segments */}
      <svg width={300} height={300} viewBox="0 0 300 300"
           style={{ position: 'absolute', WebkitAppRegion: 'no-drag' }}>

        <defs>
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-cyan">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={hovered ? '#06B6D4' : '#6366F1'} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={hovered ? '#6366F1' : '#818CF8'} stopOpacity="0.05"/>
          </radialGradient>
        </defs>

        {/* Tick ring */}
        <Ticks cx={CX} cy={CY} r={R_TICK} />

        {/* Status segments */}
        {SEGMENTS.map((seg) => {
          const active = statusMap[seg.id] !== false;
          const color  = active ? '#10B981' : 'rgba(99,102,241,0.2)';
          return (
            <g key={seg.id} filter={active ? 'url(#glow-green)' : undefined}>
              <path
                d={arcPath(CX, CY, R_SEG, seg.angle - 18, seg.angle + 18)}
                fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* Segment labels */}
        {SEGMENTS.map((seg) => {
          const rad    = (seg.angle * Math.PI) / 180;
          const lx     = CX + (R_SEG + 12) * Math.cos(rad);
          const ly     = CY + (R_SEG + 12) * Math.sin(rad);
          const active = statusMap[seg.id] !== false;
          return (
            <text key={seg.id + '-lbl'} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={6} fontWeight={700} letterSpacing={0.8}
              fill={active ? 'rgba(16,185,129,0.85)' : 'rgba(99,102,241,0.3)'}
              fontFamily="Inter, system-ui, sans-serif">
              {seg.label}
            </text>
          );
        })}

        {/* Data dots ring (counter-rotating) */}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'spin-slow-reverse 20s linear infinite' }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * 360;
            const rad   = (angle * Math.PI) / 180;
            return (
              <circle key={i}
                cx={CX + R_DATA * Math.cos(rad)}
                cy={CY + R_DATA * Math.sin(rad)}
                r={i % 3 === 0 ? 2 : 1}
                fill={i % 3 === 0 ? 'rgba(6,182,212,0.7)' : 'rgba(6,182,212,0.3)'}
              />
            );
          })}
        </g>

        {/* Main circle */}
        <circle cx={CX} cy={CY} r={R_MAIN}
          fill="none" stroke="rgba(99,102,241,0.3)" strokeWidth={1.2} />

        {/* Inner dashed ring */}
        <circle cx={CX} cy={CY} r={R_INNER}
          fill="none" stroke="rgba(6,182,212,0.35)" strokeWidth={0.8} strokeDasharray="3 5" />

        {/* Arc reactor spokes */}
        {[0,60,120,180,240,300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line key={angle}
              x1={CX + (R_CENTER + 4) * Math.cos(rad)} y1={CY + (R_CENTER + 4) * Math.sin(rad)}
              x2={CX + (R_INNER - 4) * Math.cos(rad)}  y2={CY + (R_INNER - 4) * Math.sin(rad)}
              stroke="rgba(99,102,241,0.18)" strokeWidth={0.7}
            />
          );
        })}

        {/* Time */}
        <text x={CX} y={CY - 16} textAnchor="middle" fontSize={10} fontWeight={700}
          fill="rgba(129,140,248,0.9)" fontFamily="Inter, monospace" letterSpacing={1.5}>
          {timeStr}
        </text>
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize={5.5} fontWeight={500}
          fill="rgba(99,102,241,0.45)" fontFamily="Inter, system-ui" letterSpacing={1.2}>
          {dateStr.toUpperCase()}
        </text>

        {/* CHAT label */}
        <text x={CX} y={CY + 16} textAnchor="middle" fontSize={5} fontWeight={700}
          fill={hovered ? 'rgba(6,182,212,0.9)' : 'rgba(99,102,241,0.38)'}
          fontFamily="Inter, system-ui" letterSpacing={1.8}
          style={{ transition: 'fill 0.2s' }}>
          CHAT STARTEN
        </text>

        {/* JARVIS label */}
        <text x={CX} y={CY + 48} textAnchor="middle" fontSize={6} fontWeight={800}
          fill="rgba(99,102,241,0.5)" fontFamily="Inter, system-ui" letterSpacing={3.5}>
          JARVIS
        </text>

        {/* Center glow fill */}
        <circle cx={CX} cy={CY} r={R_CENTER} fill="url(#centerGrad)" />
      </svg>

      {/* Pulsing main ring glow */}
      <div className="absolute rounded-full animate-hud-pulse" style={{
        width:  R_MAIN * 2, height: R_MAIN * 2,
        background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.07) 0%, transparent 70%)',
        border: '1px solid rgba(99,102,241,0.28)',
      }} />

      {/* Inner cyan ring glow */}
      <div className="absolute rounded-full animate-hud-pulse-cyan" style={{
        width:  R_INNER * 2, height: R_INNER * 2,
        background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.05) 0%, transparent 70%)',
        border: '1px solid rgba(6,182,212,0.25)',
      }} />

      {/* Clickable center */}
      <button
        onClick={onOpenChat}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="absolute rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          width:  R_CENTER * 2, height: R_CENTER * 2,
          background: 'transparent',
          border: `1px solid ${hovered ? 'rgba(6,182,212,0.65)' : 'rgba(99,102,241,0.45)'}`,
          boxShadow: hovered
            ? '0 0 16px rgba(6,182,212,0.35), 0 0 32px rgba(6,182,212,0.12), inset 0 0 16px rgba(6,182,212,0.08)'
            : '0 0 10px rgba(99,102,241,0.25), inset 0 0 10px rgba(99,102,241,0.06)',
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
          transform: hovered ? 'scale(1.07)' : 'scale(1)',
        }}
      >
        <span style={{
          fontSize: 18, fontWeight: 900, letterSpacing: 1,
          background: hovered
            ? 'linear-gradient(135deg, #06B6D4, #818CF8)'
            : 'linear-gradient(135deg, #6366F1, #818CF8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: hovered ? 'drop-shadow(0 0 6px rgba(6,182,212,0.55))' : 'drop-shadow(0 0 5px rgba(99,102,241,0.45))',
          transition: 'all 0.3s',
        }}>J</span>
      </button>

      {/* Corner deco dots */}
      {[45, 135, 225, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <div key={angle} className="absolute rounded-full" style={{
            width: 4, height: 4,
            background: 'rgba(99,102,241,0.45)',
            boxShadow: '0 0 5px rgba(99,102,241,0.5)',
            left: 150 + 145 * Math.cos(rad) - 2,
            top:  150 + 145 * Math.sin(rad) - 2,
          }} />
        );
      })}
    </div>
  );
}

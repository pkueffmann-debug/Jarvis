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
  return `M ${x1} ${y1} A ${r} ${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function Ticks({ cx, cy, r, count = 72, bigEvery = 9 }) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const rad   = (angle * Math.PI) / 180;
    const big   = i % bigEvery === 0;
    const len   = big ? 9 : 4;
    ticks.push(
      <line key={i}
        x1={cx + r * Math.cos(rad)}          y1={cy + r * Math.sin(rad)}
        x2={cx + (r - len) * Math.cos(rad)}  y2={cy + (r - len) * Math.sin(rad)}
        stroke={big ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.18)'}
        strokeWidth={big ? 1.5 : 0.8}
      />
    );
  }
  return <>{ticks}</>;
}

export default function HUD({ onFocusChat, statusMap = {} }) {
  const [hovered, setHovered] = useState(false);
  const [time,    setTime]    = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });

  // 400×400 SVG — large HUD for 900px window
  const SIZE = 400;
  const CX = 200, CY = 200;
  const R_TICK   = 184;
  const R_SEG    = 160;
  const R_DATA   = 136;
  const R_MAIN   = 112;
  const R_INNER  = 78;
  const R_CENTER = 52;

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, WebkitAppRegion: 'drag' }}>
      {/* Slow rotating dashed outer ring */}
      <div className="animate-spin-slow" style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '1px dashed rgba(99,102,241,0.18)',
        boxShadow: '0 0 30px rgba(99,102,241,0.06)',
        WebkitAppRegion: 'no-drag',
      }} />

      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
           style={{ position: 'absolute', inset: 0, WebkitAppRegion: 'no-drag' }}>
        <defs>
          <filter id="seg-glow">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="center-glow">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="cg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={hovered ? '#00D4FF' : '#6366F1'} stopOpacity="0.2"/>
            <stop offset="70%"  stopColor={hovered ? '#6366F1' : '#818CF8'} stopOpacity="0.06"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Tick ring */}
        <Ticks cx={CX} cy={CY} r={R_TICK} />

        {/* Status segments */}
        {SEGMENTS.map((seg) => {
          const active = statusMap[seg.id] !== false;
          return (
            <g key={seg.id} filter={active ? 'url(#seg-glow)' : undefined}>
              <path
                d={arcPath(CX, CY, R_SEG, seg.angle - 22, seg.angle + 22)}
                fill="none"
                stroke={active ? '#10B981' : 'rgba(99,102,241,0.18)'}
                strokeWidth={3.5} strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* Segment labels */}
        {SEGMENTS.map((seg) => {
          const rad    = (seg.angle * Math.PI) / 180;
          const lx     = CX + (R_SEG + 18) * Math.cos(rad);
          const ly     = CY + (R_SEG + 18) * Math.sin(rad);
          const active = statusMap[seg.id] !== false;
          return (
            <text key={seg.id + '-l'} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fontWeight={700} letterSpacing={1}
              fill={active ? 'rgba(16,185,129,0.85)' : 'rgba(99,102,241,0.28)'}
              fontFamily="Inter, system-ui, sans-serif">
              {seg.label}
            </text>
          );
        })}

        {/* Counter-rotating data dots */}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'spin-slow-reverse 22s linear infinite' }}>
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * 360;
            const rad   = (angle * Math.PI) / 180;
            return (
              <circle key={i}
                cx={CX + R_DATA * Math.cos(rad)}
                cy={CY + R_DATA * Math.sin(rad)}
                r={i % 4 === 0 ? 2.5 : 1.2}
                fill={i % 4 === 0 ? 'rgba(6,182,212,0.7)' : 'rgba(6,182,212,0.3)'}
              />
            );
          })}
        </g>

        {/* Main ring */}
        <circle cx={CX} cy={CY} r={R_MAIN}
          fill="none" stroke="rgba(99,102,241,0.28)" strokeWidth={1.5}/>

        {/* Inner dashed ring */}
        <circle cx={CX} cy={CY} r={R_INNER}
          fill="none" stroke="rgba(6,182,212,0.32)" strokeWidth={1} strokeDasharray="5 7"/>

        {/* Arc reactor spokes */}
        {[0,60,120,180,240,300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line key={angle}
              x1={CX + (R_CENTER + 5) * Math.cos(rad)} y1={CY + (R_CENTER + 5) * Math.sin(rad)}
              x2={CX + (R_INNER - 5) * Math.cos(rad)}  y2={CY + (R_INNER - 5) * Math.sin(rad)}
              stroke="rgba(99,102,241,0.16)" strokeWidth={0.9}
            />
          );
        })}

        {/* Center fill */}
        <circle cx={CX} cy={CY} r={R_CENTER} fill="url(#cg)" />

        {/* Time */}
        <text x={CX} y={CY - 22} textAnchor="middle" fontSize={16} fontWeight={700}
          fill="rgba(129,140,248,0.95)" fontFamily="Inter, monospace" letterSpacing={2.5}>
          {timeStr}
        </text>
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={8} fontWeight={500}
          fill="rgba(99,102,241,0.45)" fontFamily="Inter, system-ui" letterSpacing={1.5}>
          {dateStr.toUpperCase()}
        </text>

        {/* "CHAT ↓" label */}
        <text x={CX} y={CY + 20} textAnchor="middle" fontSize={7} fontWeight={700}
          fill={hovered ? 'rgba(0,212,255,0.9)' : 'rgba(99,102,241,0.38)'}
          fontFamily="Inter, system-ui" letterSpacing={2.5}
          style={{ transition: 'fill 0.2s' }}>
          CHAT ↓
        </text>

        {/* JARVIS label */}
        <text x={CX} y={CY + 64} textAnchor="middle" fontSize={10} fontWeight={800}
          fill="rgba(99,102,241,0.45)" fontFamily="Inter, system-ui" letterSpacing={5}>
          JARVIS
        </text>
      </svg>

      {/* Pulsing rings */}
      <div className="animate-hud-pulse" style={{
        position: 'absolute',
        left: CX - R_MAIN, top: CY - R_MAIN,
        width: R_MAIN * 2, height: R_MAIN * 2,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.07) 0%, transparent 70%)',
        border: '1px solid rgba(99,102,241,0.25)',
        pointerEvents: 'none',
      }} />
      <div className="animate-hud-pulse-cyan" style={{
        position: 'absolute',
        left: CX - R_INNER, top: CY - R_INNER,
        width: R_INNER * 2, height: R_INNER * 2,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.05) 0%, transparent 70%)',
        border: '1px solid rgba(6,182,212,0.22)',
        pointerEvents: 'none',
      }} />

      {/* Clickable center button */}
      <button
        onClick={onFocusChat}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          left: CX - R_CENTER, top: CY - R_CENTER,
          width: R_CENTER * 2, height: R_CENTER * 2,
          borderRadius: '50%',
          border: `1px solid ${hovered ? 'rgba(0,212,255,0.65)' : 'rgba(99,102,241,0.45)'}`,
          background: 'transparent',
          boxShadow: hovered
            ? '0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.12), inset 0 0 16px rgba(0,212,255,0.08)'
            : '0 0 14px rgba(99,102,241,0.28), inset 0 0 12px rgba(99,102,241,0.06)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: hovered ? 'scale(1.07)' : 'scale(1)',
          transition: 'all 0.3s',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <span style={{
          fontSize: 22, fontWeight: 900,
          background: hovered
            ? 'linear-gradient(135deg, #00D4FF, #818CF8)'
            : 'linear-gradient(135deg, #6366F1, #818CF8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: hovered ? 'drop-shadow(0 0 8px rgba(0,212,255,0.55))' : 'drop-shadow(0 0 6px rgba(99,102,241,0.45))',
          transition: 'all 0.3s',
        }}>J</span>
      </button>

      {/* Corner deco dots */}
      {[45, 135, 225, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <div key={angle} style={{
            position: 'absolute',
            width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(99,102,241,0.4)',
            boxShadow: '0 0 6px rgba(99,102,241,0.5)',
            left: CX + 192 * Math.cos(rad) - 2.5,
            top:  CY + 192 * Math.sin(rad) - 2.5,
          }} />
        );
      })}
    </div>
  );
}

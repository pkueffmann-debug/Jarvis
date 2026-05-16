import React, { useEffect, useRef } from 'react';

// Compact reactor for the chat-mode top HUD strip — square, focused on the
// arc reactor + minimal chrome. No widgets / no Stark-OS layout.

const COL = {
  cyan:    '0, 220, 255',
  bright:  '120, 235, 255',
  pale:    '200, 245, 255',
  dim:     '0, 130, 180',
  accent:  '255, 80, 30',
  hot:     '255, 200, 60',
  green:   '0, 255, 136',
  amber:   '255, 191, 0',
  red:     '255, 80, 80',
};

function deg2rad(d) { return (d * Math.PI) / 180; }
function speedFor(s) {
  return s === 'speaking' ? 1.6 : s === 'listening' ? 1.1 : s === 'processing' ? 2.4 : 0.6;
}
function pulseFor(s, t) {
  if (s === 'speaking')   return 0.88 + 0.12 * Math.abs(Math.sin(t / 200));
  if (s === 'listening')  return 0.9 + 0.1 * Math.sin(t / 500);
  if (s === 'processing') return 0.7 + 0.3 * Math.random();
  return 0.95 + 0.05 * Math.sin(t / 1100);
}
function stateTint(s) {
  if (s === 'listening')  return COL.green;
  if (s === 'speaking')   return COL.amber;
  if (s === 'processing') return COL.red;
  return COL.cyan;
}

export default function HudCompact({ size = 300, state = 'idle' }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const anglesRef = useRef([0, 0, 0, 0, 0]);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const RES = 600;
    const CX = RES / 2, CY = RES / 2;

    function draw(t) {
      const dt = t - lastFrameRef.current;
      lastFrameRef.current = t;
      const st = stateRef.current;
      const stSpeed = speedFor(st);
      const pulse = pulseFor(st, t);
      const tint = stateTint(st);

      const ang = anglesRef.current;
      const periods = [25000, 16000, 11000, 8000, 6000];
      const dirs = [1, -1, 1, -1, 1];
      for (let i = 0; i < ang.length; i++) {
        ang[i] = (ang[i] + dirs[i] * (dt / periods[i]) * 360 * stSpeed) % 360;
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, RES, RES);

      // Outer tick ring with orange accent
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(deg2rad(ang[0]));
      const R0 = 270;
      ctx.strokeStyle = `rgba(${tint}, 0.55)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, R0, 0, Math.PI * 2); ctx.stroke();
      for (let d = 0; d < 360; d += 5) {
        const isMaj = d % 30 === 0;
        const inset = isMaj ? 14 : d % 10 === 0 ? 8 : 4;
        const rad = deg2rad(d);
        ctx.strokeStyle = `rgba(${tint}, ${isMaj ? 0.85 : 0.4})`;
        ctx.lineWidth = isMaj ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(R0 * Math.cos(rad), R0 * Math.sin(rad));
        ctx.lineTo((R0 - inset) * Math.cos(rad), (R0 - inset) * Math.sin(rad));
        ctx.stroke();
      }
      const accAngle = (t / 1000) * 16 % 360;
      ctx.strokeStyle = `rgba(${COL.accent}, 0.95)`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, R0 - 5, deg2rad(accAngle), deg2rad(accAngle + 60));
      ctx.stroke();
      ctx.lineCap = 'butt';
      const tipR = deg2rad(accAngle + 60);
      ctx.fillStyle = `rgba(${COL.hot}, 1)`;
      ctx.beginPath();
      ctx.arc((R0 - 5) * Math.cos(tipR), (R0 - 5) * Math.sin(tipR), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 24-segment ring
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(deg2rad(ang[1]));
      const R1 = 220;
      for (let i = 0; i < 24; i++) {
        const s = i * 15, e = s + 11;
        const acc = i % 4 === 0;
        ctx.strokeStyle = acc ? `rgba(${COL.bright}, 0.95)` : `rgba(${tint}, 0.6)`;
        ctx.lineWidth = acc ? 4 : 2.2;
        ctx.beginPath(); ctx.arc(0, 0, R1, deg2rad(s), deg2rad(e)); ctx.stroke();
      }
      ctx.restore();

      // Dotted ring
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(deg2rad(ang[2]));
      const R2 = 175;
      for (let d = 0; d < 360; d += 3) {
        const rad = deg2rad(d);
        ctx.fillStyle = `rgba(${tint}, 0.6)`;
        ctx.beginPath();
        ctx.arc(R2 * Math.cos(rad), R2 * Math.sin(rad), 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        const a = i * 90;
        const rad = deg2rad(a);
        ctx.save();
        ctx.translate(R2 * Math.cos(rad), R2 * Math.sin(rad));
        ctx.rotate(rad + Math.PI / 2);
        ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(7, 6); ctx.lineTo(-7, 6); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Inner dashed
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(deg2rad(ang[3]));
      ctx.strokeStyle = `rgba(${tint}, 0.75)`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Reactor core
      ctx.save();
      ctx.translate(CX, CY);
      ctx.globalCompositeOperation = 'lighter';
      const haloR = 95;
      const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, haloR);
      halo.addColorStop(0,   `rgba(${COL.bright}, ${0.55 * pulse})`);
      halo.addColorStop(0.5, `rgba(${tint}, ${0.2 * pulse})`);
      halo.addColorStop(1,   `rgba(${tint}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.rotate(deg2rad(ang[4]));
      ctx.strokeStyle = `rgba(${tint}, 0.95)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const inner = 42, outer = 72;
        const halfA = Math.PI / 11;
        ctx.beginPath();
        ctx.moveTo(inner * Math.cos(a - halfA), inner * Math.sin(a - halfA));
        ctx.lineTo(outer * Math.cos(a - halfA * 0.6), outer * Math.sin(a - halfA * 0.6));
        ctx.lineTo(outer * Math.cos(a + halfA * 0.6), outer * Math.sin(a + halfA * 0.6));
        ctx.lineTo(inner * Math.cos(a + halfA), inner * Math.sin(a + halfA));
        ctx.closePath();
        ctx.fillStyle = `rgba(${tint}, ${0.22 + 0.18 * Math.sin(t / 500 + i * 1.7)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${COL.bright}, 0.85)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(CX, CY);
      ctx.strokeStyle = `rgba(${tint}, 0.75)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.stroke();

      ctx.globalCompositeOperation = 'lighter';
      const coreR = 28 * pulse;
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      core.addColorStop(0,   'rgba(255, 255, 255, 0.95)');
      core.addColorStop(0.4, `rgba(${COL.bright}, 0.85)`);
      core.addColorStop(1,   `rgba(${tint}, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      style={{
        width: size, height: size,
        display: 'block',
        background: '#000000',
        WebkitAppRegion: 'no-drag',
      }}
    />
  );
}

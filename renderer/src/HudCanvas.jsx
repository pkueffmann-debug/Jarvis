import React, { useEffect, useRef } from 'react';

// Stark OS HUD — 1100×620, modeled 1:1 after the reference wallpaper.
// Internal canvas resolution matches the displayed size for crisp pixels.

const COL = {
  cyan:    '0, 220, 255',
  bright:  '120, 235, 255',
  pale:    '200, 245, 255',
  dim:     '0, 130, 180',
  faint:   '0, 90, 130',
  grid:    '0, 80, 120',
  accent:  '255, 80, 30',
  hot:     '255, 200, 60',
  green:   '0, 255, 136',
  amber:   '255, 191, 0',
  red:     '255, 80, 80',
};

function deg2rad(d) { return (d * Math.PI) / 180; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
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

const REACTOR_CX = 500;
const REACTOR_CY = 270;

const APP_LABELS = ['Mail', 'Calendar', 'Notes', 'Memory', 'System', 'Files'];

export default function HudCanvas({
  width = 1100,
  height = 620,
  state = 'idle',
  startupAt = null,
  shutdownAt = null,
  onShutdownComplete,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const reactorAnglesRef = useRef([0, 0, 0, 0, 0]);
  const waveRef = useRef(new Array(160).fill(0));
  const downloadHistoryRef = useRef(new Array(80).fill(0).map(() => Math.random() * 0.3));
  const uploadHistoryRef = useRef(new Array(80).fill(0).map(() => Math.random() * 0.2));

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const startupAtRef = useRef(startupAt);
  useEffect(() => { startupAtRef.current = startupAt; }, [startupAt]);
  const shutdownAtRef = useRef(shutdownAt);
  useEffect(() => { shutdownAtRef.current = shutdownAt; }, [shutdownAt]);
  const shutdownDoneRef = useRef(false);
  useEffect(() => { if (shutdownAt) shutdownDoneRef.current = false; }, [shutdownAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function entrance(t, delay = 0, dur = 600) {
      const sa = startupAtRef.current;
      if (!sa) return 1;
      const v = clamp01((t - sa - delay) / dur);
      return 1 - Math.pow(1 - v, 3);
    }
    function exitVal(t, delay = 0, dur = 300) {
      const sd = shutdownAtRef.current;
      if (!sd) return 1;
      const v = 1 - clamp01((t - sd - delay) / dur);
      return v * v;
    }
    function scaleFor(t, delay) {
      const v = entrance(t, delay, 500) * exitVal(t, delay * 0.3, 250);
      const sd = shutdownAtRef.current;
      if (sd && (t - sd) > 1400 && !shutdownDoneRef.current) {
        shutdownDoneRef.current = true;
        if (onShutdownComplete) onShutdownComplete();
      }
      return v;
    }

    function draw(t) {
      const dt = t - lastFrameRef.current;
      lastFrameRef.current = t;
      const st = stateRef.current;
      const stSpeed = speedFor(st);

      // Update reactor rotations
      const ang = reactorAnglesRef.current;
      const periods = [25000, 16000, 11000, 8000, 6000];
      const dirs    = [1, -1, 1, -1, 1];
      for (let i = 0; i < ang.length; i++) {
        ang[i] = (ang[i] + dirs[i] * (dt / periods[i]) * 360 * stSpeed) % 360;
      }

      // Wave sample
      const wave = waveRef.current;
      wave.shift();
      const amp = st === 'speaking' ? 0.95 : st === 'listening' ? 0.4 : st === 'processing' ? 0.55 : 0.18;
      wave.push((Math.sin(t / 80) * 0.3 + Math.sin(t / 35) * 0.2 + (Math.random() - 0.5) * 0.45) * amp);

      // Bandwidth charts: shift + push new sample
      if (Math.floor(t / 100) !== Math.floor((t - dt) / 100)) {
        downloadHistoryRef.current.shift();
        downloadHistoryRef.current.push(0.1 + Math.random() * 0.85);
        uploadHistoryRef.current.shift();
        uploadHistoryRef.current.push(0.05 + Math.random() * 0.45);
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      drawBackgroundGrid(ctx, width, height, t);
      drawConnectionLines(ctx, width, height, scaleFor(t, 700));

      // Top calendar strip
      drawTopCalendarStrip(ctx, width, scaleFor(t, 0));

      // Top-left: BIG date circle "JUN 21"
      drawDateCircle(ctx, 75, 105, scaleFor(t, 100), t, st);
      // Time circle next to it
      drawTimeCircleSmall(ctx, 195, 80, scaleFor(t, 150), t);

      // RAM / CPU widget cluster top-center-left
      drawRamCpuCluster(ctx, 290, 60, scaleFor(t, 200), t);

      // "Laichzeit Rammstein" music label
      drawMusicLabel(ctx, 540, 50, scaleFor(t, 250), t);

      // Top-right: timer 2:40 circle
      drawTimerCircle(ctx, 740, 80, scaleFor(t, 250), t);

      // News column
      drawNewsList(ctx, 820, 50, scaleFor(t, 300));

      // Weather widget far right top
      drawWeatherWidget(ctx, 970, 50, scaleFor(t, 350), t);

      // Left side: disk / energy / mail / trash
      drawDiskWidget(ctx, 30, 200, scaleFor(t, 400));
      drawEnergyCircle(ctx, 75, 290, scaleFor(t, 450), t);
      drawSmallStatusCircle(ctx, 75, 400, scaleFor(t, 500), 'TRASH', '0', 'FILES');
      drawSmallStatusCircle(ctx, 75, 490, scaleFor(t, 530), 'MAIL', '3', 'INBOX');

      // Main reactor in center
      drawReactor(ctx, REACTOR_CX, REACTOR_CY, reactorAnglesRef.current, scaleFor(t, 50), st, t);

      // Floating app labels around the reactor (left side of reactor)
      drawReactorAppLabels(ctx, REACTOR_CX, REACTOR_CY, scaleFor(t, 600), t);

      // Right column: app icons
      drawAppIcons(ctx, 670, 280, scaleFor(t, 500));

      // Right-far column: 7-day forecast
      drawForecastColumn(ctx, 970, 215, scaleFor(t, 600));

      // Bottom: bandwidth charts + STARK INDUSTRIES + media player
      drawBandwidthCharts(ctx, 320, 460, scaleFor(t, 650), downloadHistoryRef.current, uploadHistoryRef.current);
      drawStarkIndustriesLabel(ctx, 320, 550, scaleFor(t, 700));
      drawMediaPlayer(ctx, 640, 540, scaleFor(t, 700), t);
      drawIpFooter(ctx, 30, 595, scaleFor(t, 750));

      // Audio waveform overlay (bottom-left strip, replaces nothing — adds presence)
      drawAudioWaveStrip(ctx, 30, 555, scaleFor(t, 750), waveRef.current, st);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onShutdownComplete, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width, height,
        display: 'block',
        background: '#000000',
        WebkitAppRegion: 'no-drag',
      }}
    />
  );
}

// ── Background ─────────────────────────────────────────────────────────────

function drawBackgroundGrid(ctx, w, h, t) {
  ctx.save();
  // Sparse star-field dots
  ctx.fillStyle = `rgba(${COL.grid}, 0.35)`;
  const offs = (t / 200) % 24;
  for (let x = -offs; x < w; x += 24) {
    for (let y = -offs; y < h; y += 24) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}

function drawConnectionLines(ctx, w, h, scale) {
  if (scale < 0.3) return;
  ctx.save();
  ctx.strokeStyle = `rgba(${COL.cyan}, ${0.35 * scale})`;
  ctx.lineWidth = 1;
  // Top-left widget bracket — horizontal then vertical
  ctx.beginPath();
  ctx.moveTo(40, 150);  ctx.lineTo(40, 540);
  ctx.moveTo(40, 540);  ctx.lineTo(120, 540);
  // Connection from reactor (right) running horizontally to right widgets
  ctx.moveTo(REACTOR_CX + 230, REACTOR_CY);
  ctx.lineTo(660, REACTOR_CY);
  // Top horizontal line under calendar strip
  ctx.moveTo(0, 35);    ctx.lineTo(w, 35);
  // Bottom horizontal
  ctx.moveTo(0, h - 30); ctx.lineTo(w, h - 30);
  ctx.stroke();
  ctx.restore();
}

// ── Top calendar strip (01..31) ────────────────────────────────────────────

function drawTopCalendarStrip(ctx, w, scale) {
  if (scale < 0.1) return;
  ctx.save();
  ctx.font = '10px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const today = new Date().getDate();
  const cols = 31;
  const gap = (w - 40) / cols;
  for (let i = 1; i <= cols; i++) {
    const x = 20 + (i - 0.5) * gap;
    const y = 18;
    const isToday = i === today;
    if (isToday) {
      ctx.fillStyle = `rgba(${COL.cyan}, 0.25)`;
      ctx.fillRect(x - 11, y - 9, 22, 18);
      ctx.strokeStyle = `rgba(${COL.bright}, 0.9)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 11, y - 9, 22, 18);
    }
    ctx.fillStyle = isToday ? `rgba(${COL.pale}, 1)` : `rgba(${COL.cyan}, ${0.45 + 0.05 * (i % 2)})`;
    ctx.fillText(String(i).padStart(2, '0'), x, y);
  }
  // Day-of-week centered above
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  ctx.fillStyle = `rgba(${COL.cyan}, 0.55)`;
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillText(day, w / 2, 4);
  ctx.restore();
}

// ── Top-left: Big date circle ──────────────────────────────────────────────

function drawDateCircle(ctx, cx, cy, scale, t, state) {
  const r = 55 * scale;
  if (r < 5) return;
  ctx.save();
  ctx.translate(cx, cy);
  // Outer ring with ticks
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.65)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // Inner ring
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.35)`;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  // Ticks
  for (let d = 0; d < 360; d += 6) {
    const isMaj = d % 30 === 0;
    const rad = deg2rad(d);
    ctx.strokeStyle = `rgba(${COL.cyan}, ${isMaj ? 0.85 : 0.4})`;
    ctx.lineWidth = isMaj ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo((r + 2) * Math.cos(rad), (r + 2) * Math.sin(rad));
    ctx.lineTo((r + (isMaj ? 8 : 5)) * Math.cos(rad), (r + (isMaj ? 8 : 5)) * Math.sin(rad));
    ctx.stroke();
  }
  // Progress arc — month progress
  const dt = new Date();
  const progress = dt.getDate() / 31;
  ctx.strokeStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, deg2rad(-90), deg2rad(-90 + 360 * progress));
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Center fill
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r - 8);
  grad.addColorStop(0, `rgba(${COL.cyan}, 0.12)`);
  grad.addColorStop(1, `rgba(${COL.cyan}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2); ctx.fill();

  // Big day number
  ctx.fillStyle = `rgba(${COL.pale}, 0.95)`;
  ctx.font = 'bold 36px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(dt.getDate()).padStart(2, '0'), 0, 4);
  // Month label above
  ctx.fillStyle = `rgba(${COL.cyan}, 0.75)`;
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillText(dt.toLocaleDateString('en-US', { month: 'long' }).toUpperCase(), 0, -r + 12);
  ctx.restore();
}

// ── Small time circle ─────────────────────────────────────────────────────

function drawTimeCircleSmall(ctx, cx, cy, scale, t) {
  const r = 30 * scale;
  if (r < 4) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.6)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.3)`;
  ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.stroke();
  // Progress arc — minute progress
  const dt = new Date();
  const p = dt.getMinutes() / 60;
  ctx.strokeStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, deg2rad(-90), deg2rad(-90 + 360 * p));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Hand
  const handAngle = ((dt.getSeconds() + dt.getMilliseconds() / 1000) / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = `rgba(${COL.bright}, 0.9)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo((r - 8) * Math.cos(handAngle), (r - 8) * Math.sin(handAngle));
  ctx.stroke();
  // Time text outside
  ctx.fillStyle = `rgba(${COL.cyan}, 0.85)`;
  ctx.font = '9px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  ctx.fillText(`${hh}:${mm}:${ss}`, r + 8, 0);
  ctx.restore();
}

// ── RAM/CPU/SWAP cluster ──────────────────────────────────────────────────

function drawRamCpuCluster(ctx, x, y, scale, t) {
  if (scale < 0.1) return;
  ctx.save();
  // RAM small circle
  const ram = 60 + Math.floor(20 * (0.5 + 0.5 * Math.sin(t / 4000)));
  drawMiniGauge(ctx, x, y, 25 * scale, ram, 'RAM', `${ram}`, COL.cyan);
  // SWAP next to it
  const swap = 40 + Math.floor(15 * (0.5 + 0.5 * Math.sin(t / 5000)));
  drawMiniGauge(ctx, x + 70, y, 25 * scale, swap, 'SWAP', `${swap}`, COL.cyan);
  // CPU full circle
  const cpu0 = 50 + Math.floor(35 * (0.5 + 0.5 * Math.sin(t / 3000)));
  const cpu1 = 40 + Math.floor(30 * (0.5 + 0.5 * Math.cos(t / 2500)));
  drawCpuDual(ctx, x + 145, y, 30 * scale, cpu0, cpu1);
  ctx.restore();
}

function drawMiniGauge(ctx, cx, cy, r, value, label, valTxt, tintRGB) {
  if (r < 3) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${tintRGB}, 0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // Progress
  ctx.strokeStyle = `rgba(${COL.bright}, 0.9)`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, deg2rad(-90), deg2rad(-90 + 360 * (value / 100)));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Label small
  ctx.fillStyle = `rgba(${tintRGB}, 0.85)`;
  ctx.font = 'bold 9px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -r * 0.45);
  ctx.fillStyle = `rgba(${COL.bright}, 1)`;
  ctx.font = `bold ${Math.round(r * 0.65)}px "SF Mono", monospace`;
  ctx.fillText(valTxt, 0, r * 0.15);
  ctx.restore();
}

function drawCpuDual(ctx, cx, cy, r, v0, v1) {
  if (r < 4) return;
  ctx.save();
  ctx.translate(cx, cy);
  // Outer
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.55)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // Inner
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.35)`;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  // Two progress arcs
  ctx.strokeStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, deg2rad(-90), deg2rad(-90 + 180 * (v0 / 100)));
  ctx.stroke();
  ctx.strokeStyle = `rgba(${COL.accent}, 0.85)`;
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, deg2rad(90), deg2rad(90 + 180 * (v1 / 100)));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Label
  ctx.fillStyle = `rgba(${COL.cyan}, 0.9)`;
  ctx.font = 'bold 9px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CPU', 0, -r * 0.42);
  // Two values
  ctx.fillStyle = `rgba(${COL.bright}, 1)`;
  ctx.font = `bold 11px "SF Mono", monospace`;
  ctx.fillText(`0:${String(v0).padStart(2, '0')}`, 0, -2);
  ctx.fillStyle = `rgba(${COL.hot}, 0.9)`;
  ctx.fillText(`1:${String(v1).padStart(2, '0')}`, 0, 11);
  ctx.restore();
}

// ── Music label ────────────────────────────────────────────────────────────

function drawMusicLabel(ctx, x, y, scale, t) {
  if (scale < 0.2) return;
  ctx.save();
  ctx.fillStyle = `rgba(${COL.cyan}, 0.75)`;
  ctx.font = 'bold 13px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Laichzeit', x + 80, y + 6);
  ctx.fillStyle = `rgba(${COL.dim}, 0.85)`;
  ctx.font = '10px "SF Mono", monospace';
  ctx.fillText('Rammstein', x + 80, y + 24);
  // Tiny progress bar
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.5)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 24, y + 42, 112, 6);
  const p = ((t / 9000) % 1);
  ctx.fillStyle = `rgba(${COL.bright}, 0.9)`;
  ctx.fillRect(x + 25, y + 43, 110 * p, 4);
  ctx.restore();
}

// ── Top-right: 2:40 timer circle ──────────────────────────────────────────

function drawTimerCircle(ctx, cx, cy, scale, t) {
  const r = 38 * scale;
  if (r < 4) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.6)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.3)`;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  // Sweep
  const sweep = ((t / 5000) % 1);
  ctx.strokeStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, deg2rad(-90), deg2rad(-90 + 360 * sweep));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Speaker glyph + 2:40
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = 'bold 16px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2:40', 0, 2);
  ctx.fillStyle = `rgba(${COL.cyan}, 0.6)`;
  ctx.font = '8px "SF Mono", monospace';
  ctx.fillText('TIMER', 0, r - 12);
  ctx.restore();
}

// ── News list ──────────────────────────────────────────────────────────────

function drawNewsList(ctx, x, y, scale) {
  if (scale < 0.2) return;
  const items = [
    { ico: '◉', txt: 'NEWS · Briefing ready' },
    { txt: 'Kinopoisk · Iron Man' },
    { txt: 'Top story · stock rally' },
    { txt: 'Climate · clear skies' },
    { txt: 'Music · suggested' },
    { txt: 'Club · trending' },
  ];
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let yi = y;
  for (let i = 0; i < items.length; i++) {
    ctx.fillStyle = i === 0 ? `rgba(${COL.bright}, 0.95)` : `rgba(${COL.cyan}, 0.62)`;
    ctx.font = i === 0 ? 'bold 10px "SF Mono", monospace' : '9px "SF Mono", monospace';
    ctx.fillText(items[i].txt, x, yi);
    yi += i === 0 ? 16 : 13;
  }
  ctx.restore();
}

// ── Weather widget ────────────────────────────────────────────────────────

function drawWeatherWidget(ctx, x, y, scale, t) {
  if (scale < 0.2) return;
  ctx.save();
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Munich, Germany', x, y);
  // Moon icon (placeholder circle)
  ctx.strokeStyle = `rgba(${COL.pale}, 0.85)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x + 95, y + 24, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(${COL.pale}, 0.15)`;
  ctx.beginPath(); ctx.arc(x + 95, y + 24, 12, 0, Math.PI * 2); ctx.fill();
  // Crescent cut
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(x + 99, y + 22, 10, 0, Math.PI * 2); ctx.fill();
  // Temp
  ctx.fillStyle = `rgba(${COL.pale}, 1)`;
  ctx.font = 'bold 22px "SF Mono", monospace';
  ctx.fillText('13°C', x, y + 16);
  // Details
  ctx.font = '8px "SF Mono", monospace';
  ctx.fillStyle = `rgba(${COL.cyan}, 0.75)`;
  const lines = [
    'CONDITION: CLEAR',
    'HUMIDITY:  77%',
    'WIND:      3 m/s',
    'VISIBILITY:10 km',
    'SUNSET:    20:43',
  ];
  let yi = y + 50;
  for (const l of lines) { ctx.fillText(l, x, yi); yi += 11; }
  ctx.restore();
}

// ── Left side widgets ─────────────────────────────────────────────────────

function drawDiskWidget(ctx, x, y, scale) {
  if (scale < 0.2) return;
  ctx.save();
  // Frame
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.55)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 140, 60);
  ctx.fillStyle = `rgba(${COL.cyan}, 0.05)`;
  ctx.fillRect(x + 1, y + 1, 138, 58);
  // Text
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = 'bold 10px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LOCAL DISK', x + 8, y + 6);
  ctx.fillStyle = `rgba(${COL.cyan}, 0.7)`;
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillText('TOTAL', x + 8, y + 24);
  ctx.fillText('FREE',  x + 8, y + 40);
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.textAlign = 'right';
  ctx.fillText('100 GB', x + 132, y + 24);
  ctx.fillStyle = `rgba(${COL.accent}, 0.9)`;
  ctx.fillText('2 GB', x + 132, y + 40);
  ctx.restore();
}

function drawEnergyCircle(ctx, cx, cy, scale, t) {
  const r = 42 * scale;
  if (r < 5) return;
  ctx.save();
  ctx.translate(cx, cy);
  // Outer ring
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.6)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // Inner ring
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.35)`;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  // 100% progress
  ctx.strokeStyle = `rgba(${COL.green}, 0.95)`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, deg2rad(-90), deg2rad(270));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Text
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = 'bold 16px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100%', 0, 2);
  ctx.fillStyle = `rgba(${COL.cyan}, 0.75)`;
  ctx.font = '8px "SF Mono", monospace';
  ctx.fillText('ENERGY', 0, -r + 12);
  ctx.fillText('HIGH', 0, r - 10);
  ctx.restore();
}

function drawSmallStatusCircle(ctx, cx, cy, scale, label, big, small) {
  const r = 30 * scale;
  if (r < 4) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.6)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.3)`;
  ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = 'bold 14px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(big, 0, 0);
  ctx.fillStyle = `rgba(${COL.cyan}, 0.7)`;
  ctx.font = '8px "SF Mono", monospace';
  ctx.fillText(label, 0, -r + 10);
  ctx.fillText(small, 0, r - 8);
  ctx.restore();
}

// ── Central Arc Reactor ───────────────────────────────────────────────────

function drawReactor(ctx, cx, cy, angles, scale, state, t) {
  if (scale < 0.05) return;
  const tint = stateTint(state);
  const pulse = pulseFor(state, t);

  ctx.save();
  ctx.translate(cx, cy);

  // 1) Outermost tick ring (~220) — rotates with angles[0]
  {
    const R = 220 * scale;
    ctx.save();
    ctx.rotate(deg2rad(angles[0]));
    ctx.strokeStyle = `rgba(${tint}, 0.55)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    for (let d = 0; d < 360; d += 5) {
      const isMaj = d % 30 === 0;
      const inset = isMaj ? 14 : d % 10 === 0 ? 8 : 4;
      const rad = deg2rad(d);
      ctx.strokeStyle = `rgba(${tint}, ${isMaj ? 0.85 : 0.4})`;
      ctx.lineWidth = isMaj ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(R * Math.cos(rad), R * Math.sin(rad));
      ctx.lineTo(Math.max(0, R - inset) * Math.cos(rad), Math.max(0, R - inset) * Math.sin(rad));
      ctx.stroke();
    }
    // Orange accent arc — the iconic red/orange sweep
    const accRad = Math.max(2, R - 5);
    const accAngle = (t / 1000) * 16 % 360;
    ctx.strokeStyle = `rgba(${COL.accent}, 0.95)`;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, accRad, deg2rad(accAngle), deg2rad(accAngle + 60));
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Tip marker
    const tipR = deg2rad(accAngle + 60);
    ctx.fillStyle = `rgba(${COL.hot}, 1)`;
    ctx.beginPath();
    ctx.arc(accRad * Math.cos(tipR), accRad * Math.sin(tipR), 5, 0, Math.PI * 2);
    ctx.fill();
    // Spoke from center through the accent
    ctx.strokeStyle = `rgba(${COL.bright}, 0.5)`;
    ctx.lineWidth = 1;
    const sr = deg2rad(accAngle + 30);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(sr), R * Math.sin(sr));
    ctx.stroke();
    ctx.restore();
  }

  // 2) 24-segment ring (~175) — rotates with angles[1]
  {
    const R = 175 * scale;
    ctx.save();
    ctx.rotate(deg2rad(angles[1]));
    for (let i = 0; i < 24; i++) {
      const start = i * 15, end = start + 11;
      const acc = i % 4 === 0;
      ctx.strokeStyle = acc ? `rgba(${COL.bright}, 0.95)` : `rgba(${tint}, 0.6)`;
      ctx.lineWidth = acc ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, R, deg2rad(start), deg2rad(end));
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3) Dotted ring (~140) — rotates with angles[2]
  {
    const R = 140 * scale;
    ctx.save();
    ctx.rotate(deg2rad(angles[2]));
    for (let d = 0; d < 360; d += 3) {
      const rad = deg2rad(d);
      ctx.fillStyle = `rgba(${tint}, 0.55)`;
      ctx.beginPath();
      ctx.arc(R * Math.cos(rad), R * Math.sin(rad), 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 4 cardinal triangles
    for (let i = 0; i < 4; i++) {
      const a = i * 90;
      const rad = deg2rad(a);
      ctx.save();
      ctx.translate(R * Math.cos(rad), R * Math.sin(rad));
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 4) Inner dashed ring (~105) — rotates with angles[3]
  {
    const R = 105 * scale;
    ctx.save();
    ctx.rotate(deg2rad(angles[3]));
    ctx.strokeStyle = `rgba(${tint}, 0.75)`;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 5) Reactor core
  // Halo
  ctx.globalCompositeOperation = 'lighter';
  const haloR = 75 * scale;
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, haloR);
  halo.addColorStop(0,   `rgba(${COL.bright}, ${0.55 * pulse})`);
  halo.addColorStop(0.5, `rgba(${tint}, ${0.2 * pulse})`);
  halo.addColorStop(1,   `rgba(${tint}, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Outer reactor ring with 8 wedges
  ctx.save();
  ctx.rotate(deg2rad(angles[4]));
  ctx.strokeStyle = `rgba(${tint}, 0.95)`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 62 * scale, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const inner = 34 * scale, outer = 57 * scale;
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

  // Inner ring
  ctx.strokeStyle = `rgba(${tint}, 0.75)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 28 * scale, 0, Math.PI * 2); ctx.stroke();

  // Bright core
  ctx.globalCompositeOperation = 'lighter';
  const coreR = 22 * scale * pulse;
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
  core.addColorStop(0,   'rgba(255, 255, 255, 0.95)');
  core.addColorStop(0.4, `rgba(${COL.bright}, 0.85)`);
  core.addColorStop(1,   `rgba(${tint}, 0)`);
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * pulse})`;
  ctx.beginPath(); ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

// ── App labels around reactor ──────────────────────────────────────────────

function drawReactorAppLabels(ctx, cx, cy, scale, t) {
  if (scale < 0.3) return;
  ctx.save();
  ctx.font = '11px "SF Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  // Labels float along arc on the left
  const angles = [-128, -110, -92, -74, -56, -38];
  const R = 240;
  for (let i = 0; i < APP_LABELS.length; i++) {
    const a = deg2rad(angles[i]);
    const x = cx + R * Math.cos(a);
    const y = cy + R * Math.sin(a);
    ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
    ctx.fillText(APP_LABELS[i], x - 10, y);
    // Connecting tick
    ctx.strokeStyle = `rgba(${COL.cyan}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, y); ctx.lineTo(x + 4, y);
    ctx.stroke();
  }
  // "JARVIS OS 2026" branding to the left of reactor
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(${COL.dim}, 0.8)`;
  ctx.font = 'bold 22px "SF Mono", monospace';
  ctx.fillText('JARVIS', cx - 200, cy + 70);
  ctx.font = '10px "SF Mono", monospace';
  ctx.fillText('OS · 2026', cx - 200, cy + 88);
  // "Control Panel" under reactor
  ctx.fillStyle = `rgba(${COL.cyan}, 0.55)`;
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillText('CONTROL  PANEL', cx, cy + 230 * scale);
  ctx.restore();
}

// ── App icons (right of reactor) ──────────────────────────────────────────

function drawAppIcons(ctx, x, y, scale) {
  if (scale < 0.3) return;
  ctx.save();
  // Two icons: Art (frame) and Trash (folder)
  drawIconBox(ctx, x + 30, y, 'ART', '🖼');
  drawIconBox(ctx, x + 100, y, 'TRASH', '🗑');
  // Labels list to the right
  const labels = ['Games', 'Programs', 'Cloud', 'Electronics'];
  ctx.font = '11px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let yi = y + 80;
  for (const l of labels) {
    ctx.fillStyle = `rgba(${COL.bright}, 0.9)`;
    ctx.fillText(l, x, yi);
    ctx.strokeStyle = `rgba(${COL.cyan}, 0.5)`;
    ctx.beginPath();
    ctx.moveTo(x - 8, yi + 6); ctx.lineTo(x - 2, yi + 6);
    ctx.stroke();
    yi += 18;
  }
  ctx.restore();
}

function drawIconBox(ctx, cx, cy, label, glyph) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.7)`;
  ctx.lineWidth = 1;
  // Square outline
  ctx.strokeRect(-26, -26, 52, 52);
  // Cut corners
  ctx.strokeStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.beginPath();
  ctx.moveTo(-26, -16); ctx.lineTo(-16, -26);
  ctx.moveTo( 26, -16); ctx.lineTo( 16, -26);
  ctx.moveTo(-26,  16); ctx.lineTo(-16,  26);
  ctx.moveTo( 26,  16); ctx.lineTo( 16,  26);
  ctx.stroke();
  // Glyph
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.fillText(glyph, 0, 0);
  // Label
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillStyle = `rgba(${COL.cyan}, 0.85)`;
  ctx.fillText(label, 0, 38);
  ctx.restore();
}

// ── 7-day forecast column ────────────────────────────────────────────────

function drawForecastColumn(ctx, x, y, scale) {
  if (scale < 0.3) return;
  const days = [
    { d: 'TONIGHT',   t1: '11°',          cond: 'CLOUDY' },
    { d: 'TOMORROW',  t1: '23°', t2: '11°', cond: 'SUN' },
    { d: 'FRI · 22',  t1: '23°', t2: '11°', cond: 'CLEAR' },
    { d: 'SAT · 23',  t1: '19°', t2: '12°', cond: 'CLOUDY' },
    { d: 'SUN · 24',  t1: '17°', t2: '11°', cond: 'RAIN' },
    { d: 'MON · 25',  t1: '19°', t2: '11°', cond: 'CLOUDY' },
    { d: 'TUE · 26',  t1: '22°', t2: '12°', cond: 'RAIN' },
    { d: 'WED · 27',  t1: '23°', t2: '14°', cond: 'RAIN' },
  ];
  ctx.save();
  ctx.textBaseline = 'top';
  let yi = y;
  for (const dy of days) {
    ctx.font = 'bold 9px "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(${COL.bright}, 0.9)`;
    ctx.fillText(dy.d, x, yi);
    ctx.font = '8px "SF Mono", monospace';
    ctx.fillStyle = `rgba(${COL.cyan}, 0.7)`;
    ctx.fillText(dy.cond, x, yi + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(${COL.pale}, 0.95)`;
    ctx.font = 'bold 11px "SF Mono", monospace';
    ctx.fillText(dy.t1 + (dy.t2 ? ' / ' + dy.t2 : ''), x + 120, yi);
    // Tiny icon — circle/cloud
    drawWeatherIcon(ctx, x + 138, yi + 8, dy.cond);
    yi += 22;
  }
  ctx.restore();
}

function drawWeatherIcon(ctx, x, y, cond) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(${COL.bright}, 0.85)`;
  ctx.lineWidth = 1;
  if (cond === 'SUN' || cond === 'CLEAR') {
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(6 * Math.cos(a), 6 * Math.sin(a));
      ctx.lineTo(9 * Math.cos(a), 9 * Math.sin(a));
      ctx.stroke();
    }
  } else if (cond === 'CLOUDY') {
    ctx.beginPath();
    ctx.arc(-3, 1, 4, 0, Math.PI * 2);
    ctx.arc( 3, 1, 4, 0, Math.PI * 2);
    ctx.arc( 0, -1, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cond === 'RAIN') {
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4, 4); ctx.lineTo(i * 4 - 1, 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Bandwidth charts ─────────────────────────────────────────────────────

function drawBandwidthCharts(ctx, x, y, scale, dlHist, ulHist) {
  if (scale < 0.3) return;
  ctx.save();
  // DOWNLOAD
  drawSparkline(ctx, x, y, 260, 30, dlHist, 'DOWNLOAD', '169.39 GB', '2.5k', COL.bright);
  // UPLOAD
  drawSparkline(ctx, x, y + 42, 260, 30, ulHist, 'UPLOAD', '32.96 GB', '262.0', COL.accent);
  ctx.restore();
}

function drawSparkline(ctx, x, y, w, h, hist, label, total, current, colorRGB) {
  ctx.save();
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.55)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // Header
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = 'bold 9px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 4, y - 11);
  ctx.textAlign = 'right';
  ctx.fillStyle = `rgba(${COL.cyan}, 0.85)`;
  ctx.font = '9px "SF Mono", monospace';
  ctx.fillText(`${current}  ${total}`, x + w, y - 11);
  // Bars
  const n = hist.length;
  const bw = (w - 4) / n;
  for (let i = 0; i < n; i++) {
    const bh = (h - 4) * hist[i];
    ctx.fillStyle = `rgba(${colorRGB}, 0.85)`;
    ctx.fillRect(x + 2 + i * bw, y + (h - 2) - bh, Math.max(1, bw - 0.5), bh);
  }
  ctx.restore();
}

// ── Bottom: STARK INDUSTRIES + media player + IP ─────────────────────────

function drawStarkIndustriesLabel(ctx, x, y, scale) {
  if (scale < 0.3) return;
  ctx.save();
  ctx.font = 'bold 16px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = `rgba(${COL.dim}, 0.85)`;
  ctx.fillText('STARK ∙ INDUSTRIES', x, y);
  ctx.restore();
}

function drawMediaPlayer(ctx, x, y, scale, t) {
  if (scale < 0.3) return;
  ctx.save();
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.65)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 240, 26);
  // Controls
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = '12px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('◀◀  ▶  ▶▶  ■', x + 8, y + 13);
  // Progress
  const p = (t / 12000) % 1;
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.4)`;
  ctx.beginPath();
  ctx.moveTo(x + 95, y + 13); ctx.lineTo(x + 230, y + 13);
  ctx.stroke();
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.fillRect(x + 95, y + 11, 135 * p, 4);
  ctx.beginPath();
  ctx.arc(x + 95 + 135 * p, y + 13, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIpFooter(ctx, x, y, scale) {
  if (scale < 0.3) return;
  ctx.save();
  ctx.fillStyle = `rgba(${COL.dim}, 0.75)`;
  ctx.font = '10px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('IP  91.219.164.5  ·  GATEWAY 192.168.0.1  ·  UPTIME 1d 4h 12m', x, y);
  ctx.restore();
}

// ── Audio wave strip (bottom-left) ─────────────────────────────────────────

function drawAudioWaveStrip(ctx, x, y, scale, wave, state) {
  if (scale < 0.3) return;
  const w = 270, h = 30;
  ctx.save();
  ctx.strokeStyle = `rgba(${COL.cyan}, 0.55)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // Waveform
  const tint = stateTint(state);
  ctx.strokeStyle = `rgba(${tint}, 0.95)`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < wave.length; i++) {
    const px = x + (i / (wave.length - 1)) * w;
    const py = y + h / 2 + wave[i] * (h / 2 - 4);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Label
  ctx.fillStyle = `rgba(${COL.bright}, 0.95)`;
  ctx.font = 'bold 9px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('AUDIO', x + 4, y - 11);
  ctx.textAlign = 'right';
  ctx.fillStyle = `rgba(${COL.cyan}, 0.75)`;
  ctx.font = '9px "SF Mono", monospace';
  const lbl = state === 'listening' ? 'INPUT'
             : state === 'speaking' ? 'OUTPUT'
             : state === 'processing' ? 'BUSY' : 'IDLE';
  ctx.fillText(lbl, x + w, y - 11);
  ctx.restore();
}

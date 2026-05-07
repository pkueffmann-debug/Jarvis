// Generates the JARVIS app icon in all required sizes + .icns for macOS
'use strict';
const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');
const os   = require('os');

const ASSETS = path.join(__dirname, '..', 'assets');

// ── Draw the JARVIS icon onto a canvas of the given size ──────────────────────
function drawIcon(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size / 2;

  // Background
  ctx.fillStyle = '#06060C';
  ctx.fillRect(0, 0, size, size);

  // Outer ambient glow
  const ambientGrad = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 0.95);
  ambientGrad.addColorStop(0, 'rgba(99,102,241,0.18)');
  ambientGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(0, 0, size, size);

  // ── Outer ring ───────────────────────────────────────────────────────────
  const ringOuter = R * 0.84;
  const ringInner = R * 0.73;

  const ringGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  ringGrad.addColorStop(0,   '#A5B4FC'); // indigo-300
  ringGrad.addColorStop(0.35,'#6366F1'); // indigo-500
  ringGrad.addColorStop(0.65,'#4F46E5'); // indigo-600
  ringGrad.addColorStop(1,   '#312E81'); // indigo-900

  ctx.beginPath();
  ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2);
  ctx.arc(cx, cy, ringInner, 0, Math.PI * 2, true);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // ── Ring segment dots (arc-reactor feel) ──────────────────────────────────
  const segCount = 12;
  const dotR     = Math.max(2, size * 0.008);
  const dotTrack = ringOuter - size * 0.022;
  for (let i = 0; i < segCount; i++) {
    const angle = (i / segCount) * Math.PI * 2 - Math.PI / 2;
    const dx = cx + Math.cos(angle) * dotTrack;
    const dy = cy + Math.sin(angle) * dotTrack;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0
      ? 'rgba(255,255,255,0.95)'
      : 'rgba(165,180,252,0.55)';
    ctx.fill();
  }

  // ── Inner subtle glow disk ────────────────────────────────────────────────
  const diskGrad = ctx.createRadialGradient(cx, cy - size * 0.06, 0, cx, cy, ringInner * 0.95);
  diskGrad.addColorStop(0, 'rgba(99,102,241,0.12)');
  diskGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, ringInner * 0.97, 0, Math.PI * 2);
  ctx.fillStyle = diskGrad;
  ctx.fill();

  // ── "J" letter with multi-pass glow ──────────────────────────────────────
  const fontSize = Math.round(size * 0.43);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${fontSize}px Arial, "Helvetica Neue", Helvetica, sans-serif`;

  const jx = cx + size * 0.005;
  const jy = cy + size * 0.038;

  // Outer soft glow
  ctx.shadowColor = '#818CF8';
  ctx.shadowBlur  = size * 0.12;
  ctx.fillStyle   = 'rgba(129,140,248,0.4)';
  ctx.fillText('J', jx, jy);

  // Mid glow
  ctx.shadowBlur = size * 0.06;
  ctx.fillStyle  = 'rgba(255,255,255,0.8)';
  ctx.fillText('J', jx, jy);

  // Crisp letter
  ctx.shadowBlur = size * 0.015;
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText('J', jx, jy);

  ctx.shadowBlur = 0;
}

// ── Generate all sizes + .icns ────────────────────────────────────────────────
async function main() {
  const { createCanvas } = require('canvas');

  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

  // 1. Source 1024x1024
  const src = createCanvas(1024, 1024);
  drawIcon(src.getContext('2d'), 1024);
  const srcPng = path.join(ASSETS, 'icon.png');
  fs.writeFileSync(srcPng, src.toBuffer('image/png'));
  console.log('✓ assets/icon.png (1024×1024)');

  // 2. iconset for .icns  (iconutil expects specific filenames)
  const iconset = path.join(os.tmpdir(), `jarvis_${Date.now()}.iconset`);
  fs.mkdirSync(iconset);

  const defs = [
    { name:'icon_16x16.png',       s:16  },
    { name:'icon_16x16@2x.png',    s:32  },
    { name:'icon_32x32.png',       s:32  },
    { name:'icon_32x32@2x.png',    s:64  },
    { name:'icon_64x64.png',       s:64  },
    { name:'icon_64x64@2x.png',    s:128 },
    { name:'icon_128x128.png',     s:128 },
    { name:'icon_128x128@2x.png',  s:256 },
    { name:'icon_256x256.png',     s:256 },
    { name:'icon_256x256@2x.png',  s:512 },
    { name:'icon_512x512.png',     s:512 },
    { name:'icon_512x512@2x.png',  s:1024},
  ];

  for (const { name, s } of defs) {
    const c = createCanvas(s, s);
    drawIcon(c.getContext('2d'), s);
    fs.writeFileSync(path.join(iconset, name), c.toBuffer('image/png'));
    process.stdout.write(`  ✓ ${name}\n`);
  }

  // 3. .icns via iconutil (macOS built-in)
  const icnsPath = path.join(ASSETS, 'jarvis.icns');
  execSync(`iconutil -c icns "${iconset}" -o "${icnsPath}"`);
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log(`✓ assets/jarvis.icns`);

  // 4. 22×22 tray icon (macOS menu bar — should be @2x ready)
  const tray = createCanvas(44, 44);
  drawIcon(tray.getContext('2d'), 44);
  fs.writeFileSync(path.join(ASSETS, 'tray-icon@2x.png'), tray.toBuffer('image/png'));

  const tray1 = createCanvas(22, 22);
  drawIcon(tray1.getContext('2d'), 22);
  fs.writeFileSync(path.join(ASSETS, 'tray-icon.png'), tray1.toBuffer('image/png'));
  console.log('✓ assets/tray-icon.png + @2x');

  // 5. 256×256 for electron-builder (png fallback)
  const icon256 = createCanvas(256, 256);
  drawIcon(icon256.getContext('2d'), 256);
  fs.writeFileSync(path.join(ASSETS, 'icon-256.png'), icon256.toBuffer('image/png'));
  console.log('✓ assets/icon-256.png');

  console.log('\n🚀 JARVIS icon generation complete.');
}

main().catch((e) => {
  console.error('Icon generation failed:', e.message);
  process.exit(1);
});

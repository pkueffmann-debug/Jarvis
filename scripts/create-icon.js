#!/usr/bin/env node
// Generates assets/tray-icon.png (22×22 white circle — macOS template image)
const path = require('path');
const fs = require('fs');

let PNG;
try {
  PNG = require('pngjs').PNG;
} catch {
  console.warn('⚠️  pngjs not available — skipping icon generation. Run npm install first.');
  process.exit(0);
}

const SIZE = 22;
const png = new PNG({ width: SIZE, height: SIZE, filterType: -1 });

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const idx = (SIZE * y + x) * 4;
    const cx = SIZE / 2 - 0.5;
    const cy = SIZE / 2 - 0.5;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

    if (dist <= SIZE / 2 - 1) {
      png.data[idx]     = 255; // R
      png.data[idx + 1] = 255; // G
      png.data[idx + 2] = 255; // B
      png.data[idx + 3] = 255; // A
    } else {
      png.data[idx + 3] = 0;   // transparent
    }
  }
}

// Draw a simple "J" cutout (darker pixels)
const jCols = [13, 14];
for (let y = 3; y <= 15; y++) {
  for (const x of jCols) {
    const idx = (SIZE * y + x) * 4;
    png.data[idx]     = 0;
    png.data[idx + 1] = 0;
    png.data[idx + 2] = 0;
    png.data[idx + 3] = 255;
  }
}
// bottom hook of J
for (const [x, y] of [[12,15],[11,16],[10,16],[9,15],[8,14]]) {
  const idx = (SIZE * y + x) * 4;
  png.data[idx]     = 0;
  png.data[idx + 1] = 0;
  png.data[idx + 2] = 0;
  png.data[idx + 3] = 255;
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), PNG.sync.write(png));
console.log('✅ Tray icon created → assets/tray-icon.png');

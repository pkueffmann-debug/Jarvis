#!/usr/bin/env node
// Creates a Windows .ico file from PNG sources.
// Modern ICO format supports embedded PNG (Windows Vista+).

const fs   = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const OUT    = path.join(ASSETS, 'jarvis.ico');

// Use PNG-in-ICO format (Vista+): ICO header + directory + raw PNG bytes
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize    = 6;
  const dirEntrySize  = 16;
  const dirSize       = count * dirEntrySize;

  // Calculate offsets
  let dataOffset = headerSize + dirSize;
  const offsets = pngBuffers.map((buf) => {
    const off = dataOffset;
    dataOffset += buf.length;
    return off;
  });

  // Parse PNG dimensions
  function pngDims(buf) {
    // PNG: 8-byte sig + 4-byte chunk len + 4-byte "IHDR" + 4W + 4H
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { w, h };
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(dirSize);
  pngBuffers.forEach((buf, i) => {
    const { w, h } = pngDims(buf);
    const base = i * 16;
    dir.writeUInt8(w >= 256 ? 0 : w, base);      // width (0=256)
    dir.writeUInt8(h >= 256 ? 0 : h, base + 1);  // height
    dir.writeUInt8(0, base + 2);                  // color count (0=trucolor)
    dir.writeUInt8(0, base + 3);                  // reserved
    dir.writeUInt16LE(1, base + 4);               // planes
    dir.writeUInt16LE(32, base + 6);              // bits per pixel
    dir.writeUInt32LE(buf.length, base + 8);      // size of image data
    dir.writeUInt32LE(offsets[i], base + 12);     // offset of image data
  });

  return Buffer.concat([header, dir, ...pngBuffers]);
}

// Collect available PNG sources at multiple sizes
const sources = [
  path.join(ASSETS, 'icon.png'),        // full-res icon
  path.join(ASSETS, 'icon-256.png'),    // 256px
  path.join(ASSETS, 'tray-icon@2x.png'), // 64px tray
  path.join(ASSETS, 'tray-icon.png'),   // 32px tray
];

const available = sources.filter(fs.existsSync);
if (available.length === 0) {
  console.error('No PNG source found in assets/');
  process.exit(1);
}

// Deduplicate by file size to avoid embedding the same image twice
const seen = new Set();
const pngs = available
  .map(p => fs.readFileSync(p))
  .filter(buf => {
    const key = buf.length;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

const ico = buildIco(pngs);
fs.writeFileSync(OUT, ico);
console.log(`Created ${OUT} (${pngs.length} image(s), ${ico.length} bytes)`);

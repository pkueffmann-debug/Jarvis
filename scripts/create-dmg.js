#!/usr/bin/env node
// Creates a macOS DMG using hdiutil (built into macOS — no external tools needed)
'use strict';
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const ROOT    = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'dist', 'mac');         // electron-builder --dir output
const APP     = path.join(APP_DIR, 'JARVIS.app');
const OUT_DIR = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const DMG     = path.join(OUT_DIR, `JARVIS-${VERSION}.dmg`);
const TMP_DMG = path.join(os.tmpdir(), `jarvis_tmp_${Date.now()}.dmg`);
const VOLNAME = 'JARVIS';

if (!fs.existsSync(APP)) {
  console.error(`✗ App bundle not found: ${APP}`);
  console.error('  Run `npm run dist:dir` first.');
  process.exit(1);
}

run();

async function run() {
  console.log(`Building DMG for JARVIS ${VERSION}…\n`);

  // 1. Create a writable DMG from the app bundle
  console.log('1/4 Creating writable image…');
  // Auto-size: let hdiutil calculate required space from source
  exec(`hdiutil create \
    -srcfolder "${APP}" \
    -volname "${VOLNAME}" \
    -fs HFS+ \
    -format UDRW \
    "${TMP_DMG}"`);

  // 2. Mount it
  console.log('2/4 Mounting…');
  const attachOut = exec(`hdiutil attach -readwrite -noverify -noautoopen "${TMP_DMG}"`);
  const device = attachOut.split('\n').find(l => l.startsWith('/dev/'))?.split(/\s/)[0];
  if (!device) { fs.unlinkSync(TMP_DMG); throw new Error('Could not mount DMG'); }

  const mountPath = `/Volumes/${VOLNAME}`;

  try {
    // 3. Add Applications symlink
    exec(`ln -sf /Applications "${mountPath}/Applications"`);

    // Copy icon to volume for Finder
    const icns = path.join(ROOT, 'assets', 'jarvis.icns');
    if (fs.existsSync(icns)) {
      exec(`cp "${icns}" "${mountPath}/.VolumeIcon.icns" 2>/dev/null || true`);
      exec(`SetFile -a C "${mountPath}" 2>/dev/null || true`); // enable custom icon
    }

    // Set window layout via AppleScript
    exec(`osascript -e '
      tell application "Finder"
        tell disk "${VOLNAME}"
          open
          set current view of container window to icon view
          set toolbar visible of container window to false
          set statusbar visible of container window to false
          set bounds of container window to {400, 100, 940, 480}
          set icon size of icon view options of container window to 100
          set arrangement of icon view options of container window to not arranged
          set position of item "JARVIS.app" of container window to {150, 185}
          set position of item "Applications" of container window to {390, 185}
          close
          open
          update without registering applications
          delay 2
          close
        end tell
      end tell
    ' 2>/dev/null || true`);

  } finally {
    // Detach
    exec(`hdiutil detach "${device}" -force`);
  }

  // 4. Convert to compressed read-only DMG
  console.log('3/4 Compressing…');
  if (fs.existsSync(DMG)) fs.unlinkSync(DMG);
  exec(`hdiutil convert "${TMP_DMG}" -format UDZO -imagekey zlib-level=9 -o "${DMG}"`);
  fs.unlinkSync(TMP_DMG);

  const sizeMB = (fs.statSync(DMG).size / 1024 / 1024).toFixed(1);
  console.log(`4/4 Done!\n\n✓ ${path.basename(DMG)} (${sizeMB} MB)`);
  console.log(`   ${DMG}`);
}

function exec(cmd) {
  const result = spawnSync('sh', ['-c', cmd], { encoding: 'utf8' });
  if (result.status !== 0 && !cmd.includes('2>/dev/null')) {
    const err = (result.stderr || '').trim();
    if (err) console.warn('  warn:', err.slice(0, 200));
  }
  return (result.stdout || '').trim();
}

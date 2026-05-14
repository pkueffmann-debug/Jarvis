#!/usr/bin/env node
// Cross-platform wake-word binary builder.
// Replaces the legacy bash script — works on macOS, Windows, Linux.
// Output: resources/wakeword/{wakeword|wakeword.exe}
// Run:    npm run build:wakeword
'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const ROOT      = path.join(__dirname, '..');
const VENV      = path.join(ROOT, 'services', 'oww-venv');
const PY_SCRIPT = path.join(ROOT, 'services', 'wakeword-oww.py');
const OUT_DIR   = path.join(ROOT, 'resources');
const IS_WIN    = process.platform === 'win32';

const VENV_BIN_DIR = IS_WIN ? path.join(VENV, 'Scripts') : path.join(VENV, 'bin');
const VENV_PY      = path.join(VENV_BIN_DIR, IS_WIN ? 'python.exe'      : 'python');
const VENV_PIP     = path.join(VENV_BIN_DIR, IS_WIN ? 'pip.exe'         : 'pip');
const VENV_PYINST  = path.join(VENV_BIN_DIR, IS_WIN ? 'pyinstaller.exe' : 'pyinstaller');

console.log('=== JARVIS Wake Word Builder ===');

// ── 1. Find a usable Python 3.10/3.11/3.12 ──────────────────────────────────
function pythonExists(cmd) {
  try {
    const r = spawnSync(cmd, ['--version'], { stdio: 'pipe', shell: IS_WIN });
    return r.status === 0;
  } catch { return false; }
}

const PY_CANDIDATES = IS_WIN
  ? ['py -3.11', 'py -3.12', 'py -3.10', 'python3.11', 'python']
  : ['python3.11', 'python3.12', 'python3.10'];

let py = null;
for (const cmd of PY_CANDIDATES) {
  if (pythonExists(cmd)) { py = cmd; break; }
}
if (!py) {
  console.error('ERROR: Python 3.10/3.11/3.12 not found.');
  console.error('  macOS:   brew install python@3.11');
  console.error('  Windows: install from https://python.org and re-run.');
  process.exit(1);
}
console.log(`Using: ${py}`);

// ── 2. Create venv if missing ───────────────────────────────────────────────
if (!fs.existsSync(VENV_PY)) {
  console.log('Creating virtual environment...');
  // Note: `py -3.11 -m venv` requires the launcher to handle args; works on Windows.
  const r = spawnSync(py, ['-m', 'venv', VENV], { stdio: 'inherit', shell: IS_WIN });
  if (r.status !== 0) process.exit(r.status || 1);
}

// ── 3. Install dependencies ─────────────────────────────────────────────────
console.log('Installing dependencies (this may take a few minutes on first run)...');
function pip(args) {
  const r = spawnSync(VENV_PIP, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
pip(['install', '--quiet', '--upgrade', 'pip']);
pip(['install', '--quiet', 'openwakeword', 'pyaudio', 'pyinstaller']);

// ── 4. Build with PyInstaller ───────────────────────────────────────────────
console.log('Building standalone binary with PyInstaller...');
// Wipe any previous artifact so --onedir output is clean
fs.rmSync(path.join(OUT_DIR, 'wakeword'), { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const tmpWork = path.join(os.tmpdir(), 'jarvis-pyinstaller-work');
const tmpSpec = path.join(os.tmpdir(), 'jarvis-pyinstaller-spec');

const pyinstArgs = [
  '--onedir',
  '--name', 'wakeword',
  '--distpath', OUT_DIR,
  '--workpath', tmpWork,
  '--specpath', tmpSpec,
  '--noconfirm',
  '--clean',
  '--collect-data',     'openwakeword',
  '--collect-binaries', 'openwakeword',
  '--hidden-import',    'onnxruntime',
  PY_SCRIPT,
];

const r = spawnSync(VENV_PYINST, pyinstArgs, { stdio: 'inherit', cwd: ROOT });
if (r.status !== 0) process.exit(r.status || 1);

// ── 5. Verify ───────────────────────────────────────────────────────────────
const binaryName = IS_WIN ? 'wakeword.exe' : 'wakeword';
const binaryPath = path.join(OUT_DIR, 'wakeword', binaryName);
if (!fs.existsSync(binaryPath)) {
  console.error(`ERROR: Build failed — ${binaryPath} not found.`);
  process.exit(1);
}
if (!IS_WIN) fs.chmodSync(binaryPath, 0o755);

// Folder size
let totalBytes = 0;
function walk(p) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    for (const e of fs.readdirSync(p)) walk(path.join(p, e));
  } else { totalBytes += stat.size; }
}
walk(path.join(OUT_DIR, 'wakeword'));
const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);

console.log(`\n✓ Built: ${binaryPath} (bundle: ${sizeMB} MB)`);
console.log(`✓ Test:  ${binaryPath}    (should print READY:hey_jarvis)`);

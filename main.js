require('dotenv').config();

const { app, BrowserWindow, Tray, globalShortcut, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const claude = require('./services/claude');
const voice  = require('./services/voice');

let mainWindow = null;
let tray = null;
const isDev = process.env.NODE_ENV === 'development';

// Conversation history (in-memory; Phase 6 persists to SQLite)
const history = [];

// ── Window ─────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 600,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsFocused()) {
      mainWindow.hide();
    }
  });
}

// ── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAANElEQVR42mNk+M9Qz0BFwKimBqimBqimBqimBqimBqimBqimBqimBqimBqimBqimBqimBgAm8gQZkS1C6gAAAABJRU5ErkJggg=='
    );
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('JARVIS');
  tray.on('click', toggleWindow);
}

// ── Window positioning ─────────────────────────────────────────────────────

function getWindowPosition() {
  const { width: ww, height: wh } = mainWindow.getBounds();
  const tb = tray.getBounds();
  const { workArea } = screen.getDisplayNearestPoint({ x: tb.x, y: tb.y });

  let x = Math.round(tb.x + tb.width / 2 - ww / 2);
  let y = Math.round(tb.y + tb.height + 4);

  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - ww - 8));
  y = Math.max(workArea.y + 8, Math.min(y, workArea.y + workArea.height - wh - 8));

  return { x, y };
}

function showWindow() {
  const { x, y } = getWindowPosition();
  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  mainWindow.isVisible() ? mainWindow.hide() : showWindow();
}

// ── IPC: Chat ──────────────────────────────────────────────────────────────

ipcMain.on('close-window', () => mainWindow?.hide());

ipcMain.on('send-message', async (_event, userMessage) => {
  try {
    const fullText = await claude.streamChat(
      history,
      userMessage,
      (chunk) => mainWindow.webContents.send('jarvis-chunk', chunk)
    );

    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: fullText });
    if (history.length > 40) history.splice(0, 2);

    mainWindow.webContents.send('jarvis-done', { fullText });
  } catch (err) {
    console.error('[Claude]', err.message);
    mainWindow.webContents.send('jarvis-error', err.message);
  }
});

// ── IPC: Speech-to-Text (Whisper) ──────────────────────────────────────────

ipcMain.handle('transcribe-audio', async (_event, audioData, mimeType) => {
  const buffer = Buffer.from(audioData);
  return voice.transcribeAudio(buffer, mimeType || 'audio/webm');
});

// ── IPC: Text-to-Speech (ElevenLabs) ──────────────────────────────────────

ipcMain.handle('speak', async (_event, text) => {
  try {
    const buf = await voice.textToSpeech(text);
    return buf ? buf.toString('base64') : null;
  } catch (err) {
    console.error('[ElevenLabs]', err.message);
    return null;
  }
});

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+J', toggleWindow);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWindow) showWindow(); });
}

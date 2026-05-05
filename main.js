const { app, BrowserWindow, Tray, globalShortcut, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
const isDev = process.env.NODE_ENV === 'development';

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
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
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
    // Fallback: create a tiny white dot
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAANElEQVR42mNk+M9Qz0BFwKimBqimBqimBqimBqimBqimBqimBqimBqimBqimBqimBqimBgAm8gQZkS1C6gAAAABJRU5ErkJggg=='
    );
  }

  // macOS: resize to 16×16 template image
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('JARVIS');

  tray.on('click', toggleWindow);
}

// ── Window positioning ─────────────────────────────────────────────────────

function getWindowPosition() {
  const windowBounds = mainWindow.getBounds();
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  // Keep window within screen bounds
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - windowBounds.width - 8));
  y = Math.max(workArea.y + 8, Math.min(y, workArea.y + workArea.height - windowBounds.height - 8));

  return { x, y };
}

function showWindow() {
  const position = getWindowPosition();
  mainWindow.setPosition(position.x, position.y, false);
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

ipcMain.on('close-window', () => mainWindow && mainWindow.hide());

ipcMain.handle('send-message', async (_event, _message) => {
  // Phase 1 placeholder — replaced in Phase 2 with Claude API
  return { content: 'Phase 1: UI Demo läuft. KI-Backend kommt in Phase 2 🚀' };
});

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  createWindow();
  createTray();

  globalShortcut.register('CommandOrControl+Shift+J', toggleWindow);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// Prevent second instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) showWindow();
  });
}

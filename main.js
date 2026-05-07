require('dotenv').config();

const { app, BrowserWindow, Tray, globalShortcut, ipcMain, nativeImage, screen, shell, clipboard, Notification } = require('electron');
const path     = require('path');
const claude   = require('./services/claude');
const voice    = require('./services/voice');
const gmail    = require('./services/gmail');
const calendar = require('./services/calendar');
const memory   = require('./services/memory');
const files    = require('./services/files');
const system   = require('./services/system');

let mainWindow = null;
let tray       = null;
const isDev    = process.env.NODE_ENV === 'development';

// Conversation history — persisted across sessions
const history = memory.loadHistory();
gmail.setOpenUrl((url) => shell.openExternal(url));

// ── Window ─────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380, height: 600,
    show: false, frame: false, resizable: false,
    transparent: true, alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });

  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else       mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsFocused()) mainWindow.hide();
  });
}

// ── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAANElEQVR42mNk+M9Qz0BFwKimBqimBqimBqimBqimBqimBqimBqimBqimBqimBqimBqimBgAm8gQZkS1C6gAAAABJRU5ErkJggg=='
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('JARVIS');
  tray.on('click', toggleWindow);
}

function getWindowPosition() {
  const { width:ww, height:wh } = mainWindow.getBounds();
  const tb = tray.getBounds();
  const { workArea } = screen.getDisplayNearestPoint({ x:tb.x, y:tb.y });
  let x = Math.round(tb.x + tb.width/2 - ww/2);
  let y = Math.round(tb.y + tb.height + 4);
  x = Math.max(workArea.x+8, Math.min(x, workArea.x+workArea.width-ww-8));
  y = Math.max(workArea.y+8, Math.min(y, workArea.y+workArea.height-wh-8));
  return { x, y };
}

function showWindow()   { const p = getWindowPosition(); mainWindow.setPosition(p.x, p.y, false); mainWindow.show(); mainWindow.focus(); }
function toggleWindow() { mainWindow.isVisible() ? mainWindow.hide() : showWindow(); }

// ── Tool executor ──────────────────────────────────────────────────────────

async function toolExecutor(name, input) {
  switch (name) {
    // Gmail
    case 'get_emails':           return gmail.getEmails(input);
    case 'get_email_content':    return gmail.getEmailContent(input);
    case 'send_email':           return gmail.sendEmail(input);
    // Calendar
    case 'get_calendar_events':  return calendar.getEvents(input);
    case 'create_calendar_event':return calendar.createEvent(input);
    case 'delete_calendar_event':return calendar.deleteEvent(input);
    // Memory
    case 'remember_fact':        return memory.rememberFact(input);
    case 'recall_facts':         return memory.recallFacts(input);
    case 'forget_fact':          return memory.forgetFact(input);
    // Files
    case 'search_files':         return files.searchFiles(input);
    case 'open_file':            await shell.openPath(input.path); return { opened: input.path };
    // System
    case 'get_system_info':      return system.getSystemInfo();
    case 'get_clipboard':        return { content: clipboard.readText() };
    case 'set_clipboard':        clipboard.writeText(input.text); return { done: true };
    case 'send_notification':
      new Notification({ title: input.title || 'JARVIS', body: input.body }).show();
      return { sent: true };
    default: return { error: `Unbekanntes Tool: ${name}` };
  }
}

// ── IPC: Chat ──────────────────────────────────────────────────────────────

ipcMain.on('close-window', () => mainWindow?.hide());

ipcMain.on('send-message', async (_e, userMsg) => {
  try {
    const googleConnected = gmail.isConfigured() && gmail.isAuthenticated();

    const fullText = await claude.streamChat(history, userMsg, {
      onChunk:      (c) => mainWindow.webContents.send('jarvis-chunk', c),
      onToolStatus: (s) => mainWindow.webContents.send('jarvis-tool-status', s),
      onToolUse:    googleConnected ? toolExecutor : toolExecutorLimited,
    });

    memory.saveHistory(history);
    mainWindow.webContents.send('jarvis-done', { fullText });
  } catch (err) {
    console.error('[Claude]', err.message);
    mainWindow.webContents.send('jarvis-error', err.message);
  }
});

// Tool executor without Google (memory, files, system still work)
async function toolExecutorLimited(name, input) {
  const googleTools = ['get_emails','get_email_content','send_email','get_calendar_events','create_calendar_event','delete_calendar_event'];
  if (googleTools.includes(name)) return { error: 'Google nicht verbunden. Bitte in den Einstellungen verbinden.' };
  return toolExecutor(name, input);
}

// ── IPC: Google Auth ───────────────────────────────────────────────────────

ipcMain.handle('google-status', () => ({
  configured:    gmail.isConfigured(),
  authenticated: gmail.isAuthenticated(),
}));

ipcMain.handle('google-connect', async () => {
  try   { await gmail.getAuth(); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('google-revoke', () => { gmail.revokeAuth(); return { success: true }; });

// ── IPC: Memory ────────────────────────────────────────────────────────────

ipcMain.handle('memory-stats',   () => memory.getStats());
ipcMain.handle('memory-clear',   () => { memory.clearMemory(); return { done: true }; });
ipcMain.handle('history-clear',  () => { memory.clearHistory(); history.length = 0; return { done: true }; });

// ── IPC: Config status (no keys exposed) ──────────────────────────────────

ipcMain.handle('config-status', () => ({
  anthropic:  !!process.env.ANTHROPIC_API_KEY,
  openai:     !!process.env.OPENAI_API_KEY,
  elevenlabs: !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID,
  google:     gmail.isConfigured(),
}));

// ── IPC: STT / TTS ────────────────────────────────────────────────────────

ipcMain.handle('transcribe-audio', async (_e, buf, mime) =>
  voice.transcribeAudio(Buffer.from(buf), mime || 'audio/webm')
);

ipcMain.handle('speak', async (_e, text) => {
  try   { const b = await voice.textToSpeech(text); return b ? b.toString('base64') : null; }
  catch (e) { console.error('[TTS]', e.message); return null; }
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
if (!gotLock) app.quit();
else app.on('second-instance', () => { if (mainWindow) showWindow(); });

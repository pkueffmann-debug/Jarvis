require('dotenv').config();

const {
  app, BrowserWindow, Tray, globalShortcut, ipcMain,
  nativeImage, screen, shell, clipboard, Notification,
} = require('electron');
const path      = require('path');
const fs        = require('fs');

const configSvc  = require('./services/config');
const claude     = require('./services/claude');
const voice      = require('./services/voice');
const wakeWord   = require('./services/wakeword');
const gmail      = require('./services/gmail');
const calendar   = require('./services/calendar');
const memory     = require('./services/memory');
const files      = require('./services/files');
const sysInfo    = require('./services/system');
const osCtrl     = require('./services/os-control');
const screen_    = require('./services/screen');
const clipHist   = require('./services/clipboard-history');
const focus      = require('./services/focus');
const proactive  = require('./services/proactive');
const notifs     = require('./services/notifications');
const perms      = require('./services/permissions');
const updater    = require('./services/updater');
// New integrations
const imessage   = require('./services/imessage');
const contacts   = require('./services/contacts');
const notes      = require('./services/notes');
const reminders  = require('./services/reminders');
const photos     = require('./services/photos');
const safari     = require('./services/safari');
const notion     = require('./services/notion');
const obsidian   = require('./services/obsidian');
const weather    = require('./services/weather');
const search     = require('./services/search');
const newsService = require('./services/news');
const stocks     = require('./services/stocks');
const crypto     = require('./services/crypto');
const wikipedia  = require('./services/wikipedia');

let mainWindow      = null;
let onboardingWindow = null;
let tray            = null;
const isDev    = process.env.NODE_ENV === 'development';
const history  = memory.loadHistory();

gmail.setOpenUrl((url) => shell.openExternal(url));

// ── Clipboard monitor ──────────────────────────────────────────────────────
setInterval(() => {
  try { clipHist.update(clipboard.readText()); } catch {}
}, 1000);

// ── Confirmation gate ──────────────────────────────────────────────────────
// For dangerous operations, we pause tool execution and ask the user in-chat.

let _confirmResolve = null;
let _confirmReject  = null;

function requestConfirmation(message, detail) {
  return new Promise((resolve, reject) => {
    _confirmResolve = resolve;
    _confirmReject  = reject;
    mainWindow.webContents.send('jarvis-confirm', { message, detail });
  });
}

ipcMain.on('confirm-action', (_e, confirmed) => {
  if (confirmed)  _confirmResolve?.();
  else            _confirmReject?.(new Error('Vom User abgebrochen.'));
  _confirmResolve = _confirmReject = null;
});

// ── Window ─────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380, height: 600,
    show: false, frame: false, resizable: false,
    transparent: true, alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    icon: path.join(__dirname, 'assets', 'jarvis.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else       mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsFocused()) mainWindow.hide();
  });
}

// ── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  // Use @2x icon for retina displays, fall back to 1x
  const icon2x = path.join(__dirname, 'assets', 'tray-icon@2x.png');
  const icon1x = path.join(__dirname, 'assets', 'tray-icon.png');
  const iconPath = fs.existsSync(icon2x) ? icon2x : icon1x;

  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(icon1x);
  }
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAAa/KRFAAAAGklEQVR42mNk+A8AAwAB/gD3qQAAAABJRU5ErkJggg=='
    );
  }

  // Retina: set the image as template with correct DPI
  if (fs.existsSync(icon2x)) {
    icon = nativeImage.createFromPath(icon1x);
    icon.addRepresentation({ scaleFactor: 2.0, dataURL: nativeImage.createFromPath(icon2x).toDataURL() });
  }

  icon.setTemplateImage(true); // makes it adapt to light/dark menu bar
  tray = new Tray(icon);
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
  const g = gmail.isConfigured() && gmail.isAuthenticated();

  switch (name) {
    // Gmail
    case 'get_emails':            return g ? gmail.getEmails(input)         : noGoogle();
    case 'get_email_content':     return g ? gmail.getEmailContent(input)    : noGoogle();
    case 'send_email':            return g ? gmail.sendEmail(input)          : noGoogle();
    // Calendar
    case 'get_calendar_events':   return g ? calendar.getEvents(input)       : noGoogle();
    case 'create_calendar_event': return g ? calendar.createEvent(input)     : noGoogle();
    case 'delete_calendar_event': return g ? calendar.deleteEvent(input)     : noGoogle();
    // Memory
    case 'remember_fact':         return memory.rememberFact(input);
    case 'recall_facts':          return memory.recallFacts(input);
    case 'forget_fact':           return memory.forgetFact(input);
    // Files
    case 'search_files':          return files.searchFiles(input);
    case 'open_file':             await shell.openPath(input.path); return { opened: input.path };
    // Sys info
    case 'get_system_info':       return sysInfo.getSystemInfo();
    case 'get_clipboard':         return { content: clipboard.readText() };
    case 'set_clipboard':         clipboard.writeText(input.text); return { done: true };
    case 'send_notification': {
      const title = input.title || 'JARVIS';
      new Notification({ title, body: input.body }).show();
      notifs.record(title, input.body);
      return { sent: true };
    }
    // ── OS Control ────────────────────────────────────────────────────────
    case 'open_app':              return osCtrl.openApp(input);
    case 'close_app':             return osCtrl.closeApp(input);
    case 'list_running_apps':     return osCtrl.listRunningApps();
    case 'switch_to_app':         return osCtrl.switchToApp(input);
    case 'open_url':              return osCtrl.openUrl(input);
    case 'google_search':         return osCtrl.googleSearch(input);
    case 'send_whatsapp':         return osCtrl.sendWhatsApp(input);
    case 'facetime_call':         return osCtrl.facetimeCall(input);
    case 'set_volume':            return osCtrl.setVolume(input);
    case 'set_brightness':        return osCtrl.setBrightness(input);
    case 'take_screenshot':       return osCtrl.takeScreenshot(input);
    case 'lock_screen':           return osCtrl.lockScreen();
    case 'system_sleep':          return osCtrl.systemSleep();

    // ── Screen Awareness ──────────────────────────────────────────────────
    case 'analyze_screen':        return screen_.analyzeScreen(input.question);

    // ── Clipboard Manager ─────────────────────────────────────────────────
    case 'get_clipboard_history': return { history: clipHist.getHistory(input.n || 10) };
    case 'translate_clipboard': {
      const text = clipboard.readText();
      if (!text) return { error: 'Zwischenablage ist leer.' };
      return { original: text, targetLanguage: input.targetLanguage, note: 'JARVIS übersetzt jetzt direkt im Chat — kein extra Tool-Call nötig.' };
    }
    case 'improve_clipboard': {
      const text = clipboard.readText();
      if (!text) return { error: 'Zwischenablage ist leer.' };
      return { original: text, instruction: input.instruction || 'verbessern', note: 'JARVIS verbessert den Text direkt im Chat.' };
    }

    // ── Focus Mode ────────────────────────────────────────────────────────
    case 'start_focus_mode':      return focus.startFocus(input);
    case 'end_focus_mode':        return focus.endFocus();
    case 'get_focus_status':      return focus.getStatus();

    // ── Smart Notifications ───────────────────────────────────────────────
    case 'get_notification_history': return notifs.getHistory(input);

    // ── iMessage ─────────────────────────────────────────────────────────
    case 'get_imessages':  return imessage.getMessages(input);
    case 'send_imessage':  return imessage.sendMessage(input);

    // ── Contacts ─────────────────────────────────────────────────────────
    case 'search_contacts': return contacts.searchContacts(input);

    // ── Apple Notes ──────────────────────────────────────────────────────
    case 'get_notes':   return notes.getNotes(input);
    case 'create_note': return notes.createNote(input);

    // ── Reminders ────────────────────────────────────────────────────────
    case 'get_reminders':     return reminders.getReminders(input);
    case 'create_reminder':   return reminders.createReminder(input);
    case 'complete_reminder': return reminders.completeReminder(input);

    // ── Photos ───────────────────────────────────────────────────────────
    case 'search_photos': return photos.searchPhotos(input);

    // ── Safari ───────────────────────────────────────────────────────────
    case 'get_safari_tabs':       return safari.getSafariTabs();
    case 'search_safari_history': return safari.searchSafariHistory(input);

    // ── Notion ───────────────────────────────────────────────────────────
    case 'notion_search':      return notion.searchNotion(input);
    case 'notion_create_page': return notion.createPage(input);

    // ── Obsidian ─────────────────────────────────────────────────────────
    case 'obsidian_search':      return obsidian.searchNotes(input);
    case 'obsidian_get_note':    return obsidian.getNote(input);
    case 'obsidian_create_note': return obsidian.createNote(input);

    // ── Weather ──────────────────────────────────────────────────────────
    case 'get_weather': return weather.getWeather(input);

    // ── Web Search ───────────────────────────────────────────────────────
    case 'web_search': return search.webSearch(input);

    // ── News ─────────────────────────────────────────────────────────────
    case 'get_news': return newsService.getNews(input);

    // ── Stocks ───────────────────────────────────────────────────────────
    case 'get_stock': return stocks.getStock(input);

    // ── Crypto ───────────────────────────────────────────────────────────
    case 'get_crypto_price': return crypto.getCryptoPrice(input);
    case 'get_top_crypto':   return crypto.getTopCrypto(input);

    // ── Wikipedia ────────────────────────────────────────────────────────
    case 'wikipedia_search':  return wikipedia.searchWikipedia(input);
    case 'wikipedia_summary': return wikipedia.getWikipediaSummary(input);

    case 'system_restart': {
      await requestConfirmation('Mac neu starten?', 'Alle ungespeicherten Daten gehen verloren.');
      return osCtrl.systemRestart();
    }
    case 'system_shutdown': {
      const mins = input.minutes || 0;
      await requestConfirmation(
        `Mac ${mins ? `in ${mins} Minuten` : 'jetzt'} herunterfahren?`,
        'Alle ungespeicherten Daten gehen verloren.'
      );
      return osCtrl.systemShutdown(input);
    }
    case 'execute_shell': {
      const risk = osCtrl.classifyCommand(input.command);
      if (risk === 'dangerous' || risk === 'unknown') {
        await requestConfirmation(
          risk === 'dangerous' ? '⚠️ Gefährlicher Befehl' : 'Shell-Befehl ausführen?',
          input.command
        );
      }
      return osCtrl.executeShell(input);
    }

    default: return { error: `Unbekanntes Tool: ${name}` };
  }
}

function noGoogle() { return { error: 'Google nicht verbunden. Bitte in den Einstellungen verbinden.' }; }

// ── IPC: Chat ──────────────────────────────────────────────────────────────

ipcMain.on('close-window', () => mainWindow?.hide());

ipcMain.on('send-message', async (_e, userMsg) => {
  try {
    const fullText = await claude.streamChat(history, userMsg, {
      onChunk:      (c) => mainWindow.webContents.send('jarvis-chunk', c),
      onToolStatus: (s) => mainWindow.webContents.send('jarvis-tool-status', s),
      onToolUse:    toolExecutor,
    });
    memory.saveHistory(history);
    mainWindow.webContents.send('jarvis-done', { fullText });
  } catch (err) {
    console.error('[Claude]', err.message);
    mainWindow.webContents.send('jarvis-error', err.message);
  }
});

// ── IPC: Google ────────────────────────────────────────────────────────────
ipcMain.handle('google-status',  () => ({ configured: gmail.isConfigured(), authenticated: gmail.isAuthenticated() }));
ipcMain.handle('google-connect', async () => { try { await gmail.getAuth(); return { success:true }; } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('google-revoke',  () => { gmail.revokeAuth(); return { success:true }; });

// ── IPC: Memory ────────────────────────────────────────────────────────────
ipcMain.handle('memory-stats',  () => memory.getStats());
ipcMain.handle('memory-clear',  () => { memory.clearMemory(); return { done:true }; });
ipcMain.handle('history-clear', () => { memory.clearHistory(); history.length = 0; return { done:true }; });

// ── IPC: Wake Word ─────────────────────────────────────────────────────────

ipcMain.handle('wake-word-start', () => {
  const key = configSvc.get('PICOVOICE_ACCESS_KEY') || process.env.PICOVOICE_ACCESS_KEY;
  if (!key) return { ok: false, error: 'PICOVOICE_ACCESS_KEY fehlt — bitte in Einstellungen eintragen.' };

  const result = wakeWord.init(key, () => {
    // Wake word "JARVIS" detected → show window + notify renderer
    showWindow();
    mainWindow?.webContents.send('wake-word-detected');
  });
  return result;
});

ipcMain.handle('wake-word-stop',   () => { wakeWord.stop(); return { ok: true }; });
ipcMain.handle('wake-word-status', () => ({ active: wakeWord.isActive(), frameLength: wakeWord.frameLength(), sampleRate: wakeWord.sampleRate() }));

// Audio frames arrive as plain arrays from the renderer (IPC serialises Int16Array → Array)
ipcMain.on('wake-word-frame', (_e, samples) => wakeWord.processFrame(samples));

// ── IPC: Auto-Updater ─────────────────────────────────────────────────────
ipcMain.handle('update-install', () => { updater.installNow(); return { ok: true }; });

// ── IPC: Config status ─────────────────────────────────────────────────────
ipcMain.handle('config-status', () => ({
  anthropic:  !!process.env.ANTHROPIC_API_KEY,
  openai:     !!process.env.OPENAI_API_KEY,
  elevenlabs: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
  google:     gmail.isConfigured(),
  notion:     notion.isConfigured(),
  obsidian:   obsidian.isConfigured(),
}));

// ── IPC: Config get / set ──────────────────────────────────────────────────
ipcMain.handle('config-get', (_e, key) => configSvc.get(key));
ipcMain.handle('config-set', (_e, key, value) => {
  configSvc.set(key, value);
  // Re-init claude client so new key takes effect immediately
  if (key === 'ANTHROPIC_API_KEY') {
    try { claude.reinit(); } catch {}
  }
  return { ok: true };
});

// ── IPC: Permissions (onboarding) ─────────────────────────────────────────
ipcMain.handle('perm-check',            ()         => perms.getAllStatuses());
ipcMain.handle('perm-request-mic',      ()         => perms.requestMicrophone());
ipcMain.handle('perm-open-settings',    (_e, type) => { perms.openSettings(type); return { opened: type }; });
ipcMain.handle('perm-complete',         ()         => {
  perms.markSetupComplete();
  onboardingWindow?.close();
  onboardingWindow = null;
  if (app.dock) app.dock.hide();
  showWindow();
  return { done: true };
});

// ── IPC: STT / TTS ────────────────────────────────────────────────────────
ipcMain.handle('transcribe-audio', async (_e, buf, mime) => voice.transcribeAudio(Buffer.from(buf), mime||'audio/webm'));
ipcMain.handle('speak', async (_e, text) => {
  try { const b = await voice.textToSpeech(text); return b ? b.toString('base64') : null; }
  catch(e) { console.error('[TTS]', e.message); return null; }
});

// ── App lifecycle ──────────────────────────────────────────────────────────

// PNG is more reliable than .icns for app.dock.setIcon() in dev mode
const DOCK_ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const ICNS_PATH      = path.join(__dirname, 'assets', 'jarvis.icns');

function setDockIcon() {
  if (!app.dock) return;
  const p = fs.existsSync(DOCK_ICON_PATH) ? DOCK_ICON_PATH : ICNS_PATH;
  if (fs.existsSync(p)) {
    app.dock.setIcon(nativeImage.createFromPath(p));
  }
}

function createOnboardingWindow() {
  onboardingWindow = new BrowserWindow({
    width: 560, height: 680,
    center: true, resizable: false,
    frame: false, transparent: false,
    titleBarStyle: 'hidden',
    vibrancy: 'under-window',
    webPreferences: {
      preload: path.join(__dirname, 'onboarding', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  // Set icon and show dock BEFORE loading the page so icon is visible immediately
  setDockIcon();
  if (app.dock) app.dock.show();
  onboardingWindow.loadFile(path.join(__dirname, 'onboarding', 'index.html'));
  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
    if (!isDev) app.dock?.hide();
  });
}

app.whenReady().then(() => {
  // Load persisted API keys into process.env (must run after app is ready)
  configSvc.applyToEnv();

  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+J', toggleWindow);

  if (perms.isFirstLaunch()) {
    // First launch: show onboarding with dock visible
    createOnboardingWindow();
  } else if (isDev) {
    // Dev mode: keep dock visible so icon is testable
    setDockIcon();
    if (app.dock) app.dock.show();
  } else {
    // Normal tray-only mode: hide dock
    if (app.dock) app.dock.hide();
  }

  // Proaktiver Modus — startet Cron-Jobs nach Window-Erstellung
  app.on('browser-window-created', () => {
    if (!proactive._initialized) {
      proactive._initialized = true;
      proactive.init({ mainWindow, gmail, calendar, notifyRecord: notifs.record });
    }
  });
  // Fallback: direkt initialisieren sobald Fenster existiert
  setTimeout(() => {
    if (mainWindow && !proactive._initialized) {
      proactive._initialized = true;
      proactive.init({ mainWindow, gmail, calendar, notifyRecord: notifs.record });
    }
    // Start auto-updater after app is fully ready
    updater.init(mainWindow);
  }, 2000);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// In dev mode skip single-instance lock so `npm run dev` always works
// even when a previous dev session left a ghost process behind.
if (!isDev) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) app.quit();
  else app.on('second-instance', () => { if (mainWindow) showWindow(); });
}

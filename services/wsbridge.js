// wsbridge.js — local-only WebSocket bridge between the JARVIS browser
// app (daylens.dev/brain) and this Electron app.
//
// The browser cannot directly run shell commands or open Mac apps. With
// this bridge:
//   browser  ──ws://localhost:7777──>  Electron  ──>  macOS
//
// Security:
//   - Server binds to 127.0.0.1 (loopback only) so nothing outside the
//     machine can connect.
//   - Action names go through a whitelist; unknown names are rejected.
//   - Shell commands are classified via os-control.classifyCommand;
//     anything tagged "dangerous" is refused outright (no UI prompt
//     because the bridge has no chrome to ask in).
//   - Caps on payload size, command length, file path.
//
// Wire format:
//   client → server : { id: "...", action: "open_app", payload: { name: "Spotify" } }
//   server → client : { id: "...", ok: true,  result: {...} }
//                     { id: "...", ok: false, error: "..." }
//   server → client : { type: "hello", version: 1, actions: [...] }

const { WebSocketServer } = require('ws');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { clipboard } = require('electron');

const osCtl       = require('./os-control');
const screenSvc   = require('./screen');

const PORT = 7777;
const HOST = '127.0.0.1';

const MAX_SHELL_LEN = 500;
const MAX_PAYLOAD   = 32 * 1024;  // 32 KB inbound limit

let server = null;
const clients = new Set();

// ── Action handlers ────────────────────────────────────────────────────
// Each handler returns either a plain object (resolved to { ok: true, result })
// or throws (resolved to { ok: false, error }).

const handlers = {
  // open_app({ name }) — open a macOS app by display name.
  async open_app({ name }) {
    if (typeof name !== 'string' || !name.trim()) throw new Error('name required');
    return await osCtl.openApp({ appName: name.trim() });
  },

  // open_url({ url }) — open URL in user's default browser.
  async open_url({ url }) {
    if (typeof url !== 'string' || !url.trim()) throw new Error('url required');
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
    return await new Promise((resolve, reject) => {
      execFile('open', [u], (err) => err ? reject(err) : resolve({ opened: u }));
    });
  },

  // open_file({ path }) — open a local file with the default app.
  async open_file({ path: p }) {
    if (typeof p !== 'string' || !p.trim()) throw new Error('path required');
    const abs = path.resolve(p.startsWith('~') ? p.replace('~', os.homedir()) : p);
    // Sanity: only allow paths under the user's home directory.
    if (!abs.startsWith(os.homedir())) throw new Error('path outside home directory');
    if (!fs.existsSync(abs)) throw new Error('file not found');
    return await new Promise((resolve, reject) => {
      execFile('open', [abs], (err) => err ? reject(err) : resolve({ opened: abs }));
    });
  },

  // run_shell({ command }) — execute a shell command. Dangerous commands
  // are refused; everything else runs with a 10 s timeout.
  async run_shell({ command }) {
    if (typeof command !== 'string' || !command.trim()) throw new Error('command required');
    if (command.length > MAX_SHELL_LEN) throw new Error('command too long');
    const klass = osCtl.classifyCommand?.(command);
    if (klass === 'dangerous') {
      throw new Error('command refused: dangerous (use the JARVIS chat UI to confirm)');
    }
    const r = await osCtl.executeShell({ command });
    return r;
  },

  // take_screenshot() — capture full screen, return PNG as base64.
  async take_screenshot() {
    const result = await screenSvc.captureScreen();
    // screenSvc returns { path, dataUrl } in most builds; fall back to
    // reading the file ourselves if only path is returned.
    if (result?.dataUrl) {
      // Strip "data:image/png;base64," prefix to return raw b64.
      const m = String(result.dataUrl).match(/^data:[^;]+;base64,(.+)$/);
      return { png_base64: m ? m[1] : result.dataUrl };
    }
    if (result?.path && fs.existsSync(result.path)) {
      const buf = fs.readFileSync(result.path);
      return { png_base64: buf.toString('base64') };
    }
    throw new Error('screenshot capture returned no data');
  },

  // get_clipboard() — read current clipboard contents (text only).
  async get_clipboard() {
    return { text: clipboard.readText() || '' };
  },

  // set_clipboard({ text }) — write text to the clipboard.
  async set_clipboard({ text }) {
    if (typeof text !== 'string') throw new Error('text required');
    clipboard.writeText(text);
    return { ok: true, bytes: text.length };
  },

  // ping() — health-check the bridge.
  async ping() {
    return { pong: true, version: 1, pid: process.pid };
  },
};

function listActions() {
  return Object.keys(handlers);
}

// ── Server lifecycle ───────────────────────────────────────────────────
function start() {
  if (server) return server;
  try {
    server = new WebSocketServer({ host: HOST, port: PORT });
  } catch (e) {
    console.error('[wsbridge] failed to start:', e?.message);
    return null;
  }

  server.on('listening', () => {
    console.log(`[wsbridge] listening on ws://${HOST}:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[wsbridge] server error:', err?.message);
  });

  server.on('connection', (ws, req) => {
    // Additional belt-and-suspenders: refuse anything that isn't loopback.
    const ip = req.socket?.remoteAddress || '';
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      console.warn('[wsbridge] refusing non-loopback connection:', ip);
      ws.close(1008, 'localhost-only');
      return;
    }
    clients.add(ws);
    console.log('[wsbridge] client connected, total:', clients.size);

    // Greet so the client knows we're alive + advertises our action surface.
    safeSend(ws, { type: 'hello', version: 1, actions: listActions() });

    ws.on('message', async (raw) => {
      if (raw.length > MAX_PAYLOAD) {
        safeSend(ws, { id: null, ok: false, error: 'payload too large' });
        return;
      }
      let msg;
      try { msg = JSON.parse(raw.toString('utf8')); } catch {
        safeSend(ws, { id: null, ok: false, error: 'invalid json' });
        return;
      }
      const { id = null, action, payload } = msg || {};
      if (typeof action !== 'string' || !handlers[action]) {
        safeSend(ws, { id, ok: false, error: `unknown action: ${action}` });
        return;
      }
      try {
        const result = await handlers[action](payload || {});
        safeSend(ws, { id, ok: true, result });
      } catch (e) {
        console.warn(`[wsbridge] action ${action} failed:`, e?.message);
        safeSend(ws, { id, ok: false, error: e?.message || String(e) });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[wsbridge] client disconnected, total:', clients.size);
    });

    ws.on('error', (err) => {
      console.warn('[wsbridge] client error:', err?.message);
    });
  });

  return server;
}

function stop() {
  if (!server) return;
  for (const ws of clients) {
    try { ws.close(1001, 'server shutting down'); } catch {}
  }
  clients.clear();
  try { server.close(); } catch {}
  server = null;
}

function safeSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch {}
}

module.exports = { start, stop, listActions, PORT, HOST };

if (process.platform !== 'darwin') {
  module.exports = { getSafariTabs: () => ({ error: 'Safari ist nur auf macOS verfügbar.' }), searchSafariHistory: () => ({ error: 'Safari ist nur auf macOS verfügbar.' }), openSafariUrl: () => ({ error: 'Safari ist nur auf macOS verfügbar.' }) };
  return;
}
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const execP = promisify(exec);

async function runAppleScript(script) {
  const tmp = `/tmp/jarvis_as_${Date.now()}.scpt`;
  fs.writeFileSync(tmp, script, 'utf8');
  try {
    const { stdout } = await execP(`osascript "${tmp}"`);
    return stdout.trim();
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

async function getSafariTabs() {
  const script = `
tell application "Safari"
  set output to ""
  repeat with w in windows
    repeat with t in tabs of w
      set tabName to name of t
      set tabURL to URL of t
      set output to output & tabName & "||" & tabURL & "\\n---\\n"
    end repeat
  end repeat
  return output
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw) return { tabs: [] };
    const tabs = raw.split('\n---\n').filter(Boolean).map(line => {
      const [title, url] = line.split('||');
      return { title: title?.trim(), url: url?.trim() };
    });
    return { tabs, count: tabs.length };
  } catch (e) {
    return { error: 'Safari Zugriff fehlgeschlagen. Automation-Berechtigung prüfen.' };
  }
}

async function searchSafariHistory({ query = '', limit = 20 }) {
  const limitN = Math.min(Number(limit) || 20, 100);
  const q = query.replace(/'/g, "'\"'\"'");

  // Safari history is in SQLite — use shell query
  const dbPath = `${process.env.HOME}/Library/Safari/History.db`;
  try {
    const { stdout } = await execP(
      `sqlite3 "${dbPath}" "SELECT title, url, visit_time FROM history_visits INNER JOIN history_items ON history_items.id = history_visits.history_item WHERE title LIKE '%${q.replace(/'/g, "''")}%' OR url LIKE '%${q.replace(/'/g, "''")}%' ORDER BY visit_time DESC LIMIT ${limitN}"`
    );
    if (!stdout.trim()) return { history: [] };
    const history = stdout.trim().split('\n').map(line => {
      const parts = line.split('|');
      return { title: parts[0], url: parts[1], visited: parts[2] };
    });
    return { history, count: history.length };
  } catch {
    // Fallback: try AppleScript (no history access via AS, return error)
    return { error: 'Safari History Zugriff fehlgeschlagen. Full Disk Access in Systemeinstellungen benötigt.' };
  }
}

async function openSafariUrl({ url }) {
  const safeUrl = url.replace(/"/g, '\\"');
  const script = `
tell application "Safari"
  activate
  open location "${safeUrl}"
end tell`;
  try {
    await runAppleScript(script);
    return { opened: true, url };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { getSafariTabs, searchSafariHistory, openSafariUrl };

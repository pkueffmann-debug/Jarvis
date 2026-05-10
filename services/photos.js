if (process.platform !== 'darwin') {
  module.exports = { searchPhotos: () => ({ error: 'Photos ist nur auf macOS verfügbar.' }), openPhotos: () => ({ error: 'Photos ist nur auf macOS verfügbar.' }) };
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

async function searchPhotos({ query = '', limit = 10 }) {
  const limitN = Math.min(Number(limit) || 10, 50);
  const q = query.replace(/"/g, '\\"');

  const script = `
tell application "Photos"
  set output to ""
  set resultCount to 0
  set allMedia to every media item
  repeat with m in allMedia
    if resultCount >= ${limitN} then exit repeat
    set mName to filename of m
    set mDate to date of m as string
    set mDesc to ""
    try
      set mDesc to description of m
      if mDesc is missing value then set mDesc to ""
    end try
    if ${q ? `mName contains "${q}" or mDesc contains "${q}"` : 'true'} then
      set output to output & mName & "||" & mDate & "||" & mDesc & "\\n---\\n"
      set resultCount to resultCount + 1
    end if
  end repeat
  return output
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw) return { photos: [], count: 0 };
    const photos = raw.split('\n---\n').filter(Boolean).map(line => {
      const [filename, date, description] = line.split('||');
      return { filename: filename?.trim(), date: date?.trim(), description: description?.trim() || '' };
    });
    return { photos, count: photos.length };
  } catch (e) {
    return { error: 'Photos Zugriff fehlgeschlagen. Bitte Berechtigung in Systemeinstellungen prüfen.' };
  }
}

async function openPhotos() {
  try {
    await execP('open -a Photos');
    return { opened: true };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { searchPhotos, openPhotos };

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

async function getNotes({ query = '', folder = '', limit = 10 }) {
  const limitN = Math.min(Number(limit) || 10, 30);
  const q = query.replace(/"/g, '\\"');
  const f = folder.replace(/"/g, '\\"');

  const script = `
tell application "Notes"
  set output to ""
  set resultCount to 0
  ${f ? `set theFolder to folder "${f}"
  set allNotes to notes of theFolder` : 'set allNotes to every note'}
  repeat with n in allNotes
    if resultCount >= ${limitN} then exit repeat
    set noteTitle to name of n
    set noteBody to plaintext of n
    set noteDate to modification date of n as string
    if ${q ? `noteTitle contains "${q}" or noteBody contains "${q}"` : 'true'} then
      set bodyPreview to (characters 1 thru (min of 300 and length of noteBody) of noteBody) as string
      set output to output & noteTitle & "||" & noteDate & "||" & bodyPreview & "\\n---\\n"
      set resultCount to resultCount + 1
    end if
  end repeat
  return output
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw) return { notes: [] };
    const notes = raw.split('\n---\n').filter(Boolean).map(line => {
      const [title, date, preview] = line.split('||');
      return { title: title?.trim(), date: date?.trim(), preview: preview?.trim() };
    });
    return { notes };
  } catch (e) {
    return { error: 'Apple Notes Zugriff fehlgeschlagen.' };
  }
}

async function createNote({ title, body, folder = '' }) {
  const safeTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safeBody  = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const script = folder
    ? `tell application "Notes"
  tell folder "${folder.replace(/"/g, '\\"')}"
    make new note with properties {name:"${safeTitle}", body:"${safeBody}"}
  end tell
end tell`
    : `tell application "Notes"
  make new note with properties {name:"${safeTitle}", body:"${safeBody}"}
end tell`;

  try {
    await runAppleScript(script);
    return { created: true, title };
  } catch (e) {
    return { error: `Notiz erstellen fehlgeschlagen: ${e.message}` };
  }
}

module.exports = { getNotes, createNote };

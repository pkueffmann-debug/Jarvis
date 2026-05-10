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

async function searchContacts({ query = '', limit = 10 }) {
  const limitN = Math.min(Number(limit) || 10, 50);
  const q = query.toLowerCase().replace(/"/g, '\\"');

  const script = `
tell application "Contacts"
  set output to ""
  set resultCount to 0
  set allPeople to every person
  repeat with p in allPeople
    if resultCount >= ${limitN} then exit repeat
    set fullName to ""
    try
      set firstName to first name of p
      if firstName is missing value then set firstName to ""
      set lastName to last name of p
      if lastName is missing value then set lastName to ""
      set fullName to firstName & " " & lastName
    end try
    set lcName to do shell script "echo " & quoted form of fullName & " | tr '[:upper:]' '[:lower:]'"
    if lcName contains "${q}" or "${q}" is "" then
      set phones to ""
      try
        repeat with ph in phones of p
          set phones to phones & value of ph & ", "
        end repeat
      end try
      set emails to ""
      try
        repeat with em in emails of p
          set emails to emails & value of em & ", "
        end repeat
      end try
      set output to output & fullName & "||" & phones & "||" & emails & "\\n---\\n"
      set resultCount to resultCount + 1
    end if
  end repeat
  return output
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw) return { contacts: [] };
    const contacts = raw.split('\n---\n').filter(Boolean).map(line => {
      const [name, phones, emails] = line.split('||');
      return {
        name: name?.trim(),
        phones: phones?.trim().replace(/,\s*$/, '') || '',
        emails: emails?.trim().replace(/,\s*$/, '') || '',
      };
    });
    return { contacts };
  } catch (e) {
    return { error: 'Kontakte-Zugriff fehlgeschlagen. Contacts-Berechtigung prüfen.' };
  }
}

module.exports = { searchContacts };

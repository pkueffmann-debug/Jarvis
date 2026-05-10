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

async function getReminders({ list = '', includeCompleted = false, limit = 20 }) {
  const limitN = Math.min(Number(limit) || 20, 50);

  const script = `
tell application "Reminders"
  set output to ""
  set resultCount to 0
  ${list ? `set theList to list "${list.replace(/"/g, '\\"')}"
  set allReminders to reminders of theList` : 'set allReminders to every reminder'}
  repeat with r in allReminders
    if resultCount >= ${limitN} then exit repeat
    set isCompleted to completed of r
    if ${includeCompleted ? 'true' : 'not isCompleted'} then
      set rName to name of r
      set rDue to ""
      try
        set rDue to due date of r as string
      end try
      set rNotes to ""
      try
        set rNotes to body of r
        if rNotes is missing value then set rNotes to ""
      end try
      set rList to name of containing list of r
      set output to output & rName & "||" & rDue & "||" & rNotes & "||" & rList & "||" & (isCompleted as string) & "\\n---\\n"
      set resultCount to resultCount + 1
    end if
  end repeat
  return output
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw) return { reminders: [] };
    const reminders = raw.split('\n---\n').filter(Boolean).map(line => {
      const [name, due, notes, listName, completed] = line.split('||');
      return {
        name: name?.trim(),
        due: due?.trim() || null,
        notes: notes?.trim() || '',
        list: listName?.trim(),
        completed: completed?.trim() === 'true',
      };
    });
    return { reminders };
  } catch (e) {
    return { error: 'Reminders Zugriff fehlgeschlagen.' };
  }
}

async function createReminder({ title, dueDate, notes = '', list = '' }) {
  const safeTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safeNotes = notes.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  let props = `{name:"${safeTitle}"`;
  if (notes) props += `, body:"${safeNotes}"`;
  if (dueDate) props += `, due date:date "${dueDate.replace(/"/g, '\\"')}"`;
  props += '}';

  const script = list
    ? `tell application "Reminders"
  tell list "${list.replace(/"/g, '\\"')}"
    make new reminder with properties ${props}
  end tell
end tell`
    : `tell application "Reminders"
  make new reminder with properties ${props}
end tell`;

  try {
    await runAppleScript(script);
    return { created: true, title };
  } catch (e) {
    return { error: `Reminder erstellen fehlgeschlagen: ${e.message}` };
  }
}

async function completeReminder({ name }) {
  const safeName = name.replace(/"/g, '\\"');
  const script = `
tell application "Reminders"
  set allReminders to every reminder whose name is "${safeName}"
  repeat with r in allReminders
    set completed of r to true
  end repeat
  return (count of allReminders) as string
end tell`;
  try {
    const count = await runAppleScript(script);
    return { completed: true, count: parseInt(count) || 0, name };
  } catch (e) {
    return { error: `Reminder abschließen fehlgeschlagen: ${e.message}` };
  }
}

module.exports = { getReminders, createReminder, completeReminder };

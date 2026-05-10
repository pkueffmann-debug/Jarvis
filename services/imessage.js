if (process.platform !== 'darwin') {
  module.exports = { getMessages: () => ({ error: 'iMessage ist nur auf macOS verfügbar.' }), sendMessage: () => ({ error: 'iMessage ist nur auf macOS verfügbar.' }) };
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

async function getMessages({ contact, limit = 10 }) {
  const limitN = Math.min(Number(limit) || 10, 50);
  const filterLine = contact
    ? `if chatName contains "${contact.replace(/"/g, '\\"')}" then`
    : '';
  const endIf = contact ? 'end if' : '';

  const script = `
tell application "Messages"
  set output to ""
  repeat with c in (get every chat)
    set chatName to name of c
    ${filterLine}
    try
      set allMsgs to messages of c
      set totalCount to count of allMsgs
      set startIdx to totalCount - ${limitN} + 1
      if startIdx < 1 then set startIdx to 1
      repeat with i from startIdx to totalCount
        set m to item i of allMsgs
        set msgText to text of m
        set msgSender to sender of m
        if msgSender is missing value then
          set senderName to "Me"
        else
          try
            set senderName to handle of msgSender
          on error
            set senderName to "Unknown"
          end try
        end if
        set output to output & chatName & "||" & senderName & "||" & msgText & "\\n---\\n"
      end repeat
    end try
    ${endIf}
  end repeat
  return output
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw) return { messages: [] };
    const messages = raw.split('\n---\n').filter(Boolean).map(line => {
      const [chat, sender, ...textParts] = line.split('||');
      return { chat: chat?.trim(), sender: sender?.trim(), text: textParts.join('||').trim() };
    });
    return { messages };
  } catch (e) {
    return { error: 'iMessage-Zugriff fehlgeschlagen. Accessibility-Berechtigung in Systemeinstellungen prüfen.' };
  }
}

async function sendMessage({ to, message }) {
  const safe = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safeTo = to.replace(/"/g, '\\"');
  const script = `
tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${safeTo}" of targetService
  send "${safe}" to targetBuddy
end tell`;
  try {
    await runAppleScript(script);
    return { sent: true, to, message };
  } catch (e) {
    // Fallback: try SMS service
    const script2 = `
tell application "Messages"
  send "${safe}" to buddy "${safeTo}" of 1st service
end tell`;
    try {
      await runAppleScript(script2);
      return { sent: true, to, message };
    } catch (e2) {
      return { error: `Senden fehlgeschlagen: ${e2.message}` };
    }
  }
}

module.exports = { getMessages, sendMessage };

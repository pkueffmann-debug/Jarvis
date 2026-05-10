const { exec } = require('child_process');
const { promisify } = require('util');
const execP = promisify(exec);

async function sendMessage({ contact, message }) {
  const encoded = encodeURIComponent(message);
  // Clean phone number — strip spaces, dashes, parentheses
  const phone = contact ? contact.replace(/[\s\-\(\)]/g, '') : '';
  const url = phone
    ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  try {
    await execP(`open "${url}"`);
    return { opened: true, url, contact: contact || 'kein Kontakt', message };
  } catch (e) {
    return { error: e.message };
  }
}

async function openWhatsApp() {
  try {
    await execP('open -a WhatsApp');
    return { opened: true };
  } catch {
    // WhatsApp Web fallback
    await execP('open "https://web.whatsapp.com"');
    return { opened: true, mode: 'web' };
  }
}

module.exports = { sendMessage, openWhatsApp };

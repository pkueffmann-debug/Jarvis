// Phase 4: Gmail API via googleapis
// Scopes: gmail.readonly, gmail.send, gmail.modify

async function getRecentEmails(_maxResults = 10) {
  throw new Error('Gmail not yet configured — coming in Phase 4');
}

async function sendEmail(_to, _subject, _body) {
  throw new Error('Gmail not yet configured — coming in Phase 4');
}

module.exports = { getRecentEmails, sendEmail };

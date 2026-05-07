const MAX = 50;
const history = [];
let lastContent = '';

function update(text) {
  if (!text || text === lastContent) return;
  lastContent = text;
  history.unshift({ content: text, timestamp: new Date().toISOString() });
  if (history.length > MAX) history.pop();
}

function getHistory(n = 10) {
  return history.slice(0, Math.min(n, MAX));
}

module.exports = { update, getHistory };

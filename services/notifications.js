const MAX = 200;
const history = [];

function record(title, body) {
  history.unshift({ title: title || 'JARVIS', body, timestamp: new Date().toISOString() });
  if (history.length > MAX) history.pop();
}

function getHistory({ query, hours = 24 } = {}) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  let items = history.filter((n) => n.timestamp >= cutoff);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((n) => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q));
  }
  return { notifications: items.slice(0, 50), total: items.length };
}

module.exports = { record, getHistory };

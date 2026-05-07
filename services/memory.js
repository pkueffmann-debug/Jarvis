// Persistent key-value memory + conversation history — stored in ~/.jarvis/
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DIR          = path.join(os.homedir(), '.jarvis');
const MEMORY_PATH  = path.join(DIR, 'memory.json');
const HISTORY_PATH = path.join(DIR, 'history.json');

function ensure() { fs.mkdirSync(DIR, { recursive: true }); }

// ── Facts ──────────────────────────────────────────────────────────────────

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8')); } catch { return {}; }
}
function saveMemory(data) { ensure(); fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2)); }

function rememberFact({ key, value, category = 'general' }) {
  const data = loadMemory();
  data[key]  = { value, category, updatedAt: new Date().toISOString() };
  saveMemory(data);
  return { saved: true, key, value };
}

function recallFacts({ query } = {}) {
  const data  = loadMemory();
  let entries = Object.entries(data).map(([key, v]) => ({ key, ...v }));
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter((e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q));
  }
  entries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return { facts: entries.slice(0, 25), count: entries.length };
}

function forgetFact({ key }) {
  const data = loadMemory();
  const existed = key in data;
  delete data[key];
  saveMemory(data);
  return { forgotten: existed, key };
}

function clearMemory() { saveMemory({}); return { cleared: true }; }

function getStats() {
  const facts = Object.keys(loadMemory()).length;
  const hist  = loadHistory().length;
  return { factCount: facts, historyCount: hist };
}

// ── Conversation history ───────────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); } catch { return []; }
}
function saveHistory(messages) {
  ensure();
  // Keep only last 40 messages to avoid growing unbounded
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(messages.slice(-40)));
}
function clearHistory() { saveHistory([]); return { cleared: true }; }

module.exports = { rememberFact, recallFacts, forgetFact, clearMemory, getStats, loadHistory, saveHistory, clearHistory };

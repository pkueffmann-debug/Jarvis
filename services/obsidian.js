const fs   = require('fs');
const path = require('path');

function getVaultPath() {
  return process.env.OBSIDIAN_VAULT_PATH || '';
}

function isConfigured() {
  const p = getVaultPath();
  return !!(p && fs.existsSync(p));
}

function readMarkdown(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function getAllNotes(dir, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) getAllNotes(full, results);
      else if (entry.name.endsWith('.md')) results.push(full);
    }
  } catch {}
  return results;
}

async function searchNotes({ query = '', limit = 10 }) {
  if (!isConfigured()) return { error: `Obsidian Vault nicht gefunden. OBSIDIAN_VAULT_PATH in .env setzen.` };
  const vault = getVaultPath();
  const limitN = Math.min(Number(limit) || 10, 30);
  const q = query.toLowerCase();

  try {
    const files = getAllNotes(vault);
    const results = [];

    for (const file of files) {
      if (results.length >= limitN) break;
      const content = readMarkdown(file);
      const name = path.basename(file, '.md');
      if (!q || name.toLowerCase().includes(q) || content.toLowerCase().includes(q)) {
        const preview = content.replace(/^#+\s.*/gm, '').trim().slice(0, 200);
        const rel = path.relative(vault, file);
        results.push({ filename: name, path: rel, preview });
      }
    }
    return { notes: results, count: results.length, vault };
  } catch (e) {
    return { error: e.message };
  }
}

async function getNote({ filename }) {
  if (!isConfigured()) return { error: 'Obsidian Vault nicht konfiguriert.' };
  const vault = getVaultPath();
  const fname = filename.endsWith('.md') ? filename : `${filename}.md`;

  // Search recursively
  const files = getAllNotes(vault);
  const match = files.find(f => path.basename(f) === fname || path.basename(f, '.md') === filename);
  if (!match) return { error: `Notiz "${filename}" nicht gefunden.` };

  const content = readMarkdown(match);
  return { filename, path: path.relative(vault, match), content };
}

async function createNote({ title, content = '', folder = '' }) {
  if (!isConfigured()) return { error: 'Obsidian Vault nicht konfiguriert.' };
  const vault = getVaultPath();
  const dir = folder ? path.join(vault, folder) : vault;

  try {
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${title}.md`);
    const body = content.startsWith('#') ? content : `# ${title}\n\n${content}`;
    fs.writeFileSync(filePath, body, 'utf8');
    return { created: true, title, path: path.relative(vault, filePath) };
  } catch (e) {
    return { error: e.message };
  }
}

async function appendToNote({ filename, content }) {
  if (!isConfigured()) return { error: 'Obsidian Vault nicht konfiguriert.' };
  const vault = getVaultPath();
  const files = getAllNotes(vault);
  const fname = filename.endsWith('.md') ? filename : `${filename}.md`;
  const match = files.find(f => path.basename(f) === fname);
  if (!match) return { error: `Notiz "${filename}" nicht gefunden.` };

  try {
    fs.appendFileSync(match, `\n\n${content}`, 'utf8');
    return { appended: true, filename };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { searchNotes, getNote, createNote, appendToNote, isConfigured };

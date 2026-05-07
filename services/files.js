const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SEARCH_ROOTS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Documents'),
];

async function searchFiles({ query, maxResults = 10 }) {
  const q       = (query || '').toLowerCase().trim();
  if (!q) return { files: [], count: 0 };

  const results = [];
  for (const root of SEARCH_ROOTS) {
    if (!fs.existsSync(root)) continue;
    walk(root, q, results, 0);
    if (results.length >= maxResults * 2) break;
  }

  const sorted = results
    .sort((a, b) => new Date(b.modified) - new Date(a.modified))
    .slice(0, maxResults);

  return { files: sorted, count: sorted.length };
}

function walk(dir, query, out, depth) {
  if (depth > 3 || out.length > 50) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const fullPath = path.join(dir, e.name);

    if (e.name.toLowerCase().includes(query)) {
      try {
        const stat = fs.statSync(fullPath);
        out.push({
          name:     e.name,
          path:     fullPath,
          type:     e.isDirectory() ? 'Ordner' : 'Datei',
          size:     e.isFile() ? fmtSize(stat.size) : null,
          modified: stat.mtime.toLocaleDateString('de-DE'),
        });
      } catch { /* skip */ }
    }

    if (e.isDirectory()) walk(fullPath, query, out, depth + 1);
  }
}

function fmtSize(b) {
  if (b < 1024)          return `${b} B`;
  if (b < 1024 * 1024)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = { searchFiles };

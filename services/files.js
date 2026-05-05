// Phase 6: Local file search (Desktop, Downloads, Documents)
const os = require('os');
const path = require('path');

const SEARCH_DIRS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Documents'),
];

async function searchFiles(_query) {
  throw new Error('File search not yet configured — coming in Phase 6');
}

module.exports = { searchFiles, SEARCH_DIRS };

// Phase 6: SQLite local memory via better-sqlite3

function saveMessage(_role, _content) {
  throw new Error('Memory not yet configured — coming in Phase 6');
}

function getHistory(_limit = 20) {
  throw new Error('Memory not yet configured — coming in Phase 6');
}

function saveFact(_key, _value) {
  throw new Error('Memory not yet configured — coming in Phase 6');
}

module.exports = { saveMessage, getHistory, saveFact };

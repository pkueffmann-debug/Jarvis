// /api/brain/memory — user_facts CRUD for the authenticated user.
//
//   GET  /api/brain/memory                 → list all facts, top-importance first
//   GET  /api/brain/memory?q=spotify       → naive ILIKE search
//   POST /api/brain/memory  { fact, ... }  → upsert
//   DELETE /api/brain/memory  { id }       → forget
//
// The chat endpoint loads the top-N facts and injects them into the system
// prompt. This file is also imported by chat.js for that purpose.

const { gate } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const MAX_FACTS_IN_PROMPT = 40;

// Pulled in by chat.js. Loads importance≥3 facts for the user — kept small
// so the system-prompt token cost stays bounded.
async function loadFactsFor(userId, limit = MAX_FACTS_IN_PROMPT) {
  const admin = adminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from('user_facts')
    .select('fact, category, importance')
    .eq('user_id', userId)
    .gte('importance', 3)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[memory.loadFactsFor]', error.message);
    return [];
  }
  return data || [];
}

async function rememberFact(userId, fact, category = 'general', importance = 5) {
  const admin = adminClient();
  if (!admin) throw new Error('supabase admin not configured');
  const { data, error } = await admin
    .from('user_facts')
    .upsert({ user_id: userId, fact, category, importance }, { onConflict: 'user_id,fact' })
    .select()
    .limit(1);
  if (error) throw error;
  return data?.[0];
}

async function recallFacts(userId, query) {
  const admin = adminClient();
  if (!admin) return [];
  let q = admin.from('user_facts').select('id, fact, category, importance, updated_at').eq('user_id', userId);
  if (query) q = q.ilike('fact', `%${query}%`);
  q = q.order('importance', { ascending: false }).order('updated_at', { ascending: false }).limit(100);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function forgetFact(userId, id) {
  const admin = adminClient();
  if (!admin) throw new Error('supabase admin not configured');
  const { error } = await admin.from('user_facts').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
  return { ok: true };
}

module.exports = async (req, res) => {
  const user = await gate(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      const q = url.searchParams.get('q') || null;
      const facts = await recallFacts(user.id, q);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ facts }));
    }
    if (req.method === 'POST') {
      const body = req.body && Object.keys(req.body).length ? req.body : await readJSON(req);
      const { fact, category, importance } = body || {};
      if (!fact || typeof fact !== 'string') {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'fact required' }));
      }
      const saved = await rememberFact(user.id, fact.trim(), category, importance);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, fact: saved }));
    }
    if (req.method === 'DELETE') {
      const body = req.body && Object.keys(req.body).length ? req.body : await readJSON(req);
      const { id } = body || {};
      if (!id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'id required' }));
      }
      await forgetFact(user.id, id);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true }));
    }
    res.statusCode = 405;
    res.end('method not allowed');
  } catch (e) {
    console.error('[memory]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};

function readJSON(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

// Re-export the internal helpers so chat.js can call them without HTTP.
module.exports.loadFactsFor = loadFactsFor;
module.exports.rememberFact = rememberFact;
module.exports.recallFacts  = recallFacts;
module.exports.forgetFact   = forgetFact;

// supabase.js — single admin client used by all /api/brain/* functions.
// Service-role key, server-side only.

const { createClient } = require('@supabase/supabase-js');

let _admin = null;
function adminClient() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

module.exports = { adminClient };

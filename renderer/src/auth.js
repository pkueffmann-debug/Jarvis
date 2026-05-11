import { createClient } from '@supabase/supabase-js';

let _sb = null;

async function getClient() {
  if (_sb) return _sb;
  const cfg = await window.jarvis.supabaseConfig();
  _sb = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, storageKey: 'jarvis-auth' },
  });
  return _sb;
}

export async function signUp(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const sb = await getClient();
  await sb.auth.signOut();
}

export async function getSession() {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function resetPassword(email) {
  const sb = await getClient();
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

export async function onAuthStateChange(cb) {
  const sb = await getClient();
  return sb.auth.onAuthStateChange((_event, session) => cb(session));
}

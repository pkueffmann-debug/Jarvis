// auth.js — cookie → user, plus subscription entitlement check.
// Used by all /api/brain/* endpoints to refuse anonymous callers.

const cookie = require('cookie');
const { adminClient } = require('./supabase');

// Owner / team emails always allowed past the paywall.
const WHITELIST = new Set([
  'p.kueffmann@icloud.com',
  't.henseling@gmx.de',
  'jannis.l.timm@gmail.com'
]);

// Returns { user, subscription, error? }. On any failure caller should
// short-circuit with 401/402.
async function authedUser(req) {
  const admin = adminClient();
  if (!admin) return { error: 'server-not-configured', status: 500 };

  const cookies = cookie.parse(req.headers.cookie || '');
  const accessToken = cookies['sb-access-token'];
  if (!accessToken) return { error: 'not-authenticated', status: 401 };

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return { error: 'invalid-token', status: 401 };
  const user = data.user;

  if (WHITELIST.has((user.email || '').toLowerCase())) {
    return { user, subscription: { plan: 'owner', status: 'active', current_period_end: null } };
  }

  const { data: subs } = await admin
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', user.id)
    .limit(1);
  const sub = subs?.[0] || null;
  const active = sub
    && ['trialing', 'active'].includes(sub.status)
    && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

  if (!active) return { user, subscription: sub, error: 'no-subscription', status: 402 };
  return { user, subscription: sub };
}

// Helper: respond with the canonical 401/402/500.
function sendAuthError(res, errCode, status) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: errCode }));
}

// Combined gate: returns user (if ok) or null (response already sent).
async function gate(req, res) {
  const r = await authedUser(req);
  if (r.error) {
    sendAuthError(res, r.error, r.status);
    return null;
  }
  return r.user;
}

module.exports = { authedUser, gate };

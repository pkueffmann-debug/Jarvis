// /api/brain — server-side gate for /brain (rewritten via vercel.json).
//
// Flow:
//   1) Read sb-access-token (and optionally sb-refresh-token) from cookies.
//   2) Verify with Supabase → auth.users row.
//   3) Look up public.subscriptions for that user.
//   4) Allow only when status ∈ {trialing, active} AND current_period_end > now()
//      (or NULL → no period limit, e.g. lifetime).
//   5) On allow → stream brain/index.html as the response.
//      On any failure → 302 redirect (auth or pricing).

const fs   = require('fs');
const path = require('path');
const cookie = require('cookie');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// One admin client (service role) for subscription lookups that bypass RLS.
const admin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

module.exports = async (req, res) => {
  try {
    // ── 1) Parse cookie ────────────────────────────────────────────────
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies['sb-access-token'];
    if (!accessToken) return redirect(res, '/auth.html?next=/brain');

    // ── 2) Verify token ───────────────────────────────────────────────
    if (!admin) {
      console.error('[api/brain] Supabase admin client not configured');
      return redirect(res, '/auth.html?next=/brain&error=server');
    }
    const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return redirect(res, '/auth.html?next=/brain');
    }
    const user = userData.user;

    // ── 3) Subscription lookup ────────────────────────────────────────
    const { data: subs, error: subErr } = await admin
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', user.id)
      .limit(1);

    if (subErr) {
      console.error('[api/brain] subscriptions lookup failed:', subErr.message);
      return redirect(res, '/#pricing?error=lookup');
    }
    const sub = subs?.[0];
    const active = sub
      && ['trialing', 'active'].includes(sub.status)
      && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

    if (!active) {
      return redirect(res, '/#pricing');
    }

    // ── 4) Serve the brain page ──────────────────────────────────────
    const htmlPath = path.join(process.cwd(), 'brain', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    // Tiny safety: forbid framing
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.end(html);
  } catch (e) {
    console.error('[api/brain]', e);
    return redirect(res, '/auth.html?next=/brain&error=server');
  }
};

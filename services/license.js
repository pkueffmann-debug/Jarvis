const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http  = require('http');
const https = require('https');

const LICENSE_DIR  = path.join(os.homedir(), '.jarvis');
const LICENSE_FILE = path.join(LICENSE_DIR, 'license.json');

const TRIAL_DAYS       = 7;
const FREE_DAILY_LIMIT = 50;

function load() {
  try {
    fs.mkdirSync(LICENSE_DIR, { recursive: true });
    if (!fs.existsSync(LICENSE_FILE)) return {};
    return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
  } catch { return {}; }
}

function save(data) {
  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
}

function getStatus() {
  const data = load();

  // Active license
  if (data.key && data.plan && data.plan !== 'free') {
    return {
      status:      'active',
      plan:        data.plan,
      planName:    data.planName || data.plan,
      email:       data.email || '',
      key:         data.key,
      messagesLeft: -1,
      daysLeft:    -1,
    };
  }

  // Ensure trial start date exists
  if (!data.trialStarted) {
    data.trialStarted = new Date().toISOString();
    save(data);
  }

  const daysUsed = Math.floor(
    (Date.now() - new Date(data.trialStarted).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);

  if (daysLeft > 0) {
    return { status: 'trial', daysLeft, messagesLeft: -1, plan: 'trial' };
  }

  // Trial over — free tier with daily cap
  const today      = new Date().toISOString().slice(0, 10);
  const dailyCount = data.dailyCount?.[today] || 0;
  const left       = Math.max(0, FREE_DAILY_LIMIT - dailyCount);

  return {
    status:      left > 0 ? 'free' : 'expired',
    daysLeft:    0,
    messagesLeft: left,
    plan:        'free',
  };
}

function checkAndIncrement() {
  const status = getStatus();

  // Always allow during trial or with active license
  if (status.status === 'active' || status.status === 'trial') {
    return { allowed: true, status };
  }

  if (status.status === 'expired') {
    return { allowed: false, status };
  }

  // Free tier — decrement
  const data  = load();
  const today = new Date().toISOString().slice(0, 10);
  if (!data.dailyCount) data.dailyCount = {};
  // Prune old entries
  Object.keys(data.dailyCount).forEach(d => { if (d < today) delete data.dailyCount[d]; });
  data.dailyCount[today] = (data.dailyCount[today] || 0) + 1;
  save(data);

  const used = data.dailyCount[today];
  const left = Math.max(0, FREE_DAILY_LIMIT - used);
  const allowed = used <= FREE_DAILY_LIMIT;
  return { allowed, status: { ...status, messagesLeft: left } };
}

function post(urlStr, body) {
  return new Promise((resolve) => {
    const u    = new URL(urlStr);
    const mod  = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req  = mod.request(
      {
        hostname: u.hostname,
        port:     u.port || (u.protocol === 'https:' ? 443 : 80),
        path:     u.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      }
    );
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(data);
    req.end();
  });
}

async function activateLicense(key) {
  const base = process.env.BACKEND_URL || 'http://localhost:4000';
  try {
    const result = await post(`${base}/verify-license`, { key: key.trim() });
    if (result.valid) {
      const data = load();
      Object.assign(data, {
        key:         key.trim(),
        plan:        result.plan,
        planName:    result.planName,
        email:       result.email,
        maxUsers:    result.maxUsers,
        activatedAt: new Date().toISOString(),
      });
      save(data);
    }
    return result;
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

async function createCheckoutUrl(plan, yearly = false) {
  const base = process.env.BACKEND_URL || 'http://localhost:4000';
  try {
    const result = await post(`${base}/create-checkout`, { plan, yearly });
    return result.url || null;
  } catch {
    return null;
  }
}

function revokeLicense() {
  const data = load();
  ['key', 'plan', 'planName', 'email', 'maxUsers', 'activatedAt'].forEach(k => delete data[k]);
  save(data);
}

module.exports = {
  getStatus,
  checkAndIncrement,
  activateLicense,
  createCheckoutUrl,
  revokeLicense,
};

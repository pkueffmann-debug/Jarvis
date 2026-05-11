require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');
const nodemailer = require('nodemailer');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app  = express();
const PORT = process.env.PORT || 4000;

// Webhook must receive raw body — register before express.json()
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors({ origin: '*' }));

// ── Plans ─────────────────────────────────────────────────────────────────────
const PLANS = {
  pro: {
    name:          'Pro',
    price:         49,
    priceMonthly:  process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    priceYearly:   process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    maxUsers: 1,
    features: ['Unlimited Nachrichten', 'Alle Integrationen', 'Wake Word', 'Voice Control'],
  },
  team: {
    name:         'Team',
    price:        199,
    priceMonthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
    priceYearly:  process.env.STRIPE_TEAM_YEARLY_PRICE_ID,
    maxUsers: 10,
    features: ['Bis zu 10 User', 'Admin Panel', 'Team-Gedächtnis', 'Priority Support'],
  },
  enterprise: {
    name:         'Enterprise',
    price:        499,
    priceMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    priceYearly:  process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    maxUsers: -1,
    features: ['Unlimited User', 'On-Premise Option', 'SLA', 'Dedizierter Support'],
  },
};

// ── License storage (file-based) ──────────────────────────────────────────────
const LICENSE_FILE = path.join(__dirname, 'licenses.json');

function loadLicenses() {
  if (!fs.existsSync(LICENSE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8')); } catch { return {}; }
}

function saveLicenses(data) {
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
}

function generateKey() {
  const seg = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  return `JARVIS-${seg()}-${seg()}-${seg()}`;
}

// ── Email ─────────────────────────────────────────────────────────────────────
async function sendLicenseEmail(email, key, planName) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Email] SMTP nicht konfiguriert — Key für ${email}: ${key}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"JARVIS" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `Dein JARVIS ${planName} Lizenzkey 🤖`,
    html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0A0A0F;font-family:Inter,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#0D0D15;border:1px solid rgba(99,102,241,.25);border-radius:16px;padding:40px">
  <h1 style="margin:0 0 8px;font-size:28px;color:#818CF8;letter-spacing:-.02em">JARVIS ${planName} aktiviert 🚀</h1>
  <p style="color:#A1A1AA;margin:0 0 28px;line-height:1.6">Willkommen! Hier ist dein persönlicher Lizenzkey:</p>
  <div style="background:#0A0A0F;border:1px solid #6366F1;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
    <code style="font-size:20px;font-weight:700;color:#818CF8;letter-spacing:.08em">${key}</code>
  </div>
  <p style="color:#A1A1AA;margin:0 0 8px">So aktivierst du JARVIS:</p>
  <ol style="color:#A1A1AA;padding-left:20px;line-height:1.8;margin:0 0 28px">
    <li>JARVIS öffnen</li>
    <li>Einstellungen → Lizenz</li>
    <li>Key einfügen und bestätigen</li>
  </ol>
  <p style="color:#52525B;font-size:13px;margin:0">Fragen? <a href="mailto:hello@jarvis.ai" style="color:#6366F1">hello@jarvis.ai</a></p>
</div>
</body></html>`,
  });
  console.log(`[Email] Lizenzkey an ${email} gesendet`);
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

// POST /create-checkout — create Stripe Checkout Session
app.post('/create-checkout', async (req, res) => {
  const { plan, yearly = false, email } = req.body;
  const planData = PLANS[plan];

  if (!planData) return res.status(400).json({ error: `Unbekannter Plan: ${plan}` });

  const priceId = yearly ? planData.priceYearly : planData.priceMonthly;

  if (!priceId) {
    const key = yearly
      ? `STRIPE_${plan.toUpperCase()}_YEARLY_PRICE_ID`
      : `STRIPE_${plan.toUpperCase()}_MONTHLY_PRICE_ID`;
    return res.status(400).json({
      error: `Price ID für "${plan}${yearly ? ' jährlich' : ''}" fehlt. Bitte ${key} in ENV setzen.`,
    });
  }

  const base = process.env.BACKEND_URL || `http://localhost:${PORT}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                       'subscription',
      payment_method_types:       ['card', 'sepa_debit'],
      allow_promotion_codes:      true,
      billing_address_collection: 'auto',
      customer_email:             email || undefined,
      line_items:                 [{ price: priceId, quantity: 1 }],
      success_url:                `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:                 `${base}/cancel`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { plan, yearly: String(yearly) },
      },
      locale: 'de',
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('[Stripe]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /verify-license — validate a license key
app.post('/verify-license', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Kein Key angegeben.' });

  const licenses = loadLicenses();
  const license  = licenses[key?.trim()];

  if (!license)         return res.json({ valid: false });
  if (license.revoked)  return res.json({ valid: false, reason: 'revoked' });

  res.json({
    valid:       true,
    plan:        license.plan,
    planName:    PLANS[license.plan]?.name || license.plan,
    email:       license.email,
    maxUsers:    license.maxUsers,
    activatedAt: license.activatedAt,
  });
});

// POST /webhook — Stripe events
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('[Webhook]', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  console.log(`[Webhook] ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status !== 'paid' && session.status !== 'complete') return res.json({ received: true });

    const plan  = session.metadata?.plan || 'pro';
    const email = session.customer_details?.email || session.customer_email;
    const key   = generateKey();

    const licenses = loadLicenses();
    licenses[key] = {
      plan,
      email,
      maxUsers:        PLANS[plan]?.maxUsers ?? 1,
      activatedAt:     new Date().toISOString(),
      stripeSessionId: session.id,
      stripeCustomer:  session.customer,
    };
    saveLicenses(licenses);
    console.log(`[License] Generiert: ${key} (${plan}) → ${email}`);

    if (email) {
      await sendLicenseEmail(email, key, PLANS[plan]?.name || plan).catch(e =>
        console.error('[Email]', e.message)
      );
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub      = event.data.object;
    const licenses = loadLicenses();
    const entry    = Object.entries(licenses).find(([, v]) => v.stripeCustomer === sub.customer);
    if (entry) {
      licenses[entry[0]].revoked   = true;
      licenses[entry[0]].revokedAt = new Date().toISOString();
      saveLicenses(licenses);
      console.log(`[License] Widerrufen: ${entry[0]}`);
    }
  }

  res.json({ received: true });
});

// Success / Cancel pages
app.get('/success', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Inter,sans-serif;background:#0A0A0F;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px}
    h1{font-size:32px;color:#818CF8}p{color:#A1A1AA;text-align:center;max-width:400px;line-height:1.6}
  </style></head><body>
    <h1>✓ Zahlung erfolgreich!</h1>
    <p>Dein Lizenzkey wurde per E-Mail zugeschickt.<br>Du kannst dieses Fenster schließen.</p>
  </body></html>`);
});

app.get('/cancel', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Inter,sans-serif;background:#0A0A0F;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px}
    h1{font-size:32px;color:#52525B}p{color:#71717A}
  </style></head><body>
    <h1>Abgebrochen</h1>
    <p>Du kannst dieses Fenster schließen.</p>
  </body></html>`);
});

app.listen(PORT, () => console.log(`JARVIS Backend läuft auf http://localhost:${PORT}`));

require('dotenv').config();
const express  = require('express');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ── Price IDs — create in Stripe Dashboard → Products → Add product ──────────
const PRICES = {
  pro_monthly:        process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_yearly:         process.env.STRIPE_PRICE_PRO_YEARLY,
  team_monthly:       process.env.STRIPE_PRICE_TEAM_MONTHLY,
  team_yearly:        process.env.STRIPE_PRICE_TEAM_YEARLY,
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  enterprise_yearly:  process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
};

// ── Create checkout session ───────────────────────────────────────────────────
app.post('/create-checkout-session', async (req, res) => {
  const { plan, yearly = false } = req.body;
  const key     = `${plan}_${yearly ? 'yearly' : 'monthly'}`;
  const priceId = PRICES[key];

  if (!priceId) {
    return res.status(400).json({
      error: `Price ID für "${key}" fehlt. Bitte STRIPE_PRICE_${key.toUpperCase()} in .env setzen.`
    });
  }

  const base = process.env.BASE_URL || `http://localhost:${PORT}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit', 'paypal'],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/#pricing`,
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

// ── Success page ──────────────────────────────────────────────────────────────
app.get('/success', async (req, res) => {
  const { session_id } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.redirect('/?error=payment_incomplete');
    }
    res.sendFile(path.join(__dirname, 'success.html'));
  } catch (e) {
    res.redirect('/');
  }
});

// ── Download (gated) ──────────────────────────────────────────────────────────
app.get('/download/JARVIS-latest.dmg', (req, res) => {
  const dmgPath = path.join(__dirname, '..', 'build', 'JARVIS.dmg');
  if (!fs.existsSync(dmgPath)) {
    return res.status(404).send('DMG not yet available — check back soon.');
  }
  res.download(dmgPath, 'JARVIS.dmg');
});

// ── Stripe webhook ─────────────────────────────────────────────────────────────
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  switch (event.type) {
    case 'customer.subscription.created':
      console.log('[Stripe] New subscription:', event.data.object.id);
      break;
    case 'customer.subscription.deleted':
      console.log('[Stripe] Subscription cancelled:', event.data.object.id);
      break;
    case 'invoice.payment_failed':
      console.log('[Stripe] Payment failed:', event.data.object.customer);
      break;
  }
  res.json({ received: true });
});

app.listen(PORT, () => console.log(`JARVIS website running on http://localhost:${PORT}`));

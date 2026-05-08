require('dotenv').config();
const express  = require('express');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ── Price IDs (set in .env or Stripe Dashboard) ───────────────────────────
const PRICES = {
  personal: process.env.STRIPE_PRICE_PERSONAL,
  pro:      process.env.STRIPE_PRICE_PRO,
};

// ── Create checkout session ───────────────────────────────────────────────
app.post('/create-checkout-session', async (req, res) => {
  const { plan } = req.body;
  const priceId  = PRICES[plan];

  if (!priceId) return res.status(400).json({ error: `Unbekannter Plan: ${plan}` });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.BASE_URL || `http://localhost:${PORT}`}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.BASE_URL || `http://localhost:${PORT}`}/#pricing`,
      subscription_data: {
        trial_period_days: 30,
        metadata: { plan },
      },
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('[Stripe]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Success page — verify payment + serve download ────────────────────────
app.get('/success', async (req, res) => {
  const { session_id } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.redirect('/?error=payment_incomplete');
    }
    // Serve the success page
    res.sendFile(path.join(__dirname, 'success.html'));
  } catch (e) {
    res.redirect('/');
  }
});

// ── Download endpoint (gated behind valid Stripe session) ─────────────────
app.get('/download/JARVIS-latest.dmg', (req, res) => {
  const dmgPath = path.join(__dirname, '..', 'build', 'JARVIS.dmg');
  if (!fs.existsSync(dmgPath)) {
    return res.status(404).send('DMG not yet available — check back soon.');
  }
  res.download(dmgPath, 'JARVIS.dmg');
});

// ── Stripe webhook (optional — for subscription lifecycle events) ─────────
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  switch (event.type) {
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

const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY ist nicht gesetzt (Vercel → Settings → Environment Variables).' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const PRICES = {
    pro_monthly:        process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    pro_yearly:         process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    team_monthly:       process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
    team_yearly:        process.env.STRIPE_TEAM_YEARLY_PRICE_ID,
    enterprise_monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    enterprise_yearly:  process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
  };

  const body    = req.body || {};
  const plan    = body.plan;
  const yearly  = body.yearly === true || body.yearly === 'true';
  const email   = typeof body.email === 'string' ? body.email.trim() : '';
  const key     = `${plan}_${yearly ? 'yearly' : 'monthly'}`;
  const priceId = PRICES[key];

  if (!priceId) {
    return res.status(400).json({
      error: `Price ID für "${key}" fehlt. Bitte STRIPE_${key.toUpperCase()}_PRICE_ID im Vercel-Dashboard setzen.`,
    });
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const base  = process.env.BASE_URL || `${proto}://${host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(email ? { customer_email: email } : {}),
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/#pricing`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { plan, yearly: String(yearly), email },
      },
      locale: 'de',
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[Stripe]', e.message);
    return res.status(500).json({ error: e.message });
  }
};

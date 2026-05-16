// /api/stripe-webhook — Stripe → Supabase subscriptions upsert.
//
// Set this URL in Stripe Dashboard → Webhooks. Required signing secret
// goes into env as STRIPE_WEBHOOK_SECRET. Required Supabase service role
// key goes into SUPABASE_SERVICE_ROLE_KEY.
//
// IMPORTANT: bodyParser must be OFF — Stripe needs the RAW request body to
// compute its HMAC signature. We read the buffer manually.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const admin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

// Vercel: disable body parsing so we can compute the signature.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Extract a plan label from the Stripe price metadata or price IDs in env.
// Falls back to 'pro' if we can't tell.
function inferPlan(subscription) {
  const priceIds = (subscription.items?.data || []).map((it) => it.price?.id).filter(Boolean);
  const env = process.env;
  const map = {
    [env.STRIPE_PRO_MONTHLY_PRICE_ID]:        'pro',
    [env.STRIPE_PRO_YEARLY_PRICE_ID]:         'pro',
    [env.STRIPE_TEAM_MONTHLY_PRICE_ID]:       'team',
    [env.STRIPE_TEAM_YEARLY_PRICE_ID]:        'team',
    [env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID]: 'enterprise',
    [env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID]:  'enterprise',
  };
  for (const pid of priceIds) {
    if (map[pid]) return map[pid];
  }
  return subscription.metadata?.plan || 'pro';
}

// Upsert one row keyed on user_id. Stripe gives us the customer; we keep
// user_id from the original checkout client_reference_id (in metadata).
async function upsertSubscription(userId, email, subscription) {
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  if (!userId) {
    console.warn('[webhook] no user_id on subscription event, skipping');
    return;
  }
  const row = {
    user_id:                 userId,
    email:                   email || subscription.customer_email || '',
    plan:                    inferPlan(subscription),
    status:                  subscription.status,
    stripe_customer_id:      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    stripe_subscription_id:  subscription.id,
    current_period_end:      subscription.current_period_end
                              ? new Date(subscription.current_period_end * 1000).toISOString()
                              : null,
    cancel_at_period_end:    !!subscription.cancel_at_period_end,
  };
  const { error } = await admin
    .from('subscriptions')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.error('[webhook] upsert failed:', error.message, row);
    throw error;
  }
  console.log('[webhook] upserted subscription for user', userId, 'status=' + row.status);
}

async function markCanceled(stripeSubscriptionId) {
  if (!admin) return;
  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', stripeSubscriptionId);
  if (error) console.error('[webhook] cancel update failed:', error.message);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('method not allowed');
  }
  if (!WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET missing');
    res.statusCode = 500;
    return res.end('webhook secret missing');
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error('[webhook] signature verification failed:', e.message);
    res.statusCode = 400;
    return res.end(`signature error: ${e.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // First time the user pays. Stripe gives us the subscription id +
        // the user_id we stuffed into client_reference_id during checkout.
        const session = event.data.object;
        const userId  = session.client_reference_id || session.metadata?.user_id;
        const email   = session.customer_details?.email || session.customer_email;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await upsertSubscription(userId, email, sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        // Try metadata first (we copy user_id from checkout into subscription metadata),
        // fall back to looking up by stripe_customer_id in our DB.
        let userId = sub.metadata?.user_id;
        if (!userId && admin) {
          const { data: existing } = await admin
            .from('subscriptions')
            .select('user_id, email')
            .eq('stripe_customer_id', typeof sub.customer === 'string' ? sub.customer : sub.customer?.id)
            .limit(1);
          if (existing?.[0]) userId = existing[0].user_id;
        }
        await upsertSubscription(userId, null, sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await markCanceled(sub.id);
        break;
      }
      case 'invoice.payment_failed': {
        // status update will arrive via subscription.updated; nothing to do here
        console.log('[webhook] payment_failed for', event.data.object.id);
        break;
      }
      default:
        // ignore
        break;
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ received: true }));
  } catch (e) {
    console.error('[webhook] handler error:', e);
    res.statusCode = 500;
    res.end('handler error');
  }
};

/**
 * DEV-TASK-88 read-only diagnostic probe (GET-only, no mutations).
 *
 * Captures the full Stripe-side state for a subscription (object, invoices,
 * payment intents, charges, and webhook-endpoint event subscriptions) so a
 * "stale renewal" symptom can be classified between:
 *   (a) test-mode no-auto-renew artifact  (b) webhook processing gap  (c) stale fixture
 *
 * CONCLUSION of DEV-TASK-88 (2026-09-02): (b) — the `stripe-webhook-subscriptions`
 * Stripe endpoint is NOT subscribed to `invoice.payment_succeeded`, and its
 * `customer.subscription.updated` payloads carry NULL `current_period_*`, so
 * renewal billing rows are never written and the DB `current_period_end` never
 * advances. Stripe itself DID auto-renew (invoices paid). Full write-up:
 * docs/flow-registry.md DEV-TASK-88 entry (2026-09-02).
 *
 * Reads the test-mode secret key from ~/.dt11-stripe-key (never echoed/logged).
 * Run: node scripts/qa/dev-task-88-stripe-probe.mjs [--sub sub_xxx] [--email test-buyer@kidsmarketplace.test]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();
if (!STRIPE_KEY) {
  console.error('Missing ~/.dt11-stripe-key');
  process.exit(2);
}

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe GET ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function iso(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(Number(sec)) || Number(sec) <= 0) return '(null)';
  return new Date(Number(sec) * 1000).toISOString();
}

const EMAIL = 'test-buyer@kidsmarketplace.test';

async function main() {
  console.log('=== 1. Stripe account (sanity) ===');
  const acct = await stripeGet('/account');
  console.log('account:', acct.id);

  console.log(`\n=== 2. Customers by email ${EMAIL} ===`);
  const customers = await stripeGet(`/customers?email=${encodeURIComponent(EMAIL)}&limit=10`);
  if (!customers.data || customers.data.length === 0) {
    console.log('NO CUSTOMER FOUND');
    return;
  }
  for (const c of customers.data) {
    console.log('customer:', c.id, '| created:', iso(c.created), '| email:', c.email);
  }

  for (const customer of customers.data) {
    console.log(`\n=== 3. Subscriptions for ${customer.id} ===`);
    const subs = await stripeGet(`/subscriptions?customer=${customer.id}&limit=10`);
    if (!subs.data || subs.data.length === 0) console.log('  (none)');
    for (const s of subs.data) {
      const item = s.items?.data?.[0];
      console.log('  sub:', s.id);
      console.log('    status:', s.status);
      console.log('    created:', iso(s.created));
      console.log('    current_period_start:', iso(s.current_period_start));
      console.log('    current_period_end:  ', iso(s.current_period_end));
      console.log('    billing_cycle_anchor:', iso(s.billing_cycle_anchor));
      console.log('    cancel_at_period_end:', s.cancel_at_period_end);
      console.log('    cancel_at:', iso(s.cancel_at));
      console.log('    canceled_at:', iso(s.canceled_at));
      console.log('    trial_start:', iso(s.trial_start));
      console.log('    trial_end:', iso(s.trial_end));
      console.log('    test_clock:', s.test_clock ?? '(none)');
      console.log('    collection_method:', s.collection_method);
      console.log('    pause_collection:', JSON.stringify(s.pause_collection ?? null));
      console.log('    default_payment_method:', s.default_payment_method ?? '(none)');
      console.log('    payment_settings:', JSON.stringify(s.payment_settings ?? null));
      console.log('    metadata:', JSON.stringify(s.metadata ?? {}));
      console.log('    price:', item?.price?.id ?? '(none)', '| amount:', item?.price?.unit_amount ?? '(none)', '| interval:', item?.price?.recurring?.interval ?? '(none)');
      console.log('    product:', item?.price?.product ?? '(none)');
    }

    console.log(`\n=== 4. Invoices for ${customer.id} (up to 50) ===`);
    const invs = await stripeGet(`/invoices?customer=${customer.id}&limit=50`);
    if (!invs.data || invs.data.length === 0) console.log('  (none)');
    for (const inv of invs.data) {
      console.log(
        `  ${inv.id} | created=${iso(inv.created)} | status=${inv.status} | amount_due=${(inv.amount_due ?? 0) / 100} | amount_paid=${(inv.amount_paid ?? 0) / 100} | paid=${inv.paid} | sub=${inv.subscription ?? '(none)'} | PI=${inv.payment_intent ?? '(none)'} | charge=${inv.charge ?? '(none)'}`,
      );
    }

    console.log(`\n=== 5. PaymentIntents for ${customer.id} (up to 50) ===`);
    const pis = await stripeGet(`/payment_intents?customer=${customer.id}&limit=50`);
    if (!pis.data || pis.data.length === 0) console.log('  (none)');
    for (const pi of pis.data) {
      console.log(
        `  ${pi.id} | created=${iso(pi.created)} | status=${pi.status} | amount=${(pi.amount ?? 0) / 100} | captured=${pi.captured ?? '(n/a)'} | latest_charge=${pi.latest_charge ?? '(none)'}`,
      );
    }

    console.log(`\n=== 6. Charges for ${customer.id} (up to 50) ===`);
    const chs = await stripeGet(`/charges?customer=${customer.id}&limit=50`);
    if (!chs.data || chs.data.length === 0) console.log('  (none)');
    for (const ch of chs.data) {
      console.log(
        `  ${ch.id} | created=${iso(ch.created)} | status=${ch.status} | paid=${ch.paid} | amount=${(ch.amount ?? 0) / 100} | refunded=${(ch.amount_refunded ?? 0) / 100} | invoice=${ch.invoice ?? '(none)'}`,
      );
    }
  }

  console.log('\n=== 7. Done (read-only) ===');
}

main().catch((err) => {
  console.error('PROBE ERROR:', err.message);
  process.exit(1);
});

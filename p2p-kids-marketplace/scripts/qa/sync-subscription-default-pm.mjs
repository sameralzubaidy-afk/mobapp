#!/usr/bin/env node
/**
 * FIX-Task-35 item 9 (2026-09-14) — `qa:sync-subscription-default-pm`: repair a
 * subscription whose Stripe-side default card drifted away from the card the app
 * shows the user.
 *
 * WHY THIS EXISTS (FIX-Task-34 F6)
 *   A recurring renewal is charged BY STRIPE — no app code is in the loop — so
 *   Stripe resolves the card itself, in this order:
 *     1. `subscription.default_payment_method`
 *     2. `customer.invoice_settings.default_payment_method`
 *     3. `customer.default_source`
 *   Two writers used to move `subscriptions.stripe_payment_method_id` in the DB
 *   without telling Stripe (`get-payment-method` wrote nothing at all;
 *   `attach-payment-method` set only the CUSTOMER level and swallowed failures).
 *   FIX-Task-34 fixed both writers going forward, but the live row was left
 *   drifted: the DB says the user replaced their card, and Stripe would still
 *   charge the OLD one. This tool closes that specific gap.
 *
 * WHAT IT WRITES
 *   The DB's `subscriptions.stripe_payment_method_id` is treated as the intent of
 *   record (it is what the app displays), and it is pushed to BOTH Stripe levels —
 *   subscription first, because that is the one renewals consult.
 *
 * SAFETY
 *   * DRY RUN by default; `--yes` performs the writes.
 *   * It never creates, attaches, or detaches a PaymentMethod — it only points a
 *     default at a PM id the DB already records.
 *   * It refuses to run against anything but a test-mode key.
 *   * It verifies the PM belongs to the subscription's customer before writing,
 *     so a stale/foreign id is reported rather than set.
 *
 * AUTH: a WRITER, so it uses the fixture test-mode secret key at
 * `~/.dt11-stripe-key` (never echoed).
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:sync-subscription-default-pm                    # DRY RUN
 *   npm run qa:sync-subscription-default-pm -- --yes
 *   npm run qa:sync-subscription-default-pm -- --user test-buyer --yes
 *
 * EXIT 0 = nothing to do / all synced | 1 = drift found (dry run) or a failure | 2 = setup.
 */
import { getClients, getStripeKey, PERSONAS } from './lib/r41-common.mjs';

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const APPLY = argv.includes('--yes');
const ONLY_USER = flagValue('user');
const STRIPE_VERSION = '2023-10-16';
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];
const redact = (s) => String(s).replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_***');

async function stripeCall(key, path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_VERSION,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${json?.error?.code || ''} ${json?.error?.message || ''}`.trim());
  }
  return json;
}

async function main() {
  const key = getStripeKey();
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    console.error('REFUSED: the fixture key is not a test-mode key.');
    process.exit(2);
  }
  const { admin } = getClients();

  let query = admin
    .from('subscriptions')
    .select('id,user_id,stripe_subscription_id,stripe_customer_id,stripe_payment_method_id,status')
    .not('stripe_subscription_id', 'is', null)
    .not('stripe_payment_method_id', 'is', null)
    .in('status', LIVE_STATUSES);
  if (ONLY_USER && PERSONAS[ONLY_USER]) query = query.eq('user_id', PERSONAS[ONLY_USER].id);

  const { data: subs, error } = await query;
  if (error) {
    console.error(`[sync-sub-default-pm] DB read failed: ${redact(error.message)}`);
    process.exit(2);
  }

  const rows = subs ?? [];
  console.log(`[sync-sub-default-pm] ${rows.length} live subscription(s) with a recorded card`);

  const drifted = [];
  for (const s of rows) {
    let sub;
    try {
      sub = await stripeCall(key, `/subscriptions/${s.stripe_subscription_id}`, {
        body: undefined,
      });
    } catch (err) {
      console.log(`  ${s.stripe_subscription_id}: UNREADABLE — ${redact(err.message)}`);
      continue;
    }
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    let customerDefault = null;
    try {
      const cust = await stripeCall(key, `/customers/${customerId}`);
      customerDefault = cust?.invoice_settings?.default_payment_method ?? null;
    } catch {
      /* reported via customerDefault staying null */
    }

    const subDefault = sub.default_payment_method ?? null;
    const dbPm = s.stripe_payment_method_id;
    const matches = subDefault === dbPm && customerDefault === dbPm;
    console.log(
      `  ${s.stripe_subscription_id} (${s.status})\n` +
        `     DB card          ${dbPm}\n` +
        `     subscription PM  ${subDefault ?? 'None'}   <- renewals read this first\n` +
        `     customer PM      ${customerDefault ?? 'None'}\n` +
        `     ${matches ? '✅ in sync' : '❌ DRIFTED'}`,
    );
    if (!matches) {
      // Never blindly trust the DB id: prove Stripe knows it and it belongs to
      // THIS customer, otherwise we would be pointing a renewal at a foreign PM.
      let pmOwner = null;
      try {
        const pm = await stripeCall(key, `/payment_methods/${dbPm}`);
        pmOwner = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id ?? null;
      } catch {
        /* handled below */
      }
      if (pmOwner !== customerId) {
        console.log(
          `     ⚠️  SKIPPED — ${dbPm} is not attached to ${customerId} (owner=${pmOwner ?? 'unreadable'}). Needs human review.`,
        );
        continue;
      }
      drifted.push({ ...s, customer_id: customerId, sub_default: subDefault, customer_default: customerDefault });
    }
  }

  if (!drifted.length) {
    console.log('\n✅ Nothing to sync.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — ${drifted.length} subscription(s) would be re-pointed. Re-run with --yes to apply.`);
    process.exit(1);
  }

  const failures = [];
  for (const d of drifted) {
    try {
      const sub = await stripeCall(key, `/subscriptions/${d.stripe_subscription_id}`, {
        method: 'POST',
        body: { default_payment_method: d.stripe_payment_method_id },
      });
      console.log(`   ✅ subscription ${d.stripe_subscription_id} → default_payment_method=${sub.default_payment_method}`);

      const cust = await stripeCall(key, `/customers/${d.customer_id}`, {
        method: 'POST',
        body: { 'invoice_settings[default_payment_method]': d.stripe_payment_method_id },
      });
      console.log(
        `   ✅ customer ${d.customer_id} → invoice_settings.default_payment_method=${cust?.invoice_settings?.default_payment_method}`,
      );
    } catch (err) {
      failures.push(`${d.stripe_subscription_id}: ${redact(err.message)}`);
      console.error(`   ❌ ${d.stripe_subscription_id}: ${redact(err.message)}`);
    }
  }

  console.log(`\n[sync-sub-default-pm] synced ${drifted.length - failures.length}/${drifted.length}`);
  if (failures.length) {
    for (const f of failures) console.log(`   ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`[sync-sub-default-pm] ${redact(err instanceof Error ? err.message : err)}`);
  process.exit(2);
});

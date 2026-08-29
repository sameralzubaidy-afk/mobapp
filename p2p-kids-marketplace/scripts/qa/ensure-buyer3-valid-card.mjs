/**
 * DEV-TASK-44 (2026-08-29) — Item 1b fixture repair:
 * "Give buyer-3 a valid saved Stripe payment method"
 *
 * QA run (2026-08-28, decision-outcome-log §4.1/P1) found that buyer-3
 * (`test-buyer-3@kidsmarketplace.test`) only has an invalid/unusable saved card,
 * which blocked the full 3-buyer variant of TRD-TC-B03. This script attaches a
 * VALID Stripe test card to buyer-3's customer and persists it to
 * `subscriptions.stripe_payment_method_id` so the deterministic DT41 selection
 * (and the `payment_card` QA toggle, Dev Task 44 item 1) return a working card.
 *
 * DEV-TASK-51 (2026-08-29) — NOTE: this is the buyer-3-specific single-persona
 * script. The generalized version lives in `ensure-valid-cards.mjs`
 * (`npm run qa:ensure-cards`), which provisions a valid saved card for ALL QA
 * buyer personas (test-buyer, test-free, test-buyer-2, test-buyer-3) with
 * `--persona <name>` targeting — use that for new runs; this script is kept for
 * backward compatibility with existing runbooks.
 *
 * The valid card is created from the magic test token `tok_mastercard` (BP-69),
 * which yields MASTERCARD •••• 4444 — the exact brand+last4 the QA run confirmed
 * works on this account (VISA 4242 was the invalid one). This also means the
 * `p2pkidsmarketplace://qa-dev-toggle?key=payment_card&value=mastercard_4444`
 * toggle can select it deterministically on buyer-3 too.
 *
 * Flow:
 *   1. Resolve buyer-3's user id (fixed UUID fallback + email lookup).
 *   2. Read the current `subscriptions` row (customer id, pm id).
 *   3. Create a Stripe TEST PaymentMethod from `tok_mastercard` (BP-69).
 *   4. Attach it to buyer-3's customer (creating the customer if missing).
 *   5. Update `subscriptions.stripe_payment_method_id` (+ `stripe_customer_id`
 *      if newly created).
 *   6. Verify: Stripe `paymentMethods.retrieve` + a `subscriptions` read-back.
 *
 * Run:  node scripts/qa/ensure-buyer3-valid-card.mjs [--dry-run]
 *       --dry-run  print current state + what would change, make no mutations
 *
 * Stripe test key: read from `~/.dt11-stripe-key` (session-local, never committed)
 * — same convention as verify-dt33-lazy-customer.mjs.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !STRIPE_KEY) {
  console.error('❌ Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STRIPE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// buyer-3 fixture (matches seed-staging-data.ts)
const BUYER3_EMAIL = 'test-buyer-3@kidsmarketplace.test';
const BUYER3_UUID = 'a1234567-0000-0000-0000-000000000004';

function log(...a) {
  console.log('[dt44-buyer3]', ...a);
}

async function stripeCall(method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  log(`Target: ${SUPABASE_URL}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  // 1. Resolve buyer-3 user id.
  let userId = BUYER3_UUID;
  const { data: byEmail } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = (byEmail?.users ?? []).find((u) => u.email === BUYER3_EMAIL);
  if (match) {
    userId = match.id;
    log(`✅ buyer-3 resolved by email: ${BUYER3_EMAIL} -> ${userId}`);
  } else {
    log(`⚠️  buyer-3 email not found in auth.users — using fixed UUID ${userId} (verify it exists)`);
  }

  // 2. Read current subscriptions row.
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (subErr) {
    console.error(`❌ subscriptions read failed: ${subErr.message}`);
    process.exit(1);
  }
  const customerId = sub?.stripe_customer_id ?? null;
  const storedPmId = sub?.stripe_payment_method_id ?? null;
  log(`📋 subscriptions: customer=${customerId ?? 'NULL'} pm=${storedPmId ?? 'NULL'} status=${sub?.status ?? '(none)'}`);

  // Show what the deterministic get-payment-method would currently return.
  if (customerId) {
    const pmList = await stripeCall('GET', `/customers/${customerId}/payment_methods?type=card&limit=20`);
    log(`📋 existing cards on customer ${customerId}:`);
    for (const pm of pmList?.data ?? []) {
      log(`   - ${pm.id}  ${pm.card?.brand} •••• ${pm.card?.last4}  exp ${pm.card?.exp_month}/${pm.card?.exp_year}`);
    }
  } else {
    log('ℹ️  buyer-3 has NO Stripe customer — one will be created.');
  }

  if (DRY_RUN) {
    log('DRY-RUN complete — would attach MASTERCARD 4444 and persist it to subscriptions.');
    return;
  }

  // 3. Create the valid MASTERCARD •••• 4444 test PM (BP-69: magic token).
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_mastercard' });
  log(`✅ Stripe test PM created: ${pm.id} (${pm.card?.brand} •••• ${pm.card?.last4})`);

  // 4. Attach to the customer (create if missing).
  let finalCustomerId = customerId;
  if (!finalCustomerId) {
    const cust = await stripeCall('POST', '/customers', {
      email: BUYER3_EMAIL,
      description: 'test-buyer-3 (Dev Task 44 fixture)',
    });
    finalCustomerId = cust.id;
    log(`✅ Stripe customer created: ${finalCustomerId}`);
  }
  await stripeCall('POST', `/payment_methods/${pm.id}/attach`, { customer: finalCustomerId });
  log(`✅ PM ${pm.id} attached to customer ${finalCustomerId}`);

  // 5. Persist to subscriptions.
  const { error: updateErr } = await admin
    .from('subscriptions')
    .update({
      stripe_payment_method_id: pm.id,
      ...(customerId ? {} : { stripe_customer_id: finalCustomerId }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateErr) {
    console.error(`❌ subscriptions update failed: ${updateErr.message}`);
    process.exit(1);
  }
  log(`✅ subscriptions updated: pm=${pm.id}${customerId ? '' : ` customer=${finalCustomerId}`}`);

  // 6. Verify — Stripe + DB read-back.
  const verifyPm = await stripeCall('GET', `/payment_methods/${pm.id}`);
  const { data: subAfter } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('user_id', userId)
    .maybeSingle();
  log(`✅ VERIFY — Stripe PM ${verifyPm.id}: ${verifyPm.card?.brand} •••• ${verifyPm.card?.last4}, attached=${verifyPm.customer}`);
  log(`✅ VERIFY — subscriptions AFTER: customer=${subAfter?.stripe_customer_id ?? 'NULL'} pm=${subAfter?.stripe_payment_method_id}`);

  const ok =
    verifyPm.id === pm.id &&
    String(verifyPm.card?.last4) === '4444' &&
    subAfter?.stripe_payment_method_id === pm.id;
  if (!ok) {
    console.error('❌ VERIFY FAILED — fixture not correctly provisioned.');
    process.exit(1);
  }
  log('🎉 buyer-3 now has a valid saved card (MASTERCARD •••• 4444). B03 3-buyer variant unblocked.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});

/**
 * DEV-TASK-51 (2026-08-29) — Item 3: ship every QA buyer persona with a valid
 * saved Stripe card.
 *
 * Generalization of `ensure-buyer3-valid-card.mjs` (Dev Task 44) to cover ALL
 * QA buyer personas, so no persona needs mid-run card provisioning. The QA run
 * found that only some buyers had a usable saved card (VISA 4242 was invalid on
 * this account, MASTERCARD 4444 worked), forcing an ad-hoc provisioning script
 * mid-run. This makes card provisioning a fixture-seeding step instead.
 *
 * Flow (per persona):
 *   1. Resolve the persona's user id (fixed UUID fallback + email lookup).
 *   2. Read the current `subscriptions` row (customer id, pm id).
 *   3. Create a Stripe TEST PaymentMethod from the magic token `tok_mastercard`
 *      (BP-69) — yields MASTERCARD •••• 4444, the brand+last4 confirmed valid.
 *   4. Attach it to the persona's Stripe customer (creating the customer if
 *      missing).
 *   5. Update `subscriptions.stripe_payment_method_id` (+ `stripe_customer_id`
 *      if newly created).
 *   6. Verify: Stripe `paymentMethods.retrieve` + a `subscriptions` read-back.
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:ensure-cards                       # all QA buyer personas
 *   npm run qa:ensure-cards -- --persona test-buyer-3   # one persona
 *   npm run qa:ensure-cards -- --dry-run          # preview only
 *
 * The old script name (`npm run qa:ensure-buyer3-card`) still works — it
 * delegates here with `--persona test-buyer-3` (see ensure-buyer3-valid-card.mjs).
 *
 * Stripe test key: read from `~/.dt11-stripe-key` (session-local, never committed).
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_PERSONA = (() => {
  const idx = process.argv.indexOf('--persona');
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

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

/**
 * QA buyer personas that need a valid saved card for checkout flows. Fixed
 * UUIDs match `TEST_USERS` in scripts/seed-staging-data.ts.
 */
const QA_BUYER_PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test' },
};

/** The magic Stripe TEST token that yields the confirmed-valid MASTERCARD •••• 4444 (BP-69). */
const CARD_TOKEN = 'tok_mastercard';
const CARD_LABEL = 'MASTERCARD •••• 4444';

function log(...a) {
  console.log('[qa:ensure-cards]', ...a);
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

/** Provision a valid saved card for ONE persona. Returns true on success. */
async function ensureCardFor(personaName, persona) {
  const tag = `[${personaName}]`;
  log(`${tag} resolving user for ${persona.email}...`);

  // 1. Resolve user id.
  let userId = persona.id;
  const { data: byEmail } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = (byEmail?.users ?? []).find((u) => u.email === persona.email);
  if (match) {
    userId = match.id;
    log(`${tag} ✅ resolved by email -> ${userId}`);
  } else {
    log(`${tag} ⚠️  email not found in auth.users — using fixed UUID ${userId}`);
  }

  // 2. Read current subscriptions row.
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (subErr) {
    log(`${tag} ❌ subscriptions read failed: ${subErr.message}`);
    return false;
  }
  const customerId = sub?.stripe_customer_id ?? null;
  const storedPmId = sub?.stripe_payment_method_id ?? null;
  log(`${tag} 📋 subscriptions: customer=${customerId ?? 'NULL'} pm=${storedPmId ?? 'NULL'} status=${sub?.status ?? '(none)'}`);

  // Show current cards on the customer (diagnostic).
  if (customerId) {
    const pmList = await stripeCall('GET', `/customers/${customerId}/payment_methods?type=card&limit=20`);
    for (const pm of pmList?.data ?? []) {
      log(`${tag}   existing card: ${pm.id}  ${pm.card?.brand} •••• ${pm.card?.last4}  exp ${pm.card?.exp_month}/${pm.card?.exp_year}`);
    }
  } else {
    log(`${tag} ℹ️  no Stripe customer yet — one will be created.`);
  }

  if (DRY_RUN) {
    log(`${tag} DRY-RUN — would attach ${CARD_LABEL} and persist it.`);
    return true;
  }

  // 3. Create the valid MASTERCARD •••• 4444 test PM (BP-69: magic token).
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': CARD_TOKEN });
  log(`${tag} ✅ Stripe test PM created: ${pm.id} (${pm.card?.brand} •••• ${pm.card?.last4})`);

  // 4. Attach to the customer (create if missing).
  let finalCustomerId = customerId;
  if (!finalCustomerId) {
    const cust = await stripeCall('POST', '/customers', {
      email: persona.email,
      description: `${personaName} (Dev Task 51 fixture)`,
    });
    finalCustomerId = cust.id;
    log(`${tag} ✅ Stripe customer created: ${finalCustomerId}`);
  }
  await stripeCall('POST', `/payment_methods/${pm.id}/attach`, { customer: finalCustomerId });
  log(`${tag} ✅ PM ${pm.id} attached to customer ${finalCustomerId}`);

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
    log(`${tag} ❌ subscriptions update failed: ${updateErr.message}`);
    return false;
  }
  log(`${tag} ✅ subscriptions updated: pm=${pm.id}${customerId ? '' : ` customer=${finalCustomerId}`}`);

  // 6. Verify — Stripe + DB read-back.
  const verifyPm = await stripeCall('GET', `/payment_methods/${pm.id}`);
  const { data: subAfter } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('user_id', userId)
    .maybeSingle();
  log(`${tag} ✅ VERIFY — Stripe PM ${verifyPm.id}: ${verifyPm.card?.brand} •••• ${verifyPm.card?.last4}, attached=${verifyPm.customer}`);
  log(`${tag} ✅ VERIFY — subscriptions AFTER: customer=${subAfter?.stripe_customer_id ?? 'NULL'} pm=${subAfter?.stripe_payment_method_id}`);

  const ok =
    verifyPm.id === pm.id &&
    String(verifyPm.card?.last4) === '4444' &&
    subAfter?.stripe_payment_method_id === pm.id;
  if (!ok) {
    log(`${tag} ❌ VERIFY FAILED — fixture not correctly provisioned.`);
    return false;
  }
  log(`${tag} 🎉 ${personaName} now has a valid saved card (${CARD_LABEL}).`);
  return true;
}

async function main() {
  let personas = Object.entries(QA_BUYER_PERSONAS);
  if (ONLY_PERSONA) {
    if (!QA_BUYER_PERSONAS[ONLY_PERSONA]) {
      console.error(`❌ Unknown persona '${ONLY_PERSONA}'. Known: ${Object.keys(QA_BUYER_PERSONAS).join(', ')}`);
      process.exit(2);
    }
    personas = [[ONLY_PERSONA, QA_BUYER_PERSONAS[ONLY_PERSONA]]];
  }

  log(`Target: ${SUPABASE_URL}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  let allOk = true;
  for (const [name, persona] of personas) {
    try {
      const ok = await ensureCardFor(name, persona);
      allOk = allOk && ok;
    } catch (err) {
      allOk = false;
      log(`[${name}] ❌ error: ${err?.message || err}`);
    }
  }

  if (!allOk) {
    console.error('❌ One or more personas failed provisioning.');
    process.exit(1);
  }
  log('🎉 All QA buyer personas now have a valid saved card.');
}

// Export so the legacy ensure-buyer3-valid-card.mjs wrapper can delegate.
export { main as runEnsureValidCards };

// Run directly when invoked as the entrypoint.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('❌ Unexpected error:', err?.message || err);
    process.exit(1);
  });
}

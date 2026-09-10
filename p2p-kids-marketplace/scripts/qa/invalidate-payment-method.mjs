/**
 * FIX-Task-11 (2026-09-10) — QA fixture: invalidate a persona's saved Stripe card.
 *
 * PURPOSE
 * -------
 * FIX-Task-9's self-heal retry logic (src/services/trade.ts `createTradeOfferWithHold`)
 * has two outcomes:
 *   1. the saved card drifted but a DIFFERENT usable card is available → transparent
 *      auto-retry with the fresh card, offer succeeds (already proven on-device);
 *   2. the saved card is GENUINELY unusable → no alternative card to fall back to,
 *      so the friendly decline copy is surfaced (previously unit-test-only).
 * Outcome 2 is entered whenever the `create-trade-offer` Edge Function rejects with a
 * PM_STALE_RETRY_CODES code (INVALID_PAYMENT_METHOD / CARD_DECLINED /
 * STRIPE_HOLD_FAILED / STRIPE_ERROR). There was no QA way to create that state, so
 * the rejection branch could never be exercised on-device. This script closes that gap.
 *
 * HOW THE STATE IS CREATED (empirically verified against test-mode Stripe)
 * -----------------------------------------------------------------------
 * The Edge Function validates the buyer's saved card like this (create-trade-offer):
 *
 *     const pm = await stripe.paymentMethods.retrieve(payment_method_id);
 *     if (pm.customer === null)            await stripe.paymentMethods.attach(pm, { customer });
 *     else if (pm.customer !== customerId) { await detach(pm); await attach(pm, { customer }); }
 *
 * NOTE (important, verified 2026-09-10 — this is why the fixture detaches rather than
 * "deletes"): Stripe has NO delete endpoint for a card PaymentMethod ("DELETE
 * /v1/payment_methods/:id" → `Unrecognized request URL`), so a "deleted" card cannot be
 * simulated. But DETACHING is enough, and is in fact stronger than expected: Stripe
 * permanently refuses to re-attach a card PaymentMethod that was detached from a
 * customer —
 *
 *     "This PaymentMethod was previously used without being attached to a Customer or
 *      was detached from a Customer, and may not be used again."
 *
 * So after a detach, the EF's `retrieve` still succeeds (200) but its `attach` step
 * throws → the outer catch returns 400 `INVALID_PAYMENT_METHOD`. That is byte-for-byte
 * the rejection FIX-Task-9 branches on, and it requires no synthetic/invalid data at all.
 *
 * The script detaches EVERY card on the persona's Stripe customer (not just the stored
 * one). This is deliberate: the `get-payment-method` EF performs deterministic card
 * selection (Dev Task 41) and would silently auto-swap in another attached card, which
 * would produce outcome 1 (silent self-heal) instead of the rejection branch. Leaving no
 * attached card is what makes outcome 2 reachable.
 *
 * The DB is left UNCHANGED — `subscriptions.stripe_payment_method_id` keeps pointing at
 * the now-unusable card, which is the whole point: the app *thinks* it has a valid saved
 * card and doesn't. The `get-payment-method` EF keeps returning that same id (a detached
 * pm is still retrievable), so the app submits it, the EF rejects it, and the self-heal
 * re-read returns the SAME id → no retry → friendly decline. No loop, no crash.
 *
 * USAGE (run from p2p-kids-marketplace/)
 * --------------------------------------
 *   npm run qa:invalidate-payment-method -- --persona test-buyer
 *   npm run qa:invalidate-payment-method -- --persona test-buyer --dry-run
 *   npm run qa:invalidate-payment-method -- --persona test-buyer --restore
 *
 * Restore creates a fresh valid MASTERCARD •••• 4444 and re-attaches it. A detached card
 * can never be re-attached (Stripe rule above), so a NEW card is the only restore path.
 * Card creation is delegated to the existing `qa:ensure-cards` tool — one canonical
 * implementation of card provisioning, not a second copy.
 *
 * SAFETY GUARDRAILS
 * -----------------
 *   - The Stripe key MUST be test-mode (`sk_test_...`). A live key hard-fails (exit 2).
 *     Key source: `STRIPE_SECRET_KEY` env var if set, else `~/.dt11-stripe-key`.
 *   - `--persona` must be in the allowlist below (QA buyer personas whose restore path is
 *     sanctioned). Arbitrary / production customer ids are impossible by construction.
 *   - Every detached card id is logged AND written to a state file for audit + restore.
 *   - `--dry-run` performs no mutations.
 *
 * AFTERWARDS — the standing A1 procedure is in the QA playbook
 * (.github/instructions/QA-Test-Agent.instructions.md §5.74): invalidate → offer
 * on-device (expect the friendly decline) → `--restore` → offer works again.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKETPLACE_ROOT = resolve(__dirname, '..', '..');
dotenv.config({ path: resolve(MARKETPLACE_ROOT, '.env') });
dotenv.config({ path: resolve(MARKETPLACE_ROOT, '.env.staging') });

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const PERSONA = argValue('persona');
const RESTORE = process.argv.includes('--restore');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Persona allowlist ────────────────────────────────────────────────────────
// Deliberately limited to the QA BUYER personas that `qa:ensure-cards` covers, so the
// restore path is always guaranteed to work. Fixed UUIDs mirror TEST_USERS in
// scripts/seed-staging-data.ts (used as a fallback — listUsers pagination misses
// early-created personas once staging has >1000 throwaway users).
const PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test' },
};

const STATE_DIR = resolve(tmpdir(), 'qa-invalidate-payment-method');
const statePathFor = (persona) => resolve(STATE_DIR, `${persona}.json`);

function log(...a) {
  console.log('[qa:invalidate-payment-method]', ...a);
}
function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}
function hardFail(msg) {
  console.error(`🛑 ${msg}`);
  process.exit(2);
}

// ── Guardrail 1: test-mode Stripe key only ───────────────────────────────────
function loadStripeKey() {
  const fromEnv = (process.env.STRIPE_SECRET_KEY || '').trim();
  const keyPath = resolve(process.env.HOME || '~', '.dt11-stripe-key');
  const key = fromEnv || (existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : '');
  const source = fromEnv ? 'STRIPE_SECRET_KEY env var' : '~/.dt11-stripe-key';

  if (!key) {
    hardFail(`No Stripe key found. Set STRIPE_SECRET_KEY or create ${keyPath}.`);
  }
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
    hardFail(
      `LIVE Stripe key detected (source: ${source}). This fixture DETACHES saved cards and ` +
        `must never run against live mode. Use a test key (sk_test_...).`
    );
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    hardFail(
      `Stripe key is not recognisably test-mode (source: ${source}, prefix "${key.slice(0, 8)}…"). ` +
        `Expected sk_test_... . Refusing to run.`
    );
  }
  log(`✅ Guardrail: test-mode Stripe key confirmed (source: ${source}).`);
  return key;
}

// ── Stripe REST helper (same shape as qa:ensure-cards) ───────────────────────
function makeStripeClient(key) {
  return async function stripeCall(method, path, form) {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}` },
      body: form ? new URLSearchParams(form) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    // Return the raw result — callers decide whether a non-2xx is expected
    // (the fixture deliberately probes an attach that MUST fail).
    // NOTE: Stripe's "may not be used again" error carries `type` but no `code`,
    // so fall back to `type` to keep the proof line informative.
    return {
      ok: res.ok,
      status: res.status,
      code: json?.error?.code ?? json?.error?.type ?? null,
      msg: json?.error?.message ?? null,
      data: json,
    };
  };
}

function requireEnv() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) {
    hardFail(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — check p2p-kids-marketplace/.env (or .env.staging).'
    );
  }
  return { url, serviceRole };
}

function requirePersona() {
  if (!PERSONA) {
    hardFail(`--persona <name> is required. Known: ${Object.keys(PERSONAS).join(', ')}`);
  }
  if (!PERSONAS[PERSONA]) {
    hardFail(
      `Persona '${PERSONA}' is not in the allowlist (${Object.keys(PERSONAS).join(', ')}). ` +
        `Only sanctioned QA buyer personas may be invalidated.`
    );
  }
  return PERSONAS[PERSONA];
}

/** Resolve the persona's live auth user id (email lookup, fixed-UUID fallback). */
async function resolveUserId(admin, persona, name) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = (listed?.users ?? []).find((u) => u.email === persona.email);
  if (match) {
    log(`[${name}] resolved by email -> ${match.id}`);
    return match.id;
  }
  log(`[${name}] ⚠️  email not in first 1000 users — falling back to fixture UUID ${persona.id}`);
  return persona.id;
}

async function readSubscription(admin, userId) {
  const { data, error } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(`subscriptions read failed: ${error.message}`);
  return data ?? null;
}

/** List the cards currently attached to a customer. */
async function listAttachedCards(stripeCall, customerId) {
  const res = await stripeCall('GET', `/customers/${customerId}/payment_methods?type=card&limit=20`);
  if (!res.ok) {
    fail(`Could not list cards for ${customerId}: ${res.status} ${res.code ?? ''} ${res.msg ?? ''}`);
  }
  return res.data?.data ?? [];
}

// ── Invalidate ───────────────────────────────────────────────────────────────
async function invalidate() {
  const key = loadStripeKey();
  const stripeCall = makeStripeClient(key);
  const persona = requirePersona();
  const { url, serviceRole } = requireEnv();

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log(`Target Supabase: ${url}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  const userId = await resolveUserId(admin, persona, PERSONA);
  const sub = await readSubscription(admin, userId);
  const customerId = sub?.stripe_customer_id ?? null;
  const storedPmId = sub?.stripe_payment_method_id ?? null;

  log(`[${PERSONA}] subscriptions BEFORE — customer=${customerId ?? 'NULL'} pm=${storedPmId ?? 'NULL'} status=${sub?.status ?? '(none)'}`);

  if (!storedPmId || !customerId) {
    hardFail(
      `Persona has no saved payment method to invalidate (customer=${customerId ?? 'NULL'}, pm=${storedPmId ?? 'NULL'}). ` +
        `Establish the baseline first: npm run qa:ensure-cards -- --persona ${PERSONA}`
    );
  }

  const cards = await listAttachedCards(stripeCall, customerId);
  if (cards.length === 0) {
    log(`[${PERSONA}] ℹ️  no ATTACHED cards found on ${customerId} — already invalidated?`);
    log(`[${PERSONA}]     (stored pm ${storedPmId} may already be detached. Re-run --restore to recover.)`);
    return;
  }
  for (const pm of cards) {
    log(`[${PERSONA}]   attached: ${pm.id} ${pm.card?.brand} •••• ${pm.card?.last4} exp ${pm.card?.exp_month}/${pm.card?.exp_year}`);
  }
  if (!cards.some((pm) => pm.id === storedPmId)) {
    log(`[${PERSONA}] ⚠️  stored pm ${storedPmId} is not among the attached cards (already detached).`);
  }

  if (DRY_RUN) {
    log(`[${PERSONA}] DRY-RUN — would DETACH ${cards.length} card(s): ${cards.map((c) => c.id).join(', ')}`);
    log(`[${PERSONA}] DRY-RUN — subscriptions row would be left UNCHANGED (stored pm stays ${storedPmId}).`);
    return;
  }

  // Detach every card. See the file header: no attached card may remain, otherwise the
  // get-payment-method EF's deterministic selection silently swaps in another card and
  // the app self-heals (outcome 1) instead of surfacing the rejection (outcome 2).
  const detached = [];
  for (const pm of cards) {
    if (pm.customer) {
      const res = await stripeCall('POST', `/payment_methods/${pm.id}/detach`);
      if (!res.ok) fail(`detach failed for ${pm.id}: ${res.status} ${res.code ?? ''} ${res.msg ?? ''}`);
    }
    detached.push(pm.id);
    log(`[${PERSONA}] ✅ detached ${pm.id} (${pm.card?.brand} •••• ${pm.card?.last4})`);
  }

  // ── PROOF the fixture state is correct: the EF's attach step must now be refused ──
  // Re-attempting the attach is exactly what create-trade-offer does; Stripe refusing it
  // is what produces INVALID_PAYMENT_METHOD. If it unexpectedly succeeds (Stripe change),
  // re-detach immediately and report the fixture as broken rather than reporting success.
  const attachProbe = await stripeCall('POST', `/payment_methods/${storedPmId}/attach`, { customer: customerId });
  let unusable = !attachProbe.ok;
  if (attachProbe.ok) {
    log(`[${PERSONA}] ⚠️  attach probe UNEXPECTEDLY succeeded — Stripe now allows re-attaching a detached card.`);
    await stripeCall('POST', `/payment_methods/${storedPmId}/detach`);
    log(`[${PERSONA}]     re-detached ${storedPmId} to keep the invalidated state.`);
  } else {
    log(`[${PERSONA}] ✅ PROOF — re-attach refused by Stripe (${attachProbe.code}): ${attachProbe.msg}`);
    log(`[${PERSONA}]     → create-trade-offer will now return 400 INVALID_PAYMENT_METHOD for this pm.`);
  }

  // ── DB verification hook: the stored reference is deliberately left in place ──
  const after = await readSubscription(admin, userId);
  const dbUnchanged =
    after?.stripe_customer_id === customerId && after?.stripe_payment_method_id === storedPmId;
  log(`[${PERSONA}] subscriptions AFTER  — customer=${after?.stripe_customer_id ?? 'NULL'} pm=${after?.stripe_payment_method_id ?? 'NULL'}`);
  log(
    dbUnchanged
      ? `[${PERSONA}] ✅ VERIFY — DB reference deliberately UNCHANGED (app still believes this pm is valid).`
      : `[${PERSONA}] ❌ VERIFY — DB reference changed unexpectedly; the fixture did not establish the intended state.`
  );

  // Audit trail + restore input.
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(
    statePathFor(PERSONA),
    JSON.stringify(
      {
        persona: PERSONA,
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_payment_method_id: storedPmId,
        detached_payment_method_ids: detached,
        attach_refused: unusable,
        invalidated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  log(`[${PERSONA}] 🗒️  state written: ${statePathFor(PERSONA)}`);

  if (!unusable || !dbUnchanged) fail('Fixture did not establish the intended invalid state — see the checks above.');

  log('');
  log('✅ PASS — saved card invalidated. The persona now has an unusable saved card with the DB reference intact.');
  log('');
  log('NEXT (standing A1 procedure, QA playbook §5.74):');
  log('  1. Log in as the persona (fresh session) and submit an offer — expect the friendly');
  log('     decline ("Payment method declined. Please update your card."), no loop, no crash.');
  log('  2. Backend-only check of the same rejection:');
  log(`     npm run qa:ef-repro -- --persona ${PERSONA} --ef create-trade-offer --items <available_listing_id>`);
  log('     → expect HTTP 400 { code: "INVALID_PAYMENT_METHOD" }.');
  log('  3. Restore the persona to a working card:');
  log(`     npm run qa:invalidate-payment-method -- --persona ${PERSONA} --restore`);
}

// ── Restore ──────────────────────────────────────────────────────────────────
async function restore() {
  const key = loadStripeKey();
  const stripeCall = makeStripeClient(key);
  const persona = requirePersona();
  const { url, serviceRole } = requireEnv();

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log(`Target Supabase: ${url}`);
  log(`[${PERSONA}] restoring to a working saved card...`);
  if (DRY_RUN) {
    log(`[${PERSONA}] DRY-RUN — would run: npm run qa:ensure-cards -- --persona ${PERSONA}`);
    return;
  }

  const userId = await resolveUserId(admin, persona, PERSONA);
  const before = await readSubscription(admin, userId);
  const customerId = before?.stripe_customer_id ?? null;
  log(`[${PERSONA}] subscriptions BEFORE — customer=${customerId ?? 'NULL'} pm=${before?.stripe_payment_method_id ?? 'NULL'}`);

  // A detached card can never be re-attached (Stripe rule — see the header), so restore
  // must mint a fresh card. Delegate to the canonical provisioning tool.
  log(`[${PERSONA}] delegating card provisioning to qa:ensure-cards (canonical implementation)...`);
  try {
    execFileSync('npm', ['run', 'qa:ensure-cards', '--', '--persona', PERSONA], {
      cwd: MARKETPLACE_ROOT,
      stdio: 'inherit',
    });
  } catch {
    fail(`qa:ensure-cards failed for ${PERSONA} — the persona is still in the invalidated state.`);
  }

  // ── Independent verification of the restored state ──
  const after = await readSubscription(admin, userId);
  const pmId = after?.stripe_payment_method_id ?? null;
  const custId = after?.stripe_customer_id ?? null;
  log(`[${PERSONA}] subscriptions AFTER  — customer=${custId ?? 'NULL'} pm=${pmId ?? 'NULL'}`);

  if (!pmId || !custId) fail(`Restore left no saved card for ${PERSONA}.`);

  const pmRes = await stripeCall('GET', `/payment_methods/${pmId}`);
  const attachOk = pmRes.ok && pmRes.data?.customer === custId;
  log(
    `[${PERSONA}] ${pmRes.ok ? '✅' : '❌'} VERIFY — Stripe pm ${pmId}: ${pmRes.data?.card?.brand} •••• ${pmRes.data?.card?.last4}, attached=${pmRes.data?.customer ?? 'NULL'}`
  );

  const cards = await listAttachedCards(stripeCall, custId);
  log(`[${PERSONA}] ✅ VERIFY — ${cards.length} attached card(s) on ${custId}: ${cards.map((c) => `${c.id} ${c.card?.brand} •••• ${c.card?.last4}`).join(', ') || '(none)'}`);

  // Prove the EF's attach step would now be a no-op (card already on the right customer),
  // i.e. create-trade-offer can get past its payment-method validation again.
  const usable = pmRes.ok && attachOk && pmRes.data?.card?.last4 === '4444';
  if (!usable) fail(`Restore verification failed for ${PERSONA} — persona may still be broken.`);

  const statePath = statePathFor(PERSONA);
  if (existsSync(statePath)) {
    rmSync(statePath);
    log(`[${PERSONA}] 🗒️  cleared state file ${statePath}`);
  }

  log('');
  log(`✅ PASS — ${PERSONA} restored to a valid saved card (MASTERCARD •••• 4444) attached to ${custId}.`);
  log(`   Note: the previously detached card(s) remain detached — Stripe never allows re-attaching them.`);
}

async function main() {
  if (RESTORE) {
    await restore();
  } else {
    await invalidate();
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});

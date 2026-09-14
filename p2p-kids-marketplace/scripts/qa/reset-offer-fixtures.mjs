/**
 * DEV-TASK-51 (2026-08-29) — Item 1: QA offer-fixture reset script.
 *
 * The #1 cost driver in the last TRD run: stale pending offers + stale cart
 * rows accumulated across sessions and caused `MAX_PENDING_OFFERS` and
 * "already in active trade" collisions, each costing a diagnosis-and-cleanup
 * cycle. This script resets the QA buyer personas' offer/cart fixtures in ONE
 * call, and is safely re-runnable at the start of ANY QA session touching
 * offers or bundles.
 *
 * What it does (all service-role, no UI):
 *   1. Deletes every `cart_items` row for the QA buyer personas
 *      (test-buyer, test-free, test-buyer-2, test-buyer-3) — stale bundle carts
 *      from previous runs never leak into a fresh one.
 *   2. Cancels every pending / payment_failed trade where the BUYER is one of
 *      the QA buyer personas (any seller). The direct status UPDATE fires the
 *      same DB triggers the app's cancel path uses (e.g. `fn_release_sp_on_cancel`),
 *      so reserved SP / ledger / notification side effects run correctly. *      FIX-Task-34 (2026-09-14): a raw status UPDATE does NOT cancel the buyer's
 *      Stripe authorization hold — the product cancel path does that, and this
 *      harness bypasses it. Step 2b now releases the uncaptured PaymentIntents
 *      explicitly (see `releaseStripeHolds`), so a reset no longer leaves live
 *      holds on the buyers' cards. *   3. Resets the affected listings back to `available` so they can be re-used.
 *
 * This is the buyer-side counterpart to `npm run cleanup:trades` (which covers
 * test-buyer-as-buyer + test-seller-as-seller for the per-seller cap tests).
 * It intentionally clears ALL QA buyers so a run can never start mid-collision.
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:reset-offer-fixtures            # full reset for all QA buyers
 *   npm run qa:reset-offer-fixtures -- --persona test-buyer   # one persona
 *   npm run qa:reset-offer-fixtures -- --dry-run              # preview only
 *
 * Env: reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from p2p-kids-marketplace/.env
 *      (or .env.staging), same convention as the other QA/seed scripts.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load project env (order matters: .env.staging is loaded second so it can
// override — mirrors cleanup-test-trades.ts).
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_PERSONA = (() => {
  const idx = process.argv.indexOf('--persona');
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * QA buyer personas whose offer/cart fixtures get reset. Fixed UUIDs match
 * `TEST_USERS` in scripts/seed-staging-data.ts (auth users are created with
 * these exact ids via admin.createUser).
 */
const QA_BUYER_PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test' },
};

function log(...a) {
  console.log('[qa:reset-offer-fixtures]', ...a);
}

/**
 * FIX-Task-34 (2026-09-14) — cancel the buyers' UNCAPPED Stripe holds.
 *
 * Mirrors the shipped `_shared/competing-offer-cancel.ts` rule: cancel an
 * uncaptured authorization, and never touch a captured charge (that is money we
 * would owe back as a refund, which is NOT this harness's job).
 *
 * Why not just call the product path? This harness cancels by RAW status update on
 * purpose (it must not depend on app auth), so it has to reproduce the one Stripe
 * side effect it skips. Kept deliberately small: GET the PI, cancel it only when
 * Stripe says it is still cancellable.
 *
 * Uses `~/.dt11-stripe-key` (the test-mode secret key the other fixture scripts
 * use — never echoed). If it is absent the DB reset still succeeds; the Stripe
 * leg is reported as failed rather than silently skipped.
 *
 * @returns {{ cancelled: number, skipped: number, failed: number }}
 */
async function releaseStripeHolds(trades) {
  const result = { cancelled: 0, skipped: 0, failed: 0 };
  const withPi = (trades || []).filter(
    (t) => typeof t.stripe_payment_intent_id === 'string' && t.stripe_payment_intent_id.startsWith('pi_')
  );
  if (!withPi.length) return result;

  let key = '';
  try {
    key = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();
  } catch {
    key = '';
  }
  if (!key) {
    log('⚠️  ~/.dt11-stripe-key not found — Stripe holds NOT released.');
    result.failed = withPi.length;
    return result;
  }

  const headers = { Authorization: `Bearer ${key}`, 'Stripe-Version': '2023-10-16' };
  const CANCELLABLE = [
    'requires_capture',
    'requires_confirmation',
    'requires_action',
    'requires_payment_method',
  ];

  for (const t of withPi) {
    try {
      const piRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${t.stripe_payment_intent_id}`,
        { headers }
      );
      const pi = await piRes.json();
      if (!piRes.ok) {
        result.failed += 1;
        log(`⚠️  PI read failed for ${t.id.slice(0, 8)}…: HTTP ${piRes.status}`);
        continue;
      }
      if (!CANCELLABLE.includes(pi.status)) {
        result.skipped += 1;
        continue;
      }
      const cancelRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${t.stripe_payment_intent_id}/cancel`,
        { method: 'POST', headers }
      );
      if (!cancelRes.ok) {
        result.failed += 1;
        log(`⚠️  PI cancel failed for ${t.id.slice(0, 8)}…: HTTP ${cancelRes.status}`);
        continue;
      }
      result.cancelled += 1;
    } catch (err) {
      result.failed += 1;
      log(`⚠️  Stripe error for ${t.id.slice(0, 8)}…: ${err?.message || err}`);
    }
  }
  return result;
}

/**
 * FIX-Task-24 item 4 (2026-09-12) — void the tax record for every trade this harness
 * just cancelled.
 *
 * WHY: cancelling with a raw status UPDATE (what these harnesses do) skips the tax
 * lifecycle that the app's own cancel path performs. The residue was measurable: 25
 * cancelled trades sat at `tax_status='quoted'` with reason `buyer_cancelled`, which
 * inflated `pending_tax_cents` in the period reports. A cancelled trade can never
 * have collectible tax, so voiding is always the correct cleanup here.
 *
 * The canonical logic stays in the DB — this only CALLS `rpc_void_tax_for_trade`
 * (which also zeroes stale refund fields, DT71). Expected non-void results:
 *   'noop'          = the trade has no tax record (exempt / tax-disabled fixture)
 *   INVALID_STATE   = the record is not voidable (typically already voided)
 *
 * @returns {{ voided: number, noop: number, skipped: number, failed: number }}
 */
async function voidTaxForTrades(admin, tradeIds) {
  const result = { voided: 0, noop: 0, skipped: 0, failed: 0 };

  for (const tradeId of tradeIds) {
    const shortId = String(tradeId).slice(0, 8);
    try {
      const { data, error } = await admin.rpc('rpc_void_tax_for_trade', {
        p_trade_id: tradeId,
        p_reason: 'qa_harness_cancelled',
      });

      if (error) {
        result.failed += 1;
        log(`⚠️  Tax void failed for ${shortId}…: ${error.message}`);
        continue;
      }
      if (data?.success === false) {
        if (data?.error?.code === 'INVALID_STATE') {
          result.skipped += 1;
        } else {
          result.failed += 1;
          log(`⚠️  Tax void error for ${shortId}…: ${data?.error?.code || 'unknown'}`);
        }
        continue;
      }
      if (data?.data?.action === 'noop') {
        result.noop += 1;
        continue;
      }
      result.voided += 1;
    } catch (err) {
      result.failed += 1;
      log(`⚠️  Tax void threw for ${shortId}…: ${err?.message || err}`);
    }
  }

  return result;
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

  const buyerIds = personas.map(([, p]) => p.id);
  log(`Target: ${SUPABASE_URL}`);
  log(`Personas: ${personas.map(([n]) => n).join(', ')}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  // ── 1. Clear stale cart_items for the QA buyers ──────────────────────────
  // DRY-RUN SAFE: count first (SELECT) and only DELETE when not dry-running —
  // a dry-run must never mutate (this was a real bug on first version).
  const { count: cartCount, error: cartCountError } = await admin
    .from('cart_items')
    .select('id', { count: 'exact', head: true })
    .in('user_id', buyerIds);

  if (cartCountError) {
    log(`⚠️  Failed to read cart items: ${cartCountError.message}`);
  } else {
    log(cartCount && cartCount > 0 ? `🧺 ${cartCount} stale cart item(s) found.` : '🧺 No stale cart items.');
  }

  if (!DRY_RUN) {
    const { data: deletedCarts, error: cartError } = await admin
      .from('cart_items')
      .delete()
      .select('id')
      .in('user_id', buyerIds);

    if (cartError) {
      log(`⚠️  Failed to clear cart items: ${cartError.message}`);
    } else {
      const count = deletedCarts?.length ?? 0;
      log(count > 0 ? `🧺 Cleared ${count} stale cart item(s).` : '🧺 No stale cart items.');
    }
  }

  // ── 2. Fetch pending / payment_failed trades for the QA buyers ───────────
  const { data: trades, error: fetchError } = await admin
    .from('trades')
    .select('id, listing_id, status, buyer_id, seller_id, stripe_payment_intent_id')
    .in('buyer_id', buyerIds)
    .in('status', ['pending', 'payment_failed']);

  if (fetchError) {
    console.error(`❌ Failed to fetch trades: ${fetchError.message}`);
    process.exit(1);
  }

  if (!trades || trades.length === 0) {
    log('✅ No pending offers to cancel.');
    if (DRY_RUN) {
      log('DRY-RUN complete — nothing to do beyond cart clear.');
    } else {
      log('✅ RESET COMPLETE.');
    }
    return;
  }

  log(`📋 Found ${trades.length} pending offer(s):`);
  const tradeIds = [];
  const listingIds = new Set();
  for (const t of trades) {
    log(
      `   - ${t.id.slice(0, 8)}…  listing: ${String(t.listing_id).slice(0, 8)}…  buyer: ${String(t.buyer_id).slice(0, 8)}…  status: ${t.status}`
    );
    tradeIds.push(t.id);
    listingIds.add(t.listing_id);
  }

  if (DRY_RUN) {
    log(`DRY-RUN complete — would cancel ${tradeIds.length} offer(s) + reset ${listingIds.size} listing(s).`);
    return;
  }

  // ── 3. Cancel the offers (direct UPDATE fires the release triggers) ──────
  const { error: updateError } = await admin
    .from('trades')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'buyer_cancelled',
      updated_at: new Date().toISOString(),
    })
    .in('id', tradeIds);

  if (updateError) {
    console.error(`❌ Failed to cancel trades: ${updateError.message}`);
    process.exit(1);
  }
  log(`✅ Cancelled ${tradeIds.length} offer(s).`);

  // ── 3b. Release the buyers' Stripe authorization holds ──────────────────
  // FIX-Task-34 (2026-09-14). The raw UPDATE above bypasses the product cancel
  // path (`cancel-trade` / `_shared/competing-offer-cancel.ts`), and cancelling
  // the PI on Stripe is one of the things that path does. So this harness voided
  // the tax (below) but left the buyer's card AUTHORIZED. Measured on staging:
  // 25 live holds totalling $646.68, every one `cancelled / buyer_cancelled` —
  // the exact signature this script writes. `qa:stranded-holds` now flags them.
  const holds = await releaseStripeHolds(trades);
  log(
    `💳 Stripe holds: ${holds.cancelled} cancelled · ${holds.skipped} nothing to cancel · ${holds.failed} failed`
  );

  // FIX-Task-24 item 4 (2026-09-12): the raw cancel above does NOT touch the tax
  // ledger, so void it here — otherwise every run leaves `tax_status='quoted'`
  // residue on a cancelled trade (25 such rows were found on staging).
  const tax = await voidTaxForTrades(admin, tradeIds);
  log(
    `🧾 Tax void: ${tax.voided} voided · ${tax.noop} no tax record · ${tax.skipped} already voided/unvoidable · ${tax.failed} failed`
  );

  // ── 4. Reset affected listings back to available ────────────────────────
  const { error: resetError } = await admin
    .from('items')
    .update({ status: 'available', updated_at: new Date().toISOString() })
    .in('id', [...listingIds])
    .in('status', ['pending', 'sold', 'unavailable', 'paused']);

  if (resetError) {
    log(`⚠️  Failed to reset some listings: ${resetError.message}`);
  } else {
    log(`✅ Reset ${listingIds.size} listing(s) to available.`);
  }

  log('✅ RESET COMPLETE.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});

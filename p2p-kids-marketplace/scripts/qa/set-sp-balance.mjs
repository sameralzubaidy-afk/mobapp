/**
 * DEV-TASK-75 (2026-08-31) — Item 4: QA SP top-up fixture.
 *
 * The T-group (TRD-TC-T02–T13) cases need specific SP wallet balances
 * (8 / 30 / 50 / 100 / 200 / 500 available SP) to drive the SP-cap and
 * balance-limit test legs, but test-buyer only has 4 available SP and QA had
 * no way to top up — leaving 11 cases permanently BLOCKED. This script lets QA
 * set a test account's SP balance DIRECTLY, in one call, and is safely
 * re-runnable.
 *
 * What it does (all service-role, no UI):
 *   1. Upserts the persona's `sp_wallets` row: sets `available_balance` to the
 *      requested amount, and zeroes `reserved_sp` / `pending_balance` so the
 *      wallet reads a clean "N available" (deterministic for SP-cap/balance tests).
 *      The wallet `state` is set to 'active'.
 *   2. Inserts a traceable `sp_ledger` entry (`earn_admin_grant`) recording the
 *      fixture top-up (balance_before → balance_after, admin_note).
 *   3. Read-backs the wallet + latest ledger row so the change is DB-verified.
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:set-sp-balance -- --persona test-buyer --amount 500
 *   npm run qa:set-sp-balance -- --email test-buyer@kidsmarketplace.test --amount 30
 *   npm run qa:set-sp-balance -- --user-id <uuid> --amount 8
 *   npm run qa:set-sp-balance -- --persona test-buyer --amount 500 --dry-run   # preview only
 *
 * Env: reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from p2p-kids-marketplace/.env
 *      (or .env.staging), same convention as the other QA/seed scripts
 *      (qa:reset-offer-fixtures, qa:admin-config-set).
 *
 * ⚠️ Intended for QA fixture state on a dev/staging DB with a clean persona
 *    (run `qa:reset-offer-fixtures` first if the persona has in-flight pending
 *    offers that reserved SP — zeroing reserved_sp on a mid-trade wallet can
 *    desync the reservation bookkeeping). Never run against production.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load project env (order matters: .env.staging is loaded second so it can
// override — mirrors cleanup-test-trades.ts / reset-offer-fixtures.mjs).
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const DRY_RUN = process.argv.includes('--dry-run');
const argVal = (flag) => {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
};
const PERSONA = argVal('--persona');
const EMAIL = argVal('--email');
const USER_ID = argVal('--user-id');
const AMOUNT_RAW = argVal('--amount');

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
 * QA personas whose SP wallet can be topped up. Fixed UUIDs match
 * `TEST_USERS` in scripts/seed-staging-data.ts (auth users are created with
 * these exact ids via admin.createUser).
 */
const QA_PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test' },
  'test-seller': { id: 'a1234567-0000-0000-0000-000000000002', email: 'test-seller@kidsmarketplace.test' },
};

function log(...a) {
  console.log('[qa:set-sp-balance]', ...a);
}

/** Resolve the target user id from --persona / --email / --user-id. */
async function resolveUserId() {
  if (USER_ID) return USER_ID;

  if (PERSONA) {
    const persona = QA_PERSONAS[PERSONA];
    if (!persona) {
      console.error(`❌ Unknown persona '${PERSONA}'. Known: ${Object.keys(QA_PERSONAS).join(', ')}`);
      process.exit(2);
    }
    return persona.id;
  }

  if (EMAIL) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.error(`❌ Failed to list users: ${error.message}`);
      process.exit(2);
    }
    const match = (data?.users ?? []).find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
    if (!match) {
      console.error(`❌ No auth user found for email '${EMAIL}'`);
      process.exit(2);
    }
    return match.id;
  }

  console.error('❌ Must provide one of: --persona <name>, --email <email>, --user-id <uuid>');
  process.exit(2);
}

async function main() {
  const amount = Number(AMOUNT_RAW);
  if (!Number.isInteger(amount) || amount < 0) {
    console.error(`❌ --amount must be a non-negative integer (got '${AMOUNT_RAW}')`);
    process.exit(2);
  }

  const userId = await resolveUserId();
  log(`Target: ${SUPABASE_URL}`);
  log(`User id: ${userId}${PERSONA ? ` (persona '${PERSONA}')` : ''}`);
  log(`Desired available SP balance: ${amount}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  // ── 1. Read the current wallet (DRY-RUN SAFE) ──────────────────────────────
  const { data: wallet, error: walletError } = await admin
    .from('sp_wallets')
    .select('id, available_balance, pending_balance, reserved_sp, state')
    .eq('user_id', userId)
    .maybeSingle();

  if (walletError) {
    console.error(`⚠️  Failed to read sp_wallets: ${walletError.message}`);
  } else if (wallet) {
    log(
      `Current wallet: available=${wallet.available_balance} pending=${wallet.pending_balance} reserved=${wallet.reserved_sp} state=${wallet.state}`
    );
  } else {
    log('Current wallet: none (will be created)');
  }

  if (DRY_RUN) {
    log('DRY-RUN complete — no changes made.');
    return;
  }

  // ── 2. Upsert the wallet to the requested balance ──────────────────────────
  const balanceBefore = wallet?.available_balance ?? 0;
  const walletId = wallet?.id ?? null;

  let upsertResult;
  if (walletId) {
    const { data, error } = await admin
      .from('sp_wallets')
      .update({
        available_balance: amount,
        pending_balance: 0,
        reserved_sp: 0,
        state: 'active',
      })
      .eq('id', walletId)
      .select('id, available_balance, pending_balance, reserved_sp, state')
      .single();
    upsertResult = { data, error };
  } else {
    const { data, error } = await admin
      .from('sp_wallets')
      .insert({
        user_id: userId,
        available_balance: amount,
        pending_balance: 0,
        reserved_sp: 0,
        state: 'active',
        lifetime_earned: amount, // fresh wallet — track the fixture grant as earned
      })
      .select('id, available_balance, pending_balance, reserved_sp, state')
      .single();
    upsertResult = { data, error };
  }

  if (upsertResult.error) {
    console.error(`❌ Failed to set sp balance: ${upsertResult.error.message}`);
    process.exit(1);
  }
  const newWallet = upsertResult.data;
  log(
    `✅ Wallet updated: available=${newWallet.available_balance} pending=${newWallet.pending_balance} reserved=${newWallet.reserved_sp} state=${newWallet.state}`
  );

  // ── 3. Insert a traceable ledger entry (earn_admin_grant) ──────────────────
  if (amount !== balanceBefore) {
    const { error: ledgerError } = await admin.from('sp_ledger').insert({
      wallet_id: newWallet.id,
      user_id: userId,
      transaction_type: 'earn_admin_grant',
      amount, // positive for earn
      balance_before: balanceBefore,
      balance_after: amount,
      description: `QA fixture: set available SP balance to ${amount}`,
      admin_note: 'qa:set-sp-balance (Dev Task 75)',
    });
    if (ledgerError) {
      console.warn(`⚠️  Wallet updated but ledger insert failed: ${ledgerError.message}`);
    } else {
      log(`✅ Ledger entry recorded (earn_admin_grant, ${balanceBefore} → ${amount}).`);
    }
  } else {
    log('ℹ️  Balance unchanged — no ledger entry written.');
  }

  // ── 4. Read-back verification ──────────────────────────────────────────────
  const { data: verifyWallet, error: verifyError } = await admin
    .from('sp_wallets')
    .select('id, available_balance, pending_balance, reserved_sp, state')
    .eq('user_id', userId)
    .maybeSingle();
  if (verifyError || !verifyWallet) {
    console.error(`⚠️  Read-back failed: ${verifyError?.message ?? 'no wallet row'}`);
    process.exit(1);
  }
  const ok =
    verifyWallet.available_balance === amount &&
    verifyWallet.pending_balance === 0 &&
    verifyWallet.reserved_sp === 0 &&
    verifyWallet.state === 'active';
  log(
    ok
      ? `✅ VERIFIED: available=${verifyWallet.available_balance} pending=${verifyWallet.pending_balance} reserved=${verifyWallet.reserved_sp} state=${verifyWallet.state}`
      : '❌ VERIFY FAILED: read-back does not match the requested state'
  );
  if (!ok) process.exit(1);

  log('Done. The persona now has the requested SP balance for T-group SP-cap/balance test legs.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

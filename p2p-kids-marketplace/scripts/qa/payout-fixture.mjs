/**
 * DEV-TASK-118 (2026-09-05) — Item 3: sanctioned qa:payout-fixture.
 *
 * QA Task 33 flagged that NO safe way exists to test the payout/withdraw
 * domain: test-seller's `seller_balance` row was wildly inflated ($15,603
 * displayed vs a real ~$140), `seller_balance`/`seller_payouts` are financial
 * tables with no execution-only write path, and no method-state fixtures exist
 * (only 2 sellers have methods, each a single verified stripe_connect). This
 * fixture provides a DEDICATED, disposable seller persona with CONTROLLED
 * balance/method/trade/payout state so QA can drive the withdraw E2E (H03/H06/
 * H07), the method-state cases (G04/G05/G09/G11/H04), the empty/no-payout
 * states (F05), and a fresh completed-trade→payout (F06) WITHOUT risking a
 * bogus transfer on inflated/shared data.
 *
 * Persona:
 *   email:    qa-payout-seller@kidsmarketplace.test
 *   password: TestPayout123!              (fixture value, mirrors QA_PERSONAS)
 *   id:       a1234567-0000-0000-0000-0000000000f2
 *   profile:  full + completed (test-seller's node) → qa-login-as lands on Home
 *   sub:      Kids Club+ ACTIVE (a seller who completed onboarding + is a member)
 *
 * Subcommands (all service-role on STAGING; --dry-run is fully read-only):
 *   ensure [--dry-run]
 *       → create-or-reconcile the persona (auth user + profile + active sub +
 *         an empty reconciled seller_balance row + NO methods by default).
 *   methods --scenario none|single-verified|single-unverified|two|mixed [--dry-run]
 *       → replace the persona's seller_payout_methods rows with the scenario:
 *           none              no methods (H04 no-method NoMethodModal)
 *           single-verified   one verified stripe_connect primary (F01/H02/H03 base)
 *           single-unverified one UNverified stripe_connect primary (G09 class)
 *           two               verified primary + verified secondary (G04/G05/G11)
 *           mixed             verified stripe_connect primary + unverified paypal
 *                             secondary (G04/G05 multi-method + F02 list display)
 *       Method rows are DB-controlled (no real Stripe onboarding); `withdraw`
 *       uses request_seller_payout which checks DB is_verified/is_primary only —
 *       it never mints a real outgoing transfer, which is exactly the safety QA
 *       needs. (Real-Connect onboarding E2E remains a G01-class follow-up.)
 *   balance --amount <cents> [--dry-run]
 *       → set a CONTROLLED available balance (available=N, pending=0,
 *         lifetime=N, trades=0). H-series: below-min ~150 (floor is 200 = $2.00),
 *         small 500 ($5.00) for H03/H07, or any --amount.
 *   reconcile [--seller test-seller|qa-payout-seller] [--dry-run]
 *       → recompute seller_balance from REAL trades + seller_payouts via the
 *         (now service_role-locked, DT-118) recompute_seller_balance RPC.
 *         `--seller test-seller` resets test-seller's inflated row (DT-118 Item 2).
 *   stage-trade [--amount <cents>] [--buyer test-buyer] [--dry-run]
 *       → ONE fresh COMPLETED trade (disposable item buyer→this seller) that
 *         produces a GENUINE seller_payouts row via
 *         create_seller_payout_on_trade_completion (auto-payout is on, buffer
 *         2d ⇒ status='pending', release_at = completed_at + 2d) → F06. Then
 *         reconciles the balance so it reflects real data. Staged trades are
 *         tagged (notes fixture:qa_payout_trade:) so `reset` finds them.
 *   withdraw [--full | --amount <cents>] [--dry-run]
 *       → drive a REAL withdrawal through the production request_seller_payout
 *         RPC as the persona (persona JWT — closest to the app). Creates a real
 *         seller_payouts row (status 'processing', trade_id NULL, provider from
 *         the primary method) + deducts available. Prints the payout row id +
 *         before/after available. THIS is the DT-118 "real withdrawal driven"
 *         proof. Needs a method + available balance (methods single-verified +
 *         balance 500 first).
 *   status
 *       → read-only: profile / subscription / methods / balance / recent payouts
 *         / fixture trades.
 *   reset [--full] [--dry-run]
 *       → delete ALL fixture rows for this disposable persona (methods, payouts,
 *         tagged trades + their items/images/trade_events/trade_notification_log)
 *         and re-reconcile the balance to real (0 when no trades remain).
 *         --full also deletes the auth user (BP-70). Non-fixture data is never
 *         touched.
 *
 * Two-phase provisioning: this file is Phase 1 (dev-authored). Running it
 * against staging is Phase 2 (Samer approval; one call at a time).
 *
 * Env: .env / .env.staging (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Stripe
 * key is NOT needed (no real transfer is minted).
 */
import { getClients, resolveUserId, personaOrThrow, argValue, hasFlag, log, exchangeJwt } from './lib/r41-common.mjs';
import { createClient } from '@supabase/supabase-js';

const { url, anon, admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');

// Persona constants (fixed UUID mirrors wallet-persona / r41 conventions).
const EMAIL = 'qa-payout-seller@kidsmarketplace.test';
const PASSWORD = 'TestPayout123!';
const FIXED_ID = 'a1234567-0000-0000-0000-0000000000f2';
const NAME = 'QA Payout Seller';

const SELLER_REF = argValue('seller') || 'qa-payout-seller';
const AMOUNT_CENTS = Number(argValue('amount') ?? argValue('amount-cents') ?? '');
const METHOD_SCENARIO = argValue('scenario');
const BUYER = argValue('buyer') || 'test-buyer';
const WITHDRAW_FULL = hasFlag('--full');
const TRADE_TAG_PREFIX = 'fixture:qa_payout_trade:';

function usage() {
  console.log(`qa:payout-fixture — DT-118 dedicated payout/withdraw seller persona

  ensure [--dry-run]
  methods --scenario none|single-verified|single-unverified|two|mixed [--dry-run]
  balance --amount <cents> [--dry-run]
  reconcile [--seller qa-payout-seller|test-seller] [--dry-run]
  stage-trade [--amount <cents>] [--buyer test-buyer] [--dry-run]
  withdraw [--full | --amount <cents>] [--dry-run]
  status
  reset [--full] [--dry-run]
`);
}

// ---------------------------------------------------------------------------
// Node + category resolution (mirrors wallet-persona / r41-in-progress-trade)
// ---------------------------------------------------------------------------
async function resolveNodeId() {
  for (const anchorEmail of ['test-seller@kidsmarketplace.test', 'test-buyer@kidsmarketplace.test']) {
    const { data: anchor, error } = await admin
      .from('profiles')
      .select('node_id')
      .eq('email', anchorEmail)
      .maybeSingle();
    if (!error && anchor?.node_id) return anchor.node_id;
  }
  const { data: node, error: nodeError } = await admin
    .from('nodes')
    .select('id')
    .eq('is_active', true)
    .eq('zip_code', '06850')
    .limit(1)
    .maybeSingle();
  if (!nodeError && node?.id) return node.id;
  const { data: anyNode } = await admin.from('nodes').select('id').eq('is_active', true).limit(1).maybeSingle();
  return anyNode?.id ?? null;
}

async function resolveCategoryId() {
  const { data, error } = await admin.from('categories').select('id').limit(1).maybeSingle();
  if (error || !data?.id) {
    console.error(`❌ Could not resolve a category: ${error?.message ?? 'no rows'}`);
    process.exit(1);
  }
  return data.id;
}

async function resolveUserIdByEmail() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const hit = (data?.users ?? []).find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (hit) return hit.id;
  const { data: byId } = await admin.auth.admin.getUserById(FIXED_ID);
  if (byId?.user && byId.user.email?.toLowerCase() === EMAIL.toLowerCase()) return byId.user.id;
  return null;
}

// ---------------------------------------------------------------------------
// ensure — persona provisioning
// ---------------------------------------------------------------------------
async function cmdEnsure() {
  if (DRY_RUN) {
    log('payout-fixture', 'DRY-RUN — would create/reconcile qa-payout-seller (auth + profile + active sub + empty balance).');
    return;
  }
  const nodeId = await resolveNodeId();
  if (!nodeId) {
    console.error('❌ Could not resolve an active node. Aborting.');
    process.exit(2);
  }
  let userId = await resolveUserIdByEmail();
  if (userId) {
    log(`payout-fixture`, `User exists (${userId}). Re-signing the fixture password so login creds are known-good.`);
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
    if (pwErr) log(`payout-fixture`, `⚠️ password reset failed: ${pwErr.message}`);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, phone: '5551234998' },
      id: FIXED_ID,
    });
    if (createError) {
      console.error(`❌ Failed to create auth user: ${createError.message}`);
      process.exit(1);
    }
    userId = created?.user?.id ?? FIXED_ID;
    log(`payout-fixture`, `Created auth user ${userId}`);
  }

  const nowIso = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      id: userId,
      name: NAME,
      phone: '5551234998',
      phone_verified: true,
      profile_completed: true,
      onboarding_completed: true,
      onboarding_completed_at: nowIso,
      zip_code: '06850',
      node_id: nodeId,
      dob: '2000-01-01',
      role: 'user',
      created_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (profileError) {
    console.error(`❌ profiles upsert failed: ${profileError.message}`);
    process.exit(1);
  }
  log(`payout-fixture`, 'Profile OK (completed, test-seller node).');

  const { error: subError } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      current_period_start: nowIso,
      current_period_end: periodEnd,
      auto_renew_enabled: true,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (subError) {
    console.error(`❌ subscriptions upsert failed: ${subError.message}`);
    process.exit(1);
  }
  log(`payout-fixture`, `Subscription OK (status='active').`);

  // Empty, reconciled baseline balance (no trades/payouts yet ⇒ all zeros).
  await reconcileSellerBalance(userId, true);
  log(`payout-fixture`, `✅ qa-payout-seller ensured (${EMAIL} / ${PASSWORD})`);
  await cmdStatus();
}

// ---------------------------------------------------------------------------
// methods — method-state scenarios
// ---------------------------------------------------------------------------
const METHOD_SCENARIOS = {
  none: [],
  'single-verified': [
    { method_type: 'stripe_connect', is_primary: true, is_verified: true, stripe_onboarding_complete: true, stripe_payouts_enabled: true, stripe_charges_enabled: false, stripe_account_id: 'acct_dt118_fixture' },
  ],
  'single-unverified': [
    { method_type: 'stripe_connect', is_primary: true, is_verified: false, stripe_onboarding_complete: false, stripe_payouts_enabled: false, stripe_charges_enabled: false, stripe_account_id: 'acct_dt118_fixture_unv' },
  ],
  two: [
    { method_type: 'stripe_connect', is_primary: true, is_verified: true, stripe_onboarding_complete: true, stripe_payouts_enabled: true, stripe_charges_enabled: false, stripe_account_id: 'acct_dt118_fixture_a' },
    { method_type: 'stripe_connect', is_primary: false, is_verified: true, stripe_onboarding_complete: true, stripe_payouts_enabled: true, stripe_charges_enabled: false, stripe_account_id: 'acct_dt118_fixture_b' },
  ],
  mixed: [
    { method_type: 'stripe_connect', is_primary: true, is_verified: true, stripe_onboarding_complete: true, stripe_payouts_enabled: true, stripe_charges_enabled: false, stripe_account_id: 'acct_dt118_fixture_a' },
    { method_type: 'paypal', is_primary: false, is_verified: false, stripe_onboarding_complete: false, stripe_payouts_enabled: false, stripe_charges_enabled: false, paypal_email: 'qa-payout-seller@kidsmarketplace.test' },
  ],
};

async function cmdMethods(userId) {
  if (!METHOD_SCENARIOS[METHOD_SCENARIO]) {
    console.error(`❌ --scenario must be one of: ${Object.keys(METHOD_SCENARIOS).join(', ')} (got '${METHOD_SCENARIO}')`);
    process.exit(2);
  }
  if (DRY_RUN) {
    log('payout-fixture', `DRY-RUN — would replace methods with scenario '${METHOD_SCENARIO}' (${METHOD_SCENARIOS[METHOD_SCENARIO].length} row(s)).`);
    return;
  }
  // Replace: delete existing persona methods, then insert the scenario rows.
  const { error: delErr } = await admin.from('seller_payout_methods').delete().eq('user_id', userId);
  if (delErr) {
    console.error(`❌ method delete failed: ${delErr.message}`);
    process.exit(1);
  }
  const rows = METHOD_SCENARIOS[METHOD_SCENARIO];
  for (const row of rows) {
    const { error: insErr } = await admin.from('seller_payout_methods').insert({
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...row,
    });
    if (insErr) {
      console.error(`❌ method insert failed (${row.method_type}): ${insErr.message}`);
      process.exit(1);
    }
  }
  log('payout-fixture', `✅ Methods replaced: scenario '${METHOD_SCENARIO}' (${rows.length} row(s)) for ${userId}.`);
}

// ---------------------------------------------------------------------------
// balance + reconcile — controlled balance / real-data recompute
// ---------------------------------------------------------------------------
async function upsertBalance(userId, availableCents) {
  const nowIso = new Date().toISOString();
  const { error } = await admin.from('seller_balance').upsert(
    {
      user_id: userId,
      available_balance_cents: availableCents,
      pending_balance_cents: 0,
      lifetime_earnings_cents: availableCents,
      total_trades_completed: 0,
      total_trades_pending: 0,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error(`❌ seller_balance upsert failed: ${error.message}`);
    process.exit(1);
  }
  log('payout-fixture', `✅ Controlled balance set: available=${availableCents} cents ($${(availableCents / 100).toFixed(2)}).`);
}

async function reconcileSellerBalance(userId, quiet = false) {
  if (DRY_RUN && !quiet) {
    log('payout-fixture', `DRY-RUN — would recompute seller_balance for ${userId} from real trades/payouts.`);
    return;
  }
  const { data, error } = await admin.rpc('recompute_seller_balance', { p_user_id: userId });
  if (error) {
    console.error(`❌ recompute_seller_balance failed: ${error.message}`);
    process.exit(1);
  }
  if (!quiet) {
    log('payout-fixture', `✅ Reconcile OK: ${JSON.stringify(data)}`);
  }
  return data;
}

async function cmdReconcile() {
  // Resolve the reconcile target: 'qa-payout-seller' (default, by email) or a
  // standing persona (e.g. test-seller) or an explicit email/uuid via --seller.
  let target;
  if (SELLER_REF === 'qa-payout-seller') {
    target = await resolveUserIdByEmail();
  } else {
    target = await resolveUserId(admin, SELLER_REF);
  }
  if (!target) {
    console.error(`❌ Could not resolve --seller '${SELLER_REF}'`);
    process.exit(2);
  }
  log('payout-fixture', `Reconciling seller_balance for '${SELLER_REF}' (${target}) from real trades + payouts.`);
  await reconcileSellerBalance(target, false);
}

// ---------------------------------------------------------------------------
// stage-trade — fresh completed trade → genuine payout row (F06)
// ---------------------------------------------------------------------------
async function cmdStageTrade(sellerUserId) {
  if (DRY_RUN) {
    log('payout-fixture', 'DRY-RUN — would create 1 disposable item + 1 completed trade + 1 genuine seller_payouts row (pending, buffer 2d), then reconcile.');
    return;
  }
  const buyerId = await resolveUserId(admin, BUYER);
  if (!buyerId || buyerId === sellerUserId) {
    console.error(`❌ --buyer must be a different known persona (got '${BUYER}')`);
    process.exit(2);
  }
  const amount = Number.isInteger(AMOUNT_CENTS) && AMOUNT_CENTS > 0 ? AMOUNT_CENTS : 2000; // default $20
  const categoryId = await resolveCategoryId();
  const marker = Math.random().toString(16).slice(2, 10);
  const now = new Date().toISOString();
  const createdBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // 1. Disposable approved available item owned by the seller.
  const { data: item, error: itemErr } = await admin
    .from('items')
    .insert({
      seller_id: sellerUserId,
      title: `QA Payout Fixture Item (${now.slice(0, 10)})`,
      description: `DT-118 disposable completed-trade fixture item (marker ${marker}). Delete via qa:payout-fixture reset.`,
      category_id: categoryId,
      condition: 'good',
      price: amount / 100,
      status: 'available',
      accepts_swap_points: false,
      approved_at: now,
      created_at: createdBefore,
      updated_at: now,
    })
    .select('id')
    .single();
  if (itemErr) {
    console.error(`❌ item create failed: ${itemErr.message}`);
    process.exit(1);
  }

  // 2. Completed trade (direct insert; sp=0 → no SP side effects). The seller
  //    balance trigger is AFTER UPDATE OF status, so it does NOT fire here —
  //    we reconcile explicitly at the end so the ledger matches real data.
  const { data: trade, error: tradeErr } = await admin
    .from('trades')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerUserId,
      listing_id: item.id,
      status: 'completed',
      cash_amount_cents: amount,
      sp_amount: 0,
      buyer_transaction_fee_cents: 0,
      seller_transaction_fee_cents: 0,
      tax_amount_cents: 0,
      taxable_amount_cents: amount,
      dispute_status: 'none',
      consumed_first_trade_eligibility: false,
      completed_at: now,
      created_at: createdBefore,
      updated_at: now,
      last_status_change_at: now,
      notes: `${TRADE_TAG_PREFIX}${marker}`,
    })
    .select('id, payout_status')
    .single();
  if (tradeErr) {
    console.error(`❌ trade create failed: ${tradeErr.message}`);
    process.exit(1);
  }

  // 3. Genuine seller_payouts row via the real completion-payout function.
  const { data: payout, error: payoutErr } = await admin.rpc('create_seller_payout_on_trade_completion', {
    p_trade_id: trade.id,
    p_seller_id: sellerUserId,
    p_gross_amount_cents: amount,
  });
  if (payoutErr) {
    console.error(`❌ create_seller_payout_on_trade_completion failed: ${payoutErr.message}`);
    process.exit(1);
  }
  log('payout-fixture', `✅ Completed trade ${trade.id} → payout ${JSON.stringify(payout)}`);

  // 4. Reconcile so seller_balance reflects the real trade + payout row.
  await reconcileSellerBalance(sellerUserId, false);

  log('payout-fixture', `  item ${item.id} / trade ${trade.id} — clean up via: npm run qa:payout-fixture -- reset`);
}

// ---------------------------------------------------------------------------
// withdraw — REAL request_seller_payout as the persona (DT-118 proof)
// ---------------------------------------------------------------------------
async function cmdWithdraw(sellerUserId) {
  const { data: bal } = await admin.from('seller_balance').select('available_balance_cents').eq('user_id', sellerUserId).maybeSingle();
  const available = bal?.available_balance_cents ?? 0;
  if (available <= 0) {
    console.error(`❌ No available balance for qa-payout-seller. Run: npm run qa:payout-fixture -- methods --scenario single-verified && npm run qa:payout-fixture -- balance --amount 500`);
    process.exit(1);
  }
  const { data: pm } = await admin.from('seller_payout_methods').select('id, method_type, is_verified').eq('user_id', sellerUserId).eq('is_primary', true).maybeSingle();
  if (!pm?.id || !pm.is_verified) {
    console.error(`❌ No verified primary method. Run: npm run qa:payout-fixture -- methods --scenario single-verified`);
    process.exit(1);
  }

  let amount = AMOUNT_CENTS;
  if (!Number.isInteger(amount) || amount <= 0) amount = available; // default full
  if (amount > available) {
    console.error(`❌ --amount ${amount} exceeds available ${available}.`);
    process.exit(1);
  }
  if (DRY_RUN) {
    log('payout-fixture', `DRY-RUN — would withdraw ${amount} cents (full=${amount === available}) via request_seller_payout as ${EMAIL}.`);
    return;
  }

  // Drive as the persona (real JWT — mirrors the app). Mint a user session.
  let jwt;
  try {
    jwt = await exchangeJwt(url, anon, EMAIL, PASSWORD);
  } catch (e) {
    console.error(`❌ JWT exchange failed: ${e.message}`);
    process.exit(1);
  }
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await userClient.rpc('request_seller_payout', {
    p_user_id: sellerUserId,
    p_amount_cents: amount,
  });
  if (error) {
    console.error(`❌ request_seller_payout failed: ${error.message}`);
    process.exit(1);
  }

  // Read-back: the real row + the new available balance.
  const { data: newBal } = await admin.from('seller_balance').select('available_balance_cents').eq('user_id', sellerUserId).maybeSingle();
  console.log(`\n✅ REAL WITHDRAWAL DRIVEN (request_seller_payout, persona JWT)`);
  console.log(`   result:        ${JSON.stringify(data)}`);
  console.log(`   available:     $${(available / 100).toFixed(2)} → $${((newBal?.available_balance_cents ?? 0) / 100).toFixed(2)}`);
  if (data?.success && data?.payout_id) {
    const { data: row } = await admin.from('seller_payouts').select('id, status, gross_amount_cents, payout_fee_cents, net_amount_cents, provider, trade_id').eq('id', data.payout_id).maybeSingle();
    console.log(`   payout row:    ${JSON.stringify(row)}`);
    console.log(`\nDT-118 Item 3 proof: genuine seller_payouts row id ${data.payout_id} created + balance deducted.`);
  } else {
    console.log(`   ⚠️  RPC did not report a payout_id — inspect the result above.`);
  }
}

// ---------------------------------------------------------------------------
// status / reset
// ---------------------------------------------------------------------------
async function cmdStatus() {
  const userId = await resolveUserIdByEmail();
  if (!userId) {
    console.log(`\nqa-payout-seller NOT provisioned — run: npm run qa:payout-fixture -- ensure`);
    return;
  }
  const { data: profile } = await admin.from('profiles').select('user_id, node_id, profile_completed, phone_verified').eq('user_id', userId).maybeSingle();
  const { data: subRow } = await admin.from('subscriptions').select('user_id, status, current_period_end').eq('user_id', userId).maybeSingle();
  const { data: bal } = await admin.from('seller_balance').select('available_balance_cents, pending_balance_cents, lifetime_earnings_cents, total_trades_completed').eq('user_id', userId).maybeSingle();
  const { data: methods } = await admin.from('seller_payout_methods').select('id, method_type, is_primary, is_verified').eq('user_id', userId);
  const { data: payouts } = await admin.from('seller_payouts').select('id, status, gross_amount_cents, net_amount_cents, trade_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
  const { data: trades } = await admin.from('trades').select('id, status, cash_amount_cents, payout_status, notes').eq('seller_id', userId).order('created_at', { ascending: false }).limit(10);

  console.log(`\nqa-payout-seller persona (${EMAIL} / ${PASSWORD})`);
  console.log(`  auth user id: ${userId}`);
  console.log(`  profile: ${profile ? `node=${profile.node_id} completed=${profile.profile_completed} phone_verified=${profile.phone_verified}` : 'MISSING'}`);
  console.log(`  subscription: ${subRow ? `status=${subRow.status}` : 'MISSING'}`);
  console.log(`  balance: ${bal ? `available=$${((bal.available_balance_cents ?? 0) / 100).toFixed(2)} pending=$${((bal.pending_balance_cents ?? 0) / 100).toFixed(2)} lifetime=$${((bal.lifetime_earnings_cents ?? 0) / 100).toFixed(2)} trades=${bal.total_trades_completed}` : 'MISSING'}`);
  console.log(`  methods: ${(methods?.length ?? 0) === 0 ? '(none)' : (methods || []).map((m) => `${m.method_type}[primary=${m.is_primary} verified=${m.is_verified}]`).join(', ')}`);
  console.log(`  payouts (${payouts?.length ?? 0} most recent): ${(payouts || []).map((p) => `$${((p.gross_amount_cents ?? 0) / 100).toFixed(2)}/${p.status}${p.trade_id ? '' : '(manual)'}`).join(', ') || '(none)'}`);
  console.log(`  trades: ${(trades || []).map((t) => `${t.status} $${((t.cash_amount_cents ?? 0) / 100).toFixed(2)} pay=${t.payout_status ?? '—'}`).join(', ') || '(none)'}`);
  console.log('  Mobile: qa-login-as?persona=qa-payout-seller');
}

async function cmdReset() {
  const userId = await resolveUserIdByEmail();
  if (!userId) {
    log('payout-fixture', 'Persona not provisioned — nothing to reset (clean).');
    return;
  }
  // Collect fixture trades for side-row cleanup.
  const { data: tagged } = await admin.from('trades').select('id, listing_id').ilike('notes', `${TRADE_TAG_PREFIX}%`).limit(100);
  const trades = tagged || [];

  if (DRY_RUN) {
    log('payout-fixture', `DRY-RUN — would delete persona's fixture rows: ${trades.length} tagged trade(s) + items/payouts/methods, then re-reconcile${process.argv.includes('--full') ? ' + delete the auth user' : ''}.`);
    return;
  }

  // 1. Fixture trades + side rows + items.
  for (const t of trades) {
    await admin.from('trade_events').delete().eq('trade_id', t.id);
    await admin.from('trade_notification_log').delete().eq('trade_id', t.id);
    await admin.from('seller_payouts').delete().eq('trade_id', t.id);
    await admin.from('trades').delete().eq('id', t.id);
    await admin.from('item_images').delete().eq('item_id', t.listing_id);
    await admin.from('items').delete().eq('id', t.listing_id);
    log('payout-fixture', `  ✔ deleted fixture trade ${t.id}`);
  }

  // 2. Manual-withdrawal payout rows (trade_id NULL) + methods — disposable
  //    persona: any rows it owns are fixture rows.
  const { error: pErr } = await admin.from('seller_payouts').delete().eq('user_id', userId).is('trade_id', null);
  if (pErr) console.warn(`payout-fixture: manual payout cleanup warn: ${pErr.message}`);
  const { error: mErr } = await admin.from('seller_payout_methods').delete().eq('user_id', userId);
  if (mErr) console.warn(`payout-fixture: method cleanup warn: ${mErr.message}`);

  // 3. Reconcile to real data (0 when no trades remain).
  await reconcileSellerBalance(userId, false);

  if (process.argv.includes('--full')) {
    // BP-70: delete profiles by user_id, await builders, then admin.deleteUser.
    const { error: profErr } = await admin.from('profiles').delete().eq('user_id', userId);
    if (profErr) console.warn(`payout-fixture: profile delete warn: ${profErr.message}`);
    const { error: subDelErr } = await admin.from('subscriptions').delete().eq('user_id', userId);
    if (subDelErr) console.warn(`payout-fixture: subscription delete warn: ${subDelErr.message}`);
    const { error: balErr } = await admin.from('seller_balance').delete().eq('user_id', userId);
    if (balErr) console.warn(`payout-fixture: seller_balance delete warn: ${balErr.message}`);
    const { error: delUserErr } = await admin.auth.admin.deleteUser(userId);
    if (delUserErr) {
      console.error(`❌ auth delete failed: ${delUserErr.message}`);
      process.exit(1);
    }
    log('payout-fixture', `✅ Auth user ${userId} deleted (BP-70 full reset).`);
  } else {
    log('payout-fixture', '✅ Reset complete (methods/payouts/trades/items cleared, balance re-reconciled). Persona kept for reuse.');
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  switch (sub) {
    case 'ensure':
      return cmdEnsure();
    case 'methods': {
      const userId = await resolveUserIdByEmail();
      if (!userId) {
        console.error(`❌ qa-payout-seller not provisioned — run: npm run qa:payout-fixture -- ensure`);
        process.exit(1);
      }
      return cmdMethods(userId);
    }
    case 'balance': {
      const userId = await resolveUserIdByEmail();
      if (!userId) {
        console.error(`❌ qa-payout-seller not provisioned — run: npm run qa:payout-fixture -- ensure`);
        process.exit(1);
      }
      if (!Number.isInteger(AMOUNT_CENTS) || AMOUNT_CENTS < 0) {
        console.error(`❌ --amount must be a non-negative integer of cents (got '${AMOUNT_CENTS}').`);
        process.exit(2);
      }
      if (DRY_RUN) {
        log('payout-fixture', `DRY-RUN — would set available balance to ${AMOUNT_CENTS} cents.`);
        return;
      }
      return upsertBalance(userId, AMOUNT_CENTS);
    }
    case 'reconcile':
      return cmdReconcile();
    case 'stage-trade': {
      const userId = await resolveUserIdByEmail();
      if (!userId) {
        console.error(`❌ qa-payout-seller not provisioned — run: npm run qa:payout-fixture -- ensure`);
        process.exit(1);
      }
      return cmdStageTrade(userId);
    }
    case 'withdraw': {
      const userId = await resolveUserIdByEmail();
      if (!userId) {
        console.error(`❌ qa-payout-seller not provisioned — run: npm run qa:payout-fixture -- ensure`);
        process.exit(1);
      }
      return cmdWithdraw(userId);
    }
    case 'status':
      return cmdStatus();
    case 'reset':
      return cmdReset();
    default:
      usage();
      process.exit(2);
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});

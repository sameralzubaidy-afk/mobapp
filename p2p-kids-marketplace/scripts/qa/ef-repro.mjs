/**
 * DEV-TASK-51 (2026-08-29) — Item 7: checked-in Edge Function repro harness.
 *
 * Converts the ad-hoc `node -e` EF repro pattern (JWT exchange + real
 * payment-method-id + service-role reads — the K10/K04 diagnosis workflow) into
 * a reusable, parameterized script. Instead of rebuilding the harness each time,
 * run:
 *
 *   npm run qa:ef-repro -- --persona test-buyer --ef create-trade-offer \
 *       --items <listing_id>[,<listing_id>...] [--fee-mode cash_only] [--pm pm_...] [--body '{"...":...}'] [--notify]
 *
 *   --notify (DEV-TASK-84, 2026-09-01): after a successful create, verify the
 *       offer's seller received the `trade_request` in-app notification (created
 *       by the trade_request_notification DB trigger on INSERT) and backfill it
 *       via create_trade_notification if the trigger/prefs suppressed it. Pair
 *       with the `qa:refresh` deep link to refresh the seller's open Needs
 *       Action list (it has no Realtime subscription).
 *
 *   FIX-Task-31 item 1 (2026-09-13): an `test-admin` persona is registered so
 *       ADMIN-ONLY Edge Functions can be driven with a real admin JWT. Use it
 *       with `--body` (admin EFs take their own payload; no payment method is
 *       auto-injected), e.g. to re-invoke an already-resolved dispute and
 *       assert its idempotency guard:
 *         npm run qa:ef-repro -- --persona test-admin --ef resolve-dispute \
 *             --body '{"trade_id":"<uuid>","resolution":"resolved_buyer"}'
 *
 * What it does:
 *   1. Resolves the persona (email/password registry, fixed UUIDs from
 *      scripts/seed-staging-data.ts).
 *   2. Service-role reads: the persona's saved card (`subscriptions.
 *      stripe_payment_method_id`) and each requested item's price/seller/status.
 *   3. GoTrue password grant -> user JWT.
 *   4. POSTs to the Edge Function with the app's exact headers
 *      (`Authorization: Bearer <jwt>` + `apikey: <anon>`).
 *   5. Prints the RAW EF response (status + body) so you can read the backend
 *      error (e.g. `NO_PAYMENT_METHOD` vs `MAX_PENDING_OFFERS` vs
 *      `TRADE_INSERT_ERROR`) before concluding a UI failure is an app bug.
 *
 * Body building:
 *   - Default (create-trade-offer): single item -> `{ item_id, cash_amount_cents,
 *     payment_method_id }`; multiple items -> `{ items: [...], payment_method_id }`.
 *     `cash_amount_cents = round(price * 100)`; `--fee-mode donate` uses 0.
 *   - `--body '<json>'` overrides the ENTIRE body for any other EF or an exact
 *     scenario. When `--body` is used, `--pm` is NOT auto-injected. *
 * ⚠️ FIX-Task-52 item 3 (2026-09-17) — THE FLAGS' SCOPE, stated plainly:
 *   `--items`, `--pm` and `--fee-mode` build the body ONLY when `--body` is
 *   ABSENT. `--body` REPLACES the whole request, so passing both is now a loud
 *   warning instead of a silent no-op (QA lost 3 calls to the ambiguity:
 *   `MISSING_ITEM_ID` -> `INVALID_AMOUNT` -> `NO_PAYMENT_METHOD`).
 *   `create-trade-offer`'s own contract, for when you DO use `--body`, is:
 *     { "item_id": "<uuid>", "cash_amount_cents": <int>, "payment_method_id": "pm_..." }
 *   (a bundle offer uses `items: [{ item_id, cash_amount_cents }, ...]`).
 *   The tool validates this contract before calling and exits with the shape it
 *   wanted, rather than letting the EF reject a body the tool should not have sent. *
 * Env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY from
 *      p2p-kids-marketplace/.env (or .env.staging).
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const PERSONA = argValue('persona');
const EF_SLUG = argValue('ef') || 'create-trade-offer';
const ITEMS = (argValue('items') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FEE_MODE = argValue('fee-mode') || 'cash_only';
const PM_OVERRIDE = argValue('pm');
const BODY_OVERRIDE = argValue('body');
// DEV-TASK-84 (2026-09-01): `--notify` — after a successful create, verify the
// offer's seller received the `trade_request` in-app notification (created by
// the trade_request_notification DB trigger on INSERT), and backfill it via the
// sanctioned create_trade_notification RPC if the trigger/prefs suppressed it.
// This gives QA a one-call "seller was notified" confirmation when building
// fixtures. The seller's Needs Action list refresh is handled separately by the
// qa:refresh deep link (p2pkidsmarketplace://qa-refresh).
const NOTIFY = process.argv.includes('--notify');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
  process.exit(2);
}
if (!PERSONA) {
  console.error('❌ --persona <name> is required.');
  process.exit(2);
}
if (ITEMS.length === 0 && !BODY_OVERRIDE) {
  console.error('❌ --items <id[,id...]> is required (or use --body to supply the full request body).');
  process.exit(2);
}

// FIX-Task-52 item 3 (2026-09-17): make each flag's scope unambiguous. These
// flags build the request body and therefore have NO effect once `--body`
// replaces it. Previously that was silent, so a run passing both looked like the
// flags had been accepted (the log even printed `items: 0`).
if (BODY_OVERRIDE) {
  const ignored = [
    ITEMS.length > 0 ? '--items' : null,
    PM_OVERRIDE ? '--pm' : null,
    process.argv.includes('--fee-mode') ? '--fee-mode' : null,
  ].filter(Boolean);
  if (ignored.length > 0) {
    console.warn(
      `⚠️  IGNORED: ${ignored.join(', ')} — \`--body\` replaces the ENTIRE request body, so these ` +
        'flags have no effect. Remove either the flags or --body.'
    );
  }
}

/**
 * FIX-Task-52 item 3: the body contract per EF, where it is known. Used to fail
 * LOUDLY, with the shape the EF actually wants, instead of letting the EF reject
 * a body the tool should never have sent.
 */
const BODY_CONTRACTS = {
  'create-trade-offer': {
    always: ['payment_method_id'],
    oneOf: [['item_id', 'cash_amount_cents'], ['items']],
  },
};

/** Present = supplied and not empty. */
const isPresent = (v) => v !== undefined && v !== null && v !== '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Persona registry (email/password match seed-staging-data.ts TEST_USERS).
 * Fixed `id`s mirror the seed's TEST_USERS — used as a fallback because
 * `listUsers` pagination does NOT return early-created personas (e.g. the
 * 2026-08-16 test-buyer) when staging has >1000 throwaway users.
 */
const PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test', password: 'TestBuyer123!' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test', password: 'TestFree123!' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test', password: 'TestBuyer2123!' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test', password: 'TestBuyer3123!' },
  'test-seller': { id: '14be337c-aad6-403f-bab2-ba1a7d80b666', email: 'test-seller@kidsmarketplace.test', password: 'TestSeller123!' },
  'test-seller-2': { id: 'a1234567-0000-0000-0000-000000000002', email: 'test-seller-2@kidsmarketplace.test', password: 'TestSeller2123!' },
  'test-seller-3': { id: 'a1234567-0000-0000-0000-000000000012', email: 'test-seller-3@kidsmarketplace.test', password: 'TestSeller3123!' },
  'test-grace': { id: 'a1234567-0000-0000-0000-000000000011', email: 'test-grace@kidsmarketplace.test', password: 'TestGrace123!' },
  // FIX-Task-31 item 1: admin persona. Mirrors scripts/seed-staging-data.ts
  // TEST_USERS.admin and src/services/qaPersonas.ts 'test-admin', so an
  // admin-only EF (resolve-dispute, admin config writes) can be invoked with a
  // real admin JWT. Previously the registry was buyer/seller-only, which is the
  // sole reason O3-C06's layer 2 (the ALREADY_RESOLVED guard) could not be
  // driven end-to-end. Password is re-asserted by `npm run seed:staging`
  // (FIX-Task-30 item 1), so this persona self-heals.
  'test-admin': { id: 'e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f', email: 'test-admin@kidsmarketplace.test', password: 'TestAdmin123!' },
  // FIX-Task-52 item 1 (2026-09-17): the DEDICATED disposable payout persona
  // (`qa:payout-fixture`). Registered so payout-domain EFs can be driven with its
  // real JWT — notably `create-stripe-connect-account`, whose reuse branch is what
  // produced G01's misleading "Stripe account created!" copy. Mirror of
  // scripts/qa/payout-fixture.mjs + scripts/seed-staging-data.ts.
  'qa-payout-seller': { id: 'a1234567-0000-0000-0000-0000000000f2', email: 'qa-payout-seller@kidsmarketplace.test', password: 'TestPayout123!' },
};

function log(...a) {
  console.log('[qa:ef-repro]', ...a);
}

/** GoTrue password grant → user access token. */
async function exchangeJwt(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GoTrue password grant -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

/**
 * DEV-TASK-84 `--notify` (2026-09-01): after a successful EF create, confirm the
 * offer's seller received a `trade_request` in-app notification for each newly
 * created trade. The real flow's `trade_request_notification` DB trigger already
 * inserts one on trades INSERT — this VERIFIES it landed (BP-47: never assume the
 * trigger fired) and BACKFILLS via the sanctioned create_trade_notification RPC
 * if it's missing (e.g. trigger drift, or notification_preferences suppressing
 * the 'trades' category — reported honestly as `suppressed-by-prefs`).
 *
 * Note: this does NOT refresh the seller's Needs Action list (that screen has no
 * Realtime subscription) — QA refreshes it with the `qa:refresh` deep link.
 *
 * @param {string} buyerUserId  the persona's user id (trades are queried by it)
 * @param {object} itemDetails  { [itemId]: { title, price, seller_id, ... } }
 */
async function verifySellerNotifications(buyerUserId, itemDetails) {
  const recent = await admin
    .from('trades')
    .select('id, listing_id, seller_id, created_at')
    .eq('buyer_id', buyerUserId)
    .in('listing_id', Object.keys(itemDetails))
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(25);

  const trades = recent?.data ?? [];
  if (trades.length === 0) {
    log('⚠️ --notify: no trades found for this persona in the last 5 min — nothing to verify.');
    return;
  }
  log(`📣 --notify: verifying seller notifications for ${trades.length} trade(s)...`);

  for (const trade of trades) {
    const listing = itemDetails[trade.listing_id];
    const itemTitle = listing?.title ?? 'item';
    const sellerId = trade.seller_id;

    const { data: existing } = await admin
      .from('user_notifications')
      .select('id, channels')
      .eq('user_id', sellerId)
      .eq('type', 'trade_request')
      .eq('data->>trade_id', trade.id)
      .limit(1);

    if (existing && existing.length > 0) {
      log(`✅ NOTIFY trade ${trade.id} seller ${String(sellerId).slice(0, 8)}: trade_request present (channels ${(existing[0].channels ?? []).join('+') || 'n/a'})`);
      continue;
    }

    // Backfill via the same RPC the real flow uses (respects notification_preferences).
    let backfilled = false;
    try {
      const { data: notifId, error } = await admin.rpc('create_trade_notification', {
        p_user_id: sellerId,
        p_notification_type: 'trade_request',
        p_title: 'New Trade Request! 💬',
        p_body: `Someone wants to trade for your "${itemTitle}"`,
        p_data: {
          trade_id: trade.id,
          item_id: trade.listing_id,
          item_title: itemTitle,
          buyer_id: buyerUserId,
          buyer_name: 'Someone',
          deep_link: `/trades/${trade.id}`,
          type: 'trade_request',
        },
      });
      if (error) throw error;
      backfilled = Boolean(notifId);
    } catch (err) {
      log(`⚠️ NOTIFY trade ${trade.id}: backfill RPC failed: ${err?.message ?? err}`);
    }

    if (backfilled) {
      log(`🔁 NOTIFY trade ${trade.id} seller ${String(sellerId).slice(0, 8)}: trade_request BACKFILLED`);
    } else {
      log(`⚠️ NOTIFY trade ${trade.id} seller ${String(sellerId).slice(0, 8)}: no row — suppressed-by-prefs (seller disabled 'trades' notifications) or RPC returned null`);
    }
  }
}

async function main() {
  const persona = PERSONAS[PERSONA];
  if (!persona) {
    console.error(`❌ Unknown persona '${PERSONA}'. Known: ${Object.keys(PERSONAS).join(', ')}`);
    process.exit(2);
  }
  log(`Target: ${SUPABASE_URL}`);
  log(`Persona: ${PERSONA}  EF: ${EF_SLUG}  items: ${ITEMS.length}  fee-mode: ${FEE_MODE}`);

  // 1. Service-role reads: saved card + item details. Resolve the user id via
  // email lookup with a fixed-UUID fallback (listUsers pagination can miss
  // early-created personas on staging).
  const { data: userByEmail } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = (userByEmail?.users ?? []).find((u) => u.email === persona.email);
  const userId = match?.id ?? persona.id ?? null;
  if (!userId) {
    console.error(`❌ Persona ${PERSONA} (${persona.email}) not found in auth.users.`);
    process.exit(1);
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_payment_method_id, stripe_customer_id, status')
    .eq('user_id', userId)
    .maybeSingle();
  const savedPm = sub?.stripe_payment_method_id ?? null;
  log(`📋 persona: user=${userId}  saved pm=${savedPm ?? 'NULL'}  sub status=${sub?.status ?? '(none)'}`);

  const itemDetails = {};
  if (ITEMS.length > 0) {
    const { data: items } = await admin
      .from('items')
      .select('id, title, price, seller_id, status, accepts_swap_points')
      .in('id', ITEMS);
    for (const it of items ?? []) itemDetails[it.id] = it;
    for (const id of ITEMS) {
      const it = itemDetails[id];
      log(`📋 item ${id}: ${it ? `${it.title}  price=${it.price}  status=${it.status}  seller=${String(it.seller_id).slice(0, 8)}` : 'NOT FOUND'}`);
    }

    // FIX-Task-52 item 3 (2026-09-17): a not-found id used to fall through to
    // `cash_amount_cents: 0` and come back from the EF as a confusing
    // `INVALID_AMOUNT` — a tool bug wearing the costume of a backend rejection.
    // Fail here instead, where the real reason is known. Skipped when `--body`
    // supplies the body (then --items is already reported as ignored above).
    if (!BODY_OVERRIDE) {
      const missingItems = ITEMS.filter((id) => !itemDetails[id]);
      if (missingItems.length > 0) {
        console.error(
          `❌ --items: ${missingItems.length} id(s) are not items in this database: ${missingItems.join(', ')}\n` +
            '   (A not-found item previously produced cash_amount_cents=0 and a misleading INVALID_AMOUNT.)'
        );
        process.exit(2);
      }
    }
  }

  // 2. Build the request body.
  let body;
  if (BODY_OVERRIDE) {
    try {
      body = JSON.parse(BODY_OVERRIDE);
    } catch {
      console.error('❌ --body is not valid JSON.');
      process.exit(2);
    }
  } else {
    const pm = PM_OVERRIDE || savedPm;
    if (!pm) {
      console.error('❌ No saved payment method for this persona and no --pm provided.');
      process.exit(1);
    }
    const cashFor = (itemId) => {
      const it = itemDetails[itemId];
      if (!it) return 0;
      return FEE_MODE === 'donate' ? 0 : Math.round(Number(it.price) * 100);
    };
    if (ITEMS.length === 1) {
      body = { item_id: ITEMS[0], cash_amount_cents: cashFor(ITEMS[0]), payment_method_id: pm };
    } else {
      body = {
        items: ITEMS.map((id) => ({ item_id: id, cash_amount_cents: cashFor(id) })),
        payment_method_id: pm,
      };
    }
  }

  // FIX-Task-52 item 3 (2026-09-17): validate the known body contract BEFORE
  // invoking the EF, so a wrong-shaped body is reported by the tool that built it
  // (with the shape it wanted) rather than as a terse EF rejection.
  const contract = BODY_CONTRACTS[EF_SLUG];
  if (contract) {
    const missing = contract.always.filter((key) => !isPresent(body[key]));
    const groupOk = contract.oneOf.some((group) => group.every((key) => isPresent(body[key])));
    if (missing.length > 0 || !groupOk) {
      console.error(
        `❌ ${EF_SLUG}: the request body is missing required keys — the EF\n` +
          '   would reject this with a terse, misleading error.\n' +
          `   Always required : ${contract.always.join(', ')}\n` +
          `   Plus one of     : ${contract.oneOf.map((g) => g.join(' + ')).join('   |   ')}\n` +
          `   Body received   : ${JSON.stringify(body)}\n` +
          '   NOTE: --items/--pm only populate the body when --body is ABSENT.\n' +
          '         e.g. --items <uuid> --pm pm_...  (no --body)\n' +
          '         or   --body \'{"item_id":"<uuid>","cash_amount_cents":2500,"payment_method_id":"pm_..."}\''
      );
      process.exit(2);
    }
  }

  // 3. Exchange the JWT.
  let jwt;
  try {
    jwt = await exchangeJwt(persona.email, persona.password);
    log('✅ JWT exchanged.');
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // 4. Invoke the Edge Function and print the RAW response.
  const url = `${SUPABASE_URL}/functions/v1/${EF_SLUG}`;
  log(`→ POST ${url}`);
  log(`   body: ${JSON.stringify(body)}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  log('');
  log('========== RAW EF RESPONSE ==========');
  log(`HTTP ${res.status}`);
  log(parsed ? JSON.stringify(parsed, null, 2) : text);
  log('=====================================');

  // DEV-TASK-84 (2026-09-01): `--notify` — verify/backfill the seller's
  // trade_request in-app notification (only meaningful for offer-creating EFs
  // like create-trade-offer; other EFs will simply report "no trades found").
  if (NOTIFY && ITEMS.length > 0) {
    await verifySellerNotifications(userId, itemDetails);
  } else if (NOTIFY) {
    log('⚠️ --notify requires --items <id[,id...]> to locate the created trades (skipping).');
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});

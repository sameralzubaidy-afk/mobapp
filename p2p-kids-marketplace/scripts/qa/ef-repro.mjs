/**
 * DEV-TASK-51 (2026-08-29) — Item 7: checked-in Edge Function repro harness.
 *
 * Converts the ad-hoc `node -e` EF repro pattern (JWT exchange + real
 * payment-method-id + service-role reads — the K10/K04 diagnosis workflow) into
 * a reusable, parameterized script. Instead of rebuilding the harness each time,
 * run:
 *
 *   npm run qa:ef-repro -- --persona test-buyer --ef create-trade-offer \
 *       --items <listing_id>[,<listing_id>...] [--fee-mode cash_only] [--pm pm_...] [--body '{"...":...}']
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
 *     scenario. When `--body` is used, `--pm` is NOT auto-injected.
 *
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
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});

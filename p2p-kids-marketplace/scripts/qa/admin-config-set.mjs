/**
 * DEV-TASK-65 (2026-08-30) — Item 1: QA admin-config write helper.
 *
 * WHY THIS EXISTS:
 *   QA Task 7 N01 discovered (via trial and error, costing wasted calls) that
 *   writing `admin_config` via MCP SQL now correctly fails with `P0001
 *   UNAUTHORIZED`. That is Dev Task 56a + Dev Task 59's security lockdown
 *   working exactly as intended, NOT a bug: `admin_config` holds every money
 *   lever (fees, caps, payout enable, trial/grace, tax), so the write RPCs are
 *   gated to `service_role` OR an authenticated admin (`admin_has_role`).
 *
 *   This helper gives QA a fast, documented, LEGITIMATE way to set config
 *   values for test fixtures without rediscovering the block each run.
 *
 * IT USES THE SAME LEGITIMATE PATH THE ADMIN PORTAL USES (no lockdown bypass):
 *   - It calls `public.upsert_admin_config_setting` — the EXACT shared write
 *     RPC (BP-48) the admin portal's settings pages call (with the admin's
 *     user JWT) and the /config hub API route calls (with service_role).
 *   - It authenticates with SUPABASE_SERVICE_ROLE_KEY from `.env`/`.env.staging`
 *     — the SAME credential the admin portal's server-side API routes use
 *     (p2p-kids-admin/src/app/api/admin/config/route.ts).
 *   - The RPC's own guard still applies (`current_setting('role')='service_role'
 *     OR admin_has_role(auth.uid())`) — the helper passes it legitimately; it
 *     does NOT bypass, weaken, or re-grant anything.
 *
 * THE THREE LEGITIMATE WRITE PATHS (pick whichever fits the context):
 *   A. THIS HELPER (fastest — no UI, no running server):
 *        npm run qa:admin-config-set -- set --key <k> --value <v> [...]
 *      → service_role → upsert_admin_config_setting (full control: category,
 *        data_type, is_active, is_secret, admin_id). Auto read-backs the row.
 *   B. Admin portal settings-page UI (browser, admin JWT) — what QA Task 7 N01
 *        used. Slow but fully legitimate (e.g. /settings/cart).
 *   C. Admin portal API:
 *        curl -X PATCH http://localhost:3001/api/admin/config \
 *             -H "Content-Type: application/json" \
 *             -H "x-admin-secret: <ADMIN_UI_SECRET>" \
 *             -d '{"key":"cart_min_value_cents","value":"2000","user_id":null}'
 *      → server-side service_role → secure_upsert_admin_config (key/value only;
 *        preserves category; always is_active=true). Requires the admin portal
 *        running on :3001 AND its ADMIN_UI_SECRET (p2p-kids-admin/.env.local).
 *
 * BLOCKED PATHS (by design — do NOT attempt):
 *   - Raw SQL via MCP (`mcp_supabase_execute_sql` / `apply_migration`) → anon/
 *     no-role JWT → `P0001 UNAUTHORIZED`. This is the lockdown working.
 *   - `secure_upsert_admin_config` via anon/authenticated → REVOKED (DT-56a);
 *     service_role ONLY.
 *   - `upsert_admin_config_setting` via anon → REVOKED (DT-59); authenticated
 *     (must be an admin in admin_has_role) or service_role ONLY.
 *
 * USAGE (from p2p-kids-marketplace/):
 *   npm run qa:admin-config-set -- get --key <key>                        # read one key
 *   npm run qa:admin-config-set -- list [--category <cat>]                # list keys (optional filter)
 *   npm run qa:admin-config-set -- set --key <k> --value <v>              # write (defaults below)
 *                          [--category <cat>] [--data-type <t>]
 *                          [--is-active true|false] [--is-secret true|false]
 *                          [--admin-id <uuid>] [--dry-run]
 *
 * Default for `set`: every column the caller did not pass is INHERITED from the
 * existing row (FIX-Task-50 item 4) — previously category/type/is_active/is_secret
 * fell back to feature_flags/string/true/false and silently rewrote them. Valid
 * categories: subscription, swap_points, fees, sms, email, moderation, safety,
 * analytics, feature_flags, payout_fees, referral, trade, tax, health.
 *
 * Env: reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from p2p-kids-marketplace/.env
 *      (or .env.staging), same convention as reset-offer-fixtures.mjs.
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

const CATEGORIES = [
  'subscription', 'swap_points', 'fees', 'sms', 'email', 'moderation',
  'safety', 'analytics', 'feature_flags', 'payout_fees', 'referral',
  'trade', 'tax', 'health',
];

// ---- arg parsing -----------------------------------------------------------
const argv = process.argv.slice(2);
const sub = argv[0] || 'help'; // get | list | set | help

function flagValue(name) {
  const idx = argv.indexOf(name);
  return idx >= 0 && argv[idx + 1] !== undefined ? argv[idx + 1] : null;
}
const hasFlag = (name) => argv.includes(name);

const key = flagValue('--key');
const value = flagValue('--value');
// FIX-Task-50 item 4 (2026-09-17): these are FLAGS, not resolved defaults. `set`
// now inherits whatever the row already has unless the flag is passed explicitly —
// the old `|| 'string'` / `|| 'feature_flags'` defaults silently rewrote the row's
// data_type (number→string) on any fixture write that omitted the flag, which is a
// real cross-run hazard (SUB Android Round 6 finding F4; it also rewrote
// `pending_sp_release_days` once before, during the FIX-Task-37 verification).
const categoryFlag = flagValue('--category'); // null when not passed
const dataTypeFlag = flagValue('--data-type'); // null when not passed
const isActive = flagValue('--is-active');   // null | 'true' | 'false'
const isSecret = flagValue('--is-secret');   // null | 'true' | 'false'
const adminId = flagValue('--admin-id') || null;
const dryRun = hasFlag('--dry-run');
const onlyCategory = flagValue('--category');

// ---- client ----------------------------------------------------------------
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ---- helpers ---------------------------------------------------------------
function toBool(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  if (raw === 'true' || raw === '1' || raw === true) return true;
  if (raw === 'false' || raw === '0' || raw === false) return false;
  console.error(`❌ Invalid boolean: "${raw}" (use true/false)`);
  process.exit(2);
}

function printRow(row) {
  console.log(JSON.stringify(row, null, 2));
}

async function readKey(k) {
  // service_role bypasses RLS; direct select gives the FULL row (incl. the
  // write-verification columns QA cares about: is_active, updated_by, etc.).
  const { data, error } = await admin
    .from('admin_config')
    .select('key,value,category,data_type,is_secret,is_active,updated_at,updated_by')
    .eq('key', k)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

// ---- subcommands -----------------------------------------------------------
async function cmdGet() {
  if (!key) {
    console.error('❌ get requires --key <key>');
    process.exit(2);
  }
  const row = await readKey(key);
  if (!row) {
    console.log(`ℹ️  No admin_config row for key "${key}".`);
    return;
  }
  printRow(row);
}

async function cmdList() {
  let q = admin.from('admin_config').select('key,value,category,data_type,is_secret,is_active,updated_at,updated_by').order('key');
  if (onlyCategory) q = q.eq('category', onlyCategory);
  const { data, error } = await q;
  if (error) throw error;
  if (!data || !data.length) {
    console.log('ℹ️  No admin_config rows matched.');
    return;
  }
  console.log(`(${data.length} rows)`);
  data.forEach((r) => console.log(`  ${r.key} = ${r.value}  [cat=${r.category}, active=${r.is_active}, type=${r.data_type}]`));
}

async function cmdSet() {
  if (!key || value === null || value === undefined) {
    console.error('❌ set requires --key <key> AND --value <value>');
    process.exit(2);
  }

  // FIX-Task-50 item 4: read the CURRENT row first and inherit everything the
  // caller did not override. A fixture write must never mutate a column's type (or
  // silently move a row's category / flip is_active) just because a flag was
  // omitted — that is what made `pending_sp_release_days` come back as a string.
  // A key that does not exist yet may only be created with BOTH --category and
  // --data-type passed explicitly (never guessed from defaults).
  const existing = await readKey(key);
  if (!existing && (!categoryFlag || !dataTypeFlag)) {
    console.error(
      `❌ No admin_config row for key "${key}". Creating a new key requires an explicit\n` +
        '   --category <cat> AND --data-type <t> (refusing to guess them).'
    );
    process.exit(2);
  }

  const category = categoryFlag ?? existing.category;
  const dataType = dataTypeFlag ?? existing.data_type;
  if (!CATEGORIES.includes(category)) {
    console.error(`❌ Invalid category "${category}". Valid: ${CATEGORIES.join(', ')}`);
    process.exit(2);
  }

  const inherited = [];
  if (!categoryFlag) inherited.push(`category=${category}`);
  if (!dataTypeFlag) inherited.push(`data_type=${dataType}`);
  if (!isActive) inherited.push(`is_active=${existing.is_active}`);
  if (!isSecret) inherited.push(`is_secret=${existing.is_secret}`);
  if (inherited.length) {
    console.log(`ℹ️  Inherited from the existing row: ${inherited.join(', ')}`);
  }

  const p_is_active = isActive === null ? existing.is_active : toBool(isActive, true);
  const p_is_secret = isSecret === null ? existing.is_secret : toBool(isSecret, false);

  const call = {
    p_key: key,
    p_value: String(value),
    p_category: category,
    p_data_type: dataType,
    p_is_secret: p_is_secret,
    p_is_active: p_is_active,
    p_admin_id: adminId,
  };

  if (dryRun) {
    console.log('🔍 DRY-RUN — would call upsert_admin_config_setting with:');
    printRow(call);
    return;
  }

  const { data, error } = await admin.rpc('upsert_admin_config_setting', call);
  if (error) {
    // Surface the exact lockdown error so QA knows WHY a path is blocked
    // (e.g. "P0001 UNAUTHORIZED: only admins or service_role can update...").
    console.error(`❌ upsert_admin_config_setting failed: ${error.message}`);
    process.exit(1);
  }

  const written = Array.isArray(data) && data.length ? data[0] : null;
  console.log('✅ upsert_admin_config_setting returned:');
  printRow(written || data);

  // Auto read-back — closes the verification loop in ONE call.
  const readBack = await readKey(key);
  console.log('🔎 Read-back from admin_config:');
  if (readBack) {
    printRow(readBack);
    const ok =
      readBack.value === String(value) &&
      readBack.is_active === p_is_active &&
      // FIX-Task-50 item 4: also assert the columns a fixture write used to be able
      // to clobber silently — a type/category change is a defect, not a write.
      readBack.data_type === dataType &&
      readBack.category === category;
    console.log(ok ? '✅ DB read-back matches the requested write.' : '⚠️  DB read-back differs from the requested write — inspect above.');
  } else {
    console.error('❌ Read-back returned no row — write did not persist.');
    process.exit(1);
  }
}

function cmdHelp() {
  console.log(`qa:admin-config-set — legitimate admin_config write helper (DEV-TASK-65)

USAGE:
  npm run qa:admin-config-set -- get --key <key>
  npm run qa:admin-config-set -- list [--category <cat>]
  npm run qa:admin-config-set -- set --key <k> --value <v> [options]

set OPTIONS:
  --category <cat>   admin_config_category enum (default: the row's CURRENT category)
  --data-type <t>    string | number | boolean | json (default: the row's CURRENT type)
  --is-active <b>    true|false (default: the row's CURRENT value)
  --is-secret <b>    true|false (default: the row's CURRENT value)
  --admin-id <uuid>  actor recorded in updated_by (default: null)
  --dry-run          print the RPC call without executing

FIX-Task-50 item 4: the set subcommand requires the key to EXIST and inherits every
column you do not override explicitly, so a fixture write can never silently change a
row's data_type (the number->string hazard) or move its category. Pass a flag only when
you genuinely want to change that column.

LEGITIMATE PATHS (the RPC guard still applies; nothing is bypassed):
  A. this helper  -> service_role -> upsert_admin_config_setting
  B. admin portal settings-page UI (browser, admin JWT)
  C. admin portal API  POST :3001/api/admin/config  w/ x-admin-secret
BLOCKED (by design): raw MCP SQL (P0001), secure_upsert_admin_config via anon.`);
}

// ---- dispatch --------------------------------------------------------------
(async () => {
  try {
    if (sub === 'get') await cmdGet();
    else if (sub === 'list') await cmdList();
    else if (sub === 'set') await cmdSet();
    else cmdHelp();
  } catch (err) {
    console.error(`❌ ${err.message || err}`);
    process.exit(1);
  }
})();

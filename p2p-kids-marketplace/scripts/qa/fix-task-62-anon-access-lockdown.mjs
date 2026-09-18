#!/usr/bin/env node
/**
 * FIX-Task-62 (2026-09-18) — remaining anonymous-access holes: positive + negative
 * proof against the LIVE staging database.
 *
 * WHY THIS SCRIPT (owner summary):
 *   Three separate holes let an unauthenticated caller (or a non-admin signed-in one)
 *   reach admin / profile data:
 *     1. `admin_get_user_detail` (and its siblings `admin_list_users`,
 *        `admin_get_user_analytics`) are SECURITY DEFINER functions whose only
 *        authorization check trusted a CALLER-SUPPLIED `p_admin_id`, and which carried
 *        Postgres' built-in PUBLIC EXECUTE because no migration ever granted or revoked
 *        them. Anonymously callable full-PII read.
 *     2. Anonymous `SELECT`/`INSERT`/`UPDATE` rules on `profiles` + `items` (staging
 *        still carried the 13 `*_anon_*` policies the chain had already dropped).
 *     3. `setup_user_profile(uuid,text,text)` — SECURITY DEFINER with NO identity check,
 *        granted to `anon` — an anonymous "rename anyone" RPC.
 *   This script proves, through the REAL credentials a caller would use, that all three
 *   now reject the unauthorised caller while the legitimate paths still work.
 *
 * LEGS (each asserts a hard outcome, not just "the UI looked right"):
 *   SETUP   two disposable users exist unmodified; a real admin UUID is resolvable;
 *           one disposable user is a NON-ADMIN (so the spoof leg means something).
 *   LEG 1   HIGHEST — unauthenticated → each of the three admin read RPCs → REJECTED,
 *           with the rejecting LAYER recorded (grant layer = "permission denied for
 *           function" / schema-cache miss; gate layer = "not an admin"). Both are
 *           acceptances, but the report must say WHICH — a gate-only rejection with the
 *           grant still open is the BP-79 silent-no-op trap.
 *   LEG 2   THE ACTUAL FIX — signed in as a NON-ADMIN, passing a REAL admin's UUID as
 *           `p_admin_id` → REJECTED with "not an admin". This is the leg that proves
 *           identity is derived from auth.uid() and not from the parameter: the grant
 *           layer cannot stop it (the caller IS authenticated).
 *   LEG 3   unauthenticated profile access → 0 rows / rejected for read, no rows for
 *           insert, 0 rows for update; the target's row is UNCHANGED.
 *   LEG 4   unauthenticated `setup_user_profile` against another account → REJECTED and
 *           the target's name is UNCHANGED (also proves the anonymous grant is gone).
 *   LEG 5   positive controls, one per rewritten body — service_role still reads the
 *           detail / analytics / list, and a signed-in buyer can still read the seller
 *           columns the app selects (`id, user_id, name, avatar_url`), so the app's
 *           discovery + chat surfaces keep working.
 *   LEG 6   residual checks — the two class-adjacent anon surfaces
 *           (`profiles_with_auth`, `debug_auth_context`) reject an anonymous caller.
 *
 * SAFETY / DISCIPLINE:
 *   * Users A and B are DISPOSABLE and created by this script (BP-72 / BP-70). No
 *     standing QA persona is read or written. The admin UUID is only ever READ.
 *   * Read-backs go through the service-role client, so they prove the DATABASE state
 *     rather than what the caller was told.
 *   * Cleanup always runs (finally): delete `profiles` by `user_id`, then
 *     `auth.admin.deleteUser` — `profiles.id != user_id` in this app (BP-70).
 *   * `--keep` skips cleanup for inspection; the fixture's own primary keys are printed
 *     either way so a later session can find it (BP-80 rule 4).
 *   * The GRANT-layer read for the four signatures (`aclexplode` / `has_function_privilege`)
 *     cannot be done over PostgREST — no RPC exposes `pg_proc`. It is captured by the
 *     FIX-Task-62 pre-flight SQL (see `supabase/migrations/20260918000010_*.sql`, V1/V2)
 *     and this script's LEG 1 records which layer actually rejected behaviourally.
 *
 * USAGE:
 *   cd p2p-kids-marketplace && npm run qa:fix62-anon-lockdown
 *   node scripts/qa/fix-task-62-anon-access-lockdown.mjs --keep
 *
 * EXIT: 0 = every leg behaved as required, 1 = at least one leg failed,
 *       2 = environment problem (missing env vars).
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KEEP = process.argv.includes('--keep');

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
  console.error(
    '❌ Missing env: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), ' +
      'SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY.\n' +
      '   They live in p2p-kids-marketplace/.env — nothing else in this repo is needed.'
  );
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Optional: the real staging admin account, for the admin-portal positive control. */
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL || '';
const ADMIN_PASSWORD =
  process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD || '';

const results = [];
let userA = null; // non-admin, signed-in attacker
let userB = null; // victim
let userC = null; // profile-INSERT probe target (its profiles row is removed up front)
let adminUserId = null;

/** Payload used for BOTH the service-role control insert and the anon insert (LEG 3d). */
const PROBE_PROFILE_INSERT = (userId) => ({
  user_id: userId,
  name: 'fix62-insert-probe',
  zip_code: '00000',
});

const NAME_B_BEFORE = 'fix62-victim-before';
const NAME_B_AFTER = 'fix62-victim-after';

function log(...a) {
  console.log('[fix62]', ...a);
}

function record(leg, pass, detail) {
  results.push({ leg, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${leg} — ${detail}`);
}

function skip(leg, reason) {
  results.push({ leg, pass: null, detail: reason });
  console.log(`⏭️  SKIP  ${leg} — ${reason}`);
}

/** Create a disposable auth user (its `profiles` row comes from the signup trigger). */
async function createDisposableUser(label) {
  const email = `fix62-${label}-${Date.now()}@kidsmarketplace.test`;
  const password = `Fix62${label}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`createUser(${label}) failed: ${error?.message ?? 'no user returned'}`);
  }
  return { id: data.user.id, email, password };
}

/** A fresh anon-key client with NO session — exactly what an unauthenticated caller has. */
function freshAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** An anon-key client holding a real user JWT (the app's own credential model). */
async function signedInClient(user) {
  const client = freshAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`signInWithPassword(${user.email}) failed: ${error.message}`);
  return client;
}

/** Authoritative read-back via service role — the real database state. */
async function readProfileRow(userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, name, zip_code, account_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`readProfileRow(${userId}) failed: ${error.message}`);
  return data;
}

function describeError(error) {
  if (!error) return 'no error';
  return `${error.code ?? ''} ${String(error.message ?? '')}`.trim();
}

/**
 * Classify WHICH layer rejected a call, so a gate-only rejection is never mistaken for a
 * closed grant (the BP-79 silent-no-op trap) and vice versa.
 */
function rejectionLayer(error) {
  const msg = String(error?.message ?? '').toLowerCase();
  if (msg.includes('permission denied for function')) return 'grant layer (no EXECUTE)';
  if (msg.includes('schema cache')) return 'grant layer (not in PostgREST schema cache)';
  if (msg.includes('not an admin')) return 'gate layer (auth.uid() is not an admin)';
  if (msg.includes('you can only')) return 'gate layer (identity mismatch)';
  if (msg.includes('row-level security')) return 'RLS layer (policy)';
  return `other (${describeError(error)})`;
}

async function cleanup() {
  for (const [label, user] of [
    ['A', userA],
    ['B', userB],
    ['C', userC],
  ]) {
    if (!user) continue;
    try {
      // BP-70: profiles first (deleted by user_id — profiles.id != user_id here).
      const { error: pErr } = await admin.from('profiles').delete().eq('user_id', user.id);
      if (pErr) console.warn(`[fix62] cleanup profiles(${label}) warn: ${pErr.message}`);
      const { error: uErr } = await admin.auth.admin.deleteUser(user.id);
      if (uErr) console.warn(`[fix62] cleanup deleteUser(${label}) warn: ${uErr.message}`);
      else log(`🧹 deleted disposable user ${label} (${user.id})`);
    } catch (e) {
      console.warn(`[fix62] cleanup(${label}) err: ${e.message}`);
    }
  }
}

async function main() {
  log(`target: ${SUPABASE_URL}`);

  // ---------------------------------------------------------------------------
  // SETUP
  // ---------------------------------------------------------------------------
  log('creating three disposable users…');
  userA = await createDisposableUser('a');
  userB = await createDisposableUser('b');
  userC = await createDisposableUser('c');
  // BP-80 rule 4: print the fixture's own keys so a later session can find it.
  log(
    `fixture keys: A=${userA.id} (${userA.email})  B=${userB.id} (${userB.email})  ` +
      `C=${userC.id} (${userC.email})`
  );

  const { data: adminRows, error: adminErr } = await admin
    .from('role_based_access_control')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1);
  if (adminErr) {
    record('SETUP', false, `could not read role_based_access_control: ${adminErr.message}`);
    return;
  }
  adminUserId = adminRows?.[0]?.user_id ?? null;
  if (!adminUserId) {
    record(
      'SETUP',
      false,
      'no admin row in role_based_access_control — the spoof leg (LEG 2) cannot be driven, ' +
        'and an admin-less project would make "not an admin" pass for the wrong reason'
    );
    return;
  }

  const rowA = await readProfileRow(userA.id);
  const rowB = await readProfileRow(userB.id);
  if (!rowA || !rowB) {
    record(
      'SETUP',
      false,
      'a disposable user has no profiles row — the signup trigger did not create it, so this ' +
        'script cannot tell a blocked write from a missing row'
    );
    return;
  }

  // Make B's name distinctive so "unchanged" is provable, and prove A is NOT an admin.
  await admin.from('profiles').update({ name: NAME_B_BEFORE }).eq('user_id', userB.id);
  const { data: aRoles } = await admin
    .from('role_based_access_control')
    .select('role')
    .eq('user_id', userA.id);
  if (aRoles && aRoles.length > 0) {
    record(
      'SETUP',
      false,
      `disposable user A unexpectedly holds RBAC role(s): ${aRoles
        .map((r) => r.role)
        .join(', ')} — the non-admin spoof leg would be meaningless`
    );
    return;
  }
  record(
    'SETUP',
    true,
    `A is a non-admin, B exists with name="${NAME_B_BEFORE}", real admin UUID resolved (${adminUserId})`
  );

  const anon = freshAnonClient();

  // ---------------------------------------------------------------------------
  // LEG 1 — unauthenticated access to the three admin read RPCs
  // ---------------------------------------------------------------------------
  const anonDetail = await anon.rpc('admin_get_user_detail', {
    p_admin_id: adminUserId,
    p_user_id: userB.id,
  });
  {
    const leaked = anonDetail.data && typeof anonDetail.data === 'object';
    const pass = !leaked && !!anonDetail.error;
    record(
      'LEG 1a anon admin_get_user_detail',
      pass,
      pass
        ? `rejected via ${rejectionLayer(anonDetail.error)}`
        : `LEAKED: anon received ${JSON.stringify(anonDetail.data)?.slice(0, 160)}`
    );
  }

  const anonAnalytics = await anon.rpc('admin_get_user_analytics', {
    p_admin_id: adminUserId,
  });
  {
    const leaked = anonAnalytics.data && typeof anonAnalytics.data === 'object';
    const pass = !leaked && !!anonAnalytics.error;
    record(
      'LEG 1b anon admin_get_user_analytics',
      pass,
      pass
        ? `rejected via ${rejectionLayer(anonAnalytics.error)}`
        : `LEAKED: anon received ${JSON.stringify(anonAnalytics.data)?.slice(0, 160)}`
    );
  }

  // The admin portal calls the 9-parameter overload (p_sort_by / p_sort_order).
  const anonList = await anon.rpc('admin_list_users', {
    p_admin_id: adminUserId,
    p_search: null,
    p_account_status: null,
    p_subscription_status: null,
    p_node_id: null,
    p_page: 1,
    p_page_size: 1,
    p_sort_by: 'registered_at',
    p_sort_order: 'DESC',
  });
  {
    const leaked = anonList.data && typeof anonList.data === 'object';
    const pass = !leaked && !!anonList.error;
    record(
      'LEG 1c anon admin_list_users',
      pass,
      pass
        ? `rejected via ${rejectionLayer(anonList.error)}`
        : `LEAKED: anon received ${JSON.stringify(anonList.data)?.slice(0, 160)}`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 2 — THE ACTUAL FIX: an authenticated NON-ADMIN spoofing p_admin_id
  // ---------------------------------------------------------------------------
  {
    const attacker = await signedInClient(userA);
    const { data, error } = await attacker.rpc('admin_get_user_detail', {
      p_admin_id: adminUserId, // a REAL admin — the old gate accepted this
      p_user_id: userB.id,
    });
    const leaked = data && typeof data === 'object';
    const mentionsNotAdmin = String(error?.message ?? '').includes('not an admin');
    const pass = !leaked && !!error && mentionsNotAdmin;
    record(
      'LEG 2 non-admin spoof of p_admin_id',
      pass,
      pass
        ? `rejected by the identity gate (${describeError(error)}) — auth.uid() is what counts now`
        : leaked
          ? 'FAILED OPEN: a signed-in non-admin read another user’s full detail by passing an admin UUID'
          : `rejected, but NOT by the identity gate: ${describeError(error)} (expected "not an admin")`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 3 — anonymous profile access must yield nothing
  // ---------------------------------------------------------------------------
  {
    // 3a read — the 3-4 columns the app reads for a seller card.
    const { data: readData, error: readErr } = await anon
      .from('profiles')
      .select('id, user_id, name, avatar_url')
      .limit(5);
    const pass = !!readErr || (Array.isArray(readData) && readData.length === 0);
    record(
      'LEG 3a anon profiles SELECT',
      pass,
      pass
        ? readErr
          ? `rejected via ${rejectionLayer(readErr)}`
          : 'returned 0 rows (RLS)'
        : `LEAKED ${readData.length} profile row(s) to an unauthenticated caller`
    );
  }
  {
    // 3b read — the sensitive columns specifically.
    const { data: priv, error: privErr } = await anon
      .from('profiles')
      .select('user_id, phone, phone_verified_at, account_status')
      .limit(5);
    const pass = !!privErr || (Array.isArray(priv) && priv.length === 0);
    record(
      'LEG 3b anon profiles private columns',
      pass,
      pass
        ? privErr
          ? `rejected via ${rejectionLayer(privErr)}`
          : 'returned 0 rows (RLS)'
        : `LEAKED private columns for ${priv.length} row(s)`
    );
  }
  {
    // 3c update — must affect 0 rows and leave B unchanged.
    const { error: updErr } = await anon
      .from('profiles')
      .update({ name: 'fix62-anon-updated' })
      .eq('user_id', userB.id);
    const after = await readProfileRow(userB.id);
    const unchanged = after?.name === NAME_B_BEFORE;
    const pass = unchanged || !!updErr;
    record(
      'LEG 3c anon profiles UPDATE',
      pass,
      pass
        ? updErr
          ? `rejected via ${rejectionLayer(updErr)}`
          : `0 rows affected (RLS); B’s name is still "${after?.name}"`
        : `B was renamed to "${after?.name}" by an unauthenticated caller`
    );
  }
  {
    // 3d insert — must not create a row.
    //
    // NON-VACUITY (§9.1h): an insert that fails for an unrelated reason (missing NOT NULL
    // column, FK violation) would "pass" this leg while proving nothing about the policy.
    // So the SAME payload is first proved valid by a service-role CONTROL insert against a
    // spare account (C) whose profiles row has been removed. Only when the control succeeds
    // is the anon leg discriminating.
    const { error: clearErr } = await admin.from('profiles').delete().eq('user_id', userC.id);
    if (clearErr) {
      skip('LEG 3d anon profiles INSERT', `could not clear C's profiles row: ${clearErr.message}`);
    } else {
      const { data: control, error: controlErr } = await admin
        .from('profiles')
        .insert(PROBE_PROFILE_INSERT(userC.id))
        .select('user_id');
      const controlWorked = !controlErr && Array.isArray(control) && control.length === 1;

      if (!controlWorked) {
        skip(
          'LEG 3d anon profiles INSERT',
          `the control insert itself failed (${describeError(controlErr)}) — the payload is not ` +
            'valid here, so an anon failure would prove nothing'
        );
      } else {
        await admin.from('profiles').delete().eq('user_id', userC.id);
        const { data: insData, error: insErr } = await anon
          .from('profiles')
          .insert(PROBE_PROFILE_INSERT(userC.id))
          .select('user_id');
        const created = Array.isArray(insData) && insData.length > 0;
        if (created) await admin.from('profiles').delete().eq('user_id', userC.id);
        record(
          'LEG 3d anon profiles INSERT',
          !created,
          !created
            ? `control insert proved the payload valid; anon was rejected via ${rejectionLayer(insErr)}`
            : 'an unauthenticated caller created a profile row'
        );
      }
    }
  }
  {
    // 3e items — the anonymous discovery read.
    const { data: items, error: itemsErr } = await anon
      .from('items')
      .select('id, seller_id, price')
      .limit(5);
    const pass = !!itemsErr || (Array.isArray(items) && items.length === 0);
    record(
      'LEG 3e anon items SELECT',
      pass,
      pass
        ? itemsErr
          ? `rejected via ${rejectionLayer(itemsErr)}`
          : 'returned 0 rows (RLS)'
        : `LEAKED ${items.length} listing row(s) to an unauthenticated caller`
    );
  }
  {
    // 3f user_notifications — one of the other 4 `*_anon_*` tables.
    const { data: notifs, error: notifErr } = await anon
      .from('user_notifications')
      .select('id, user_id, title')
      .limit(5);
    const pass = !!notifErr || (Array.isArray(notifs) && notifs.length === 0);
    record(
      'LEG 3f anon user_notifications SELECT',
      pass,
      pass
        ? notifErr
          ? `rejected via ${rejectionLayer(notifErr)}`
          : 'returned 0 rows (RLS)'
        : `LEAKED ${notifs.length} notification row(s) to an unauthenticated caller`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 4 — anonymous "rename anyone"
  // ---------------------------------------------------------------------------
  {
    const { data, error } = await anon.rpc('setup_user_profile', {
      p_user_id: userB.id,
      p_display_name: 'fix62-anon-renamed',
      p_zip_code: '00000',
    });
    const after = await readProfileRow(userB.id);
    const unchanged = after?.name === NAME_B_BEFORE;
    const ok = !data && !!error && unchanged;
    record(
      'LEG 4 anon setup_user_profile',
      ok,
      ok
        ? `rejected via ${rejectionLayer(error)}; B’s name is still "${after?.name}"`
        : data
          ? `FAILED OPEN: anon renamed another account (returned ${JSON.stringify(data)?.slice(0, 120)})`
          : `rejected, but B’s name changed to "${after?.name}"`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 5 — positive controls: every rewritten body still executes
  // ---------------------------------------------------------------------------
  {
    // 5a — service_role reads the full detail (proves the patched body runs).
    const { data, error } = await admin.rpc('admin_get_user_detail', {
      p_admin_id: adminUserId,
      p_user_id: userB.id,
    });
    const pass = !error && !!data?.identity;
    record(
      'LEG 5a service_role admin_get_user_detail',
      pass,
      pass ? 'returned the identity block' : `expected an identity block, got: ${describeError(error)}`
    );
  }
  {
    // 5b — service_role analytics.
    const { data, error } = await admin.rpc('admin_get_user_analytics', {
      p_admin_id: adminUserId,
    });
    const pass = !error && typeof data?.total_users !== 'undefined';
    record(
      'LEG 5b service_role admin_get_user_analytics',
      pass,
      pass ? `returned total_users=${data.total_users}` : `expected total_users, got: ${describeError(error)}`
    );
  }
  {
    // 5c — service_role list (the 9-parameter overload the portal uses).
    const { data, error } = await admin.rpc('admin_list_users', {
      p_admin_id: adminUserId,
      p_search: null,
      p_account_status: null,
      p_subscription_status: null,
      p_node_id: null,
      p_page: 1,
      p_page_size: 1,
      p_sort_by: 'registered_at',
      p_sort_order: 'DESC',
    });
    const pass = !error && Array.isArray(data?.users);
    record(
      'LEG 5c service_role admin_list_users',
      pass,
      pass ? `returned ${data.users.length} user(s)` : `expected a users array, got: ${describeError(error)}`
    );
  }
  {
    // 5d — a SIGNED-IN user can still read the seller columns the app selects.
    const buyer = await signedInClient(userA);
    const { data, error } = await buyer
      .from('profiles')
      .select('id, user_id, name, avatar_url')
      .eq('user_id', userB.id)
      .maybeSingle();
    const pass = !error && data?.user_id === userB.id;
    record(
      'LEG 5d signed-in seller-card read',
      pass,
      pass
        ? 'buyer still reads the seller card columns (discovery + chat keep working)'
        : `the app’s own read broke: ${describeError(error)}`
    );
  }
  {
    // 5e — service_role keeps the RPC alive, and the identity gate lets it through.
    const { data, error } = await admin.rpc('setup_user_profile', {
      p_user_id: userB.id,
      p_display_name: NAME_B_AFTER,
      p_zip_code: '06850',
    });
    const after = await readProfileRow(userB.id);
    const pass = !error && after?.name === NAME_B_AFTER;
    record(
      'LEG 5e service_role setup_user_profile',
      pass,
      pass
        ? `service_role updated B (“${after?.name}”) — the rewritten body still works`
        : `expected B to be renamed, got: name="${after?.name}" err=${describeError(error)} data=${JSON.stringify(
            data
          )?.slice(0, 80)}`
    );
  }
  {
    // 5f — OPTIONAL: the real admin portal credential (a user JWT that IS an admin).
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      skip(
        'LEG 5f real-admin JWT admin_get_user_detail',
        'no ADMIN_E2E_* / PLAYWRIGHT_ADMIN_* credentials in env — the admin-portal positive ' +
          'control cannot be driven from here (service_role 5a covers the body, not the JWT path)'
      );
    } else {
      const portal = freshAnonClient();
      const { error: signInErr } = await portal.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
      if (signInErr) {
        record('LEG 5f real-admin JWT admin_get_user_detail', false, `sign-in failed: ${signInErr.message}`);
      } else {
        const { data, error } = await portal.rpc('admin_get_user_detail', {
          p_admin_id: adminUserId,
          p_user_id: userB.id,
        });
        const pass = !error && !!data?.identity;
        record(
          'LEG 5f real-admin JWT admin_get_user_detail',
          pass,
          pass
            ? 'the admin portal’s credential still reads a user detail'
            : `the admin portal would break: ${describeError(error)}`
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // LEG 6 — class-adjacent anonymous surfaces
  // ---------------------------------------------------------------------------
  {
    const { data, error } = await anon.from('profiles_with_auth').select('user_id, email').limit(3);
    const pass = !!error || (Array.isArray(data) && data.length === 0);
    record(
      'LEG 6a anon profiles_with_auth SELECT',
      pass,
      pass
        ? error
          ? `rejected via ${rejectionLayer(error)}`
          : 'returned 0 rows (RLS)'
        : `LEAKED ${data.length} row(s) including email`
    );
  }
  {
    const { data, error } = await anon.rpc('debug_auth_context');
    const pass = !data && !!error;
    record(
      'LEG 6b anon debug_auth_context',
      pass,
      pass ? `rejected via ${rejectionLayer(error)}` : `anon received ${JSON.stringify(data)?.slice(0, 120)}`
    );
  }
}

async function residueCheck() {
  // BP-80 / BP-72: prove the disposable fixtures are gone.
  if (KEEP) {
    log('--keep supplied — fixtures retained for inspection');
    return;
  }
  const ids = [userA?.id, userB?.id, userC?.id].filter(Boolean);
  if (ids.length === 0) return;
  const { data, error } = await admin.from('profiles').select('user_id').in('user_id', ids);
  if (error) {
    log(`⚠️  residue check could not run: ${error.message}`);
    return;
  }
  log(`residue: ${data?.length ?? 0} profile row(s) left for the disposable fixtures`);
}

try {
  await main();
} catch (e) {
  record('UNEXPECTED', false, e?.message ?? String(e));
} finally {
  await cleanup();
  await residueCheck();

  const failed = results.filter((r) => r.pass === false);
  const skipped = results.filter((r) => r.pass === null);
  const passed = results.filter((r) => r.pass === true);
  console.log('\n──────────────────────────────────────────────');
  console.log(`PASS ${passed.length} · FAIL ${failed.length} · SKIP ${skipped.length}`);
  if (failed.length) {
    console.log('Failed legs:');
    for (const f of failed) console.log(`  ✗ ${f.leg} — ${f.detail}`);
  }
  if (skipped.length) {
    console.log('Skipped legs (must be stated in the report, never silently dropped):');
    for (const s of skipped) console.log(`  ⏭  ${s.leg} — ${s.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

#!/usr/bin/env node
/**
 * FIX-Task-59 (2026-09-18) — `verify_user_phone` unauthenticated access hole:
 * positive + negative proof against the LIVE staging database.
 *
 * WHY THIS SCRIPT (owner summary):
 *   `profiles.phone_verified_at` is the single source of truth gating who may
 *   publish a listing or buy (FIX-Task-58). Before this task, three separate
 *   unauthenticated paths could set it for ANY account:
 *     1. the `verify_user_phone` RPC (SECURITY DEFINER, no identity check, granted
 *        to `anon`),
 *     2. the `profiles_anon_update` policy (`FOR UPDATE TO anon USING (true)`),
 *     3. the `Allow phone verification updates` policy (PUBLIC, anon branch true).
 *   This script proves, through the REAL credentials a caller would use, that (1)
 *   and (2) now reject an unauthenticated / wrong-identity caller while the
 *   legitimate signed-in self-verification still works.
 *
 * LEGS (each asserts a hard outcome, not just "the UI looked right"):
 *   LEG 1  POSITIVE — a signed-in user verifies their OWN phone → success, and the
 *          row really changed (also proves the FIX-Task-58 derived mirror still
 *          produces phone_verified = true from the timestamp).
 *   LEG 2  NEGATIVE — an unauthenticated (anon key, no session) caller invoking the
 *          RPC against someone else's account → rejected, and the target row is
 *          UNCHANGED.
 *   LEG 2b NEGATIVE — an unauthenticated caller PATCHing `profiles` directly over
 *          PostgREST → 0 rows affected (RLS), target row UNCHANGED. This is the leg
 *          that proves the policy drops mattered: without them, revoking the RPC
 *          alone would have been security theatre.
 *   LEG 3  NEGATIVE — signed in AS user A but targeting user B → the identity gate
 *          raises 42501, and NEITHER row changes.
 *   LEG 3b NEGATIVE — signed in as A, PATCHing B's row directly → 0 rows, B unchanged.
 *
 * SAFETY / DISCIPLINE:
 *   * Users A and B are DISPOSABLE and created by this script (BP-72 / BP-70). No
 *     standing QA persona is read or written.
 *   * Read-backs go through the service-role client, so they prove the DATABASE state
 *     rather than what the caller was told (a caller-narrated result could be wrong).
 *   * Cleanup always runs (finally): delete profiles by `user_id`, then
 *     `auth.admin.deleteUser` — `profiles.id != user_id` in this app (BP-70).
 *   * `--keep` skips cleanup for inspection; the fixture's own primary keys are
 *     printed either way so a later session can find it (BP-80 rule 4).
 *
 * USAGE:
 *   cd p2p-kids-marketplace && npm run qa:fix59-phone-lockdown
 *   node scripts/qa/fix-task-59-phone-rpc-lockdown.mjs --keep
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

const PHONE_A = '+15550000101';
const PHONE_B = '+15550000102';

const results = [];
let userA = null;
let userB = null;

function log(...a) {
  console.log('[fix59]', ...a);
}

function record(leg, pass, detail) {
  results.push({ leg, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${leg} — ${detail}`);
}

/** Create a disposable auth user (its `profiles` row comes from the signup trigger). */
async function createDisposableUser(label) {
  const email = `fix59-${label}-${Date.now()}@kidsmarketplace.test`;
  const password = `Fix59${label}Aa1!`;
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
async function readVerification(userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, phone, phone_verified, phone_verified_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`readVerification(${userId}) failed: ${error.message}`);
  return data;
}

function describeError(error) {
  if (!error) return 'no error';
  return `${error.code ?? ''} ${String(error.message ?? '')}`.trim();
}

async function cleanup() {
  for (const [label, user] of [
    ['A', userA],
    ['B', userB],
  ]) {
    if (!user) continue;
    try {
      // BP-70: profiles first (deleted by user_id — profiles.id != user_id here).
      const { error: pErr } = await admin.from('profiles').delete().eq('user_id', user.id);
      if (pErr) console.warn(`[fix59] cleanup profiles(${label}) warn: ${pErr.message}`);
      const { error: uErr } = await admin.auth.admin.deleteUser(user.id);
      if (uErr) console.warn(`[fix59] cleanup deleteUser(${label}) warn: ${uErr.message}`);
      else log(`🧹 deleted disposable user ${label} (${user.id})`);
    } catch (e) {
      console.warn(`[fix59] cleanup(${label}) err: ${e.message}`);
    }
  }
}

async function main() {
  log(`target: ${SUPABASE_URL}`);
  log('creating two disposable users…');
  userA = await createDisposableUser('a');
  userB = await createDisposableUser('b');
  // BP-80 rule 4: print the fixture's own keys so a later session can find it.
  log(`fixture keys: A=${userA.id} (${userA.email})  B=${userB.id} (${userB.email})`);

  const initialA = await readVerification(userA.id);
  const initialB = await readVerification(userB.id);
  if (!initialA || !initialB) {
    record(
      'SETUP',
      false,
      'a disposable user has no profiles row — the signup trigger did not create it, so ' +
        'this script cannot tell a blocked write from a missing row'
    );
    return;
  }
  if (initialA.phone_verified_at || initialB.phone_verified_at) {
    record(
      'SETUP',
      false,
      'a disposable user is ALREADY phone-verified before any leg ran — the baseline is not ' +
        'clean, so "unchanged" would be meaningless'
    );
    return;
  }
  record('SETUP', true, 'both disposable users exist with phone_verified_at IS NULL');

  // ---------------------------------------------------------------------------
  // LEG 2 — unauthenticated RPC call against another account
  // ---------------------------------------------------------------------------
  {
    const anon = freshAnonClient();
    const { data, error } = await anon.rpc('verify_user_phone', {
      p_user_id: userA.id,
      p_phone: PHONE_A,
    });
    const after = await readVerification(userA.id);
    const rejected = error !== null || (Array.isArray(data) ? data[0] : data)?.success !== true;
    const unchanged = !after.phone_verified_at && after.phone_verified !== true;
    record(
      'LEG 2 (anon RPC → someone else)',
      rejected && unchanged,
      `rejected=${rejected} (${describeError(error)}) | target phone_verified_at still ${
        after.phone_verified_at === null ? 'NULL' : after.phone_verified_at
      }`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 2b — unauthenticated DIRECT PATCH of profiles (the RLS/policy half)
  // ---------------------------------------------------------------------------
  {
    const anon = freshAnonClient();
    const { data, error } = await anon
      .from('profiles')
      .update({ phone_verified_at: new Date().toISOString() })
      .eq('user_id', userA.id)
      .select();
    const after = await readVerification(userA.id);
    const wroteNothing = (!data || data.length === 0) && !after.phone_verified_at;
    record(
      'LEG 2b (anon direct PATCH → someone else)',
      wroteNothing,
      `rows affected=${Array.isArray(data) ? data.length : 'n/a'} | ${describeError(error)} | ` +
        `target phone_verified_at still ${after.phone_verified_at === null ? 'NULL' : 'SET'}`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 3 — signed in as A, targeting B
  // ---------------------------------------------------------------------------
  const clientA = await signedInClient(userA);
  {
    const { data, error } = await clientA.rpc('verify_user_phone', {
      p_user_id: userB.id,
      p_phone: PHONE_B,
    });
    const afterA = await readVerification(userA.id);
    const afterB = await readVerification(userB.id);
    const blocked = error !== null && /own phone|42501|permission/i.test(describeError(error));
    const untouched = !afterA.phone_verified_at && !afterB.phone_verified_at;
    record(
      'LEG 3 (signed in as A → target B)',
      blocked && untouched,
      `blocked=${blocked} (${describeError(error)}) | B unchanged=${
        !afterB.phone_verified_at
      } | A unchanged=${!afterA.phone_verified_at}`
    );
    if (Array.isArray(data)) log('  (unexpected data payload returned:', JSON.stringify(data), ')');
  }

  // ---------------------------------------------------------------------------
  // LEG 3b — signed in as A, DIRECT PATCH of B's row
  // ---------------------------------------------------------------------------
  {
    const { data, error } = await clientA
      .from('profiles')
      .update({ phone_verified_at: new Date().toISOString() })
      .eq('user_id', userB.id)
      .select();
    const afterB = await readVerification(userB.id);
    const wroteNothing = (!data || data.length === 0) && !afterB.phone_verified_at;
    record(
      'LEG 3b (signed in as A, direct PATCH → B)',
      wroteNothing,
      `rows affected=${Array.isArray(data) ? data.length : 'n/a'} | ${describeError(error)} | ` +
        `B phone_verified_at still ${afterB.phone_verified_at === null ? 'NULL' : 'SET'}`
    );
  }

  // ---------------------------------------------------------------------------
  // LEG 1 — POSITIVE: the legitimate signed-in user verifying their OWN phone
  //         (run last so the earlier legs are proven on an unverified row)
  // ---------------------------------------------------------------------------
  {
    const clientB = await signedInClient(userB);
    const { data, error } = await clientB.rpc('verify_user_phone', {
      p_user_id: userB.id,
      p_phone: PHONE_B,
    });
    const afterB = await readVerification(userB.id);
    const reportedSuccess = (Array.isArray(data) ? data[0] : data)?.success === true;
    const persisted =
      Boolean(afterB.phone_verified_at) &&
      afterB.phone === PHONE_B &&
      afterB.phone_verified === true; // derived mirror, FIX-Task-58
    record(
      'LEG 1 (signed-in user verifies OWN phone — positive)',
      reportedSuccess && persisted && error === null,
      `success=${reportedSuccess} | phone_verified_at set=${Boolean(
        afterB.phone_verified_at
      )} | phone_verified(derived)=${afterB.phone_verified} | phone=${afterB.phone} | ${describeError(
        error
      )}`
    );
  }
}

try {
  await main();
} catch (e) {
  record('UNEXPECTED', false, e.message);
} finally {
  if (KEEP) log('--keep passed — leaving disposable users in place (delete them manually).');
  else await cleanup();
}

const failed = results.filter((r) => !r.pass);
console.log('\n──────── FIX-Task-59 phone-verification lockdown ────────');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.leg}`);
console.log(
  failed.length === 0
    ? `\n✅ ALL ${results.length} LEGS PASSED — the hole is closed and the legitimate flow still works.`
    : `\n❌ ${failed.length} of ${results.length} legs FAILED — the hole is NOT fully closed.`
);
process.exit(failed.length === 0 ? 0 : 1);

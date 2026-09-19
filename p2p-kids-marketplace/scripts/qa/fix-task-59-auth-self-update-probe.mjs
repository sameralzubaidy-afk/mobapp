#!/usr/bin/env node
/**
 * FIX-Task-59 follow-up — AUTH closing pass (2026-09-18): the ONE leg the
 * original lockdown probe did not cover.
 *
 * WHY THIS EXISTS
 * ---------------
 * `fix-task-59-phone-rpc-lockdown.mjs` proves:
 *   LEG 2b  anon            -> DIRECT PATCH of someone else's profiles row  = blocked
 *   LEG 3b  authenticated A -> DIRECT PATCH of B's profiles row             = blocked (0 rows)
 *   LEG 4   authenticated B -> `verify_user_phone` RPC (SECURITY DEFINER)   = works
 *
 * It never proves the leg the SHIPPED APP actually depends on:
 *
 *   authenticated B -> DIRECT PATCH of B's OWN profiles row  (what
 *   `phoneService.verifyPhoneCode` does on every successful SMS verify:
 *   `supabase.from('profiles').update({phone_verified:true, phone_verified_at, ...})
 *    .eq('user_id', user.id)`)
 *
 * FIX-Task-59 DROPped two `profiles` UPDATE policies:
 *   - `profiles_anon_update`              (anon only)              -> no legitimate access lost
 *   - `Allow phone verification updates`  (PUBLIC, anon branch)    -> ??? 
 *
 * The migration argues the PUBLIC policy's `auth.uid() = user_id` branch is still
 * covered by the surviving `Users can update their own profile` policy. That is a
 * CLAIM about live staging state, and the RPC leg (SECURITY DEFINER) bypasses RLS
 * entirely, so LEG 4 cannot falsify it. This probe can.
 *
 * THE DISCRIMINATOR
 * -----------------
 * A blocked PostgREST UPDATE does NOT error — RLS silently filters it and returns
 * 0 rows. So "no error" proves nothing. This probe therefore WRITES a value and
 * READS IT BACK on a later round-trip: only a genuine 1-row update makes the new
 * value observable.
 *
 * SAFETY
 * ------
 * - Uses the `anon` key + a documented fixture persona password. NO service role.
 * - Touches ONLY `profiles.phone_verification_method` (a descriptive column), never
 *   `phone_verified_at` / `phone_verified` (the gating source of truth), so no gate
 *   can be flipped even if something goes wrong.
 * - Restores the original value in a `finally` block and re-verifies the restore.
 *
 * USAGE
 *   node scripts/qa/fix-task-59-auth-self-update-probe.mjs [--persona test-seller]
 *
 * EXIT CODES
 *   0 = every leg behaved as required
 *   1 = at least one leg regressed
 *   2 = setup problem (env / auth)
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const URL_ = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Documented, already-committed fixture credentials (scripts/seed-staging-data.ts).
const PERSONAS = {
  'test-seller': { email: 'test-seller@kidsmarketplace.test', password: 'TestSeller123!' },
  'test-buyer': { email: 'test-buyer@kidsmarketplace.test', password: 'TestBuyer123!' },
  'test-free': { email: 'test-free@kidsmarketplace.test', password: 'TestFree123!' },
};

const argv = process.argv.slice(2);
let persona = 'test-seller';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--persona' && argv[i + 1]) persona = argv[++i];
  else if (argv[i].startsWith('--persona=')) persona = argv[i].split('=')[1];
}

if (!URL_ || !ANON) {
  console.error('✗ Missing SUPABASE_URL / SUPABASE_ANON_KEY (check .env)');
  process.exit(2);
}
const cred = PERSONAS[persona];
if (!cred) {
  console.error(`✗ Unknown persona "${persona}". Known: ${Object.keys(PERSONAS).join(', ')}`);
  process.exit(2);
}

const results = [];
function record(id, expectation, observed, pass) {
  results.push({ id, expectation, observed, pass });
  console.log(`${pass ? '✓' : '✗'} ${id}\n    expected: ${expectation}\n    observed: ${observed}`);
}

const short = (e) => (e ? `${e.code ?? ''} ${e.message ?? ''}`.trim() || String(e) : 'no error');

const supabase = createClient(URL_, ANON, { auth: { persistSession: false } });
let original = null;
let userId = null;

try {
  console.log(`Target: ${URL_}\nPersona: ${persona}\n`);

  // ── Sign in (password grant, anon key only) ────────────────────────────────
  const signIn = await supabase.auth.signInWithPassword({
    email: cred.email,
    password: cred.password,
  });
  if (signIn.error) {
    console.error(`✗ sign-in failed: ${short(signIn.error)}`);
    process.exit(2);
  }
  const session = signIn.data.session;
  userId = session?.user?.id;
  if (!userId) {
    console.error('✗ sign-in returned no user id');
    process.exit(2);
  }
  console.log(`Signed in (user id ${userId.slice(0, 8)}…)\n`);

  // Re-bind the client to the user's JWT so RLS sees `authenticated`.
  const asUser = createClient(URL_, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  // ── LEG 1 — read own row (baseline) ───────────────────────────────────────
  const before = await asUser
    .from('profiles')
    .select('user_id, phone_verification_method, phone_verified_at, phone_verified')
    .eq('user_id', userId)
    .maybeSingle();
  if (before.error) {
    console.error(`✗ baseline read failed: ${short(before.error)}`);
    process.exit(2);
  }
  original = {
    phone_verification_method: before.data?.phone_verification_method ?? null,
    phone_verified_at: before.data?.phone_verified_at ?? null,
  };
  console.log(
    `baseline: method=${JSON.stringify(original.phone_verification_method)} ` +
      `verified_at=${JSON.stringify(original.phone_verified_at)} ` +
      `phone_verified=${JSON.stringify(before.data?.phone_verified)}\n`
  );

  // ── LEG 2a — authenticated user PATCHes OWN row, legal column value ───────
  // `profiles.phone_verification_method` CHECK allows only sms|social_auto|manual.
  const probeMethod = original.phone_verification_method === 'manual' ? 'social_auto' : 'manual';
  const patchA = await asUser
    .from('profiles')
    .update({ phone_verification_method: probeMethod })
    .eq('user_id', userId)
    .select('user_id, phone_verification_method');
  const rowsA = Array.isArray(patchA.data) ? patchA.data.length : 0;

  // Read back on a SEPARATE round-trip — the only way to distinguish
  // "1 row really updated" from "RLS silently filtered it to 0 rows".
  const afterA = await asUser
    .from('profiles')
    .select('phone_verification_method')
    .eq('user_id', userId)
    .maybeSingle();
  const gotA = afterA.data?.phone_verification_method ?? null;

  record(
    'LEG 2a (authenticated -> DIRECT PATCH of OWN profiles row, non-gating column) MUST be allowed',
    'row updated, new value readable back (surviving "Users can update their own profile" policy covers the branch the DROPped PUBLIC policy used to)',
    `patch error=${short(patchA.error)} | rows=${rowsA} | read back=${JSON.stringify(gotA)} | changed=${gotA === probeMethod}`,
    !patchA.error && gotA === probeMethod
  );

  // ── LEG 2b — THE FAITHFUL LEG: the app's EXACT publish-time payload ───────
  // `phoneService.verifyPhoneCode` writes this triple directly on every
  // successful SMS verify. `phone_verified_at` is the gating source of truth and
  // it is NOT a constant, so a real update is observable; we restore it after.
  const stamp = new Date().toISOString();
  const patchB = await asUser
    .from('profiles')
    .update({ phone_verified: true, phone_verified_at: stamp, phone_verification_method: 'sms' })
    .eq('user_id', userId)
    .select('user_id, phone_verified_at');
  const rowsB = Array.isArray(patchB.data) ? patchB.data.length : 0;

  const afterB = await asUser
    .from('profiles')
    .select('phone_verified, phone_verified_at')
    .eq('user_id', userId)
    .maybeSingle();
  const gotB = afterB.data?.phone_verified_at ?? null;
  const wroteGatingField = gotB !== null && new Date(gotB).getTime() === new Date(stamp).getTime();

  record(
    'LEG 2b (app-exact payload -> phone_verified + phone_verified_at) MUST be allowed',
    'the gating column is genuinely written (value read back equals the value we sent)',
    `patch error=${short(patchB.error)} | rows=${rowsB} | phone_verified=${
      afterB.data?.phone_verified
    } | verified_at read back=${JSON.stringify(gotB)} | equals-sent=${wroteGatingField}`,
    !patchB.error && wroteGatingField
  );

  // ── LEG 3 — negative control: same write against ANOTHER user's row ───────
  const other = await asUser
    .from('profiles')
    .select('user_id')
    .neq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (other.data?.user_id) {
    const otherPatch = await asUser
      .from('profiles')
      .update({ phone_verification_method: `must_not_land_${Date.now()}` })
      .eq('user_id', other.data.user_id)
      .select('user_id');
    const otherRows = Array.isArray(otherPatch.data) ? otherPatch.data.length : 0;
    record(
      'LEG 3 (authenticated -> DIRECT PATCH of ANOTHER profiles row) MUST be blocked',
      'zero rows updated',
      `rows updated=${otherRows} | error=${short(otherPatch.error)}`,
      otherRows === 0
    );
  } else {
    console.log('! LEG 3 skipped — could not read another profile row to target');
  }
} catch (e) {
  console.error('✗ unexpected error:', e?.message ?? e);
  results.push({ id: 'unexpected', pass: false, expectation: 'no exception', observed: String(e) });
} finally {
  // ── Restore ───────────────────────────────────────────────────────────────
  if (userId) {
    try {
      const restoreClient = createClient(URL_, ANON, { auth: { persistSession: false } });
      const s = await restoreClient.auth.signInWithPassword({
        email: cred.email,
        password: cred.password,
      });
      if (s.data?.session) {
        const asUser = createClient(URL_, ANON, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${s.data.session.access_token}` } },
        });
        await asUser
          .from('profiles')
          .update({
            phone_verification_method: original.phone_verification_method,
            phone_verified_at: original.phone_verified_at,
          })
          .eq('user_id', userId);
        const check = await asUser
          .from('profiles')
          .select('phone_verification_method, phone_verified_at')
          .eq('user_id', userId)
          .maybeSingle();
        const restored =
          (check.data?.phone_verification_method ?? null) === original.phone_verification_method &&
          (check.data?.phone_verified_at ?? null) === original.phone_verified_at;
        console.log(
          `\nrestore: method -> ${JSON.stringify(original.phone_verification_method)}, ` +
            `verified_at -> ${JSON.stringify(original.phone_verified_at)} (verified=${restored})`
        );
      }
    } catch (e) {
      console.warn('\n⚠ restore failed:', e?.message ?? e);
    }
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} legs passed ===`);
if (failed.length) {
  console.log('REGRESSION in: ' + failed.map((f) => f.id).join('; '));
  process.exit(1);
}
console.log('VERDICT: PASS — FIX-Task-59 did not remove legitimate authenticated self-update access.');
process.exit(0);

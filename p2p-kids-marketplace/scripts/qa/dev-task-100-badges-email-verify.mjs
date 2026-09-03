/**
 * DEV-TASK-100 (item 2) — Tier-1 live check: a fresh user's 'badges'
 * notification_preferences row must default email_enabled = TRUE (the signup
 * trigger handle_new_user was re-emitted by
 * 20260903000003_dev_task_100_badges_email_default_on.sql).
 *
 * Creates ONE disposable user via the service-role GoTrue admin API (fires the
 * on_auth_user_created trigger), reads back their badges pref row, asserts
 * email_enabled = true, then cleans up (BP-70: delete profiles by user_id, then
 * admin.deleteUser — profiles.id != user_id in this app). Residue-verified.
 */
import { loadEnv, getClients, log } from './lib/r41-common.mjs';

loadEnv();
const { url, anon, admin } = getClients();

const UNIQUE = Date.now();
const email = `qa.dt100.badges.${UNIQUE}@kidsmarketplace.test`;
const password = 'Dt100Badges!';

let userId = null;
try {
  log('create', 'Creating disposable user', email);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser: ${createErr.message}`);
  userId = created.user.id;
  log('created', userId);

  // Give the AFTER INSERT trigger a moment to finish (it is synchronous in the
  // same transaction as the insert, but poll once for safety).
  const deadline = Date.now() + 15000;
  let row = null;
  let lastErr = null;
  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from('notification_preferences')
      .select('category, push_enabled, in_app_enabled, email_enabled')
      .eq('user_id', userId)
      .eq('category', 'badges')
      .maybeSingle();
    if (error) { lastErr = error; }
    else if (data) { row = data; break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!row) {
    throw new Error(`badges pref row not found (lastErr=${lastErr?.message ?? 'none'})`);
  }

  log('read-back', JSON.stringify(row));
  const pass = row.category === 'badges' && row.email_enabled === true;
  console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'} — badges email default for a new user = ${row.email_enabled} (expected true)`);
  console.log('   Also sanity-checked other defaults:', JSON.stringify({ push: row.push_enabled, in_app: row.in_app_enabled }));
  if (!pass) process.exitCode = 1;
} catch (err) {
  console.error('❌', err.message);
  process.exitCode = 1;
} finally {
  // BP-70 cleanup: profiles.id != user_id — delete profiles by user_id, then the auth user.
  if (userId) {
    const { error: profErr } = await admin.from('profiles').delete().eq('user_id', userId);
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    log('cleanup', `profiles delete error=${profErr?.message ?? 'none'}, deleteUser error=${delErr?.message ?? 'none'}`);

    // Residue check
    const { data: leftover } = await admin
      .from('notification_preferences')
      .select('id')
      .eq('user_id', userId);
    console.log(`   residue notification_preferences rows: ${(leftover ?? []).length} (expected 0)`);
  }
}

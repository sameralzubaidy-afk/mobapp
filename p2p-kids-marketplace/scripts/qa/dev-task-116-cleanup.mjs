/**
 * DT-116 (2026-09-05) — Clear non-reversible QA residue left by QA Task 32 (R6).
 *
 * One-off QA-tooling cleanup. Uses the service role (bypasses RLS). Deletes ONLY
 * the disposable residue rows flagged in the QA Task 32 ledger/report:
 *   - P03 badge award left on test-buyer (KEEP the persona)
 *   - C09 needs-edits item owned by test-buyer (KEEP the persona)
 *   - draft education section 145edf55  (already removed via admin UI item 9 — no-op)
 *   - archived disposable policy 10e2c3e6 (already removed via admin UI item 9 — no-op)
 *   - fresh qa.* users (Alice/Bob/Charlie) + their waitlist/profile rows (hard delete)
 *
 * Standing personas and load-bearing data are never touched (test-buyer,
 * real liability 4f41639e, real nodes, the other (non-fresh) qa.* users).
 *
 * Env convention: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from
 * p2p-kids-marketplace/.env (or .env.staging) — same as the other scripts/qa/*.
 *
 * Usage:
 *   node scripts/qa/dev-task-116-cleanup.mjs --dry-run   # show what would happen
 *   node scripts/qa/dev-task-116-cleanup.mjs             # execute
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const DRY_RUN = process.argv.includes('--dry-run');

const url = process.env.SUPABASE_URL || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !serviceRole) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in p2p-kids-marketplace/.env(.staging)');
  process.exit(2);
}
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

// ── DT-116 QA residue targets (QA Task 32 ledger/report) ────────────────────
const TEST_BUYER = '49243010-f458-4744-add1-a6c84ab95f1f'; // standing persona — KEEP
const P03_AWARD = 'baa7a2ee-6d90-4282-86f5-b436aec12fb7';
const P03_BADGE = '3ac79591-537b-4612-a699-194404d4d46a';
const C09_ITEM = '5cde6ca9-e831-464b-8aa1-3c10a5e8c277';
const QA_WAITLIST = '6390e6d4-fd9d-4022-b3bf-13afb40076d4';
const EDU_SECTION = '145edf55-9640-41db-82d5-f22f649d2e35';
const ARCHIVED_POLICY = '10e2c3e6-10e8-436a-9650-de70aa1b33ed';
const QA_USERS = [
  { id: 'b8415a56-ed05-40f6-861d-88eb29611692', label: 'qa.alice (R6)' },
  { id: '3f22269f-688d-498d-987c-1ab5f3bc47b2', label: 'qa.bob (R6, incomplete)' },
  { id: '76af5475-9b3f-435c-a101-84588e843b44', label: 'qa.charlie (R6)' },
];

const log = (...a) => console.log(...a);
const step = (t) => console.log(`\n=== ${t}${DRY_RUN ? '  [DRY RUN — not executed]' : ''} ===`);

async function countOf(table, col, val) {
  const { count, error } = await admin
    .from(table).select('*', { count: 'exact', head: true }).eq(col, val);
  if (error) return `err:${error.message}`;
  return count ?? 0;
}

async function deleteRows(table, col, val) {
  if (DRY_RUN) { log(`  would delete from ${table} WHERE ${col}=${val}`); return; }
  const { error, count } = await admin.from(table).delete().eq(col, val).select('id', { count: 'exact' });
  if (error) log(`  ⚠️ ${table}: ${error.message}`);
  else log(`  ✓ deleted ${count ?? '?'} row(s) from ${table}`);
}

// 1) Revoke P03 badge award on test-buyer (keep persona)
step('1. Revoke P03 award on test-buyer');
await deleteRows('user_badges', 'id', P03_AWARD);
if (!DRY_RUN) {
  const { error } = await admin
    .from('badge_audit_logs')
    .delete()
    .eq('user_id', TEST_BUYER)
    .eq('badge_id', P03_BADGE);
  if (error) log(`  ⚠️ badge_audit_logs: ${error.message}`);
  else log('  ✓ deleted manual_award badge_audit_logs rows for P03 badge on test-buyer');
} else {
  log('  would delete badge_audit_logs WHERE user_id=test-buyer AND badge_id=P03');
}

// 2) Delete C09 needs-edits item (owned by test-buyer)
step('2. Delete C09 needs-edits item (test-buyer disposable)');
if (!DRY_RUN) {
  const { error, count } = await admin.from('items').delete().eq('id', C09_ITEM).select('id', { count: 'exact' });
  if (error) log(`  ⚠️ items: ${error.message}`);
  else log(`  ✓ deleted item ${C09_ITEM}${count ? ` (${count})` : ''}`);
} else {
  log(`  would delete items.id=${C09_ITEM}`);
}

// 3) Draft education section (already removed via item-9 UI this session — ensure-gone)
step('3. Draft education section 145edf55');
{
  const c = await countOf('education_sections', 'id', EDU_SECTION);
  log(`  remaining: ${c}${c === 0 ? ' (already removed via admin UI)' : ''}`);
  if (c > 0 && !DRY_RUN) await deleteRows('education_sections', 'id', EDU_SECTION);
}

// 4) Archived disposable policy (already removed via item-9 UI — ensure-gone)
step('4. Archived disposable policy 10e2c3e6');
{
  const c = await countOf('platform_policies', 'id', ARCHIVED_POLICY);
  log(`  remaining: ${c}${c === 0 ? ' (already removed via admin UI)' : ''}`);
  if (c > 0 && !DRY_RUN) {
    const acc = await countOf('policy_acceptances', 'policy_id', ARCHIVED_POLICY);
    if (acc > 0) log(`  ⚠️ skip — ${acc} policy_acceptances reference it`);
    else await deleteRows('platform_policies', 'id', ARCHIVED_POLICY);
  }
}

// 5) Fresh qa.* waitlist row + per-user rows, then hard-delete the users
step('5. Fresh qa.* waitlist row');
await deleteRows('zip_waitlist', 'id', QA_WAITLIST);

const USER_TABLES = [
  'subscriptions', 'billing_history', 'subscription_events', 'user_notifications',
  'notification_preferences', 'profiles', 'sp_wallets', 'user_badges',
  'id_badges', 'education_analytics', 'cart_items', 'zip_waitlist',
];
for (const u of QA_USERS) {
  step(`6. Hard-delete ${u.label} (${u.id})`);
  for (const table of USER_TABLES) {
    const c = DRY_RUN ? null : await countOf(table, 'user_id', u.id);
    if (DRY_RUN) {
      log(`  would delete ${table} rows for user`);
    } else if (c > 0) {
      await deleteRows(table, 'user_id', u.id);
    }
  }
  if (DRY_RUN) {
    log(`  would auth.admin.deleteUser(${u.id})`);
  } else {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) log(`  ⚠️ auth deleteUser ${u.id}: ${error.message}`);
    else log(`  ✓ auth user ${u.label} deleted`);
  }
}

// 7) Residue read-back
step('7. Residue read-back');
if (!DRY_RUN) {
  const checks = [
    ['user_badges P03 award', await countOf('user_badges', 'id', P03_AWARD)],
    ['C09 item', await countOf('items', 'id', C09_ITEM)],
    ['edu section', await countOf('education_sections', 'id', EDU_SECTION)],
    ['archived policy', await countOf('platform_policies', 'id', ARCHIVED_POLICY)],
    ['qa waitlist row', await countOf('zip_waitlist', 'id', QA_WAITLIST)],
  ];
  for (const u of QA_USERS) {
    checks.push([`${u.label} profiles`, await countOf('profiles', 'user_id', u.id)]);
    checks.push([`${u.label} auth`, await admin.auth.admin.listUsers().then(
      (r) => (r.data?.users ?? []).filter((x) => x.id === u.id).length,
      () => 'err'
    )]);
  }
  for (const [label, c] of checks) {
    log(`  ${label}: ${c}${c === 0 ? '  ✅' : '  ⚠️ REMAINING'}`);
  }
  log('\nDone. All checks should read 0.');
} else {
  log('  (dry run — run without --dry-run to execute)');
}

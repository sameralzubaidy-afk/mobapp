/**
 * DT-117 (2026-09-05) — Clear badge test-icon residue left by badge QA.
 *
 * One-off QA-tooling cleanup. Uses the service role (bypasses RLS + the
 * `badge-icons` storage RLS). Removes the DISPOSABLE test icons that QA uploads
 * left on real badges with no UI to clear them (DEV-TASK-117 item 6):
 *   - badge 3ac79591 ("50 Trades")  — DT116 P02 re-verify icon (2026-09-05)
 *   - badge d886e2af ("Updated 10 Trades") — older badge-QA icon (2026-01-12)
 *
 * For each badge:
 *   1. remove the storage object under badge-icons/icons/<badgeId>-*.{png,jpg,...}
 *   2. clear badges.icon_url to NULL
 *   3. delete the matching 'Icon uploaded from admin portal' badge_audit_logs
 *      rows (the disposable config_change upload residue), mirroring the
 *      DT116 award-audit cleanup. Real config rows for other badges are untouched.
 *
 * Env convention: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from
 * p2p-kids-marketplace/.env (or .env.staging) — same as the other scripts/qa/*.
 *
 * Usage:
 *   node scripts/qa/dev-task-117-badge-icon-cleanup.mjs --dry-run   # show what would happen
 *   node scripts/qa/dev-task-117-badge-icon-cleanup.mjs             # execute
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

// ── DT-117 residue targets ───────────────────────────────────────────────────
const BADGES = [
  { id: '3ac79591-537b-4612-a699-194404d4d46a', label: '50 Trades (DT116 P02)' },
  { id: 'd886e2af-3bdd-4dd7-8e0a-fbce28665c33', label: 'Updated 10 Trades (older badge-QA)' },
];

const log = (...a) => console.log(...a);
const step = (t) => console.log(`\n=== ${t}${DRY_RUN ? '  [DRY RUN — not executed]' : ''} ===`);

/** Pull a storage object path out of a public badge-icons URL. */
function extractObjectPath(publicUrl) {
  const marker = '/object/public/badge-icons/';
  const idx = (publicUrl || '').indexOf(marker);
  if (idx === -1) return null;
  return (publicUrl.substring(idx + marker.length).split('?')[0]) || null;
}

for (const badge of BADGES) {
  step(`${badge.label} (${badge.id})`);

  // Read current icon_url
  const { data: row, error: readError } = await admin
    .from('badges').select('id, name, icon_url').eq('id', badge.id).maybeSingle();
  if (readError) {
    log(`  ⚠️ read error: ${readError.message}`);
    continue;
  }
  if (!row) {
    log(`  badge not found — skipping`);
    continue;
  }
  log(`  current icon_url: ${row.icon_url || '(null)'}`);
  const objectPath = extractObjectPath(row.icon_url);
  log(`  storage object:   ${objectPath || '(none)'}`);

  // 1) Storage object removal
  if (objectPath) {
    if (DRY_RUN) {
      log(`  would remove storage object badge-icons/${objectPath}`);
    } else {
      const { error } = await admin.storage.from('badge-icons').remove([objectPath]);
      if (error) log(`  ⚠️ storage remove failed: ${error.message} (continuing to DB clear)`);
      else log(`  ✓ removed storage object badge-icons/${objectPath}`);
    }
  }

  // 2) Clear badges.icon_url
  if (DRY_RUN) {
    log(`  would set badges.icon_url = NULL for ${badge.id}`);
  } else {
    const { error } = await admin
      .from('badges').update({ icon_url: null, updated_at: new Date().toISOString() })
      .eq('id', badge.id);
    if (error) log(`  ⚠️ badges update failed: ${error.message}`);
    else log(`  ✓ badges.icon_url = NULL for ${badge.id}`);
  }

  // 3) Remove the disposable icon-upload audit residue (config_change rows for
  //    this badge whose reason is the portal-upload marker). This is QA test
  //    residue, not a real admin history record.
  if (DRY_RUN) {
    log(`  would delete badge_audit_logs WHERE badge_id=${badge.id} AND reason='Icon uploaded from admin portal'`);
  } else {
    const { data: toDelete, error: listError } = await admin
      .from('badge_audit_logs')
      .select('id, reason, metadata')
      .eq('badge_id', badge.id)
      .eq('reason', 'Icon uploaded from admin portal');
    if (listError) {
      log(`  ⚠️ badge_audit_logs list error: ${listError.message}`);
    } else {
      for (const audit of toDelete || []) {
        const removed = await admin.from('badge_audit_logs').delete().eq('id', audit.id);
        if (removed.error) log(`  ⚠️ audit delete ${audit.id}: ${removed.error.message}`);
        else log(`  ✓ deleted audit row ${audit.id}`);
      }
      if (!toDelete || toDelete.length === 0) log('  (no upload audit rows found)');
    }
  }
}

// ── Read-back ────────────────────────────────────────────────────────────────
step('Read-back');
if (!DRY_RUN) {
  const { data: after } = await admin
    .from('badges').select('id, name, icon_url').in('id', BADGES.map((b) => b.id));
  for (const b of after || []) {
    log(`  ${b.name} (${b.id}) icon_url: ${b.icon_url || '(null)'}`);
  }
  const { data: objs, error: listErr } = await admin.storage
    .from('badge-icons').list('icons', { limit: 1000 });
  if (listErr) {
    log(`  ⚠️ storage list error: ${listErr.message}`);
  } else {
    const orphans = (objs || []).filter((o) =>
      BADGES.some((b) => o.name.startsWith(b.id))
    );
    log(`  remaining objects matching residue badges: ${orphans.length}`);
    for (const o of orphans) log(`    - ${o.name}`);
  }
  const { count: auditLeft } = await admin
    .from('badge_audit_logs').select('*', { count: 'exact', head: true })
    .in('badge_id', BADGES.map((b) => b.id))
    .eq('reason', 'Icon uploaded from admin portal');
  log(`  remaining icon-upload audit rows for residue badges: ${auditLeft ?? 0}`);
}
log(DRY_RUN ? '\nDry run complete — nothing changed.' : '\nCleanup complete.');

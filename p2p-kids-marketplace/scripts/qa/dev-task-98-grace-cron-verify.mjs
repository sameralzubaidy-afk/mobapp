/**
 * DEV-TASK-98 (2026-09-03) — live verification for the grace-reminder cron fix.
 *
 * Defect (found during R41): grace-period-cron wrote its in-app leg to a bare
 * `notifications` table that does not exist (real table = `user_notifications`)
 * and relied on `grace_reminder_sent_day_*` columns that existed in no
 * migration. Both fixed in the EF + a new committed migration.
 *
 * This script proves the FIXED path end-to-end against staging:
 *   1. Creates a DISPOSABLE user (service role).
 *   2. Puts their `subscriptions` row into the exact grace state the webhook
 *      produces (status='grace_period', grace_ends_at ≈ now + 6d20h so the
 *      cron computes daysRemaining == 7 → fires the day-7 threshold).
 *   3. Invokes the DEPLOYED grace-period-cron Edge Function (service-role
 *      bearer — the same caller the pg_cron job / invoke_grace_period_cron RPC
 *      uses). NOTE: this processes all live grace subs (same as the 3AM run);
 *      real subs already at a threshold were flagged at today's 3AM run, so
 *      they are skipped by the dedup.
 *   4. Reads back: exactly ONE user_notifications row (category='subscription',
 *      type='subscription', data.event='grace_period_reminder', days_left 7,
 *      deep_link '/subscription', channels ['push','in_app']) and
 *      subscriptions.grace_reminder_sent_day_7 = true.
 *   5. Cleanup (BP-70): deletes subscriptions/user_notifications by user_id,
 *      profiles by user_id, then admin.deleteUser.
 *
 * Run: node scripts/qa/dev-task-98-grace-cron-verify.mjs [--keep] [--dry-run]
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const KEEP = process.argv.includes('--keep');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
const EF_URL = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/grace-period-cron`;

function log(...a) { console.log('[dt98-grace-cron]', ...a); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let userId = null;

async function cleanup() {
  if (DRY_RUN || KEEP) return;
  log('🧹 cleanup...');
  try {
    if (userId) {
      const del = async (table) => {
        const { error } = await admin.from(table).delete().eq('user_id', userId);
        if (error) console.warn(`db cleanup ${table} err`, error.message);
      };
      await del('subscriptions');
      await del('subscription_events');
      await del('user_notifications');
      const { error: pErr } = await admin.from('profiles').delete().eq('user_id', userId);
      if (pErr) console.warn('db cleanup profiles err', pErr.message);
      const { error: uErr } = await admin.auth.admin.deleteUser(userId);
      if (uErr) console.warn('db cleanup deleteUser err', uErr.message);
    }
  } catch (e) { console.warn('db cleanup err', e.message); }
  log('✅ cleanup done');
}

async function main() {
  if (DRY_RUN) {
    log('DRY-RUN — no mutations. Would: create disposable user, set subscriptions to grace_period @ ~7d remaining, invoke deployed grace-period-cron EF, assert 1 user_notifications row (event=grace_period_reminder, days_left 7) + day-7 flag true, then cleanup.');
    return;
  }

  // 1. Disposable user (signup trigger creates the default 'free' subscriptions row)
  const email = `qa.dt98.grace.${Date.now()}@kidsmarketplace.test`;
  const password = 'TestPass123!';
  const { data: { user }, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (userErr) { console.error('❌ createUser failed:', userErr.message); process.exit(1); }
  userId = user.id;
  log(`✅ disposable user ${userId} (${email})`);

  // 2. Ensure a subscriptions row exists (signup trigger should have created it)
  let subId = null;
  for (let i = 0; i < 10; i++) {
    const { data } = await admin.from('subscriptions').select('id, status').eq('user_id', userId).maybeSingle();
    if (data) { subId = data.id; break; }
    await sleep(500);
  }
  if (!subId) {
    const { data, error } = await admin.from('subscriptions')
      .insert({ user_id: userId, status: 'free', tier: 'free' })
      .select('id').single();
    if (error) { console.error('❌ subscriptions insert failed:', error.message); process.exit(1); }
    subId = data.id;
    log('⚠️ signup trigger did not create subscriptions row — inserted fallback');
  }

  // 3. Put it in the exact grace state the webhook produces: status grace_period,
  //    grace_ends_at ~6d20h out → cron computes daysRemaining = ceil(6.83) = 7.
  const graceEndsAt = new Date(Date.now() + (6 * 24 + 20) * 60 * 60 * 1000).toISOString();
  const { error: upErr } = await admin.from('subscriptions').update({
    status: 'grace_period',
    grace_ends_at: graceEndsAt,
    grace_reminder_sent_day_60: false,
    grace_reminder_sent_day_30: false,
    grace_reminder_sent_day_7: false,
    grace_reminder_sent_day_1: false,
  }).eq('id', subId);
  if (upErr) { console.error('❌ subscriptions update failed:', upErr.message); process.exit(1); }
  log(`✅ subscription ${subId} set to grace_period, grace_ends_at=${graceEndsAt} (expect daysRemaining=7 → day-7 reminder)`);

  // 4. Invoke the DEPLOYED cron EF (service-role bearer — same as the RPC/cron)
  log('📡 invoking deployed grace-period-cron EF...');
  let efBody = null;
  try {
    const res = await fetch(EF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({}),
    });
    efBody = await res.json().catch(() => ({}));
    log(`📡 EF HTTP ${res.status}:`, JSON.stringify(efBody));
    if (!res.ok && !(efBody && efBody.success)) {
      console.error('❌ EF invocation returned non-OK — cron not processing.');
      if (!KEEP) await cleanup();
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ EF fetch error:', e.message);
    if (!KEEP) await cleanup();
    process.exit(1);
  }

  // 5. Read back the in-app notification row + flag
  await sleep(1500);
  const { data: notifRows, error: nErr } = await admin
    .from('user_notifications')
    .select('id, category, type, title, body, channels, data, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (nErr) { console.error('❌ notification read failed:', nErr.message); if (!KEEP) await cleanup(); process.exit(1); }

  const { data: subRow } = await admin.from('subscriptions').select('status, grace_reminder_sent_day_60, grace_reminder_sent_day_30, grace_reminder_sent_day_7, grace_reminder_sent_day_1').eq('id', subId).single();

  log('── assertions ──────────────────────────────────────────');
  log(`user_notifications rows for user: ${notifRows?.length ?? 0}`);
  if (notifRows && notifRows.length > 0) {
    log('  row[0]:', JSON.stringify({
      category: notifRows[0].category, type: notifRows[0].type,
      title: notifRows[0].title, channels: notifRows[0].channels,
      event: notifRows[0].data?.event, days_left: notifRows[0].data?.days_left,
      deep_link: notifRows[0].data?.deep_link, is_read: notifRows[0].is_read,
    }));
  }
  log('  sub flags:', JSON.stringify({ d60: subRow?.grace_reminder_sent_day_60, d30: subRow?.grace_reminder_sent_day_30, d7: subRow?.grace_reminder_sent_day_7, d1: subRow?.grace_reminder_sent_day_1 }));

  const row = notifRows?.[0];
  const pass =
    notifRows?.length === 1 &&
    row?.category === 'subscription' &&
    row?.type === 'subscription' &&
    row?.data?.event === 'grace_period_reminder' &&
    Number(row?.data?.days_left) === 7 &&
    row?.data?.deep_link === '/subscription' &&
    Array.isArray(row?.channels) && row.channels.includes('in_app') &&
    subRow?.grace_reminder_sent_day_7 === true;

  if (pass) {
    log('✅ PASS — exactly one canonical grace_reminder in-app notification created and day-7 flag set (no duplicate).');
  } else {
    log('❌ FAIL — expected exactly 1 user_notifications row (category=subscription, type=subscription, data.event=grace_period_reminder, days_left=7, deep_link=/subscription, channels incl in_app) AND subscriptions.grace_reminder_sent_day_7=true.');
    log(`   EF response: ${JSON.stringify(efBody)}`);
  }

  if (!KEEP) await cleanup();
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => { console.error('❌ script error:', e); if (!KEEP) await cleanup(); process.exit(1); });

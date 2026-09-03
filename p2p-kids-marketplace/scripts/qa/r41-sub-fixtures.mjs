/**
 * DEV-TASK-R41 (2026-09-03) — SUB-guide fixture builder.
 *
 * Makes currently-unreachable SUB test states reachable for QA on standing
 * personas. All writes are service-role DB inserts/updates on STAGING — run by
 * the dev team with Samer's approval (two-phase provisioning: code here is
 * Phase 1; executing it against staging is Phase 2). Read-only / --dry-run
 * flags are provided; every fixture is idempotent and removable.
 *
 * Subcommands:
 *
 *   billing-failed            → SUB-TC-E03 (a failed billing_history row so
 *                               Transaction History shows a red Failed badge
 *                               + error message). Default persona test-buyer.
 *     npm run qa:r41-sub -- billing-failed --persona test-buyer [--remove] [--dry-run]
 *
 *   notif-sub-status          → SUB-TC-E04 (Subscription Status screen entry).
 *                               Inserts an in-app user_notifications row whose
 *                               data.deep_link = '/subscription/status' — the
 *                               ONLY way to reach SubscriptionStatusScreen.
 *     npm run qa:r41-sub -- notif-sub-status --persona test-buyer [--remove] [--dry-run]
 *
 *   notif-sub-event           → SUB-TC-D06/D07 + MSG-TC-R02 in-app notification
 *                               rows. --preset selects the producer-faithful
 *                               row; see PRESETS below. --type-override lets QA
 *                               force the literal NotificationCenter icon type
 *                               (e.g. payment_failed red icon).
 *     npm run qa:r41-sub -- notif-sub-event --persona test-buyer --preset payment_failed [--remove]
 *     npm run qa:r41-sub -- notif-sub-event --persona test-buyer --preset renewal_success [--remove]
 *     npm run qa:r41-sub -- notif-sub-event --persona test-buyer --preset trial_reminder_7d [--remove]
 *     npm run qa:r41-sub -- notif-sub-event --persona test-buyer --preset grace_reminder_7 [--remove]
 *     # R02 legs (need a real trade/listing owned by the persona):
 *     npm run qa:r41-sub -- notif-sub-event --persona test-buyer --preset trade_completed --trade-id <uuid> [--remove]
 *     npm run qa:r41-sub -- notif-sub-event --persona test-seller --preset listing_approved --listing-id <uuid> [--remove]
 *
 *   wallet-state              → SUB-TC-I06 / I05 + TRD freeze legs. Sets
 *                               sp_wallets.state for a persona.
 *                               NOTE: 'inactive' is NOT a valid DB state (it is
 *                               app-derived when no wallet row exists); valid
 *                               values are active|frozen|grace_period|suspended.
 *     npm run qa:r41-sub -- wallet-state --persona test-buyer --state frozen [--dry-run]
 *     npm run qa:r41-sub -- wallet-state --persona test-buyer --state active   # restore
 *
 * Env: .env/.env.staging (service role). Persona ids mirror ef-repro.mjs.
 */
import { getClients, personaOrThrow, resolveUserId, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const PERSONA = argValue('persona') || 'test-buyer';
const DRY_RUN = hasFlag('--dry-run');
const REMOVE = hasFlag('--remove');
const PRESET = argValue('preset');
const TYPE_OVERRIDE = argValue('type-override');
const TRADE_ID = argValue('trade-id');
const LISTING_ID = argValue('listing-id');
const STATE = argValue('state');

const persona = personaOrThrow(PERSONA);

function usage() {
  console.log(`qa:r41-sub — SUB fixture builder (E03/E04/D06/D07/I06 + R02 rows)

  billing-failed [--persona X] [--remove]
  notif-sub-status [--persona X] [--remove]
  notif-sub-event --preset <name> [--persona X] [--type-override T] [--trade-id U] [--listing-id U] [--remove]
  wallet-state --state <active|frozen|grace_period|suspended> [--persona X]
`);
}

// ── producer-faithful notification presets ─────────────────────────────────
// category/type/title/body/data mirror what each real producer writes (research
// 2026-09-03): the webhook EF writes type:'subscription' + data.event; the
// trial-reminders EF writes data.event:'trial_reminder'; the grace cron pushes
// data.type:'grace_period_reminder'. data.qa_r41 + data.preset are the fixture
// tag used by --remove (never rendered).
const PRESETS = {
  trial_reminder_7d: {
    category: 'subscription', type: 'subscription',
    title: '🎉 7 Days Left in Your Free Trial!',
    body: 'Continue enjoying Kids Club+ benefits! Your trial ends in 7 days. Add a payment method to keep your Swap Points active.',
    data: { event: 'trial_reminder', days: 7, deep_link: '/subscription' },
  },
  trial_reminder_3d: {
    category: 'subscription', type: 'subscription',
    title: '⏰ 3 Days Left in Your Free Trial',
    body: 'Your trial ends in 3 days. Add a payment method now to keep earning and spending Swap Points.',
    data: { event: 'trial_reminder', days: 3, deep_link: '/subscription' },
  },
  trial_reminder_1d: {
    category: 'subscription', type: 'subscription',
    title: '🚨 Last Day of Your Free Trial!',
    body: 'Your trial ends tomorrow! Subscribe now to keep your Kids Club+ benefits and Swap Points.',
    data: { event: 'trial_reminder', days: 1, deep_link: '/subscription' },
  },
  renewal_success: {
    category: 'subscription', type: 'subscription',
    title: 'Subscription Renewed ✅',
    body: 'Your Kids Club+ subscription has been renewed. Your next billing date is the same day each month.',
    data: { event: 'subscription_renewed', deep_link: '/subscription' },
  },
  payment_failed: {
    category: 'subscription', type: 'subscription',
    title: '⚠️ Payment Failed - Action Required',
    body: 'Your subscription payment was declined. Please update your payment method to avoid service interruption.',
    data: { event: 'payment_failed', critical: true, deep_link: '/subscription' },
  },
  cancellation: {
    category: 'subscription', type: 'subscription',
    title: 'Subscription Cancelled',
    body: 'Your Kids Club+ subscription has been cancelled. You will have access until the end of your billing period.',
    data: { event: 'subscription_cancelled', deep_link: '/subscription' },
  },
  grace_reminder_30: {
    category: 'subscription', type: 'subscription',
    title: '📅 Grace Period Update',
    body: 'Your Kids Club+ grace period ends in 30 days. Re-subscribe to keep your Swap Points from being frozen.',
    data: { event: 'grace_period_reminder', days_left: 30, deep_link: '/subscription' },
  },
  grace_reminder_7: {
    category: 'subscription', type: 'subscription',
    title: '⏰ Grace Period Ending Soon',
    body: 'You have 7 days to re-subscribe before your Swap Points are frozen.',
    data: { event: 'grace_period_reminder', days_left: 7, deep_link: '/subscription' },
  },
  grace_reminder_1: {
    category: 'subscription', type: 'subscription',
    title: '⚠️ Final Day: Grace Period Ending',
    body: 'Your grace period ends today. Re-subscribe now to keep your Swap Points.',
    data: { event: 'grace_period_reminder', days_left: 1, deep_link: '/subscription' },
  },
  // R02 legs — require --trade-id / --listing-id
  trade_completed: {
    category: 'trades', type: 'trade_completed', needsTrade: true,
    title: 'Trade Complete! 🎉',
    body: 'Your trade is complete! Don\'t forget to leave a review.',
    data: {},
  },
  listing_approved: {
    category: 'listings', type: 'listing_approved', needsListing: true,
    title: 'Listing Approved',
    body: 'Your listing was approved and is now live.',
    data: {},
  },
};

async function insertNotification(userId, preset) {
  const row = {
    user_id: userId,
    category: preset.category,
    type: TYPE_OVERRIDE || preset.type,
    title: preset.title,
    body: preset.body,
    channels: ['push', 'in_app'],
    data: { ...preset.data, qa_r41: true, preset: PRESET, created_at: new Date().toISOString() },
    is_read: false,
  };
  if (preset.needsTrade) {
    if (!TRADE_ID) { console.error(`❌ --preset ${PRESET} requires --trade-id <uuid>`); process.exit(2); }
    row.data = { ...row.data, trade_id: TRADE_ID, deep_link: `/trades/${TRADE_ID}`, type: row.type };
  }
  if (preset.needsListing) {
    if (!LISTING_ID) { console.error(`❌ --preset ${PRESET} requires --listing-id <uuid>`); process.exit(2); }
    row.data = { ...row.data, listing_id: LISTING_ID, item_id: LISTING_ID, deep_link: `/listing/${LISTING_ID}`, type: row.type };
  }
  const { data, error } = await admin.from('user_notifications').insert(row).select('id, type, title, created_at').single();
  if (error) { console.error(`❌ notification insert failed: ${error.message}`); process.exit(1); }
  log('r41-sub', `✅ inserted user_notifications ${data.id} (type=${data.type})`);
  return data.id;
}

async function removeFixtureRows(userId, tag) {
  const { data, error } = await admin
    .from('user_notifications')
    .select('id, data')
    .eq('user_id', userId)
    .contains('data', { qa_r41: true });
  if (error) { console.error(`❌ fixture lookup failed: ${error.message}`); process.exit(1); }
  let removed = 0;
  for (const r of data || []) {
    const p = r.data?.preset;
    if (!tag || p === tag) {
      await admin.from('user_notifications').delete().eq('id', r.id);
      removed += 1;
    }
  }
  log('r41-sub', `🧹 removed ${removed} R41 fixture notification row(s)`);
}

async function cmdBillingFailed(userId) {
  // Persona's current subscriptions row (user_id is UNIQUE → single).
  const { data: subRow, error: subErr } = await admin
    .from('subscriptions').select('id, status').eq('user_id', userId).maybeSingle();
  if (subErr) { console.error(`❌ subscriptions read failed: ${subErr.message}`); process.exit(1); }
  if (!subRow) {
    console.error('❌ Persona has no subscriptions row (cannot FK billing_history). Run seed:staging first.');
    process.exit(1);
  }
  const chargeId = `qa_r41_e03_failed_${userId.slice(0, 8)}`;
  if (REMOVE) {
    const { error } = await admin.from('billing_history').delete().eq('charge_id', chargeId);
    if (error) { console.error(`❌ remove failed: ${error.message}`); process.exit(1); }
    log('r41-sub', `🧹 removed E03 failed billing row (charge_id=${chargeId})`);
    return;
  }
  const row = {
    user_id: userId,
    subscription_id: subRow.id,
    charge_id: chargeId,
    stripe_invoice_id: `in_qa_r41_e03_failed_${userId.slice(0, 8)}`,
    amount: 599,
    currency: 'usd',
    status: 'failed',
    description: 'Kids Club+ Subscription',
    error_message: 'Your payment was declined. Please update your payment method to keep your subscription active.',
  };
  if (DRY_RUN) { log('r41-sub', 'DRY-RUN — would upsert billing_history row:', row); return; }
  const { error } = await admin.from('billing_history').upsert(row, { onConflict: 'charge_id' });
  if (error) { console.error(`❌ billing_history upsert failed: ${error.message}`); process.exit(1); }
  log('r41-sub', `✅ E03 failed billing row ready (charge_id=${chargeId}) — open Profile → Billing History to see the red Failed badge`);
}

async function cmdNotifSubStatus(userId) {
  const row = {
    user_id: userId,
    category: 'subscription',
    type: 'subscription',
    title: 'Subscription Status',
    body: 'Tap to open your subscription diagnostic status.',
    channels: ['push', 'in_app'],
    data: { deep_link: '/subscription/status', qa_r41: true, preset: 'sub_status', created_at: new Date().toISOString() },
    is_read: false,
  };
  if (REMOVE) { await removeFixtureRows(userId, 'sub_status'); return; }
  if (DRY_RUN) { log('r41-sub', 'DRY-RUN — would insert:', row); return; }
  const { data, error } = await admin.from('user_notifications').insert(row).select('id').single();
  if (error) { console.error(`❌ insert failed: ${error.message}`); process.exit(1); }
  log('r41-sub', `✅ E04 row ${data.id} inserted — QA: open Notification Center and tap it to reach Subscription Status`);
}

async function cmdNotifSubEvent(userId) {
  const preset = PRESETS[PRESET];
  if (!preset) {
    console.error(`❌ Unknown --preset '${PRESET}'. Known: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(2);
  }
  if (REMOVE) { await removeFixtureRows(userId, PRESET); return; }
  if (DRY_RUN) { log('r41-sub', `DRY-RUN — would insert preset '${PRESET}'`, preset); return; }
  await insertNotification(userId, preset);
  log('r41-sub', `✅ preset '${PRESET}' inserted for ${PERSONA} — check the in-app Notification Center`);
}

async function cmdWalletState(userId) {
  const valid = ['active', 'frozen', 'grace_period', 'suspended'];
  if (!valid.includes(STATE)) {
    console.error(`❌ --state must be one of ${valid.join('|')}. NOTE: 'inactive' is NOT a valid DB state — it is app-derived when no wallet row exists (free-user visual), not a settable value.`);
    process.exit(2);
  }
  const patch = { user_id: userId, state: STATE, updated_at: new Date().toISOString() };
  if (STATE === 'frozen' || STATE === 'suspended') patch.frozen_at = new Date().toISOString();
  if (STATE === 'active' || STATE === 'grace_period') patch.frozen_at = null;
  if (DRY_RUN) { log('r41-sub', 'DRY-RUN — would set wallet state:', patch); return; }
  const { data, error } = await admin.from('sp_wallets').upsert(patch, { onConflict: 'user_id' }).select('user_id, state, available_balance').single();
  if (error) { console.error(`❌ sp_wallets upsert failed: ${error.message}`); process.exit(1); }
  log('r41-sub', `✅ wallet state -> ${data.state} (available ${data.available_balance})`);
  log('r41-sub', '⚠️ session wallet_state is cached — pull-to-refresh (or the qa:refresh deep link) after login so the banner reflects the change');
}

async function main() {
  const userId = await resolveUserId(admin, PERSONA);
  log('r41-sub', `persona=${PERSONA} userId=${userId} sub=${sub}${DRY_RUN ? ' DRY-RUN' : ''}`);

  if (sub === 'billing-failed') return cmdBillingFailed(userId);
  if (sub === 'notif-sub-status') return cmdNotifSubStatus(userId);
  if (sub === 'notif-sub-event') return cmdNotifSubEvent(userId);
  if (sub === 'wallet-state') return cmdWalletState(userId);
  usage();
  process.exit(2);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });

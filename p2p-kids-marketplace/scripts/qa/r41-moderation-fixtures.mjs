/**
 * DEV-TASK-R41 (2026-09-03) — MSG Safety-Review / moderation fixture builder.
 *
 * Unblocks MSG-TC-G01–G07 (+ G09's banner leg) by driving a STANDING
 * test-seller-owned listing into a flagged / rejected / needs_edits state that
 * is reachable from My Listings → Safety Review.
 *
 * WHY THIS IS POSSIBLE (research 2026-09-03): the task premise was that
 * flagged/rejected/needs_edits can't be seeded via SQL because the recall/AI
 * checks run inside Edge Functions. That premise is INCORRECT for the item
 * STATE: `items.status` CHECK allows all three values, no DB trigger overrides
 * a service-role UPDATE, and the BEFORE-UPDATE trigger
 * `on_item_status_change_notify_seller` AUTO-CREATES the seller's in-app
 * notification ("Item Under Review"/"Item Rejected"/"Edits Requested") — the
 * same notification a real flag produces. The EF-only dependency is the
 * optional `item_safety_flags` side row (flag_type cpsc_recall/ai_moderation),
 * which this script inserts when --flag-type is passed.
 *
 * Subcommands:
 *
 *   list [--persona test-seller]         → read-only: the persona's listings
 *                                          (id, title, status) so QA can pick
 *                                          a target (prefer a QA_POOL_LISTINGS
 *                                          item; AVOID an item needed by trade
 *                                          cases — flagged items are not
 *                                          available to trade).
 *
 *   apply --listing-id <uuid> --state <flagged|rejected|needs_edits>
 *         [--persona test-seller] [--reason "…"] [--flag-type cpsc_recall|ai_moderation]
 *         [--backdate-days N] [--appeal-count N] [--dry-run]
 *         → G01 (any state renders its Safety Review banner)
 *         → G02/G04 (rejected / flagged: appeal + remove flows)
 *         → G03 (needs_edits: Submit for Re-Review flow)
 *         → G06 (max attempts: presets appeal_count; combine with the admin
 *                config round-trip moderation_appeal_max_attempts → qa:admin-config-set)
 *         → G07 (window: --backdate-days 15 on a rejected item makes appeals
 *                hit the 14-day "Appeal window has expired" check)
 *         → G05/G09 banner leg (--flag-type cpsc_recall marks it as a recall
 *                flag; NOTE the "Safety Alert" recall_alert NOTIFICATION has no
 *                production producer — see runbook/verdicts)
 *
 *   reset --listing-id <uuid> [--dry-run]
 *         → restore available + clear moderation fields (admin-approve
 *           semantics). Run after each G-series case so the pool item returns.
 *
 * All writes are service-role on STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1). Every apply captures a
 * --dry-run preview; --dry-run is fully read-only.
 *
 * Env: .env/.env.staging (service role). Persona ids mirror ef-repro.mjs.
 */
import { getClients, personaOrThrow, resolveUserId, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const PERSONA = argValue('persona') || 'test-seller';
const DRY_RUN = hasFlag('--dry-run');
const LISTING_ID = argValue('listing-id');
const STATE = argValue('state');
const REASON = argValue('reason');
const FLAG_TYPE = argValue('flag-type');
const BACKDATE_DAYS = argValue('backdate-days');
const APPEAL_COUNT = argValue('appeal-count');

const persona = personaOrThrow(PERSONA);

const VALID_STATES = ['flagged', 'rejected', 'needs_edits'];
const VALID_FLAG_TYPES = ['cpsc_recall', 'ai_moderation', 'user_report'];

function usage() {
  console.log(`qa:r41-moderation — MSG Safety-Review moderation fixture builder

  list [--persona test-seller]
  apply --listing-id <uuid> --state <flagged|rejected|needs_edits>
        [--persona test-seller] [--reason "…"] [--flag-type cpsc_recall|ai_moderation]
        [--backdate-days N] [--appeal-count N] [--dry-run]
  reset --listing-id <uuid> [--dry-run]
`);
}

async function requireOwnedListing(userId) {
  if (!LISTING_ID) {
    console.error('❌ --listing-id <uuid> is required (run `list` to pick one owned by the persona).');
    process.exit(2);
  }
  const { data, error } = await admin
    .from('items')
    .select('id, title, status, seller_id, flagged_at, rejected_at, rejection_reason, appeal_count, appeal_reason, appealed_at, edited_since_rejection, edited_since_rejection_at, approved_at')
    .eq('id', LISTING_ID)
    .maybeSingle();
  if (error) { console.error(`❌ items read failed: ${error.message}`); process.exit(1); }
  if (!data) { console.error(`❌ No item found for --listing-id ${LISTING_ID}`); process.exit(1); }
  if (data.seller_id !== userId) {
    console.error(`❌ Item "${data.title}" is owned by ${data.seller_id}, not persona ${PERSONA} (${userId}). Pick one of the persona's own listings.`);
    process.exit(1);
  }
  return data;
}

async function cmdList(userId) {
  const { data, error } = await admin
    .from('items')
    .select('id, title, status')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) { console.error(`❌ items read failed: ${error.message}`); process.exit(1); }
  console.log(`\n${PERSONA}'s listings (pick an 'available' QA_POOL item unless a trade case needs it):`);
  for (const it of data || []) console.log(`  ${it.id}  [${it.status}]  ${it.title}`);
  console.log('');
}

async function cmdApply(userId) {
  if (!VALID_STATES.includes(STATE)) {
    console.error(`❌ --state must be one of ${VALID_STATES.join('|')}`);
    process.exit(2);
  }
  if (FLAG_TYPE && !VALID_FLAG_TYPES.includes(FLAG_TYPE)) {
    console.error(`❌ --flag-type must be one of ${VALID_FLAG_TYPES.join('|')}`);
    process.exit(2);
  }
  const listing = await requireOwnedListing(userId);
  if (listing.status !== 'available') {
    console.error(`❌ Listing "${listing.title}" is not 'available' (current: ${listing.status}). Reset it first or pick another.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const patch = { status: STATE, updated_at: now };
  if (STATE === 'flagged') {
    patch.flagged_at = now;
    if (REASON) patch.rejection_reason = REASON;
  } else if (STATE === 'rejected') {
    patch.rejected_at = now;
    patch.rejection_reason = REASON || 'This listing may not be appropriate for our marketplace.';
    patch.edited_since_rejection = false;
    patch.edited_since_rejection_at = null;
  } else if (STATE === 'needs_edits') {
    patch.flagged_at = now;
    patch.rejection_reason = REASON || 'Please update your photos and provide more detail in the description.';
    patch.rejected_at = null;
    patch.edited_since_rejection = false;
    patch.edited_since_rejection_at = null;
  }
  if (BACKDATE_DAYS) {
    const n = Number(BACKDATE_DAYS);
    if (!Number.isInteger(n) || n <= 0) { console.error('❌ --backdate-days must be a positive integer'); process.exit(2); }
    // G07: backdate the rejection so the appeal-window check (moderation_appeal_window_days,
    // default 14) sees an expired window.
    patch.rejected_at = new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  }
  if (APPEAL_COUNT !== null && APPEAL_COUNT !== undefined) {
    const n = Number(APPEAL_COUNT);
    if (!Number.isInteger(n) || n < 0) { console.error('❌ --appeal-count must be a non-negative integer'); process.exit(2); }
    patch.appeal_count = n; // G06: preset the attempt counter the client checks against max
  }

  if (DRY_RUN) {
    log('r41-moderation', `DRY-RUN — would apply ${STATE} to "${listing.title}" (${listing.id}):`, patch);
    if (FLAG_TYPE) log('r41-moderation', `  + insert item_safety_flags { item_id, flag_type=${FLAG_TYPE} }`);
    return;
  }

  // 1. Status + moderation fields (fires on_item_status_change_notify_seller,
  //    which creates the seller's in-app notification — same as a real flag).
  const { error: updateErr } = await admin.from('items').update(patch).eq('id', listing.id);
  if (updateErr) { console.error(`❌ items update failed: ${updateErr.message}`); process.exit(1); }

  // 2. Optional item_safety_flags side row (mirrors check-item-safety /
  //    moderate-image). status default 'pending'.
  if (FLAG_TYPE) {
    const { error: flagErr } = await admin.from('item_safety_flags').insert({
      item_id: listing.id,
      flag_type: FLAG_TYPE,
      flag_reason: REASON || (FLAG_TYPE === 'cpsc_recall'
        ? 'Possible CPSC recall match: QA moderation fixture (recall title).'
        : 'Unsafe image content detected: QA moderation fixture.'),
    });
    if (flagErr) { console.error(`⚠️ item_safety_flags insert failed (non-fatal): ${flagErr.message}`); }
    else log('r41-moderation', `  + item_safety_flags (${FLAG_TYPE}) inserted`);
  }

  log('r41-moderation', `✅ "${listing.title}" (${listing.id}) → ${STATE}`);
  log('r41-moderation', 'QA: log in as the seller → My Listings → tap the item → Safety Review. Re-run with reset after the case.');
}

async function cmdReset(userId) {
  const listing = await requireOwnedListing(userId);
  if (DRY_RUN) { log('r41-moderation', `DRY-RUN — would reset "${listing.title}" to available + clear moderation fields`); return; }
  const now = new Date().toISOString();
  const { error: updateErr } = await admin.from('items').update({
    status: 'available',
    flagged_at: null,
    rejected_at: null,
    rejection_reason: null,
    appeal_count: 0,
    appeal_reason: null,
    appealed_at: null,
    edited_since_rejection: false,
    edited_since_rejection_at: null,
    updated_at: now,
  }).eq('id', listing.id);
  if (updateErr) { console.error(`❌ reset failed: ${updateErr.message}`); process.exit(1); }
  // Cleanup of the safety-flag side row is non-blocking (the item-status reset
  // already landed). A supabase-js query builder is a thenable, NOT a Promise —
  // it has no .catch(); await + check the { error } instead (same pattern fix
  // as r41-dispute DEV-TASK-108). Otherwise the flag cleanup silently never
  // runs and this line throws "...catch is not a function".
  const { error: flagErr } = await admin.from('item_safety_flags').delete().eq('item_id', listing.id);
  if (flagErr) console.warn(`[r41-moderation] item_safety_flags cleanup warn: ${flagErr.message}`);
  log('r41-moderation', `✅ "${listing.title}" (${listing.id}) reset to available`);
}

async function main() {
  const userId = await resolveUserId(admin, PERSONA);
  log('r41-moderation', `persona=${PERSONA} userId=${userId} sub=${sub}${DRY_RUN ? ' DRY-RUN' : ''}`);
  if (sub === 'list') return cmdList(userId);
  if (sub === 'apply') return cmdApply(userId);
  if (sub === 'reset') return cmdReset(userId);
  usage();
  process.exit(2);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });

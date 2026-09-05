/**
 * DEV-TASK-110 / QA Task 31-M FG-2 (2026-09-04) — reported-review fixture
 * builder for the Q-group (review moderation).
 *
 * WHY THIS EXISTS (FG-2 in e2e-test-results/qa-task31m-adm-mobile-impact-2026-09-04):
 * QA Task 29 never actually executed the Q01–Q06 moderation commits — the
 * confirm dialog copy was verified, then dismissed. The admin /reviews queue is
 * driven purely by `review_reports` rows, and no QA fixture anywhere creates a
 * reported review on a clean target, so there was nothing to commit against.
 *
 * This builds the CURRENT moderation model (1 report → review_status
 * 'pending_review'; admin Hide → is_hidden=true + review_status='hidden';
 * admin Keep → review_status='reviewed' + report_count=0 + reports deleted):
 *
 *   create [--reason spam|offensive|false_info|other] [--dry-run]
 *       → creates ONE disposable completed trade (test-buyer → test-seller) on a
 *         fresh item, ONE review (reviewer=test-buyer, reviewee=test-seller)
 *         tagged as disposable, and ONE `review_reports` row (reporter =
 *         reviewee/test-seller, mirroring the real report flow). The
 *         check_review_reports trigger flips review_status → 'pending_review'.
 *         The review then appears in the admin /reviews reported queue AND on
 *         test-seller's mobile profile (is_hidden=false) — exactly the state
 *         Q01–Q06 + the mobile display leg act on.
 *
 *   find [--dry-run]
 *       → read-only: list current tagged fixture reviews (comment LIKE
 *         '%(QA fixture %') with their review_status + report state, so QA can
 *         see what is staged.
 *
 *   reset [--dry-run]
 *       → deletes ALL tagged fixture review_reports + reviews + their completed
 *         trades + items. Runs whether the review is 'active'/'pending_review'/
 *         'reviewed' or 'hidden' (a Keep deletes the reports; reset locates by
 *         the review.comment tag, which survives both Hide and Keep).
 *
 * All writes are service-role on STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1). --dry-run is fully read-only.
 * RLS is bypassed by design (service role); the reporter is set to the reviewee
 * (test-seller) so the fixture mirrors the real report path (only the reviewee
 * can report their own review in-app).
 *
 * Env: .env/.env.staging (service role). Persona ids mirror r41-common.mjs.
 */
import { getClients, personaOrThrow, resolveUserId, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const REVIEWER = argValue('reviewer') || 'test-buyer'; // writes the review
const REVIEWEE = argValue('reviewee') || 'test-seller'; // review subject (and reporter)
const REASON = argValue('reason') || 'offensive';
const DRY_RUN = hasFlag('--dry-run');

const reviewerP = personaOrThrow(REVIEWER);
const revieweeP = personaOrThrow(REVIEWEE);

const VALID_REASONS = ['spam', 'offensive', 'false_info', 'other'];
// Human-readable tag in review.comment so it is (a) self-identifying as a
// disposable QA review and (b) findable by `reset` even after a Hide/Keep commit.
const TAG_PREFIX = '(QA fixture';
// The tag sits mid-comment ("…smooth trade! (QA fixture <marker>)"), so matching
// needs a leading % wildcard — never a bare-prefix match.
const TAG_LIKE = `%${TAG_PREFIX}%`;

function usage() {
  console.log(`qa:r41-review — Q-group reported-review fixture builder

  create [--reviewer test-buyer] [--reviewee test-seller] [--reason spam|offensive|false_info|other] [--dry-run]
  find
  reset [--dry-run]
`);
}

async function resolveCategories() {
  const { data, error } = await admin
    .from('categories')
    .select('id, name')
    .in('name', ['Toys', 'Sports', 'Books', 'Electronics']);
  if (error || !data || data.length === 0) {
    console.error(`❌ Could not resolve categories: ${error?.message ?? 'no rows'}`);
    process.exit(1);
  }
  const byName = Object.fromEntries(data.map((c) => [c.name, c.id]));
  return ['Toys', 'Sports', 'Books', 'Electronics'].map((n) => byName[n]).filter(Boolean);
}

async function findFixtureReviews() {
  const { data, error } = await admin
    .from('reviews')
    .select('id, trade_id, reviewer_id, reviewee_id, rating, comment, is_hidden, review_status, report_count, created_at')
    .ilike('comment', TAG_LIKE)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.error(`❌ reviews read failed: ${error.message}`); process.exit(1); }
  return data || [];
}

async function cmdFind() {
  const reviews = await findFixtureReviews();
  if (reviews.length === 0) {
    console.log('\nNo tagged reported-review fixture staged right now.');
    console.log('  Create one:  npm run qa:r41-review -- create');
    return;
  }
  console.log('\nTagged review fixtures (admin /reviews queue + mobile profile target):');
  for (const r of reviews) {
    console.log(`  ${r.id}  status=${r.review_status}  hidden=${r.is_hidden}  reports=${r.report_count}  rating=${r.rating}  ${r.comment}`);
  }
}

async function cmdCreate() {
  if (!VALID_REASONS.includes(REASON)) {
    console.error(`❌ --reason must be one of ${VALID_REASONS.join('|')}`);
    process.exit(2);
  }
  const marker = Math.random().toString(16).slice(2, 10); // 8-hex idempotency marker
  const now = new Date().toISOString();
  const dayMs = 24 * 60 * 60 * 1000;

  if (DRY_RUN) {
    log('r41-review', `DRY-RUN — would create completed trade ${REVIEWER}→${REVIEWEE} + review + 1 review_reports (reason=${REASON})`);
    return;
  }

  const categoryIds = await resolveCategories();

  // 1. Disposable item for the reviewee/seller (marked sold by the completed trade).
  const { data: item, error: itemErr } = await admin
    .from('items')
    .insert({
      seller_id: revieweeP.id,
      title: `QA Reported Review Fixture (${now.slice(0, 10)})`,
      description: `QA Task 31-M FG-2 disposable reported-review item (marker ${marker}). Remove via qa:r41-review reset.`,
      category_id: categoryIds[0],
      condition: 'good',
      price: 25,
      status: 'available',
      accepts_swap_points: true,
      approved_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (itemErr) { console.error(`❌ item create failed: ${itemErr.message}`); process.exit(1); }

  // 2. Completed trade (mirrors seedCompletedTradeWithReview's insert shape).
  const { data: trade, error: tradeErr } = await admin
    .from('trades')
    .insert({
      buyer_id: reviewerP.id,
      seller_id: revieweeP.id,
      listing_id: item.id,
      status: 'completed',
      cash_amount_cents: 3500,
      sp_amount: 0,
      buyer_transaction_fee_cents: 99,
      completed_at: new Date(Date.now() - 2 * dayMs).toISOString(),
      created_at: new Date(Date.now() - 7 * dayMs).toISOString(),
      updated_at: now,
    })
    .select('id')
    .single();
  if (tradeErr) { console.error(`❌ completed trade create failed: ${tradeErr.message}`); process.exit(1); }

  // Mark the item sold, mirroring the seed's completed-trade behavior.
  await admin.from('items').update({ status: 'sold', updated_at: now }).eq('id', item.id);

  // 3. Review (reviewer=buyer, reviewee=seller), clearly tagged as disposable.
  const comment = `Good item, smooth trade! ${TAG_PREFIX} ${marker})`;
  const { data: review, error: reviewErr } = await admin
    .from('reviews')
    .insert({
      trade_id: trade.id,
      reviewer_id: reviewerP.id,
      reviewee_id: revieweeP.id,
      rating: 5,
      comment,
      created_at: new Date(Date.now() - 1 * dayMs).toISOString(),
    })
    .select('id, review_status')
    .single();
  if (reviewErr) { console.error(`❌ review create failed: ${reviewErr.message}`); process.exit(1); }

  // 4. One report — the check_review_reports trigger flips review_status to
  //    'pending_review' (mirrors the real reviewee-reported path).
  const { error: reportErr } = await admin.from('review_reports').insert({
    review_id: review.id,
    reporter_id: revieweeP.id, // reviewee reports their own review (real flow)
    reason: REASON,
    description: `QA reported-review fixture (marker ${marker}, reason ${REASON}). Remove via qa:r41-review reset.`,
  });
  if (reportErr) { console.error(`❌ review_reports insert failed: ${reportErr.message}`); process.exit(1); }

  log('r41-review', `✅ Created reported review ${review.id} (trade ${trade.id}) — review_status now ${review.review_status}`);
  log('r41-review', 'QA: admin portal → /reviews → find it in the reported queue → Q02 Hide / Q03 Keep.');
  log('r41-review', '    Mobile: test-seller profile shows the review (is_hidden=false) until a Hide commit.');
  log('r41-review', `    Clean up:  npm run qa:r41-review -- reset`);

  // 5. Verify — read the review back to confirm the trigger flipped status.
  const { data: rb, error: rbErr } = await admin
    .from('reviews')
    .select('id, review_status, report_count, is_hidden')
    .eq('id', review.id)
    .maybeSingle();
  if (rbErr || !rb) {
    log('r41-review', `⚠️  read-back failed: ${rbErr?.message ?? 'no row'} (harmless)`);
  } else {
    log('r41-review', `✅ VERIFY — read-back: review_status=${rb.review_status} report_count=${rb.report_count} hidden=${rb.is_hidden}`);
  }
}

async function cmdReset() {
  const reviews = await findFixtureReviews();
  if (reviews.length === 0) {
    log('r41-review', 'No tagged review fixtures to reset (clean).');
    return;
  }
  if (DRY_RUN) {
    log('r41-review', `DRY-RUN — would delete ${reviews.length} tagged review fixture(s) + their trades/items:`);
    for (const r of reviews) console.log(`  review ${r.id}  status=${r.review_status}  trade ${r.trade_id}`);
    return;
  }

  let deleted = 0;
  for (const r of reviews) {
    // Reports first (Keep already deletes them; deleting again is a no-op).
    const { error: repErr } = await admin.from('review_reports').delete().eq('review_id', r.id);
    if (repErr) console.warn(`[r41-review] review_reports cleanup warn: ${repErr.message}`);
    const { error: revErr } = await admin.from('reviews').delete().eq('id', r.id);
    if (revErr) { console.error(`❌ review delete failed for ${r.id}: ${revErr.message}`); continue; }
    deleted += 1;
    // Its disposable completed trade + item (idempotent; a fully manual delete is fine).
    if (r.trade_id) {
      const { data: t, error: trErr } = await admin
        .from('trades')
        .select('listing_id')
        .eq('id', r.trade_id)
        .maybeSingle();
      if (!trErr && t?.listing_id) {
        const { error: imgErr } = await admin.from('item_images').delete().eq('item_id', t.listing_id);
        if (imgErr) console.warn(`[r41-review] item_images cleanup warn: ${imgErr.message}`);
        const { error: itErr } = await admin.from('items').delete().eq('id', t.listing_id);
        if (itErr) console.warn(`[r41-review] item cleanup warn (non-fatal): ${itErr.message}`);
      }
      const { error: tdErr } = await admin.from('trades').delete().eq('id', r.trade_id);
      if (tdErr) console.warn(`[r41-review] trade cleanup warn (non-fatal): ${tdErr.message}`);
    }
    log('r41-review', `  ✔ deleted review ${r.id}`);
  }
  log('r41-review', `✅ reset complete: ${deleted}/${reviews.length} tagged review fixture(s) removed`);
}

async function main() {
  const reviewerId = await resolveUserId(admin, REVIEWER);
  const revieweeId = await resolveUserId(admin, REVIEWEE);
  if (!reviewerId || !revieweeId || reviewerId === revieweeId) {
    console.error('❌ reviewer and reviewee must be different known personas.');
    process.exit(2);
  }
  log('r41-review', `reviewer=${REVIEWER} (${reviewerId}) reviewee=${REVIEWEE} (${revieweeId}) sub=${sub}${DRY_RUN ? ' DRY-RUN' : ''}`);
  if (sub === 'create') return cmdCreate();
  if (sub === 'find') return cmdFind();
  if (sub === 'reset') return cmdReset();
  usage();
  process.exit(2);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });

/**
 * DEV-TASK-110 (2026-09-04) — Item 1: sanctioned pending category-suggestion fixture.
 *
 * QA Task 31 flagged ADM-TC-D04 (Suggestions queue + count badge) and ADM-TC-D11
 * (Approve / Merge / Reject) as PARTIAL / fixture-gated: staging has ZERO pending
 * `category_suggestions` (all terminal — 9 approved / 1 merged) and no sanctioned
 * path existed to create one. The real product producer is the mobile "Other"-
 * category listing flow, which is too heavy to orchestrate just to feed the admin
 * queue — so, mirroring the r41-* / qa:failed-payout pattern, this is a dev-authored,
 * service-role fixture that stages disposable pending suggestions.
 *
 * Clean-revert design (why this is safe):
 *   - Each suggestion references a DISPOSABLE item created by this fixture (title
 *     tagged `QA DT110 …`). D11's Approve / Merge legs ALWAYS reassign the
 *     suggestion's item to the new / merged category (reassignItem is hard-coded
 *     true in the modals + merge route) — so those legs only ever move a
 *     fixture-owned item, never a shared seed item.
 *   - Items default to status='draft' so they never count toward
 *     categories.item_count (the `update_category_item_count` trigger counts only
 *     status='available') and never surface in marketplace feeds / mobile
 *     discovery during the QA window. `--status available` is allowed if a run
 *     ever needs a market-visible item, but is NOT the default.
 *   - `category_suggestions.item_id` is UNIQUE + `ON DELETE CASCADE`, so `reset`
 *     deleting the tagged items removes their suggestions automatically.
 *   - `reset` also deletes tagged categories (name `QA DT110 …`) created by D11's
 *     Approve leg, returning the DB to its pre-stage category set.
 *
 * Subcommands:
 *
 *   find [--persona test-seller]
 *       → read-only: the seller persona + "Other" category resolution + any
 *         existing tagged residue (items / suggestions / categories), so QA knows
 *         whether to `reset` before staging.
 *
 *   stage [--persona test-seller] [--count 3] [--status draft|available]
 *         [--force] [--dry-run]
 *       → creates `count` disposable items under "Other" + one pending suggestion
 *         each (suggested_name `QA DT110 <name>`).
 *         → D04: the /categories → Suggestions tab shows the pending rows + count
 *           badge (the badge polls `status=eq.pending`).
 *         → D11: Approve #1 / Merge #2 / Reject #3 against these rows.
 *         Refuses (exit 2) if any tagged residue already exists unless --force.
 *
 *   list [--persona test-seller] [--status pending|all]
 *       → read-only: this fixture's tagged suggestion rows (id, suggested_name,
 *         item id/title, status) so QA knows exactly which to act on.
 *
 *   reset [--persona test-seller] [--dry-run]
 *       → deletes ONLY this fixture's rows: tagged suggestions, tagged items
 *         (seller + title prefix), then tagged categories (name prefix). Returns
 *         the DB to zero tagged residue.
 *
 * All writes are against STAGING — dev-team run with Samer's approval (two-phase
 * provisioning; this file is Phase 1). --dry-run is fully read-only.
 *
 * Env: .env / .env.staging (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Persona ids mirror r41-common.mjs PERSONAS.
 */
import { getClients, personaOrThrow, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');
const FORCE = hasFlag('--force');
const PERSONA = argValue('persona') || 'test-seller';
const COUNT = Number(argValue('count') || '3');
const STATUS = argValue('status') || 'draft';

// Tag prefix used for every row this fixture creates (name / title / suggested_name)
// so `reset` can always find exactly what this fixture made — and nothing else.
const TAG = 'QA DT110';
const SUGGESTION_NAMES = ['Trading Cards', 'Puzzles', 'LEGO Bricks', 'Action Figures', 'Board Games'];
const VALID_STATUSES = ['draft', 'available'];

const persona = personaOrThrow(PERSONA);

function usage() {
  console.log(`qa:category-suggestion — ADM D04/D11 pending category-suggestion fixture builder

  find [--persona test-seller]
  stage [--persona test-seller] [--count 3] [--status draft|available] [--force] [--dry-run]
  list [--persona test-seller] [--status pending|all]
  reset [--persona test-seller] [--dry-run]
`);
}

/** Read-only: count of this fixture's existing tagged rows across all three tables. */
async function findTaggedResidue(userId) {
  const out = { items: 0, suggestions: 0, categories: 0 };

  const { count: itemCount, error: itemErr } = await admin
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .ilike('title', `${TAG}%`);
  if (itemErr) log('category-suggestion', `⚠️ items residue read failed: ${itemErr.message}`);
  else out.items = itemCount ?? 0;

  const { count: suggCount, error: suggErr } = await admin
    .from('category_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .ilike('suggested_name', `${TAG}%`);
  if (suggErr) log('category-suggestion', `⚠️ category_suggestions residue read failed: ${suggErr.message}`);
  else out.suggestions = suggCount ?? 0;

  const { count: catCount, error: catErr } = await admin
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .ilike('name', `${TAG}%`);
  if (catErr) log('category-suggestion', `⚠️ categories residue read failed: ${catErr.message}`);
  else out.categories = catCount ?? 0;

  return out;
}

/** The "Other" category id (the product category suggestions originate from). */
async function findOtherCategoryId() {
  const { data, error } = await admin
    .from('categories')
    .select('id')
    .ilike('name', 'other')
    .maybeSingle();
  if (error) {
    log('category-suggestion', `⚠️ categories read failed: ${error.message}`);
    return null;
  }
  return data?.id ?? null;
}

async function cmdFind(userId) {
  const otherId = await findOtherCategoryId();
  const residue = await findTaggedResidue(userId);

  console.log(`\nPersona: ${PERSONA} (${persona.id})`);
  console.log(`Other category id: ${otherId ?? '(not found — suggestions will stage with category_id null)'}`);
  console.log(`Existing tagged residue (QA DT110 …): items=${residue.items} suggestions=${residue.suggestions} categories=${residue.categories}`);

  if (residue.items + residue.suggestions + residue.categories > 0) {
    console.log('\nResidue from a prior run exists — run `reset` before staging:');
    console.log(`  npm run qa:category-suggestion -- reset --persona ${PERSONA}`);
  } else {
    console.log('\nClean. Stage with:');
    console.log(`  npm run qa:category-suggestion -- stage --persona ${PERSONA} --count 3`);
  }
}

async function cmdStage(userId) {
  if (!Number.isInteger(COUNT) || COUNT < 1 || COUNT > SUGGESTION_NAMES.length) {
    console.error(`❌ --count must be an integer 1..${SUGGESTION_NAMES.length} (got '${argValue('count')}')`);
    process.exit(2);
  }
  if (!VALID_STATUSES.includes(STATUS)) {
    console.error(`❌ --status must be one of ${VALID_STATUSES.join(' / ')} (got '${STATUS}')`);
    process.exit(2);
  }

  // Refuse to stack on top of an earlier, uncleaned run unless --force.
  const residue = await findTaggedResidue(userId);
  if (residue.items + residue.suggestions + residue.categories > 0 && !FORCE) {
    console.error(`❌ Tagged residue already exists (items=${residue.items} suggestions=${residue.suggestions} categories=${residue.categories}).`);
    console.error('   Run `reset` first (or pass --force to stage on top):');
    console.error(`   npm run qa:category-suggestion -- reset --persona ${PERSONA}`);
    process.exit(2);
  }

  const otherId = await findOtherCategoryId();
  const nowIso = new Date().toISOString();

  if (DRY_RUN) {
    log('category-suggestion', `DRY-RUN — would create ${COUNT} disposable item(s) (status=${STATUS}, category=${otherId ?? 'null'}) + pending suggestions under seller ${PERSONA} (${userId})`);
    for (let i = 1; i <= COUNT; i += 1) {
      console.log(`  item  title="QA DT110 Suggestion Item ${i} <rand>"  →  suggestion suggested_name="${TAG} ${SUGGESTION_NAMES[i - 1]}"`);
    }
    return;
  }

  const staged = [];
  for (let i = 1; i <= COUNT; i += 1) {
    const rand = Math.random().toString(36).slice(2, 8);
    const title = `QA DT110 Suggestion Item ${i} ${rand}`;
    const suggestedName = `${TAG} ${SUGGESTION_NAMES[i - 1]}`;

    // 1. Disposable item under "Other" (draft by default → never counts / never feeds).
    const { data: item, error: itemErr } = await admin
      .from('items')
      .insert({
        seller_id: userId,
        title,
        description: `Disposable fixture item for ADM-TC-D04/D11 category-suggestion cases (Dev Task 110). Clean up with qa:category-suggestion reset.`,
        category_id: otherId,
        condition: 'good',
        price: 25.0,
        status: STATUS,
        accepts_swap_points: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id, title, status')
      .single();

    if (itemErr) {
      console.error(`❌ items insert failed (suggestion ${i}): ${itemErr.message}`);
      await cmdReset(userId, true); // best-effort partial cleanup
      process.exit(1);
    }

    // 2. Pending suggestion referencing the disposable item (UNIQUE per item_id).
    const { data: sugg, error: suggErr } = await admin
      .from('category_suggestions')
      .insert({
        suggested_name: suggestedName,
        seller_id: userId,
        item_id: item.id,
        status: 'pending',
      })
      .select('id, suggested_name, status')
      .single();

    if (suggErr) {
      console.error(`❌ category_suggestions insert failed: ${suggErr.message}`);
      await cmdReset(userId, true);
      process.exit(1);
    }

    staged.push({ itemId: item.id, suggestionId: sugg.id, suggestedName });
    log('category-suggestion', `✅ staged suggestion ${staged.length}/${COUNT}: ${suggestedName}  (suggestion=${sugg.id}, item=${item.id})`);
  }

  console.log('\nAdmin surface: /categories → Suggestions tab (pending rows + count badge).');
  console.log('D11 legs: Approve #1 · Merge #2 (into an existing category) · Reject #3.');
  console.log('Reset after QA:');
  console.log(`  npm run qa:category-suggestion -- reset --persona ${PERSONA}`);
}

async function cmdList(userId) {
  const status = argValue('status') || 'all';
  let query = admin
    .from('category_suggestions')
    .select('id, suggested_name, item_id, status, created_at')
    .eq('seller_id', userId)
    .ilike('suggested_name', `${TAG}%`);
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  query = query.order('created_at', { ascending: false }).limit(50);

  const { data, error } = await query;
  if (error) {
    console.error(`❌ category_suggestions read failed: ${error.message}`);
    process.exit(1);
  }
  const rows = data || [];
  if (rows.length === 0) {
    console.log(`\nNo ${TAG} tagged suggestion rows (status=${status}). Run \`stage\` first.`);
    return;
  }
  console.log(`\n${TAG} tagged suggestions (status=${status}): ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.id}  [${r.status}]  ${r.suggested_name}  item=${r.item_id}`);
  }
}

async function cmdReset(userId, quiet) {
  if (DRY_RUN && !quiet) {
    log('category-suggestion', `DRY-RUN — would delete tagged rows for ${PERSONA} (${userId}): suggestions, items (title '${TAG}%'), categories (name '${TAG}%')`);
    return;
  }
  if (quiet) {
    log('category-suggestion', 'partial-cleanup after a mid-run failure…');
  }

  // 1. Tagged suggestions (explicit — items also cascade, but belt-and-braces).
  const { error: delSuggErr } = await admin
    .from('category_suggestions')
    .delete()
    .eq('seller_id', userId)
    .ilike('suggested_name', `${TAG}%`);
  if (delSuggErr) {
    console.error(`❌ category_suggestions delete failed: ${delSuggErr.message}`);
    process.exit(1);
  }

  // 2. Tagged items (owner + title prefix) — removes their suggestions by cascade too.
  const { error: delItemErr } = await admin
    .from('items')
    .delete()
    .eq('seller_id', userId)
    .ilike('title', `${TAG}%`);
  if (delItemErr) {
    console.error(`❌ items delete failed: ${delItemErr.message}`);
    process.exit(1);
  }

  // 3. Tagged categories created by D11's Approve leg (name = suggested_name).
  const { error: delCatErr } = await admin
    .from('categories')
    .delete()
    .ilike('name', `${TAG}%`);
  if (delCatErr) {
    console.error(`❌ categories delete failed: ${delCatErr.message}`);
    process.exit(1);
  }

  const residue = await findTaggedResidue(userId);
  const total = residue.items + residue.suggestions + residue.categories;
  if (total === 0) {
    log('category-suggestion', '✅ reset clean — zero tagged residue.');
  } else {
    log('category-suggestion', `⚠️ reset done but residue remains (items=${residue.items} suggestions=${residue.suggestions} categories=${residue.categories}) — investigate.`);
    process.exit(1);
  }
}

async function main() {
  const userId = persona.id;
  switch (sub) {
    case 'find':
      await cmdFind(userId);
      break;
    case 'stage':
      await cmdStage(userId);
      break;
    case 'list':
      await cmdList(userId);
      break;
    case 'reset':
      await cmdReset(userId, false);
      break;
    default:
      usage();
      process.exit(sub === 'help' ? 0 : 2);
  }
}

main();

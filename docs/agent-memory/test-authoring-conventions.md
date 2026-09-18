# Test-Authoring Conventions (manual-test library)

## The 6 canonical files (cross-checked-and-consolidated/)
Auth/Onboarding/Listing/Discovery · Messaging/Badges/ID/Referrals/Safety/Notifs · TradeFlowV2 · Account/Dashboard/Help/Legal · Admin Portal · Subscriptions/Payouts/SPWallet.

## CRITICAL: non-indexed sections reuse TC-IDs
Every canonical file has a non-indexed "Regression checks" section that REUSES group-letter TC-IDs with DIFFERENT meanings:
- AUTH: `## Regression checks` = TC-R01–R06, plus `TC-ACC-01–06` (Accessibility identifiers). "Password Recovery" group had to be renamed R→S at merge.
- Subscriptions: `## Regression` = TC-R01–R05.
- TradeFlowV2: `## Regression checks` = TC-R01–R08; also has `Summary of Test Status`, `Critical Paths`, `Appendix B: SQL`, `Group R2` (reuses D06/G05), `Group N2` (TC-N2-C*).
- Account: `## Regression` = TC-R01–R05.
- Admin: `## Regression` = TC-R*, plus `Group N2` (TC-N2-A*).
ALWAYS grep `^## ` AND all `^### TC-` (and `^### passed TC`/`^### new TC`) before assigning a new group letter or continuing an existing group's numbering.

## Metadata conventions
- Entry: `### TC-XXX · Description` then `**Ref:**` (absent in AUTH/Messaging groups A–P; present in Account/Admin/Subscriptions/TradeFlowV2 and AUTH Group Q), `**Actors:**`, `**Objective:**`, `**Steps:**`, `**Expected Result:**`.
- TradeFlowV2 also uses status prefixes (`### Passed TC-` / `### new TC-`) — new unexecuted cases use plain `### TC-XXX`.
- `**Surfaces: admin, mobile**` line introduced 2026-08-13 for cross-surface cases (first use in the library). Place after `**Actors:**`.

## Staging discipline (this task)
New cases drafted into `gap-analysis/new-test-cases-<module>.md`, merged into canonical files only after explicit per-batch approval. Never edit app source while authoring tests.

## Coverage-gap authoring (2026-08-13) — ~110 new cases merged
Batches: Auth 16 (B07–B11, S01–S11) · Subscriptions 28 (M, N new groups; C08–C12, F07–F08, G07–G11, I07–I09) · TradeFlowV2 17 (B10–B13, E07–E10, new Group Y) · Account 14 (A05, B06–B10, F04, G07–G13) · Admin 22 (B06–B08, C06–C12, D05–D11, N03–N04, Q04–Q06) · Admin 13 (F08–F11, H04–H06, I05, M04–M06, X13–X14).

## 4-field test-case format (`Setup` / `Locator hints` / `Assert` / `Dependencies`)
Cases instrumented in Phase 9 use this format (also see `**Steps:**`/`**Expected Result:**`). `Locator hints:` lists concrete `testID` (mobile) / `data-testid` (admin) identifiers per interactive element. `Dependencies:` covers anything the case needs at run time (dialogs, network, seeded state).

## Dialog-handling convention — approved Option B (2026-08-15, Phase 9 closeout)
For any test case involving one of the 3 exempt dialog categories (Stripe `PaymentSheet`, React Native `Alert.alert`, browser `confirm()`/`alert()` — see locator-conventions.md):
- `Locator hints:` MUST read exactly **"N/A — see Dependencies"** (never a missing/empty entry — an empty Locator hints field must not look like an unresolved instrumentation gap).
- `Dependencies:` MUST state the concrete handling technique, e.g.:
  - "Native `Alert.alert` — match 'Delete' button by text via Detox (`by.text('Delete')`) / Appium."
  - "Browser `confirm()` — Playwright `page.on('dialog')`, accept (assert message text)."
  - "Stripe `PaymentSheet` — native sheet; enter test card 4242 4242 4242 4242, any future expiry / any CVC."
These categories are permanently out of scope for `testID`/`data-testid`; no custom modal refactor. When a case is a MIX of instrumentable elements AND a dialog, keep the real locator hints for the instrumentable part and note the dialog in `Dependencies:` (e.g. `/trades/[id]` force-cancel, `/listings` reject/request-edits, `PaymentMethods` Stripe entry, `/payouts` actions).

## Admin Playwright spec authoring (2026-08-21, Group L) — verified patterns
- **Do NOT use `auth.admin.listUsers()` to resolve a seeded persona's email→user_id on staging** — staging has **5,103** auth users and the admin API is pagination-capped, so a seeded persona (e.g. `test-seller@…`) reliably falls outside page 1 and resolves to `undefined` (caught during Group L validation). **Use `public.profiles.email` instead**: `supabase.from('profiles').select('user_id').eq('email', email).maybeSingle()` (service-role readable; `profiles` carries an `email` column).
- DB read-backs in admin Playwright specs: `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })` + `dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })` — `.env.local` holds both keys. Gate the describe on `DB_READY = Boolean(url && key)` and `PLAYWRIGHT_ADMIN_E2E === 'true'`.
- The `/listings` approve flow surfaces the RPC result via **`window.alert()`** — register `page.on('dialog', d => { msg = d.message(); d.accept(); })` BEFORE clicking `btn-confirm-action`, then `expect.poll(() => msg).not.toBe('')`.
- `admin_approve_listing` now emits the `listing_approved` notification (data.deep_link = `/listing/<id>`) — the old "R8 may not emit notification" known-gap is FIXED on staging (verified 2026-08-21).
- Buyer-feed visibility mirror = `status='available'` (sole predicate in `search_listings`); pending items never surface.
- `tr_items_require_reapproval_on_seller_edit` fires ONLY when `auth.uid() = seller_id` and `OLD.status='available'` and content changes — a seller edit is mobile-only (Playwright cannot trigger it); author L04's edit as a documented mobile-mcp precondition and self-skip with reason if unmet.

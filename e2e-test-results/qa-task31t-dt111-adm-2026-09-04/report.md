# QA Task 31-T v2 — Dev Task 111 Live Verification + ADM Never-Run Closure

**Run date:** 2026-09-04 · **Folder:** `e2e-test-results/qa-task31t-dt111-adm-2026-09-04/`
**Rules:** ADM-R1–R6 (v3 file), R55/§5.57, R53/§5.55, R52/§5.54, R56/R57, R28/R37, R54/§5.56.
**Supersedes:** the earlier QA Task 31-T draft — this v2 adds Batch 0 (Dev Task 111 live verification) before closing the never-run pool.
**Verdict summary:** Batch 0 → **4 of 5 Dev Task 111 items PASS** (Items 1+7, 3, 4, 6) + **Item 2 PARTIAL** (fixture core works; `--with-auto-complete` flag is dead — hasFlag double-dash bug). Batch 1 → **C11 PASS, E06 PASS, E07 PASS, F11 PASS, K03 PASS, M01 PASS, C12 PARTIAL, L07 PARTIAL (mobile-leg gap), B03/B06/B07 BLOCKED (ADM-R3)**. ADM never-run pool reduced **12 → 3**.

---

## 0. Session recon (R29 busy check + environment)

- **R29 busy check:** no maestro/run-suite/playwright/mobilecli in flight; simulator iPhone 17 Pro Max `3F3293A3` booted; admin portal `:3001` + Metro `:8081` up. Shared admin browser page (3ac26655) logged in as samer (`1a546991`). Staging `drntwgporzabmxdqykrp`. Mobile toolset + read-only SQL both used.
- **Dev Task 111 source confirmed present before driving** (all items verified in source first): admin Resume (`ListingSearch.tsx` `btn-resume-<id>` "▶️ Resume / Make Available" via lighter `admin_unpause_listing` RPC), gentle unavailable copy (`ItemDetailScreen.tsx` "This item is no longer available" vs "❌ Listing not found" via `probeListingAvailability`), `qa:r41-in-progress-trade` + `qa:r41-review` scripts (registered in package.json), `r41-moderation-fixtures.mjs` reset `.catch` fix (now `await` + `{error}`), `WalletWarningBanner` token remap (info `#5B8FB9`/`#EBF4F9`, error `#E85D75`/`#FFF0F2`, warning `#FFA726`/`#FFF3E0`).
- **DB feasibility (R-NEW-6):** no leftover FG-1/FG-2/reported-payout fixtures; item `185546da` "QA Bundle Fixture 1 of 1 (2026-09-02)" available (chosen disposable for Item 1+7/Item 3). test-buyer `49243010…` active/490 SP.

---

## 1. Batch 0 — Dev Task 111 Phase 2 live verification

### Item 1+7 — Admin Resume + gentle unavailable copy — ✅ PASS
Disposable listing `185546da` (test-seller, $25, Accept-SP):
- **Admin Pause** (`/listings` drawer → `btn-pause-<id>` → reason → `admin_pause_listing`): alert "Listing paused successfully"; DB `status='paused'` + `admin_listing_actions` row (action_type `pause`, admin `1a546991`, reason scoped).
- **Resume button live:** paused drawer shows Status **Paused** with **▶️ Resume / Make Available** (`btn-resume-<id>` present) and **Pause hidden** (verified). Click → Confirm Resume → alert "Listing resumed and is available again"; DB `status='available'` + `admin_listing_actions` row `action_type='unpause'` (the lighter RPC, not `admin_approve_listing`).
- **No duplicate "Listing Approved" notification:** seller (test-seller) `user_notifications` count/refs unchanged after resume (`approved_total` stayed 12, `last_approved` unchanged, 0 refs to the item) — DB-verified.
- **Mobile (buyer = test-buyer) legs:**
  - **Paused** deep link → **"This item is no longer available"** + hint ("It may have been sold or removed by the seller…") — NOT "Listing not found". `MOBILE-DT111-paused-gentle-unavailable.png`
  - **Resumed** deep link → item loads normally ($25.00, Condition Good, Toys, **Request to Buy** purchasable) and appears in Recommended feed. `MOBILE-DT111-resumed-item-loads.png`
  - **Invalid ID** (bogus UUID) → **"❌ Listing not found"** — the two states are distinguishable. `MOBILE-DT111-invalid-id-listing-not-found.png`
- Item left **available** (natural end state of the Resume); audit rows (pause + unpause) expected/normal.

### Item 2 — FG-1 in-progress-trade fixture — 🟡 PARTIAL (core PASS, one flag broken)
- `qa:r41-in-progress-trade create` ✅ → real disposable **in_progress** single trade test-buyer→test-seller (trade `f3e94e33`, item `4ab5d9f3`), dispute_status `none`, tagged. **node_id auto-populated on the new item AND trade** (`6bf728cf` Diag Test Node) — this doubles as E06 step-3 evidence.
- `qa:r41-dispute open --trade-id` ✅ → real `open-dispute` EF HTTP 200 → `dispute_status='reported'` (proves I03/I04/X06 dispute reflection is unblocked).
- `qa:r41-dispute reset` + `qa:r41-in-progress-trade reset` ✅ → clean teardown (0 residue DB-verified).
- ❌ **`--with-auto-complete` does NOT set `auto_complete_at`** (DB NULL). Root cause: **`hasFlag` double-dash bug** — every caller passes `hasFlag('--dry-run')`/`hasFlag('--with-auto-complete')` but `hasFlag()` prepends `--` again → checks `'----dry-run'`, which never matches. Affects **all 9 fixture scripts** (`--dry-run`, `--with-auto-complete`, `--force`, `--keep`, `--remove` are silently dead; proven by dry-run that created real rows). Tooling finding #3.
- Auto-complete F-group countdown staging stays blocked until the flag is fixed.

### Item 3 — r41-moderation reset bug fix — ✅ PASS
Full `qa:r41-moderation apply` (flagged + `cpsc_recall` safety-flag on `185546da`) → `reset` cycle:
- **No `.catch is not a function` error** printed (the QA31-M finding's fix works).
- **`item_safety_flags` row actually deleted** this time (DB: `safety_flags=0` after reset; previously the cleanup silently never ran).
- Item restored: `status='available'`, `flagged_at`/`rejected_at`/`rejection_reason` NULL, `appeal_count=0`.

### Item 4 — FG-2 reported-review fixture + first real Q-group commit — ✅ PASS
- `qa:r41-review create --reason spam` ✅ → review `1928ca5d` (test-buyer 5★ → test-seller), `review_status='pending_review'`, `report_count=1`, `is_hidden=false`; `review_reports` row (reporter test-seller, spam).
- **Q02 Hide commit — FIRST real execution** (QA29 only confirm-copy-checked): admin `/reviews` `btn-review-hide-<id>` → confirm copy **"This will remove the review and notify everyone who reported it. Continue?"** (matches guide) → DB `review_status='hidden'`, `is_hidden=true`. **Mobile:** test-seller profile (viewed as test-buyer) dropped **6→5 reviews, 4.5→4.4, 5★ 3→2**, fixture review gone. `MOBILE-DT111-review-hidden-posthide.png`
- **Q03 Keep commit — first real execution:** `btn-review-keep-<id>` → confirm copy **"This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?"** (matches guide) → DB `review_status='reviewed'`, `is_hidden=false`, `report_count=0`, reports deleted. **Mobile:** profile back to **6 reviews / 4.5 / 5★3**, review visible. `MOBILE-DT111-review-visible-postkeep.png`
- `qa:r41-review reset` cleaned the review/report/trade. **Residue finding:** the disposable item (`0253b2cb` "QA Reported Review Fixture", status `sold`, orphaned) is **stranded by the reset** (item-delete fails with a `trades.listing_id` not-null error after the completed-trade delete) — needs dev cleanup (finding #4).

### Item 6 — WalletWarningBanner token remap — ✅ PASS
test-buyer wallet driven through active → frozen → suspended → grace_period → active (admin `/sp-wallet` status buttons for active/frozen/suspended; `qa:r41-sub wallet-state` helper for grace, which the admin UI cannot set). On-device SP Wallet (deep link `sp-wallet`) pixel-scanned (badge-scan) at each state:
| Wallet state | Banner | Accent pixels | Tint (region %) | Old Tailwind accent |
|---|---|---|---|---|
| frozen | "Swap Points Frozen" | **#5B8FB9** (2496 px) | #EBF4F9 (48.5%) | #3B82F6 = 0 |
| suspended | "Wallet Suspended" | **#E85D75** (4414 px) | #FFF0F2 (43.8%) | #EF4444 ≈ 0 |
| grace_period | "Grace Period Active" | **#FFA726** (2494 px) | #FFF3E0 (42.1%) | #F59E0B = 0 |
| active | no banner | — | — | — |
QA31-M's finding #4 (Tailwind palette chips) is **resolved**. Audit rows `sp_wallet_status_change` actor `1a546991` throughout. Wallet restored **active / 490 SP**.

---

## 2. Batch 1 — ADM never-run closure (11)

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| B03 | MODULE-ADMIN-PORTAL | BLOCKED | ADM-R3 — Suspend/Delete use native `prompt()`; not drivable in the embedded driver. Recorded, no action. |
| B06 | MODULE-ADMIN-PORTAL | BLOCKED | ADM-R3 — Reset Password flow uses `prompt()`. Recorded, no action. |
| B07 | MODULE-ADMIN-PORTAL | BLOCKED | ADM-R3 — Unsuspend requires a `prompt()` reason. Recorded, no action. |
| C11 | MODULE-ADMIN-PORTAL | ✅ PASS | select-all toggles all 20 page rows; "Selected on this page: N" + Clear selection work. Guide's no-bulk-executor doc flag confirmed. |
| C12 | MODULE-ADMIN-PORTAL | 🟡 PARTIAL | query/status/SP filters PASS (DB-exact); **category + seller-email DEGRADED** — see Finding #1 (DT97 RPC regression). Also Paused absent from status dropdown (439 paused items exist). |
| E06 | MODULE-ADMIN-PORTAL | ✅ PASS | NULL-coverage on all 10 N6 tables + residual characterization; step-3 write-trigger driven via the FG-1 fixture (item/trade/payments node_id auto-pop `6bf728cf`). N6 residual finding (below). |
| E07 | MODULE-ADMIN-PORTAL | ✅ PASS | /nodes KPI panel reconciles digit-for-digit with `admin_node_kpis(NULL)`; node-filtered call correct; stat cards 12/10/176 reconcile. |
| F11 | MODULE-ADMIN-PORTAL | ✅ PASS | trade-timing Reset reverts unsaved edit (72→71→72); no DB write. |
| K03 | MODULE-ADMIN-PORTAL | ✅ PASS | sanctioned failed-payout fixture → Retry → confirm copy matches guide → DB failed→pending, failure_reason cleared → reset clean. |
| L07 | MODULE-ADMIN-PORTAL | 🟡 PARTIAL | RPC/backend leg PASS; **mobile SP-disabled leg gap** — see Finding #2 (TradeOfferScreen SP input not disabled when frozen). |
| M01 | MODULE-ADMIN-PORTAL | ✅ PASS | grace-config round-trip 30/[60,30,7,1] → 45/[45,20,10,3] → baseline, DB-verified each step. |

Per-case detail (traces are in the decision trace / this report's evidence):
- **C11:** `/listings` — clicked 2 row checkboxes → "Selected on this page: 2" + Clear appears; select-all → "Selected on this page: 20" (all page rows); Clear → counter + link gone. No bulk executor present (guide flag confirmed as a doc note, not a defect).
- **C12:** search by item name "QA Bundle Fixture" → Results (16), all titles match; status `pending` → Results **(81 = DB 81)**; SP-eligible only → Results **(456 = DB 456)**; category `Toys` → Results **(9)** vs DB **1078**; seller email `test-seller@` → Results **(20)** vs DB **274**. Root cause = `admin_search_listings_v2` on staging has only the legacy 5-arg signature → the UI's 7-arg call fails and falls back to a client-side category/seller filter applied to only the newest ≤20-row page, with `totalCount` = filtered page length.
- **E06:** read-only coverage — `trades_null` 20/826, `payments_null` 20/826, `items_null` 1605/1969, `sp_wallets_null` 5053/5167, `sp_ledger_null` 362/1075, `sp_batches_null` 16/73, `cart_items_null` 2/24, `seller_balance_null` 2/26, `seller_payouts_null` 0, `trade_refunds_null` 0. Residual characterization (NULL rows whose actor HAS a node = not "unresolvable"): **items 358, sp_ledger 341, sp_wallets 35, trades 20 (+payments 20), sp_batches 15, cart_items 2, seller_balance 1**; the 20 NULL trades are all pre-N6 (Jan–Jul 2026) with NULL-node listings too. Step 3 (write-trigger): FG-1 fixture created item + in_progress trade → **item.node_id, trade.node_id, AND the trigger-created payments.node_id all = `6bf728cf`** (auto-populated, no manual entry). Fixture reset clean.
- **E07:** `/nodes` Per-Node Marketplace KPIs panel (Node/Users/Listings/Trades/Completed/GMV/Platform Fees/Paid Payouts/SP Earned/SP Spent) — every row matches `admin_node_kpis(NULL)` digit-for-digit (GMV + platform fees displayed rounded to whole dollars off the exact cents: e.g. Diag Test Node platform_fee 2581¢ → $26; Norwalk 104864¢ → $1,049). `admin_node_kpis('6bf728cf…')` returns only that node. Stat cards: Total Nodes **12** = DB 12; Active Nodes **10** = DB `is_active=true` count; Total Members **176** = DB profiles-with-node. No auth errors.
- **F11:** `/settings/trade-timing` — `auto_complete_hours` 72 → filled 71 (unsaved) → Reset → back to **72**; DB config still 72 (Reset wrote nothing).
- **K03:** `qa:failed-payout stage` (payout `42a6cb4a`, trade `fe3924ee`, $15) → `/payouts/earnings?status=failed` shows Retry (`btn-payout-retry-<id>`) → confirm copy **"Retry this payout? This will attempt to reprocess the failed payout."** → alert "Payout retry initiated" → DB **status failed → pending**, `failure_reason` cleared, `updated_at` bumped → `qa:failed-payout reset` → 0 residue.
- **L07:** RPC/backend leg PASS (wallet_state flows into AuthContext → the SP Wallet + offer surfaces render the frozen state; DB flips verified; get_user_sp_wallet_summary consumption proven by the banners). **Mobile leg:** with test-buyer's wallet frozen, an Accept-SP listing (`185546da`) → Request to Buy → **Make Offer (TradeOfferScreen, title "Make Offer")** renders the frozen WalletWarningBanner BUT the **"ADD SP OFFER" input stays ENABLED ("Max 12 SP (50% of price)")** — the SP-slider/input is **not** disabled, only a banner warns. Source confirms `TradeOfferScreen` gates the SP input on `isSubscriber && accepts_swap_points && maxSpToUse>0` (no `canSpendSP`/editable gate; `maxSpToUse = min(maxSpAllowed, availableSp)` ignores wallet state), whereas `TradeInitiationScreen` ("Start Trade") gates on `canSpendSP` correctly. `MOBILE-L07-offer-screen-frozen-sp-enabled.png`; wallet restored active/490.
- **M01:** `/subscriptions/manage` grace form (`grace-days-input` 30, `reminder-thresholds-input` "60, 30, 7, 1", per-field Save) — round-trip to 45 / "45, 20, 10, 3" (both "updated successfully") then reverted to **30 / "60, 30, 7, 1"**; DB-verified at each step (baseline restored).

---

## 3. Findings (ranked)

1. **[P1/P2 — admin] `admin_search_listings_v2` server-side category/seller filters are dead on staging (DT97 regression).** Migration `20260903000001_dev_task_97_admin_identity_reconcile.sql` redefined the function to the legacy 5-arg signature `(p_query, p_status, p_sp_eligible, p_page, p_items_per_page)`, dropping the `p_category`/`p_seller_email` params added by `20260429000012_admin_listing_search_category_email_filters.sql`. The admin UI (`ListingSearch.tsx`) calls the 7-arg signature, gets a signature-mismatch, and silently falls back to a **client-side** category/seller filter applied to only the newest ≤20-row page, with `totalCount` set to the filtered page length. Consequences: wrong population (older matching items never surface) and wrong counts (category Toys shows "Results (9)" vs **1078** in DB; seller test-seller shows "Results (20)" vs **274**). Fix: restore the `p_category`/`p_seller_email` params in the `admin_search_listings_v2` definition (re-apply the 20260429000012 signature onto the DT97 rewrite), and re-verify C12.
2. **[P2 — mobile UX] TradeOfferScreen's SP offer input is not disabled when the wallet is frozen.** With `sp_wallets.state='frozen'` (can_spend_sp=false), the Make Offer (`TradeOfferScreen`) "ADD SP OFFER" input remains enabled ("Max 12 SP") — only the `WalletWarningBanner` warns; a buyer can type SP that the server will reject (or silently ignore), a confusing money-adjacent state. `TradeInitiationScreen` gates correctly on `canSpendSP` (shows the frozen message, hides controls). Fix: add a `canSpendSP`/`editable={false}` gate to `sp-amount-input` on `TradeOfferScreen` (mirror `TradeInitiationScreen`).
3. **[P2 — QA tooling] `hasFlag` double-dash bug across all 9 fixture scripts.** `r41-common.mjs hasFlag(name)` does `process.argv.includes('--'+name)`, but every caller passes the already-dashed form (`hasFlag('--dry-run')`) → the check is for `'----dry-run'`, which never matches. `--dry-run`, `--with-auto-complete`, `--force`, `--keep`, `--remove` are silently dead (a `--dry-run` create actually inserted rows). Fix: make `hasFlag` accept the dashed form (strip a leading `--` if present) or change callers to bare names. Unblocks `qa:r41-in-progress-trade --with-auto-complete` (F-group countdown staging).
4. **[P3 — QA tooling] `qa:r41-review reset` strands the disposable item.** After deleting the completed trade, the item delete fails with `null value in column "listing_id" of relation "trades" violates not-null constraint` (trigger/delete-order interplay), leaving an orphaned sold item `0253b2cb` "QA Reported Review Fixture (2026-09-05)". Needs a delete-order fix + cleanup of the orphan. (Item `0253b2cb` is flagged for dev cleanup in App State Left Behind.)
5. **[LOW — admin] Paused is not an option in the `/listings` status dropdown.** 439 items are `status='paused'` (admin-paused), but the Status filter only offers All/Available/Pending/Needs Edits/Rejected/Flagged/Sold/Draft/Deleted — a paused listing can only be found by title search, not by status filter. Recommend adding a Paused option.
6. **[LOW — data hygiene] Leftover QA disposable node.** "QA T31 Disc Node" (a QA Task 31 disposable) has `status='active'` but `is_active=false`; also appears in `/nodes`/`admin_node_kpis` at 0s. Cleanup candidate.
7. **[LOW — note] N6 node-tagging residual is larger than the "actor has no node" class.** Rows whose actor HAS a node but `node_id` is NULL: 358 items, 341 sp_ledger, 35 sp_wallets, 20 trades (+20 payments), 15 sp_batches, 2 cart_items, 1 seller_balance. These predate the actor's node assignment (the 20 trades are all pre-N6, Jan–Jul 2026). Recommend the dev confirm whether a retroactive node reconciliation/backfill is intended so "every record resolves to one node" is fully met.
8. **[LOW — note] `/subscriptions/manage` grace-config Save writes `updated_by=null`** (no admin attribution on that form's save path) — R35-adjacent; recommend passing the editor id.

---

## 4. Config / fixture state left behind (cleanup — all DB-verified)

- test-buyer wallet: **active / 490 SP** (baseline restored after Item 6 + L07). Audit rows from the status round-trips are expected (`sp_wallet_status_change`, actor `1a546991`).
- Item `185546da`: **available** (restored after Pause/Resume + moderation reset). Audit rows (`pause`/`unpause`) expected. No safety-flag residue.
- **Orphaned sold item `0253b2cb`** "QA Reported Review Fixture (2026-09-05)" — left by `qa:r41-review reset` (finding #4) — **NEEDS DEV CLEANUP** (also visible as the top row of `/listings`). No trade/cart refs (safe to delete).
- FG-1 in-progress-trade fixture: **0 residue**. FG-2 review fixture: **0 residue** (review/report/trade gone). K03 failed-payout fixture: **0 residue**.
- Grace config: reverted to baseline `grace_period_days=30`, `grace_reminder_thresholds=[60,30,7,1]`. Trade-timing config: untouched (Reset wrote nothing).
- One moderation `apply` on `185546da` auto-created a test-seller "flagged" in-app notification (documented fixture side effect; not cleaned by the reset — expected).
- Admin portal left on `/listings` with filters reset to neutral (Results 1969, SP unchecked), logged in as samer. Mobile app relaunched to Home (session = test-buyer).

## 5. Perceived load-time (labeled per §5.7; simulator wall-clock, not a profile)

- Cold dev relaunches ~8–12s ("Downloading 100%…" bundle load) — environment artifact (dev-build reload), not an app defect.
- SP Wallet after relaunch: banner rendered sub-second after navigation (<1s) in every state.
- Admin actions: Pause/Resume drawer → success alert ~1.5–2.5s; wallet status change → "✅ Wallet status changed" ~1.5–2.5s; review Hide/Keep → row status update ~2s; payout Retry → status update ~2.5s; grace-config save → success ~1.5s. None ≥3s.

## 6. Design-system / UX / copy notes

- `WalletWarningBanner` token remap (Item 6) is **design-system compliant now**: semantic info/error/warning accents + soft tints, AA-clean neutral text; resolves QA31-M's design note.
- Buyer-facing copy in the new states is clear and parent-appropriate ("This item is no longer available / It may have been sold or removed…"; "Your Swap Points are frozen. Renew your subscription to use them again."; grace banner explains keep-spending vs no-earning).
- **L07 UX gap is the standout copy/affordance issue:** an enabled "ADD SP OFFER / Max 12 SP" on a frozen wallet invites an action that can't succeed (see Finding #2).

## 7. Evidence

Screenshots in `screenshots/`:
`MOBILE-DT111-paused-gentle-unavailable.png`, `MOBILE-DT111-resumed-item-loads.png`, `MOBILE-DT111-invalid-id-listing-not-found.png`, `ADMIN-DT111-pause-form-filled.png`, `ADMIN-DT111-paused-drawer-resume-visible.png`, `ADMIN-DT111-resume-form-filled.png`, `MOBILE-DT111-review-visible-prehide.png`, `MOBILE-DT111-review-hidden-posthide.png`, `MOBILE-DT111-review-visible-postkeep.png`, `ADMIN-DT111-review-hidden.png`, `ADMIN-DT111-review-kept.png`, `MOBILE-DT111-wallet-frozen-banner.png`, `MOBILE-DT111-wallet-suspended-banner.png`, `MOBILE-DT111-wallet-grace-banner.png`, `MOBILE-DT111-wallet-active-nobanner-restored.png`, `ADMIN-C11-selectall-counter.png`, `ADMIN-C12-search-item-name.png`, `ADMIN-C12-status-sp-filters.png`, `ADMIN-F11-reset-revert.png`, `MOBILE-L07-itemdetail-frozen.png`, `MOBILE-L07-offer-screen-frozen-sp-enabled.png`.
Admin UI states + DB read-backs recorded inline in the trace.

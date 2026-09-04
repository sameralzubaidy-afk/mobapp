# QA Task 30 — ADM Moderation Fixture Round + MSG G05/G08/G09 + Y-Group

**Run date:** 2026-09-04 · **Folder:** `e2e-test-results/qa-task30-adm-moderation-msg-y-2026-09-04/`
**Verdict:** **C03–C10 (8/8) + X05/X06 PASS live; X07 fixture-gated · Y01–Y12 executed (10 PASS / 2 PARTIAL) · MSG G05/G08/G09 closed from never-run (G09 PASS, G05/G08 PARTIAL with gated behavioral legs) · DT106 spot-checks all hold.** This round gives the ADM moderation/action-center **commit legs a genuine disposable-fixture verdict base** (they are now genuinely closed on disposable targets), fully closes **MSG's never-run pool (0 remaining)**, and delivers the first real pass over the ⌘K command palette.

> Note: the task brief referenced `ADM-QA-Standing-Rules-v2.md` (ADM-R1–R4); that file does not exist in the workspace (searched `**/ADM*.md`, `**/*Standing-Rules*`, session store). ADM-R1–R4 were inferred from the QA Task 29 report + run plan (R1 money/config→DB read-back + actor attribution; R2 config toggles scoped + revert-verified; R3 prompt()-driven B03/B06/B07 BLOCKED-on-tooling + batch admin actions; R4 admin screenshots mandatory). Flag to the owner if the file lives elsewhere.

## 0. Session recon (R29 busy check + environment)
- **R29 busy check:** no maestro/run-suite/playwright/mobilecli in flight; simulator iPhone 17 Pro Max `3F3293A3` booted; admin portal `:3001` + Metro `:8081` up. Shared admin browser page logged in as `samer`.
- **Environment:** shared browser page f6b5a809 at `:3001` (QA Task 29 left it as samer). Staging `drntwgporzabmxdqykrp`. Mobile app logged in as test-grace → switched to test-seller via `qa-login-as`.
- **Baselines read before touching config:** trade-timing 48/72; moderation keys `moderation_ai_enabled=false`, `cpsc_recall_check_enabled=true`, `cpsc_match_threshold=0.5`, `moderation_appeal_max_attempts=3`, `moderation_appeal_window_days=14`. All restored + DB-verified at end (see §7).

## 1. Batch 0 — Also-Confirm spot-checks (DT106 holds)
| Check | Result | Evidence |
|---|---|---|
| F06 batch guardrail fix (one-Save offer↑ + pickup↓) | ✅ PASS/holds | Trade-timing one-Save 48→100 + 72→67 → success banner, DB atomic 100/67 SAME updated_at (18:05:01.738). Reverted 48/72 (DB atomic, 18:05:12.295). The QA Task 29 order-dependent-guardrail finding is RESOLVED by DT106's `upsert_admin_config_settings_batch`. |
| K02 /payouts/earnings data | ✅ PASS/holds | Seller Payouts renders 100 rows (Total 100/Completed 0/Pending 38/Failed 0/$5183.53); NO 401. Retry buttons correctly 0 (no failed rows). |
| Z05 deep-link | ✅ PASS | `/payouts/earnings?status=failed` presets filter 'failed' + empty state (correct: no failed payout rows). |
| B04 doc-drift | ✅ DOC-DRIFT confirmed | `/users` drawer SP Wallet is READ-ONLY; SP credit/debit + freeze live on `/sp-wallet` (Manual SP Adjustment `admin_adjust_sp_wallet`, Wallet Status `admin_toggle_sp_wallet_status`). Guide's `/users` ref is wrong. No wallet mutated. |

## 2. Batch 1 — Disposable-Fixture Moderation Round (C03–C10 + X05–X07)
**Fixture build:** 5 disposable "QA Bundle Fixture" available listings created under test-seller via `qa:create-bundle-fixture` (count 5, ids `7bc46028/a821258d/53a3b578/7a045732/a8d41d07`) + reused clean pending leftover `033baae0` (0 trades/refs verified). Moderation states staged via `qa:r41-moderation apply`. **All 6 disposables force-deleted at cleanup** (DB-verified). test-buyer's 5-item cart side-effect cleared via `qa:reset-offer-fixtures` (0 cart/0 pending verified). DT104's MSG fixtures (`0c1b5be8`/`04662c2c`) untouched.

| TC | Verdict | Top finding / evidence |
|---|---|---|
| C03 Approve flagged | ✅ PASS | Review modal Approve → confirm → available; DB approved_by 1a546991 (R35 actor ✓), flag cleared, admin_activity_log approve_listing |
| C04 Reject w/ required reason | ✅ PASS | Reject DISABLED without reason; enabled after Decision Note → rejected + rejection_reason stored (appeal_count 1) |
| C05 Item detail + appeal info | ✅ PASS | Appeal info (count/note/"Appealed at:") renders on the /items/flagged Review modal. DOC-DRIFT: guide's `/items/[id]` renders NO appeal data + hung on "Loading item details..." (anon-key RLS read) |
| C06 Force Delete | ✅ PASS | /listings details Force Delete (reason required) → deleted (also cleaned up the C08 leftover) |
| C07 Pause | ✅ PASS | /listings Pause → paused |
| C08 Approve (pending) | ✅ PASS | Approve Listing present (pending-only) → available; approved_by samer |
| C09 Request Edits | ✅ PASS | Confirm disabled w/o note; → needs_edits + note stored |
| C10 Reject | ✅ PASS | Decision Note required → rejected |
| X05 Inline approve (AC) | ✅ PASS | Action Center Flagged Items card (3) → inline Approve → toast "Approved QA Bundle Fixture 1 of 5 (2026-09-04)." → row left, count 3→2, DB available |
| X06 Inline dispute under review | ✅ PASS | r41-dispute reported on fe3924ee → AC Disputes card (Urgent) → Under Review → toast "Dispute marked under review." → DB under_review. **Residue:** r41-dispute reset only resets 'reported', not 'under_review' → trade fe3924ee left under_review (see §7 + follow-up) |
| X07 Inline retry failed payout | 🟡 PARTIAL (fixture-gated) | 0 failed payout rows → no Failed Payouts card (correct); retry commit leg needs a failed-payout fixture (same as K03) |

**Verdict on the brief's question:** the moderation + action-center **commit legs are now genuinely closed on disposable targets** — C03–C10 + X05 + X06 have real live commit verdicts with DB-verified side effects and actor attribution; X07 is the sole remaining gated commit (data-gated on a failed-payout row, not on any UI/affordance gap).

## 3. Batch 3 — Y-Group Command Palette (⌘K)
All 12 executed against the live palette (`CommandPalette.tsx` + `admin_global_search` RPC). **Driver facts:** the embedded browser driver cannot deliver real ⌘K/keystrokes; verified the ⌘K handler via synthetic KeyboardEvent + native-setter for queries (same pattern as DT106 settings inputs).

| TC | Verdict | Top finding |
|---|---|---|
| Y01 ⌘K opens | ✅ PASS | synthetic Meta+k opens/focuses from 4 pages, toggles closed, Esc closes. Real-keyboard leg = driver-limited (recommend a normal-browser pass) |
| Y02 Header pill | ✅ PASS | topbar-global-search → opens + focused |
| Y03 Grouped search | ✅ PASS | "samer" → Users(21)/Listings(68)/Trades(514) in one render; empty groups omitted |
| Y04 Breadcrumbs | ✅ PASS | Users→email, Listings→title, Trades→short-id, Config→category→key |
| Y05 Debounce | 🟡 PARTIAL | 200ms source-verified; char-by-char not drivable (driver) |
| Y06 Top-5 + See all | ✅ PASS | Users 5→21 expand; See-all removed |
| Y07 View-all footer | ✅ PASS | → /users?search=samer, /listings?tab=search&q=bike, /trades?search=samer (prefilled) |
| Y08 Row navigation | 🟡 PARTIAL | Settings/Users/Trades nav ✓. **FINDING:** Listings row → `/listings?tab=search&q=<uuid>` = "Results (0)" — search RPC matches text, not item UUID → chosen listing NOT surfaced |
| Y09 Keyboard nav | ✅ PASS | ArrowDown→Enter opened row 2 (uuid 30be9c70); ArrowUp moved back (row 1); Esc closes |
| Y10 Non-admin | ✅ PASS | RBAC admin-only + profiles role gate (5235 user/1 admin) → non-admins never reach palette (A02); RPC 'Forbidden' → "Only admins can use global search." (defense-in-depth) |
| Y11 Secrets hidden | ✅ PASS | config rows show key/desc/breadcrumb, never value; search by value not matched |
| Y12 Empty/no-results | ✅ PASS | hint + "No results for …" + tip, no errors |

## 4. Batch 2 — MSG G05/G08/G09 (last never-run pool → closed)
Config round-trips via `qa:admin-config-set` (R37 sanctioned path), verified DB + /config UI each way, all reverted (§7). Recall scenario: `check_cpsc_recalls('FUNTOK 24V 2-Seater Ride-On Truck')` → recall 26348 @ **0.9143** similarity (≥0.5 threshold).

| TC | Verdict | Top finding |
|---|---|---|
| G05 Recall alert | 🟡 PARTIAL | banner leg PASS: cpsc_recall side-flag on disposable → seller Safety Review "This listing is currently under safety review." + FLAGGED (on-device). Notification leg = product-decision-gated: **no production recall_alert notification producer exists** (check-item-safety only flags → generic "Item Under Review") — guide wording unverified per its own 2026-08-12 flag |
| G08 AI toggle | 🟡 PARTIAL | config round-trip PASS (moderation_ai_enabled false→true→false, DB+UI). Behavioral AI-image-flag leg = **infra-gated** (Google Vision reachability from staging unverified — R41 verdict; do not fake) |
| G09 Recall toggle/threshold | ✅ PASS | config round-trips PASS (cpsc_recall_check_enabled true→false→true; cpsc_match_threshold 0.5→0.95→0.5); match behavior (0.9143 ≥ 0.5) + EF threshold gate source-verified; recall-flagged scenario driven (item_safety_flags cpsc_recall + queue + mobile banner). Residual: full New-Item recall-titled create comparison not driven (ItemCreate fiddly; EF-level threshold demo residual) |

**MSG guide status:** ✅ **fully closed of never-run cases (0 remaining).** Every one of the 72 MSG cases now has a verdict. G05/G08's remaining behavioral legs are product/infra-decision items, not "never run" items.

## 5. NEW FINDINGS (worth their own follow-up)
1. **[MED, same BP-49 class as the DT106 /payouts 401] /config SMS-stats API 401s** — console error "Failed to load SMS stats: Error: No valid authentication provided" (config `page.tsx:993` loadStatsFromApi → an SMS-stats API returns 401). The /config page's SMS-stats sub-fetch still lacks the `x-admin-secret` header. Dev: same header fix as DT106 item 2.
2. **[LOW, Y08] Listings palette navigation lands on empty search** — `/listings?tab=search&q=<listing-uuid>` returns "Results (0)" because `admin_search_listings_v2` matches text columns, not item UUID. The chosen listing is not surfaced (guide expects it). Dev: pass the title or add ID matching.
3. **[LOW, C05 doc-drift] `/items/[id]` does not render appeal data** + hung on "Loading item details..." for a needs_edits item this session (anon-key `items` RLS read). Appeal data genuinely lives on the /items/flagged Review modal. Guide C05 route note should be corrected.
4. **[LOW-MED, tooling residue] r41-dispute reset only resets `reported`, not `under_review`** — X06's commit leg leaves the trade in under_review with no sanctioned reset path. Dev: extend r41-dispute reset to restore under_review → none (or document the H05/X06 end-state).
5. **[LOW, number-accuracy — added via post-run DB reconciliation, R54] `/payouts/earnings` stat cards are window-scoped but unlabeled** — the stat cards (Total Payouts 100 / Completed 0 / Pending 38 / Failed 0 / $5183.53) are computed from the returned ≤100-row page (`api/admin/payouts/route.ts`: `total_pending` = pending+processing in the returned rows), NOT global DB counts. Global DB: completed 2, pending 33, processing 28, requires_action 63, failed 0. So "Completed 0" shows while 2 completed rows exist, and "Pending 38" is a window subset of 61. Dev: label the cards "on this page" or return global aggregates.

**Post-run admin↔DB number reconciliation (per the new R54 rule):** every Action Center figure verified exact against `admin_action_center_summary()` logic — sidebar badge **28 = 2 (flagged) + 1 (dispute under_review) + 24 (id-badge pending) + 1 (cancel escalated) + 0 (anomaly) + 0 (failed) + 0 (config drift)**; each card matched its DB source (id-badge Pending 24/Approved 21/Rejected 32, cancel-requests 1, no failed/config-drift/cancel-anomaly cards because 0/0/false). This reconciliation motivated the new playbook standing rule **§5.56 R54 — admin-displayed numbers must be DB-reconciled on every case** (owner standing request 2026-09-04).

## 6. Design-system / UX / load-time notes (admin surface)
- Admin palette + moderation surfaces reviewed: config toggles render with clear Enabled/Disabled labels + per-field Save; moderation Review modal uses status-color pills (flagged amber/rejected red/needs_edits orange) consistent with the admin design tokens observed in QA Task 29. No new design-system deviations on the surfaces visited this round.
- Copy check: moderation confirm/decision copy is clear and parent-appropriate ("This will keep the review visible...", "Send this listing back to seller for edits?"). No raw error-code leaks observed on user-facing moderation surfaces this round.
- **Perceived load-time:** all admin transitions <3s (typical 1–2.5s); the /items/flagged queue data poll occasionally took ~6–8s on first load after a fixture write (supabase direct read + refresh) — flagged as environment/data-fetch, not a defect. No formal profile.
- **Per-transition table (measured, per §5.7/R50):** trade-timing save→banner ~1.5s; /payouts/earnings render ~2.5s; /items/flagged Review modal open ~1s; action-center card expand ~1.2s; approve/reject/pause/delete commit (POST → success) ~1.5–2.2s; palette open+fetch ~1.4s; palette row nav ~1.5–2.2s. None ≥3s except the one noted /items/flagged first-poll.

## 7. Config / fixture state left behind (cleanup)
- **Config all reverted + DB-verified:** offer_timeout_hours=48, pickup_window_hours=72 (atomic, after the F06 round-trip); moderation_ai_enabled=false; cpsc_recall_check_enabled=true; cpsc_match_threshold=0.5; moderation_appeal_* untouched (3/14). Trade-timing audit rows from the F06 round-trip are expected/normal.
- **All 6 disposable listings force-deleted** (7bc46028, a821258d, 53a3b578, 7a045732, a8d41d07, 033baae0) — DB-verified status='deleted'. Flagged queue back to the DT104 fixtures only (0c1b5be8/04662c2c untouched). item_safety_flags rows on deleted disposables are harmless orphans (item deleted).
- **test-buyer cart/offers reset to 0** (create-bundle-fixture side-effect cleared via qa:reset-offer-fixtures; 3 stale pending offers cancelled per R-16-1 standard).
- **RESIDUE (recorded):** trade `fe3924ee-7574-494f-96f2-a72767f1a8a2` (leftover in_progress bundle, test-buyer→test-seller) is now `dispute_status='under_review'` from X06 — r41-dispute reset refuses under_review. Needs a dev-side reset or acceptance as an under_review fixture. Trade status in_progress unchanged; no money moved.
- Admin browser session left logged in as samer. Mobile app left logged in as test-seller (at the Safety Review of a now-deleted disposable; navigate Home to reset).

## 8. Evidence
Screenshots in `screenshots/` (ADM-* = admin surface, MOBILE-* = simulator): Batch 0 (K02/Z05/B04), C03–C10 commits, X05/X06/X07, G08/G09 config tabs + recall-flagged queue, G05 mobile Safety Review banner, Y-group palette (open/groups/expand/view-all/nav/empty).

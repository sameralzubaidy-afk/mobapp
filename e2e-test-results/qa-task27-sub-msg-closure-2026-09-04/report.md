# QA Task 27 — SUB Reconciliation + Real Execution, MSG Final Closure

**Run date:** 2026-09-04 · **Folder:** `e2e-test-results/qa-task27-sub-msg-closure-2026-09-04/`
**Verdict:** **SUB reconciled to its true state** (canonical 100; PASS 44 / PARTIAL 2 / OPEN 3 / remaining 51 — tracker gap of ~13 real PASSes corrected) · **MSG PARTIAL×5 reconciled to PASS** (Part 3a) · **MSG H02 + H03 executed for real** via the admin portal (2 PASS) · **All other MSG Batch-B and SUB Part-2 on-device execution BLOCKED** this session (mobile-mcp toolset disabled by the user; DB read-back tool also disabled mid-run).

---

## 0. Session recon + environment (R29 busy check)

- **R29 busy check:** booted simulator = iPhone 17 Pro Max (`3F3293A3-…`, iOS 26.1). Metro dev server up on `:8081` (pid 43400/43432); admin `p2p-kids-admin` Playwright test-server up on `:3001` (pid 10832). No in-flight `maestro` / `run-suite.sh` / `expo run:ios` process. No fresh `e2e-test-results/` writes from another task. Clear to execute.
- **Staging project:** `drntwgporzabmxdqykrp`.
- **🔴 ENVIRONMENT BLOCKERS (tooling, applied progressively mid-session):**
  1. **`mobile-mcp` toolset disabled by the user for this session** — `mobile_list_elements_on_screen`, `mobile_launch_app`, `mobile_click_*`, `mobile_take_screenshot`, etc. all returned "currently disabled by the user" despite successful category activation. → **ALL on-device (simulator) execution was impossible** this session.
  2. **`mcp_supabase_execute_sql` disabled by the user mid-run** — it worked for the first ~6 read-only queries (fixture recon), then returned "currently disabled by the user". → direct DB read-backs for the later admin cases were impossible; those cases were verified via the **DB-rendered admin moderation queue** instead.
- Consequence: Parts 2 (SUB on-device) and most of Part 3b (MSG on-device cases) are **BLOCKED with reason** (tooling disabled), not skipped. They are carried forward as genuinely-open, queued for the next session. All **reconciliation** (Parts 1 + 3a) was completed to evidence-backed conclusion, and the **admin-executable** MSG cases (H02/H03) were executed for real.

---

## 1. PART 1 — SUB Reconciliation (completed; evidence-backed)

### 1.1 Canonical SUB case count = **100** (the 100-vs-105 question)
- The guide's **Test Case Index** (`cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`, groups A–N) declares **100 cases**. The reconciliation data layer agrees: `temp/tc-inventory-v2/master-tcs-v2.tsv` and `canonical-latest-v2.tsv` each model exactly **100 SUB rows**.
- The "~105" figure came from counting ALL `### SUB-TC-` **body headers** — 105 = the 100 indexed cases + **5 un-indexed regression headers `SUB-TC-R01…R05`** in the guide's trailing "Regression checks" section (run-after-any-change cross-cutting checks, NOT part of the 100-case module count). `D06`/`D07` count inside the 100 despite being physically placed at the doc end.
- **Answer: 100 is the true canonical count** (index + tracker + TSVs agree). It did not "change" recently; ~105 was always a body-header-count artifact.

### 1.2 Verdict capture — QA Tasks 19–25 + Dev Tasks 94/97/99/100/101
- **Verdicts WERE captured on disk** in report.md-parseable form in `qa-task19-sub-kickoff-2026-09-02`, `qa-task21-sub-close-2026-09-02`, `qa-task22-sub-remainder-2026-09-02`, `qa-task25-consolidated-2026-09-03`, `qa-task26-msg-g-closing-2026-09-03`, and `dev-task99-grace-freeze-verify-2026-09-03` (Dev Task 99's independent QA stage).
- **The gap was a TRACKER not rolled up** — real PASSes from qa21 (C04/C06/C07 cancel loop, L01/L04 §F upgrades), qa22 (C08/A02/E02/J03/J04/L03), qa25 (L02 via DT99 cross-ref), and qa19/qa21 (E01 bundled with K01) were never moved into the tracker's Completed table; E02/J03/J04 were frozen as `BLOCKED` from a qa21 "budget-not-run" note that qa22 subsequently overturned with on-device PASSes; L01–L04 sat at PARTIAL despite report text explicitly upgrading them to PASS.
- **This is the "30-vs-44" discrepancy:** ~44 cases have real positive verdicts on disk (tracker's 31 PASS + ~13 uncredited) — fixed in the **tracker**, not the underlying facts (per the task's "fix the reconciliation, not the facts" instruction). Underlying tooling note: `temp/tc-inventory-v2/*.tsv` is stale (qa22/qa26 verdicts absent; E03 still FAIL, E02/J03/J04 still BLOCKED) — regeneration must fold qa22/qa26/this round in, and must NOT overwrite the corrected hand tracker.

### 1.3 Specific confirmations requested
| Case | Verdict | Evidence source |
|---|---|---|
| SUB E03 (failed-charge display) | ✅ **PASS** | qa26 (2026-09-04) on-device: FAILED row ($5.99, Sep 3) renders `error_message` caption under the red badge — DEV-TASK-101 render fix live. (qa25 was the pre-fix FAIL-finding.) Already correctly credited in the tracker. |
| SUB L02 (payment-failed → grace) | ✅ **PASS** | qa25 Batch 4 (2026-09-03) cross-ref + **Dev Task 99's independent QA stage** (`dev-task99-grace-freeze-verify-2026-09-03`): real failing-renewal on a disposable user — 3rd payment failure → `subscriptions.status=grace_period` + `sp_wallets.state=grace_period` + 3 critical payment-failed notifications; success/return-to-active legs also PASS. | 
| SUB C09 / D03 (expired states) | ✅ **PASS** | qa25 Batch 3 (2026-09-03) on-device: test-expired → C09 Manage Kids Club+ expired info-box + Re-subscribe CTA; D03 Subscription Expired screen with dated copy "Your Kids Club+ plan ended on July 25, 2026" (DEV-TASK-100 expired-date fix live). Both already credited. |

### 1.4 Corrected SUB numbers (tracker now updated — R52)
- **PASS 31 → 44** (13 additions: A02, C04, C06, C07, C08, E01, E02, J03, J04, L01, L02, L03, L04)
- **PARTIAL 5 → 2** (L05 payout-domain webhook — unchanged; **C05** newly classified PARTIAL — see below)
- **OPEN 6 → 3** (D06, D07 — clock/push fixture-gated; I08 — wallet-auto-insert fixture-gated)
- **Remaining NEVER RUN 58 → 51**
- C05 (cancel reason modal): qa21 drove the cancel *outcome* via the My Subscription retention/"Cancel Subscription?"-alert path, **not** the Manage Kids Club+ reason-modal surface (`cancel-reason-*` rows / disabled Confirm / Other free-text) that is C05's distinguishing assertion → **PARTIAL** with that precise reason (honest, not forced either way).

---

## 2. PART 2 — SUB "still genuinely open" after reconciliation + execution status

**What the reconciliation revealed is genuinely still open (neither credited nor run):**
- **Fixture-gated on a dev-run service-role/staging step (NOT QA-runnable):** `D06` + `D07` (subscription-event / grace-reminder notifications — need `notif-sub-event`-class staging rows + clock/push fixtures; qa25 note: a dev-run step) and `I08` (SP Wallet "Wallet Not Found" — `getWallet` auto-inserts, needs a wallet-deletion/RLS fixture). **E04** is already closed (PASS qa25/qa26) — per the task's "if not already closed" clause it needed no run.
- **Never-run remainder (51) composition:** 17 are explicitly RETIRED/🚫 N/A (B01–B13, D02, D04, G02, G03). ~22 are payout-domain guide entries (F01/F03–F08, G01/G04–G11, H01–H04, H06–H07) whose guide targets are dead/unreachable and **re-mapped to the live `PayoutSettingsScreen`** (verified qa19: F02-adapted + H05 PASS) — a documented guide-refresh finding (qa21 F-D2), not an execution gap. Remaining genuinely-attemptable without a new dev fixture is small: D01 (grace persona — standing `test-grace` exists), D05 (reactivate — needs a cancelled-not-expired persona), K02 (empty leg ≈ E02-done; error leg needs fixture), I06/A05 (reachability/doc-drift-classified).
- **Execution this session:** BLOCKED — the mobile-mcp toolset (simulator driver) is disabled by the user this session, so D01 and the other app-side open items could not be driven. **Carry-forward:** next session, execute SUB D01 via `test-grace` → `manage-kids-club` (grace urgency + SP-freeze warning + Re-subscribe CTA), and re-assess D05/I06/K02/A05 reachability; D06/D07/I08 remain gated on dev-run staging fixtures.

---

## 3. PART 3a — MSG PARTIAL reconciliation (5 rows → PASS, evidence-backed)

The tracker's 5 PARTIAL rows (D07, D08, E02, E03, E05) were **genuine PASSes in qa25 Batch 1** (report verbatim: "PASS×5 · PARTIAL×1 (E04)"), with the real sub-legs observed (DB read-backs, notifications delivered, screenshot-object deletion). The tracker froze them at PARTIAL — a reconciliation gap, not a genuine partial. Each corrected in the tracker (R52) with the verbatim qa25 evidence + its caveat preserved in Notes:
- **MSG-TC-E02** (Approve) → PASS: `d148ee0f` → approved + reviewed_at/by + approval_notes; `id_badge_approved` notification; screenshot storage object deleted post-decision.
- **MSG-TC-E03** (Reject with reason) → PASS: no-reason submit fired "Please select a rejection reason" (guide match) → reason + notes → rejected; `id_badge_rejected` notification with reason.
- **MSG-TC-E05** (Edit message templates) → PASS: edit → "✓ Saved successfully" + Last-updated bumped; reverted. (Doc drift: confirmation copy is "✓ Saved successfully", not guide's "Message saved".)
- **MSG-TC-D07** (Approved → Verified badge) → PASS (with self-view finding #2 carried — the seller's OWN public-profile self-view staleness is the open DEV-TASK-102/Item 5 thread; badge + other-user-view legs pass).
- **MSG-TC-D08** (Rejected → reason + resubmit) → PASS: reason in Notification Center + resubmit possible.
- E04 was already PASS (qa26). New MSG roll-up: **PASS 59 / PARTIAL 0 / OPEN 1 (B05 deferred) / remaining 12**.

---

## 4. PART 3b — MSG never-run Batch B: execution results

### ✅ MSG-TC-H02 — Approve a flagged item (admin) — **PASS**
- **Fixture:** `ba6345ce-ed31-4a78-903f-32ccacbf53c4` "Cash-Only Item" ($20, Status **Flagged**, Appeals 0, owner test-seller) — the live R41 G01 fixture.
- **Executed for real** on the live admin portal (`/items/flagged` Moderation Queue): opened Review modal (Status Flagged shown) → **Approve & Make Available** → confirm dialog "Are you sure you want to approve this item and make it available?" → accepted.
- **Verification:** post-approve queue reload — `ba6345ce` **no longer present** in the moderation queue (the queue lists only moderation-status items and is DB-rendered → the item left the flagged/moderation set = approved to available). Direct SQL read-back was not possible (execute_sql disabled mid-run) — recorded as a verification-method caveat, not a defect.
- **Fixture consequence (documented):** ba6345ce consumed → now available. This removes the last "flagged" G01 re-run fixture (G01 is PASS; acceptable for closure).
- Evidence: `screenshots/H02-review-modal-flagged.png`, `screenshots/H02-post-approve-queue.png`.

### ✅ MSG-TC-H03 — Reject with reason (admin) — **PASS**
- **Fixture:** `ccf97ae4-d74a-4e42-a78a-023202ae56af` "Cash-Only Item" (Status **Flagged**, Appeals 1 — the G02 post-appeal fixture, owner test-seller).
- **Executed for real:** opened Review modal (Status Flagged) → verified the **Reject button is DISABLED until a Decision Note is entered** (disabled before, enabled after filling `flagged-rejection-reason-input` — the guide's + DT97's disabled-guard assertion) → entered Decision Note → **Reject** → confirm dialog "Are you sure you want to reject this item?" → accepted.
- **Verification:** queue reload — `ccf97ae4` row now shows **Status "Rejected"**; reopening the modal shows **"Latest Admin Decision Note: QA Task 27 H03 - test rejection reason (duplicate/safety)"** persisted + Appeals Submitted 1 + the seller appeal note. DB-rendered UI confirmation (direct SQL read-back unavailable).
- **Fixture consequence (documented):** ccf97ae4 consumed → rejected. This removes the last flagged G02 fixture (G02 is PASS).
- Evidence: `screenshots/H03-reject-modal-flagged-prefill.png`, `screenshots/H03-post-reject-queue.png`, `screenshots/H02-H03-flagged-queue-all.png`.

### 🔴 MSG-TC-D02 / D04 / D05 / D10 / I01 / I02 — **BLOCKED** (mobile-mcp toolset disabled by the user this session)
All six are on-device (simulator) cases and could not be executed. Their readiness was fully scoped (source + DB + fixture) so the next session is one login away:
- **D05 (No-image submit validation)** — ready to run: `test-seller` (ID upload, rejected → resubmittable upload state) → deep link `id-verification-upload` → assert `id-verification-submit-btn` disabled (source: `IDVerificationUploadScreen.tsx` L311-315, `disabled={!state.selectedImage || state.uploading}` + `accessibilityState`) → one bounded functional tap for the no-op (R-16-4).
- **D02 (Capture ID with camera)** — ready to run on the same screen: `id-verification-take-photo-btn` → on the simulator the native camera permission prompt appears; allow → `launchCameraAsync` rejects (no camera) → inline "Failed to take photo" (`id-verification-error`); deny → Alert "Permission Required / Please allow camera access." (source L106-135). The actual capture leg is a documented simulator-camera limitation.
- **D04 (Duplicate pending request blocked)** — needs a pending request. **DB recon this session: ZERO pending `id_badge_verification_requests`** (test-seller rejected, test-seller-3 + test-buyer approved). A pending row must be created by submitting an ID upload first (D03 surface); submission requires the photo-library picker. Client-side guard confirmed in source (`handleSubmit` L148-155: Alert "Pending Request / You already have a pending verification request…"). Attempt next session on test-seller.
- **D10 (Decision notifications honor channel preferences)** — **by-design NOT SUPPORTED** (guide + source): `NotificationCategory` union (`src/services/notificationPreferences.ts` L7) = `subscription | sp_events | badges | trades | system` — **no `id_verification` category**; all ID-verification notifications (`id_badge_submission/approved/rejected`) are created under **`badges`** and gated by the badges preference (EFs `id-badge-submission-notification` + `id-badge-notifications`). The case as written (an id_verification category to toggle) cannot be exercised — the guide itself says "treat as NOT SUPPORTED … (If product later adds an `id_verification` category, re-open this case.)". The testable proxy (badges-category channel gating of decision delivery) is verifiable once D04/E-series produce a fresh decision notification; recorded as NOT-SUPPORTED-by-design rather than a fabricated run.
- **I01 (Enable push notifications)** — the enable prompt ("🔔 Stay Connected", `NotificationSetup`) is reachable post-login via `settings-enable-notifications-button` or the `notification-setup` deep link, but a **successful real push registration requires a physical device** (`registerForPushNotifications` returns null token when `!Device.isDevice`) → success leg is environment-blocked on the simulator. Requires a real-device leg (out of the current simulator scope).
- **I02 (Push error states)** — the **iOS-simulator leg IS testable**: tapping Enable on the simulator yields the error state "Could not obtain push notification token. Make sure you granted permissions." (no crash). Web/Android legs are Platform-gated (not runnable on the iOS sim). Queued — one login away.

### NOT this round (per task): G05/G08/G09 (parked product decisions — recall_alert producer, AI-vision reachability), B05 (deferred post-MVP), J05 (NOT SUPPORTED — no id_verification category; unchanged).

---

## 5. Config / fixture state left behind

- **Fixtures consumed this session (expected, documented):** `ba6345ce` (H02 approve → **available**), `ccf97ae4` (H03 reject → **rejected**, Decision Note stored). Both were the last two `flagged` items on staging; the moderation queue's flagged set is now empty (remaining queue rows are rejected/needs_edits demo items).
- **Config baselines:** untouched this session (no admin_config/category writes). `moderation_appeal_max_attempts=3`, `moderation_appeal_window_days=14` unchanged from qa26.
- **ID-badge queue state:** 0 pending (unchanged). test-seller rejected (76592772), test-seller-3 + test-buyer approved.
- **Admin portal:** left on `/items/flagged` Moderation Queue, logged in as the documented staging admin (`samer@samer.com`).
- **Mobile app:** untouched this session (mobile toolset disabled — no login/session change; prior qa26 state presumed).

---

## 6. QA Session Handoff

**Test Scope:** QA Task 27 — SUB reconciliation (Part 1) + SUB genuinely-open execution (Part 2) + MSG PARTIAL reconciliation (Part 3a) + MSG Batch B never-run execution (Part 3b), across the SUB guide (`MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET`) and the MSG guide (`MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS`). Live execution possible only for the admin-portal cases this session.
**Design-System Compliance:** N/A this session on mobile (no mobile screens driven — toolset disabled). Admin moderation-queue surfaces exercised (H02/H03) are the existing Next.js admin design (blue primary "Review"/filter tabs, green Approve / gray-red Reject) — consistent with the admin portal's established styling; no new deviation to record against `design-system-passitup.md` (mobile doc).
**Perceived Load-Time Verdict:** GOOD — the only transitions measured this session were admin `/items/flagged` queue loads + modal opens + post-action queue reloads (each rendered within ~1–2.5s wall-clock on the local dev server). Not a formal profile; no ≥3s flag.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — MSG H02 approve confirm dialog copy: "Are you sure you want to approve this item and make it available?" (matches guide intent).
- CONFIRMED — MSG H03 reject guard: Reject disabled until a Decision Note is entered; confirm dialog "Are you sure you want to reject this item?"; the queue + review modal render "Status: Rejected" and "Latest Admin Decision Note" after rejection.
- CONFIRMED — MSG H03 Decision-Note field placeholder "Provide clear moderation feedback for seller..." + label "Decision Note (required for Reject and Request Edits)".
- (No mobile screens/dialogs were visited this session to confirm against the design doc — see Known Gaps.)
**Verdict Summary:** **2 PASS / 0 FAIL / 8 BLOCKED (tooling)** + full evidence-backed reconciliation of SUB (Part 1: 100 canonical, tracker corrected to 44 PASS/2 PARTIAL/3 OPEN/51 remaining) and MSG PARTIALs (Part 3a: D07/D08/E02/E03/E05 → PASS). BLOCKED: SUB D01 (+ remaining app-side open items, Part 2) and MSG D02/D04/D05/D10/I01/I02 (Part 3b) — all because the mobile-mcp simulator toolset is disabled by the user this session.
**Coverage Tracker Updated:** YES (R52) — `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`.
- **SUB:** 13 rows moved to ✅ PASS (A02, C04, C06, C07, C08, E01, E02, J03, J04, L01, L02, L03, L04 — with qa21/qa22/qa25/DT99 evidence notes); C05 added as 🟡 PARTIAL; E02/J03/J04 de-flagged from stale 🔴 BLOCKED; Remaining 58→51. Roll-up now **PASS 44 / PARTIAL 2 / OPEN 3 / Remaining 51**.
- **MSG:** D07, D08, E02, E03, E05 flipped 🟡 PARTIAL → ✅ PASS (qa25 verbatim evidence + caveats preserved); **H02, H03** moved from Remaining → ✅ PASS (this session's real admin executions); Remaining 12→10. Roll-up now **PASS 61 / PARTIAL 0 / OPEN 1 / Remaining 10**.
**Critical Findings:**
1. **[Tooling blocker — session]** mobile-mcp (simulator) and later `execute_sql` were disabled by the user during this session, blocking all on-device work and direct DB read-backs. No app defect.
2. **[Reconciliation — fixed]** the SUB tracker under-credited ~13 real PASSes (and MSG 5 PARTIALs were real PASSes) — corrected in the tracker; the `temp/tc-inventory-v2/*.tsv` layer remains stale (qa22/qa26 absent; E03 FAIL, E02/J03/J04 BLOCKED) and must fold these in before any regeneration.
3. **[Fixtures consumed]** H02/H03 consumed the last two `flagged` items on staging (ba6345ce → available, ccf97ae4 → rejected). A future flagged-item moderation case needs a fresh flagged fixture (dev seed).
4. **[Documented, not new]** MSG D10 + J05 remain NOT SUPPORTED by design (no `id_verification` notification category; ID-verif routes through `badges`).
**App State Left Behind:** §5. Moderation queue: no remaining `flagged` items. Admin logged in as `samer@samer.com` on `/items/flagged`. Mobile app untouched.
**Why It Matters:** SUB's real, reconciled state is now recorded — **44 PASS / 2 PARTIAL (L05, C05) / 3 OPEN (D06/D07/I08, all dev-run-fixture-gated) / 51 remaining (17 retired/N-A + ~22 payout-domain guide entries remapped to the live PayoutSettings surface + a small genuinely-attemptable remainder)** — no hidden "44 cases with verdicts but 31 credited" discrepancy remains. MSG's 5 PARTIALs are resolved to PASS, and H02/H03 were the first of the 8 Batch-B cases to be genuinely executed and closed (the other 6 + SUB D01 are queued, not lost). Both guides are substantially closer to "everything done, deferred, or blocked on a named decision" — the bar for moving to ADM — with the caveat that the 6 un-executed on-device Batch-B cases + SUB D01 still need a session with the mobile toolset enabled.
**How to Verify/Reproduce:** Tracker edits: `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (SUB § line ~828, MSG § line ~180). Reconciliation evidence quoted in §1–§3 above and in the qa19/qa21/qa22/qa25/qa26/DT99 reports. H02/H03 reproduce: admin `/items/flagged` → Review on a flagged item → Approve / Reject-with-note. Admin screenshots in this run folder's `screenshots/`. The BLOCKED mobile cases carry full ready-to-run source+DB scoping in §4 and session memory.
**Known Gaps / Not Tested:** SUB Part 2 on-device (D01 + app-side remainder) and MSG D02/D04/D05/D10/I01/I02 not executed (mobile-mcp disabled — queued for next session). H02/H03 direct SQL read-back not possible (execute_sql disabled mid-run) — verified via the DB-rendered moderation queue instead. MSG I01's push-success leg requires a physical device (out of simulator scope). MSG G05/G08/G09 + B05 + J05 deliberately not attempted per task.
**What Needs To Be Fixed Next:**
- **(Dev/ops, unblocks remaining SUB open items):** stage the `notif-sub-event`-class rows + clock/push fixtures (D06/D07) and a wallet-deletion/RLS fixture (I08) — the only genuine SUB gaps left. (QA can't stage — service-role writes.)
- **(Optional dev seed):** a fresh `flagged` fixture item so H02/H03 (and any flagged-item moderation re-run) has a target after this session consumed the last two.
- **No app defects surfaced this session** — none to fix beyond the above fixtures.
**UX Enhancement Ideas (optional, not defects):** None this session — no mobile screens were driven (toolset disabled), so no grounded enhancement observations were possible beyond those already recorded in prior runs.
**Suggested Next Session:** Re-run with the mobile-mcp toolset (and SQL read-back) enabled to execute the queued on-device batch: SUB D01 (test-grace), MSG D05 + D02 (test-seller ID upload), MSG D04 (create a pending request → duplicate-blocked), MSG D10 (badges-category decision-delivery proxy — or confirm NOT SUPPORTED), MSG I02 (simulator push-error leg) + I01 (real-device note). Then close out the MSG Remaining ledger (G05/G08/G09 product decisions, J05, B05) and move to ADM.
**Suggested to Improve Agent Rules:** none new — the standing playbook (R13 BLOCKED-with-reason, R52 tracker discipline, R53 full handoff, §5.20 admin screenshot evidence, R-NEW-5/§5.49 batched admin scripts) covered this session well. One operational note worth retaining: when `mobile-mcp` activation "succeeds" but individual tools return "disabled by the user," treat the whole toolset as unavailable immediately and pivot to what IS available (browser/admin + reconciliation) rather than probing — the probe cycles are wasted. This session's probe cost was small but nonzero.

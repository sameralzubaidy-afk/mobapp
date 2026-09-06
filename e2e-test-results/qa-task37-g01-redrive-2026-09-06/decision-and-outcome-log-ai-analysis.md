# QA Task 37 — Full Decision & Outcome Log (AI-analysis edition)

**Purpose:** A complete, timestamped account of every key action → the reasoning behind it → the tool calls that mattered → the outcome, written so an AI agent can mine it for:
- **(a)** what slows execution (bottlenecks, ranked)
- **(b)** what patterns an agent should adopt proactively
- **(c)** what instrumentation/fixture work removes the friction so future smaller runs don't burn the same time and calls

**Session:** 2026-09-06, iOS Sim iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), staging `drntwgporzabmxdqykrp`. Runs: Batch A (DT121 delete-only + resume-hint UI), Batch B (SUB-TC-G01 instrumented re-drive — DT121/122/123 on-device), Batch C (billing-dedupe D05-style re-drive), Cleanup (R41/BP-70). Mobile HEAD `8b1d1294` (DT123); admin portal :3001 real session.

**Method note (read first):** unlike QA Task 36's log (approximate ranges reconstructed from the trace), **every number here is EXACT — mined from the session transcript** (`…/GitHub.copilot-chat/transcripts/e08d8302-582a-49d1-9a52-19dfb9d9980d.jsonl`, 487 tool executions). QA Task 36's own log used approximate ranges and likely undercounted, so **do not read QA Task 37's higher totals as "the efficiency rules failed"** — QA Task 37 drove substantially more work to completion (QA Task 36's Batch B SKIPPED at the ID-document gate; QA Task 37 finished onboarding → verified → primary → withdrawal, plus a full Batch C renewal cycle). The apples-to-apples statement that matters is the **hosted-web-form share** (~43% of the whole session) and which sub-steps inside it are compressible. A mid-run manual estimate this session ("Batch B ~110–120 calls") materially undercounted the mined reality (211) — a process lesson recorded in §Correction.

**The one-line headline:** instrumented app modals are now cheap (Batch A = 39 calls for two DT121 UI checks; Withdraw/Add/Continue-Onboarding were one-tap), but **Stripe's hosted web flows in system Safari still dominate the budget** (Batch B hosted drive ≈ 148 calls for ONE single-pass onboarding; Batch C hosted Checkout ≈ 63 calls) — and the largest single *new* cost this run was **data staleness after a hosted flow completes** (37 calls in Batch B part 3 to sync a `false` DB row that the app wouldn't refresh).

---

## Call-budget distribution (EXACT, mined — 487 tool calls total)

| Phase | msgs | Exact calls | % of session | Verdict |
|---|---|---|---|---|
| 0. Recon / playbook / memory / persona prep | 0–25 | 54 | 11% | high but mandatory boilerplate (playbook + repo-memory reads) |
| 1. Batch A — DT121 UI (A1 delete-only + A2 resume hint) | 26–60 | 39 | 8% | low — instrumented modals = one-tap |
| 2. Batch B — G01 hosted Stripe Connect drive (part 1: phone/business/bank) | 61–150 | 90 | 18% | **high — hosted-form cost** |
| 3. Batch B — G01 hosted drive (part 2: SSN fight → verified) | 151–208 | 58 | 12% | **high — SSN/canonical-test-value friction** |
| 4. Batch B — return + method-stale sync + set primary | 209–241 | 37 | 8% | **high — staleness resolution (new gap)** |
| 5. Batch B — withdrawal + dispatch check | 242–263 | 26 | 5% | low (DB-proof heavy) |
| 6. Batch C — signup + onboarding (fresh disposable) | 264–306 | 43 | 9% | moderate (wizard taps) |
| 7. Batch C — hosted Checkout card form | 307–368 | 63 | 13% | **high — second hosted-form cost** |
| 8. Batch C — add PM (PaymentSheet) + admin cancel → grace | 369–393 | 25 | 5% | moderate (admin search misdirection) |
| 9. Batch C — grace UI + re-subscribe + dedupe proof | 394–414 | 22 | 5% | low (fresh-fetch + one renewal) |
| 10. Cleanup + report + tracker + memory + handoff | 415–440 | 30 | 6% | low |

**Batch B total = 211** (parts 2–5). **Batch C total = 153** (parts 6–9). **Hosted-web (Stripe Safari) share = Batch B parts 2–3 (148) + Batch C part 7 (63) ≈ 211 calls ≈ 43% of the session.**

Per-tool totals (top): `list_elements_on_screen` 111 · `click_on_screen_at_coordinates` 92 · `run_in_terminal` 73 · `save_screenshot` 33 · `execute_sql` 28 · `view_image` 26 · `read_file` 23 · `grep_search` 29 · `type_keys` 13 · `swipe` 8 · `run_playwright_code` 8.

---

## Phase-by-phase log

### Phase 0 — Recon / playbook / memory (54 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 0.1 | Read mandatory playbook + repo memory | §1 says read `.github/instructions/QA-Test-Agent.instructions.md` + repo memory before first run | `read_file` (playbook, ~7 files) + `memory view` ×several + `grep_search` to find R63–R70 & DT121/122/123 context (12 grep) | full operating context loaded | HIGH-but-mandatory — ~54 calls of pure prep; the R63–R70 search came up empty (rules not codified) so patterns had to be recalled from QA Task 36's log |
| 0.2 | Persona + fixture baseline | R-NEW-4/R-NEW-6 | `execute_sql` ×5 (qa-payout-seller methods/sub/wallet; Connect baseline) | clean baseline (0 methods, active sub) | LOW |
| 0.3 | Verify tool categories + device | mobile-mcp categories reset | `activate_*` ×~8 + `list_available_devices` + `list_apps` (warm WDA) | tools live; full-UUID handle confirmed | MED (boilerplate reset per session, same as QA Task 36 F-7) |

**0-lesson:** prep is ~11% of the session every run. Consolidating the R63–R70 codification + a one-read "current authoritative state" helper would cut this to ~half.

### Phase 1 — Batch A: DT121 UI items (39 calls — CHEAP, the win the instrumentation was for)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 1.1 | Provision method → reach the sheet Delete path | A1 needs a "Cannot Delete Only Method" guard | AX reads + taps on instrumented method card (`kebab-btn-24ddd76a…`) | method card fully instrumented (DT122 I-2 on-device: `continue-onboarding-<id>` CTA present, "Onboarding required" radio) | LOW |
| 1.2 | **PayoutMethodBottomSheet NOT AX-exposed this build** | QA Task 34 drove it via AX; this build it's a native RN Modal in a separate window with no AX | `list_elements` came back blank (status bar only) → **screenshot + OCR + coordinate** for the Delete tap | Delete path reached; A1 assert met | **MED — drivability is build-dependent (§5.31); the one modal DT122 did NOT instrument reverted to pixel work** |
| 1.3 | A1 assert: delete-only alert has **Cancel + "Add a method"** → opens AddPayoutMethodModal | DT121-3 (was a dead-end OK) | tap + AX read | PASS — "Add a method" opened the modal | LOW |
| 1.4 | A2 assert: resume-path success alert shows phone re-verify hint | DT121-4 | Add-modal → Stripe → success alert AX read | PASS — hint copy present | LOW |

**1-lesson:** Batch A was 39 calls for two checks because the Add modal + Withdraw modal are AX-exposed (DT122 I-1). **The one modal that regressed to pixel work was the un-instrumented PayoutMethodBottomSheet** — instrumenting it (testID + `accessibilityRole` on its rows) is the remaining modal ask.

### Phase 2 — Batch B part 1: hosted Express drive, phone → business → bank (90 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 2.1 | Safari resumes hosted session at the phone step | fresh account link; account still at phone | Safari AX readable → tap **"Use test phone number"** | moved to SMS step | LOW |
| 2.2 | "Use test code" | QA Task 36 recipe | tap + type | code 000000 entered, auto-advanced | LOW |
| 2.3 | Personal details Continue → business details | recipe-following | AX taps | progressed | LOW |
| 2.4 | **Industry picker sub-item dropdown NOT AX-exposed** | AX tree stale on the expanded sub-options (shows Retail→Digital products, skips Clothing/Software); screenshot is truth | `screenshot` + `view_image` to see the real expanded list; **used the picker's SEARCH field** → typed "merchandise" → picked "Other merchandise" | selection made, but ~5–6 calls for ONE dropdown row | **MED — hosted sub-item dropdowns need screenshot-truth + search-filter workaround** |
| 2.5 | Description textarea + keyboard | product-description path (learned in QA Task 36: avoid clearing prefilled) | `type_keys` → **Done tap hit Dictation** (accessory coords unreliable) → screenshot the real accessory | eventually saved | **MED — keyboard accessory coordinate drift inside Safari; each dismiss is a screenshot-confirm** |
| 2.6 | Bank autofill + **"Save account with Link"** prompt | Stripe autofilled bank, asked to save | screenshot to locate **"Finish without saving"** precisely → tap | bank added (STRIPE TEST BANK ••••6789) | LOW |
| 2.7 | Reach "Review and submit" — Personal details shows **"Incomplete"** | review page lists a gap | screenshot evidence | progressed to review | LOW (flag raised) |

### Phase 3 — Batch B part 2: the SSN/name fight → verified (58 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 3.1 | **GET `requirements.currently_due` instead of blind-driving "Incomplete"** | F-4 pattern from QA Task 36 (API names the missing field) | scratch node probe (read-only) → account `acct_1UCgIu4…` | `currently_due` = phone + `ssn_last_4` + TOS — **NO `individual.verification.document`** → the DT121 gov-ID gate is GONE (root cause fixed) | LOW (the F-4 pattern paid off — 1 probe) |
| 3.2 | First SSN attempt: **8888 prefill** → name precheck fails → personal "Incomplete" persisted | hosted Express prefilled SSN 8888 | type + Save; editor re-rendered Submit lower (y549 vs my y521 tap) | still incomplete — wasted ~6–8 calls on an SSN value Stripe rejects at precheck | **HIGH — Stripe's canonical test SSN is `0000`, NOT 8888; no UI error, only the persisted Incomplete** |
| 3.3 | Reasoning out the persistence model | "Submit isn't persisting phone/SSN" | checked account state | **learned hosted Express commits data only at the FINAL "Agree and submit"** (intermediate steps collect client-side) | HIGH (had to infer this; ~4 calls) |
| 3.4 | Re-enter SSN as **`0000`** (Cmd+A select-all + retype) + re-touch phone | canonical test value + re-touch to persist | Cmd+A + `type_keys` + tap Submit (HARD GATE: screenshot before tap when keyboard up) | `ssn_last_4` + phone cleared from `currently_due` | MED — SSN fight total ~15–20 calls |
| 3.5 | Scroll to "Agree and submit" → tap | final commit | scroll + tap | **details_submitted=true, charges/payouts_enabled=true, currently_due=[]** — FULLY VERIFIED 🎉 | LOW |

**3-lesson:** the two *values* that matter are now known (SSN `0000`, not `8888`; phone re-touch; commit only at Agree-and-submit). This phase should be ~15 calls next time, not 58 — codify the canonical values in the G01 runbook.

### Phase 4 — Batch B part 3: return + STALE-METHOD sync + set primary (37 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 4.1 | Hosted flow redirects to `/stripe-redirect` → "Open Kids Marketplace App" | DT123 return path | tap | app cold-returned to Payout Settings (DT123 E2E verified) | LOW |
| 4.2 | **Method card STALE — still "Onboarding required" + Continue Onboarding present** | app fetched before completion; R59 → stale until fresh fetch | pull-to-refresh → **still stale** → `execute_sql` | **DB row `stripe_onboarding_complete=false` despite a fully verified Stripe account** | **HIGH — the app's own on-mount sync silently did not fire; pull-to-refresh doesn't sync** |
| 4.3 | Direct `sync-stripe-connect-status` EF call with the persona JWT | the reliable sync path (the app's is not) | scratch node probe + `execute_sql` read-back | DB row now `is_verified=true, stripe_onboarding_complete=true` | LOW (once the right path was chosen) |
| 4.4 | Remount Payout Settings → verified UI | force fresh fetch | relaunch/remount + AX | radio → "Set as primary"; **Continue Onboarding CTA correctly disappeared (DT122 I-2)** | LOW |
| 4.5 | Set primary | G01 step | tap + DB read-back | `is_primary=true` | LOW |

**4-lesson (NEW gap this run):** ~10+ calls (and the risk of a false "it's broken" report) went to reconciling a **`false` DB row after a real hosted completion**. The app does not reliably sync on return-from-onboarding. Instrumentation ask: **call `sync-stripe-connect-status` on the success=true deep-link return** (or on PayoutSettings focus), and/or have the QA helper do it in one step.

### Phase 5 — Batch B part 4: real withdrawal + dispatch check (26 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 5.1 | Fund a controlled $5.00 | sanctioned fixture (`qa:payout-fixture balance`) | run_in_terminal | balance 500¢ | LOW |
| 5.2 | Withdraw Now → **WithdrawModal now AX-exposed** (DT122 I-1) | `withdraw-cancel`/`withdraw-confirm` present | tap Confirm | "Withdrawal Requested" → row `8f085298` (gross 500/fee 26/net 474/processing) + balance→0 | LOW (one-tap — the instrumentation win) |
| 5.3 | Check whether a real Stripe transfer was minted | money-path truth (R24) | node probe (Stripe transfers list) + `execute_sql` | **no transfer minted** — `request_seller_payout` creates the row only | LOW (finding, not friction) |
| 5.4 | Find the dispatcher | is there a trigger? | read migrations/grep | **dispatch trigger fires ONLY on trade completion (`initiate-payout` by trade_id); manual-withdrawal rows (trade_id NULL) have NO dispatcher** | LOW (finding → dev follow-up) |

### Phase 6 — Batch C part 1: fresh-disposable signup + onboarding (43 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 6.1 | Log out qa-payout-seller → Landing | need a fresh disposable | terminate + qa-logout + launch | Landing shown | LOW |
| 6.2 | Sign up the disposable | R41: fresh disposable, no reuse | typed email/pw + Get Started + onboarding wizard taps (Skip onboarding) | user `a9132789…` created | MED — signup wizard is tap-by-tap (~15 taps); a dev-fill equivalent for subscription users would cut this |

### Phase 7 — Batch C part 2: hosted Checkout card form (63 calls — SECOND hosted hotspot)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 7.1 | Mint + open a real Checkout session | D05 recipe | EF create-checkout-session → Safari | `cs_test_…` open, "$5.99/mo", email prefilled | LOW |
| 7.2 | Select the **Card** radio | reveal the embedded card form | tap card row | card fields appear | LOW |
| 7.3 | Enter 4242 → **field misdirection: tapping "ZIP" appended to the CARDHOLDER field** | focus landed wrong | observed "QA Task37 C06850" in cardholder | **~10+ calls lost to wrong-field focus** | **HIGH — hosted Checkout fields are iframe/embedded and misdirect taps** |
| 7.4 | **Cmd+A select-all + retype** per field | the reliable replace technique | `type_keys` with select-all + keyboard suppression (per simulator-keyboard-suppression.md) | 4242 / 12/34 / 123 / cardholder "QA Task37 C" correct | MED |
| 7.5 | ZIP field: **OCR-pin the position** (~pt 605) | keyboard down; ZIP below Country | screenshot → OCR → tap ~(220,605) → screenshot-verify focus | ZIP entered correctly this time | MED — each field = screenshot+verify |
| 7.6 | Submit → Safari "can't open localhost" redirect | success path | — | Checkout COMPLETED → sub `3ec25273` ACTIVE (DB) | LOW (known benign) |

**7-lesson:** the hosted Checkout card form cost 63 calls, dominated by **wrong-field focus (7.3) + the screenshot-verify loop per field (7.5)**. The cardholder→ZIP misdirection is the specific trap; Cmd+A-select-all is the counter. A documented "Checkout card-form recipe" (field order, select-all-per-field, ZIP OCR band) would halve this.

### Phase 8 — Batch C part 3: add PM + admin cancel → grace (25 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 8.1 | Manage Kids Club+ via the registered `manage-kids-club` deep link | warm deep link — worked this time (QA Task 36's F-6 mostly resolved for cold/warm after DT123) | `openurl` | Manage Kids Club+ Active, "No payment method on file" | LOW |
| 8.2 | **"Add Payment Method" button NOT AX-exposed** | locator gap | screenshot → coordinate tap (~pt 515) | native PaymentSheet opened | MED (one locator gap) |
| 8.3 | PaymentSheet: select saved card → Set up | need a PM on the sub for the renewal | taps on native sheet (AX-exposed) | `pm_1UCgvY4…` stored on the subscription | LOW (native sheet instrumented) |
| 8.4 | Admin cancel (real portal :3001) | admin → grace | `open_browser_page` + Playwright: **the first `input` filled was the GLOBAL ⌘K search** (opened the search dialog, not the table filter) → Escape → row-scoped `button:has-text("Cancel")` with `window.confirm` override | `grace_period` / `admin_override` | **MED — the table filter vs global-search misdirection cost ~3 extra Playwright calls** |

### Phase 9 — Batch C part 4: grace + re-subscribe + dedupe proof (22 calls — CHEAP)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 9.1 | Cold relaunch → fresh fetch (R59) | don't trust the stale open screen | terminate + relaunch + `openurl` | Home "Grace Period Active → Re-subscribe Now"; Manage = Grace Period + SP-frozen banner | LOW |
| 9.2 | **Re-subscribe CTA not AX-exposed** → coordinate tap | Home "Re-subscribe Now" + Manage "Re-subscribe to Kids Club+" | screenshot → tap (~y655 first guess missed; y770 on Home correct) | **renewal fired** → "Subscription Renewed" modal | MED — two un-instrumented CTAs, one guess-tap miss (could be testIDs) |
| 9.3 | DB dedupe proof (R24: read every money row) | the DT121 assertion | `execute_sql` on `billing_history` | **EXACTLY ONE row per invoice** (orig in_1UCgva4→1; renewal in_1UCh0p4→1) — QA Task 36's two-row MED CONFIRMED FIXED | LOW (the DB read is the win) |
| 9.4 | Dismiss renewal modal (OK) + post-state | — | AX exposed OK only after a beat → tap | Active + Visa ••••4242 + Auto-Renew on | LOW (1 extra call — modal buttons appear with delay) |

### Phase 10 — Cleanup + report + tracker + memory + handoff (30 calls)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 10.1 | Stripe-side cleanup (customer + Connect account) | R41/BP-70 | node cleanup script (key from admin `.env.local`) | both DELETE HTTP 200 | LOW (Node-only key read avoided QA Task 36's F-8) |
| 10.2 | DB cleanup (disposable + qa-payout-seller residue) | BP-70 | `execute_sql` (transaction + read-back) | all rows 0; qa-payout-seller back to baseline | LOW |
| 10.3 | Tracker update | R52 | read rows + `multi_replace` ×4 (G01 PASS row + strike, D05 append, header) | done | LOW |
| 10.4 | Report + session plan + repo memory + verbatim §8.3 handoff | R53 | `create_file` + memory | done; §8.3 emitted verbatim first pass (read template first — QA Task 36 F-9 avoided) | LOW |
| 10.5 | **Post-run transcript mining for exact call counts** | mid-run estimates undercounted | scratch node miner → exact per-phase ledger | **487 total / Batch B 211 / Batch C 153 — see the correction below** | LOW (the mining itself was ~6 calls and is reusable) |

---

## Correction (important — do not propagate the mid-run estimate)
The report.md + session-plan figure **"Batch B ≈ 110–120 calls (vs QA Task 36's ~130–160)" was a manual mid-run estimate and is materially WRONG.** Mined ground truth: **Batch B = 211 exact tool calls** (Batch B parts 2–5, msgs 61–263). The comparison to QA Task 36 is also **not apples-to-apples**: QA Task 36's numbers were themselves approximate reconstructions, AND QA Task 36's Batch B stopped at the ID-document gate (never did the SSN-fix/verify/return/sync/primary/withdrawal legs that QA Task 37 completed). Lesson: **never report a call-count comparison from a mid-run estimate — mine the transcript at the end** (the miner used here took ~6 calls and can be a reusable QA tool). A corrected note is appended to `report.md`.

---

## Friction events deep-dive (longest / most-call steps and the fix)

### F-1 (biggest): one single-pass hosted Stripe Express onboarding still costs ~148 calls (Batch B parts 2–3)
**What happened:** even with the gov-ID gate gone (DT121) and a single clean pass (no re-drive this session — the only drop was the *deliberate* terminate→cold-deep-link test), driving phone→business→bank→personal-details→Agree-and-submit in **system Safari** cost 148 calls. Sub-frictions: industry sub-item dropdown not AX-exposed (screenshot-truth + search filter, ~5–6 calls); keyboard-accessory coordinate drift (Done→Dictation); the SSN `8888`→`0000` canonical-value discovery + phone re-touch + "commit only at Agree-and-submit" inference (~15–20 calls); screenshot-confirm per field.
**Fix (codify + fixture):** (a) write the **canonical hosted-Express values + order** (SSN `0000`, phone re-touch, `currently_due`-first, commit-at-Agree-and-submit, search-field-for-industry, no-long-press) into the G01 runbook so the next run starts known (target ~60–80 calls); (b) **fixture/EF that completes Express test requirements server-side** (`ssn_last_4`/phone/TOS via the account-update API) would let QA verify the verified-transition without the Safari drive at all.

### F-2 (NEW, biggest single *new* cost): app method-stale after a real hosted completion (Batch B part 3, ~37 calls)
**What happened:** the hosted flow finished (Stripe verified), but the DB row stayed `stripe_onboarding_complete=false`; pull-to-refresh did not sync; the app's own on-mount sync silently did not fire. Resolution required a direct `sync-stripe-connect-status` EF call with a persona JWT + a remount — ~10+ calls and a near-miss on a false "DT122 broken" report (R59 saved it).
**Fix (instrumentation — highest-value new ask):** **call `sync-stripe-connect-status` on the `success=true` deep-link return** (or on PayoutSettings focus/AppState-active), so a completed hosted flow reflects immediately; alternatively a one-call QA helper "sync + verify" step. This removes the whole 37-call part 3 next run.

### F-3: hosted Checkout card form (Batch C, 63 calls)
**What happened:** real Checkout in Safari; dominated by **wrong-field focus** (tapping ZIP appended to the cardholder field — "QA Task37 C06850") and the screenshot-verify loop per field (keyboard up/down changes layout each time).
**Fix (codify):** a **Checkout card-form recipe** in the D05 runbook — Card radio → enter each field with **Cmd+A select-all + retype** (never blind-tap-and-type after the first misdirection), suppress keyboard before coordinate taps, OCR-pin the ZIP band once. Halves this phase.

### F-4: native RN modal AX exposure is build-dependent and inconsistent (Batch A ~1 modal, Batch C CTAs)
**What happened:** DT122 I-1 made the Add-method + Withdraw modals AX-exposed (one-tap — big win), but the **PayoutMethodBottomSheet (a native RN Modal) still does NOT AX-expose** this build (regression vs QA Task 34's session — §5.31 drivability varies), and the Manage Kids Club "Add Payment Method" + grace "Re-subscribe to Kids Club+" buttons have no testIDs.
**Fix (instrumentation):** BP-53-expose the PayoutMethodBottomSheet rows (mirror the DT122 modal fix) + add testIDs to the two Manage-Kids-Club CTAs. Cheap, removes ~3–6 coordinate/OCR calls each occurrence.

### F-5: admin-portal search misdirection (Batch C part 3, ~3 calls)
**What happened:** on `/subscriptions/manage` the first `input` filled was the **global ⌘K search** (opened a dialog) rather than the table filter.
**Fix (pattern):** scope Playwright to the table's own filter input (or Escape-close the global dialog first); target the Cancel by row text. Already known from QA Task 36; still bit once.

### F-6: every-step screenshot-confirm tax (cross-cutting)
**What happened:** across the session, most mobile steps = `list_elements` + `click` + `save_screenshot` + `view_image` to *confirm* the previous action (111 list + 92 click + 33 screenshot + 26 view_image). The confirm loop is the constant tax; it's highest inside Safari where layout shifts with the keyboard.
**Fix (pattern):** batch confirmation — after a string of AX-drivable taps (instrumented surfaces), confirm once, not per tap; reserve screenshot-confirm for Safari/keyboard-shifted surfaces (R-NEW-1 already: first-guess screenshot then proceed).

---

## (a) What slows execution — ranked bottlenecks

| Rank | Bottleneck | Exact cost | Remedy class |
|---|---|---|---|
| 1 | **Hosted Stripe Express onboarding in system Safari** — single pass still ~148 calls (industry dropdown, keyboard drift, SSN canonical value, screenshot-confirm per field) | 148 calls (B2+B3) | codify recipe (F-1a) + fixture/EF completion (F-1b) |
| 2 | **Method-stale after hosted completion** — app doesn't sync on return; pull-to-refresh doesn't sync | ~37 calls (B3) | instrumentation (F-2) — sync on success=true return |
| 3 | **Hosted Checkout card form** — field misdirection + per-field verify | 63 calls (C2) | codify recipe (F-3) |
| 4 | **Recon/prep boilerplate** — playbook + repo-memory reads + tool re-activation | 54 calls | consolidate memory + R63–R70 codification (reduces the grep/search tax) |
| 5 | **Native RN modal / CTA AX gaps** — PayoutMethodBottomSheet + 2 Manage-Kids-Club CTAs | ~3–6 calls each occurrence | instrumentation (F-4) |
| 6 | **Every-step screenshot-confirm loop** (esp. Safari) | cross-cutting | pattern (F-6) |
| 7 | Admin search misdirection | ~3 calls (once) | pattern (F-5) |

## (b) Patterns an agent should adopt proactively

1. **Start a hosted (Safari) flow knowing the canonical values, not discovering them** — SSN `0000` (not 8888), phone re-touch, commit-at-"Agree and submit", `currently_due`-first when Incomplete, search-field for industry sub-items, never long-press Safari fields (QA Task 36 F-3 carried forward). Every value discovered mid-flight cost 5–20 calls.
2. **After ANY hosted-flow completion, treat the app method/DB row as stale until a sync** (R59 + F-2): pull-to-refresh is NOT a sync; call the sync EF (or the sync-on-return instrumentation once it lands) before asserting UI state.
3. **Confirm DB over UI for hosted outcomes, once, and only after the sync** — `execute_sql`/Stripe API read-back is the verdict (R24); screenshots corroborate.
4. **In hosted card/checkout forms, Cmd+A select-all + retype every field** after the first focus misdirection; suppress the keyboard before coordinate taps; OCR-pin a field's band once, not per field.
5. **Batch confirmation, don't confirm-per-step** — on AX-drivable surfaces, chain taps and confirm at the end; reserve screenshot-confirm for Safari/keyboard-shifted surfaces.
6. **Scope admin Playwright to the table's filter input** (or Escape the global ⌘K dialog first) and click row-scoped buttons by row text.
7. **Mine the transcript for exact call counts at the end** — never report a mid-run estimate as a comparison (the ~110–120 vs 211 correction).
8. **Session-start checklist** (activate categories → list devices → confirm persona via DB → confirm admin/Metro → read §8.3 template before any handoff) — absorbs the restart tax once.

## (c) Instrumentation / fixture work that removes the friction (concrete dev asks)

| # | Work | Saves | Owner |
|---|---|---|---|
| I-1 | **Sync-on-return:** call `sync-stripe-connect-status` when Payout Settings loads after a `success=true` deep-link return (or on focus/AppState-active) — closes the stale-method gap | the entire Batch B part 3 (~37 calls) | mobile dev |
| I-2 | **Express test-mode completion fixture/EF** (write `ssn_last_4`/phone/TOS server-side via the account API) so QA verifies the verified-transition without the Safari drive | most of F-1 (~100+ calls) | EF/dev ops |
| I-3 | **G01 runbook canonical-values section** (SSN 0000, phone re-touch, commit-at-submit, industry search-field, Checkout card recipe) | F-1 + F-3 re-discovery each run | docs |
| I-4 | **BP-53-expose PayoutMethodBottomSheet rows** (mirror the DT122 modal fix) | pixel/OCR per method-sheet interaction | mobile dev |
| I-5 | **testIDs on Manage Kids Club+ "Add Payment Method" + grace "Re-subscribe to Kids Club+" CTAs** | ~3–6 coordinate calls each | mobile dev |
| I-6 | **QA transcript-mining helper** (`qa:mine-call-ledger`) to get exact per-phase counts instead of estimates | the correction lesson; ~6 calls | QA tooling |
| I-7 | **QA start-of-run state helper** (persona + methods + sub + Connect `currently_due` in one read) | prep-phase SQL/grep tax | QA tooling |
| I-8 | **Codify R63–R70** into the QA playbook (session checklist; one-tap instrumented modals; hosted canonical values; sync-after-hosted; mine-at-end) | every future session's recall tax | QA playbook (dev agent) |

**Biggest levers:** I-1 removes the newest 37-call cost; I-2 removes most of the oldest (F-1); I-5/I-4 are cheap and kill the remaining coordinate taps. Together they make the next G01/D05-style run a ~150-call session instead of ~487.

---

## Bottom line for future smaller runs
- **Batch A (DT121/DT122 instrumented UI):** CHEAP (39 calls) and stable — the modal-AX work paid off. Only the PayoutMethodBottomSheet regression (I-4) remains.
- **Batch B (G01):** the terminal gate is gone (DT121) and the flow is now completable on-device end-to-end — but it is still **Safari-bound and call-heavy** (211 calls). Re-drive only for regression after I-1/I-2 land; until then, codify the canonical values (I-3) so the hosted drive is ~half its current cost.
- **Batch C (billing dedupe):** the recipe is proven and the dedupe assertion is cheap once the disposable + Checkout are standing (dedupe proof itself ≈ 3 DB calls). Its 153 calls are almost entirely the signup wizard (6.2) + hosted Checkout card form (F-3).
- **The generic, reusable wins** (I-1 sync-on-return, I-4/I-5 AX, F-2/F-3 recipes, I-6 mining helper) benefit every future batch — they are not G01-specific.

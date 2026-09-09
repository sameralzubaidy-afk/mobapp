# QA Task TRD-R1b — Full Decision-and-Outcome Log

**Purpose:** Mineable record of the executing agent's **actions, reasoning, key tool calls, and outcomes** for QA Task TRD-R1b (FIX-Task-7 close-out + Group J first-Android-execution + TRD Round-1 continuation). Feed this file to an AI agent to derive (a) what slows execution, (b) proactive patterns, (c) instrumentation/fixture work that removes friction — so smaller future runs do not re-spend the same time and calls.

**Run:** `e2e-test-results/qa-task-trd-r1b-2026-09-08/` · **Date:** 2026-09-08 (ended 2026-09-09 00:0x UTC) · **Repo HEAD:** `62238ea4` (FIX-Task-7 committed, clean tree) · **Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` · **LLM:** DeepSeek V4 Flash · **Platforms:** iOS Simulator (iPhone 17 Pro Max, stable all session) + Android Emulator (`Medium_Phone_API_36.1`, became unstable mid-session) · **Admin portal** :3001 (active page, samer)
**Source basis:** written from the agent's session memory (`/memories/session/qa-trd-r1b-2026-09-08.md`), the run `report.md`/`ledger.md`, and the agent's own per-episode call tally. **The tool transcript was NOT mineable** (pointer-only `main.jsonl` — R71), so call counts are best-effort per-episode tallies, accurate to roughly ±3–5 calls; the relative ordering and per-episode drivers are reliable.

---

## 0. Executive cost profile

| Metric | Value |
|---|---|
| Total tool executions (manual tally) | **~400+** |
| Verdict-class items | ~17 (PASS×16, PARTIAL×1, deferred Part 3 as 1 scope item) |
| Calls / verdict | **~23** (above the 43c 9.6 baseline — flagged per brief) |
| Clean-flow per-verdict cost | ~10–12 (iOS real-UI flow, Group J cancels) |
| Dominant cost classes | iOS native rebuild (~15–18) · iOS comprehensive real-UI flow (~90/8 verdicts) · UX-5c auto-resubmit chase (~20) · Android emulator instability (~25–30 wasted) · Group J fixture+restore (~55) · admin cleanup (~20) · recon/tracker/report (~40) |

**Highest-leverage story of the round:** one environment fix (iOS native rebuild, ~16 calls) unblocked a whole previously-BLOCKED platform; one real-UI flow carried 8 verdicts; one dev defect (UX-5c auto-resubmit stale cap) cost ~20 calls to characterize; one emulator dev-tooling crash cost ~25–30 calls and forced the Part-3 deferral.

---

## 1. Phase-by-phase decision-and-outcome log

Each episode: **Trigger → Reasoning → Tool calls that mattered → Outcome** (+ approximate call cost).

### Phase 0 — Recon (R78-1) — ~15 calls

- **Trigger:** Huge 3-part brief (FIX-Task-7 close-out + Group J + 57-case continuation).
- **Reasoning:** R78-1 recon-first; read prior-round facts before any prep. The brief itself said iOS was BLOCKED-ON-BUILD and Group J was never-run, so recon would tell me the exact resume point and the fixture/persona constraints before touching devices.
- **Key calls:** read QA-Test-Agent playbook head; read repo memories (`qa-test-agent.md`, `qa-test-accounts.md`, `fix-task-7…`, `schema-cheat-sheet.md`); read the 3 most-recent TRD/FIX-Task-7 run reports (`qa-task-trd-r1-android`, `qa-task-trd-r1-fix7-reverify-android` + `-ios`, `qa-task-cleanup1`); environment snapshot (booted sims, `adb devices`, git HEAD/status); port-8081/Metro + DerivedData mtime + scheme list.
- **Outcome:** Established (a) the P1 fix was already Android-verified and iOS was the gap; (b) the iOS prebuilt `.app` was stale (netinfo missing) and the exact prior build failures; (c) Group J had never run on Android and test-seller was already cancel-flagged; (d) no open trades existed between test personas (clean slate). Recon collapsed later prep.
- **Lesson:** recon-first worked; the single highest-leverage DB fact (test-seller at count 6 + flagged) came from the persona-account memory, saving a doomed Group-J-on-test-seller attempt.

### Phase 1 — iOS native-build environment fix (Part 1a prerequisite) — ~15–18 calls (ONE-TIME but decisive)

- **E1 · Trigger:** brief's documented remedy = clean `npx expo run:ios` with `SENTRY_COPY_OPTIONS_FILE=false`.
  - **Reasoning:** try the documented remedy exactly first (async, capture to log).
  - **Key calls:** async `npx expo run:ios` (piped `tail -60`) → completed with `CommandError: No code signing certificates are available`.
  - **Outcome:** same blocker as the FIX-Task-7 iOS round — `expo run:ios` insists on signing even for a simulator build. Cost ~2 calls.
- **E2 · Reasoning:** the prior round proved direct `xcodebuild … CODE_SIGNING_ALLOWED=NO` compiles pods; route around the CLI signing check. Recon'd the scheme (`xcodebuild -list` → main scheme `PassItUp`) + checked DerivedData for `sentry.options.json` (absent). Cost ~2.
- **E3 · Trigger:** first direct xcodebuild (async, full log to `/tmp/qa-trd-r1b-ios-build.log`).
  - **Reasoning:** write FULL output to a log so a `tail`/grep can diagnose (prior round's error was truncated by the build's own tail).
  - **Key calls:** `SENTRY_COPY_OPTIONS_FILE=false xcodebuild … build > log; echo EXIT=$?` → grep log for `error:|BUILD FAILED`.
  - **Outcome:** **BUILD FAILED** at "Bundle React Native code and images" — but now the JS `export:embed` step SUCCEEDED (prior round's blocker gone) and the ONLY failure was `sentry-cli … An organization ID or slug is required`. The log line itself printed the fix: *"To disable source maps auto upload, set `SENTRY_DISABLE_AUTO_UPLOAD=true`"*. Cost ~3.
- **E4 · Reasoning:** the tool told me its own fix — add `SENTRY_DISABLE_AUTO_UPLOAD=true` and rerun (incremental; pods already cached).
  - **Key calls:** rerun with both env vars → `** BUILD SUCCEEDED **` (exit 0).
  - **Outcome:** environment fix FOUND: the brief's single var was insufficient; **two** vars are required (`SENTRY_COPY_OPTIONS_FILE=false` clears the options-file copy phase; `SENTRY_DISABLE_AUTO_UPLOAD=true` clears the sourcemap-org upload). Cost ~2.
- **E5 · Install + launch + screenshot** → fresh `.app` boots to the Welcome carousel, no `RNCNetInfo null` / no "App entry not found". **iOS BLOCKED-ON-BUILD closed.** Cost ~3.
- **Lesson (bottleneck class B1):** iOS native rebuilds are a recurring multi-call wall because `expo run:ios` can't sign and the Sentry phase needs 2 env vars. Reading the FULL build log (not the truncated tail) is what surfaced the fix.

### Phase 2 — iOS comprehensive real-UI flow carrying 8 verdicts (Part 1a) — ~90 calls

**Strategy decision (the round's best cost lever):** instead of 8 separate case flows, drive ONE genuine flow (buyer SP offer → seller accept → in_progress → real-UI dispute → admin resolve) and read every Part-1a verdict off it: Item-3 copy, UX 5a/5b, E01/E03, E02/D02, E04, H02, I06.

- **E6 · login test-buyer (iOS)** via `qa-login-as` deep link → poll Home. ~3.
- **E7 · item deep-link trap (FIRST miss):** deep-linked to Remote Control Car with a **short UUID prefix** (`…/listing/35e3a900`) — pattern borrowed from a prior 43L run that used a prefix.
  - **Reasoning:** assumed the prefix form worked (43L used `/listing/73670a8f`).
  - **Key calls:** `xcrun simctl openurl …/listing/35e3a900` → tree showed "❌ Listing not found"; later a LogBox surfaced `[listing] getListingById … invalid input syntax for type uuid: "35e3a900"` (22P02).
  - **Outcome:** WRONG — item deep links need the FULL UUID; the short form is an invalid-uuid param (SQL error, not an app defect) that ALSO plants a LogBox entry to dismiss later. Cost ~3 (bad link + re-link + later LogBox dismiss).
  - **Lesson (bottleneck class B3):** source-verify deep-link param format before driving; treat "not found + later LogBox 22P02" as a bad-param artifact.
- **E8 · full-UUID deep link** → item detail loads. ~2.
- **E9 · Make Offer:** SP field focus → type `8` → **per-field re-list verify** (§5.2: confirm value landed) → value-stack showed $17 + 8 SP + fee $1.49 + tax $1.75. Keyboard discipline (re-list after focus). ~5.
- **E10 · Send → Liability Disclaimer modal:** checkbox tap at row center (220,824) → verify `value=checked` → Accept. **Captured the CRITICAL Amazon-content finding on iOS** (I06 re-confirmed, cross-platform shared policy). ~4.
- **E11 · Trade Initiated** — `cta-message` "Got it! You saved $8.00… You have 474 SP available" (H02). Screenshot. ~2.
- **E12 · switch to test-seller** (qa-login-as) → My Trades → Review Offer row → captured **Item-3** "15 SP releasing in **3 days** after completion" (live SP offer). Accept → **native "Offer Accepted!" alert** (AX tree blank → screenshot → tap OK at the documented iPhone-17-Pro-Max anchor ~y530). ~8.
- **E13 · switch back to test-buyer** → trade deep link (`…/trade/<id>`) does NOT open the timeline directly (lands on My Trades) → tap View Trade → Trade Timeline → **UX 5a** pinned `confirm-trade-button` (stays fixed during scroll) + **UX 5b** collapsed SafeMeetup (`safe-meetup-toggle`). ~6.
- **E14 · Report a Problem** → reason modal (not AX-exposed on iOS → OCR the no-show row at ~y540) → Submit → **dispute filed; `disputed_at` SET** on the real iOS path (P1 fix confirmed platform-side). DB verify. ~6.
- **E15 · E03 buyer banner + disabled CTA:** dispute banner captured; tapped the pinned I Got It — **no modal, DB unchanged** → functionally disabled. Source check revealed the disabled style is **50%-opacity on the green pill** (not a gray) — resolved the "green-looking but disabled" ambiguity by reading the style, not more UI taps. ~5.
- **E16 · E02/D02 fast-clock:** `UPDATE auto_complete_at=now()+5s` → `rpc_process_auto_complete(100)` → `auto_completed_count: 0`; trade in_progress, item available, 0 seller_payouts. ~3.
- **E17 · E04 seller view:** switch to test-seller → View Trade → **role-aware banner** ("A buyer has reported an issue…") — confirmed the Android-reverify LOW finding is RESOLVED at HEAD (source L1262-1264). ~5.
- **E18 · admin cleanup of the fixture trade** — see Phase 3.
- **Cost note:** ~90 calls / 8 verdicts ≈ 11/verdict — efficient per-verdict, but the ABSOLUTE cost is high because every step rides one long flow with persona switches (~3 switches × settle) and the disclaimer/alert dances repeat. This is the standard "one-flow-many-verdicts" pattern to keep, plus the fixture-driven replacements in §5.

### Phase 3 — Admin portal cleanup (resolve-refund) — ~20 calls

- **Trigger:** the iOS fixture trade `1ba3745c` (real Stripe PI `pi_3UDYVy4…`) must be cleaned so test-seller's item returns to available.
- **Reasoning (R81, §5.71):** admin clicks need an ACTIVE page. The only shared page was "(not visible)" (background tab — never passes actionability). Open a FRESH active page to the same origin (session shared per-origin).
- **Key calls:** `open_browser_page` (forceNew) → redirected to login → login samer (documented staging creds) → navigate `/trades/disputes?status=reported` → **click-tool actionability failed** (sidebar `<aside>` intercepts pointer events on every retry) → **DOM click fallback** `page.locator('[data-testid="btn-dispute-resolve-refund-…"]').evaluate(el => el.click())` with `window.confirm=()=>true` overridden → DB verify.
- **Outcome:** trade cancelled/`resolved_buyer`, PI cancelled (`cancelled_pi_…`), item relisted, 0 payout, admin_audit_logs actor `1a546991`, test-buyer SP back to 482/0 reserved. Clean.
- **Lesson (bottleneck class B4):** trade cleanup still needs the whole admin-portal dance (fresh active page + login + DOM-click workaround). A one-shot "resolve disputed trade" fixture/EF would remove ~15 of these 20 calls (see FIX-8).

### Phase 4 — Group J recon + persona decision — ~10 calls

- **Trigger:** Group J (J01–J05) never tested on Android; brief warned not to consume test-seller's post-acceptance-cancel counters.
- **Reasoning (R78-3, source before driving):** read the guide bodies (J01–J05) AND the source for the consequence mechanism before building anything.
- **Key calls:** guide Group-J bodies; `grep` TradeTimelineScreen for the cancel block (`seller-cancel-inprogress-button` under `isSeller && in_progress && !hasUnresolvedDispute`); `grep` for the Level-alert copy → **found `DEPRECATED(TFV2-023)` comment** ("Seller-facing Level 1/2/3 consequence alerts removed… backend counter and admin flag still fire silently"); traced `cancelTradeV2` → `consequenceLevel` returned but never displayed; traced the EF `cancel-trade/index.ts` → `fn_handle_seller_cancellation`; read migration `20260528000012_seller_cancel_consequences.sql` (counter +1; ≥3 sets `admin_review_flagged_at`; returns level).
- **DB persona check:** test-seller count **6 + flagged 2026-08-30** (unusable — confirmed brief's caution); test-seller-2 count **0/flag NULL** (clean); test-seller-3 count 2 (not clean for J01).
- **Decision:** use **test-seller-2** (secondary, low-load) rather than a UI throwaway (execution-only can't cheaply provision a throwaway seller with listings), with a documented **post-run restore** (count→0, flag→NULL) matching the dev E2E spec's own reset pattern. test-seller untouched.
- **Outcome:** consequence mechanism fully mapped BEFORE any device time — zero wasted device calls on the level semantics. This is the R78-2/R78-3 pattern paying off.

### Phase 5 — Group J execution (Android) — ~55 calls

- **E19 · fixture build:** `qa:r41-in-progress-trade create --seller test-seller-2` ×3 → T1 `7478ebab`, T2 `364d5b51`, T3 `c3f04bc0`. (3 calls — the sanctioned fixture path.)
- **E20 · login test-seller-2 (Android)** + My Trades → **surprise:** the 3 in_progress fixture trades appear under "Needs Action" with Review-Offer rows, and the summary shows "In Progress: 0".
  - **Reasoning:** DB already proved status=in_progress; so the LIST presentation is a fixture/list artifact — don't trust the list filter; try the timeline directly.
  - **Key calls:** DB re-verify (in_progress, buyer test-buyer, seller test-seller-2) → deep link `…/trade/<id>` → **mixed UI**: status banner "In Progress" + `seller-cancel-inprogress-button` present, BUT timeline content cards read "Awaiting Seller" (pending copy).
  - **Decision:** the action I need (seller cancel) is drivable — the contradictory content card is a synthetic-fixture artifact (direct-insert trade lacks the accept-event markers the step-model expects). Proceed via deep link + scroll.
  - **Lesson (bottleneck class B5):** r41 in_progress fixtures are buyer/dispute-oriented; their seller-list + content presentation is misleading. Drive seller actions via the trade deep link, and note the artifact instead of "fixing" it.
- **E21 · J05 + J04 (recon on T3):** scroll to `seller-cancel-inprogress-button` (below fold, needs an anchored swipe) → tap → **CancellationReasonModal (Android AX-exposed)** → captured seller-only reasons ("Can't do pickup" / "Item no longer available" / "Other") → J05 evidence. ~6.
- **E22 · J01 (T3):** cancel (Can't do pickup) → confirm → **generic "Trade Cancelled" notification** (NOT a Level alert — confirms the deprecation finding on-device) → DB counter 0→1. ~6.
- **E23 · J02 (T2):** deep link → scroll → cancel (Item no longer available) → generic notif → counter 1→2. ~6.
- **E24 · J03 (T1):** deep link → scroll → cancel (Can't do pickup) → generic notif → counter 2→3 + **`admin_review_flagged_at` SET**. ~6.
- **E25 · J04 negative:** My Trades → Completed tab → Science Kit trade → **no** seller-cancel button (only "Review the Buyer"). Pending/buyer negatives source-gated. ~6.
- **E26 · cleanup:** `qa:r41-in-progress-trade reset` (deleted 3 trades + items) + restore test-seller-2 counter/flag (DB-verified). ~4.
- **Cost note:** ~55 calls for J01–J05 + fixture + restore ≈ 11/case. The scroll-to-cancel dance (deep link → swipe → tap) repeated 3×; a scroll-to-element primitive would cut ~2–3 calls per cancel.

### Phase 6 — UX 5c on-device drive (Part 1b) — ~45 calls (the round's second-biggest cost sink)

- **Strategy pivot:** the brief wanted 1b driven on-device; after the Android emulator began failing (Phase 7), I moved 1b to the **stable iOS** platform (platform not mandated for 1b).
- **E27 · fixture (cheap):** 3 pending offers test-buyer→test-seller via `qa:ef-repro` (RC Car `bb544703`, Skateboard `39c0d0e3`, Soccer `58b34f46`) — 3 calls (the sanctioned EF path replaced ~90 calls of UI offer-driving).
- **E28 · 4th offer via real UI:** deep link Roald Dahl → Send → disclaimer → accept → **cap modal** appeared ("Too Many Open Offers / You have 3 pending offers… Open offers: • Soccer • Skateboard • RC Car") with `offer-limit-cancel-oldest-button`. Screenshot. ~8.
- **E29 · tap "Cancel My Oldest Offer"** → **DB: RC Car `bb544703` (oldest by `offer_expires_at`) CANCELLED** with the exact reason "Buyer cancelled oldest offer to free a slot for a new offer"; Skateboard + Soccer stay pending (3→2). **Core UX-5c assertion PASS.**
- **E30 · THE COST SINK — auto-resubmit chase (~20 calls):** after cancel-oldest, the flow re-presented the disclaimer (unchecked) — I accepted → **LogBox** "[trade] createTradeOfferWithHold invoke error: You have 3 pending offers". DB showed **2** pending. Disclaimer re-presented again → accepted → still no offer.
  - **Reasoning path (in order):** (1) DB count = 2 ⇒ the cap claim is suspect; (2) read `handleCancelOldestOffer` source → it calls `handleSendOffer()` after the cancel, and clears `offerLimitPendingOffers` via `setState` immediately before — a **stale-client-count race** hypothesis; (3) tiebreaker = **direct EF call** (`qa:ef-repro` on Roald Dahl) → **SUCCEEDED** (trade `7662e9a2` pending) ⇒ server count is correct and the slot IS free ⇒ the failure is client-side stale state, not a server bug.
  - **Outcome:** root-caused as a dev defect (auto-resubmit races the freed slot / reads a stale pending list) — the cancel-oldest itself is correct. Cost ~20 calls including the disclaimer re-entry loop and LogBox dismissals.
  - **Lesson (bottleneck class B2):** when the app says "X" but the DB says "Y", the **direct EF call is the cheap decisive tiebreaker** — reach for `qa:ef-repro` immediately instead of re-driving the UI to confirm.
- **E31 · evidence screenshot:** re-trigger the cap modal (Send → disclaimer → accept → modal) → screenshot → dismiss via OK (NOT cancel-oldest again — avoid re-entering the loop). ~6.
- **E32 · cleanup:** `qa:reset-offer-fixtures` cancelled the 3 fixtures + reset listings. `bb544703` left cancelled as evidence. ~3.

### Phase 7 — Part 1c (Item-3 Android leg) + Android emulator instability — ~25–30 calls, mostly wasted

- **E33 · login test-buyer (Android)** → deep link RC Car → **"Loading item…" stall** (persistent across polls).
  - **Reasoning:** DB check proved the item is healthy (available, SP-eligible, 0 open trades) ⇒ not a data problem; suspected client/network stall.
  - **Key calls:** DB item-state check; retry deep link (×2); BACK; screenshot (still "Loading item…"); device logs (login OK, no fetch error surfaced = silent hang).
- **E34 · relaunch attempts:** app **exited to the launcher** (process exit); relaunch via Dev Launcher → crash on bundle load; **crash report = SIGSEGV in `libart.so` during `art::ti::AgentSpec` attach** (Hermes/JVMTI debug-agent attach crash) — a dev-tooling crash, NOT app code.
  - **Reasoning decision:** this is the known dev-client debug-agent instability class; re-launch retries will keep crashing. **Pivot:** move UX 5c to iOS (done, Phase 6), and **defer** the 1c Android screenshot leg with an explicit deferral row naming that iOS already carries the verdict + the single missing leg (per the freshly-extended R80).
- **Outcome:** 1c = PARTIAL (Android env-blocked; iOS/source/config evidence strong). Part 3 breadth deferred explicitly.
- **Lesson (bottleneck class B6):** detect the dev-tooling crash signature from the crash report EARLY and pivot/defer instead of ~4–5 relaunch retries (~25–30 calls lost).

### Phase 8 — Tracker reconciliation (Part 1d) — ~10 calls

- **Trigger:** E02/D02 still showed 🔴 STILL OPEN in the tracker despite the FIX-Task-7 closure.
- **Reasoning:** read the exact row text; batch multi-row edits.
- **Key calls:** `multi_replace` on D02/E03/E04/J01–J05 (applied) + J01/J02/J03/J05 second batch; E02 failed exact-match → **retried with a shorter oldString** → applied. Roll-up line (PASS 232→234, OPEN 4→2) + dated R1b note.
- **Lesson (friction):** exact-match row edits fail on subtle whitespace; use a minimal unique oldString for tracker rows.

### Phase 9 — Report / ledger / §8.3 handoff + apply-handoff rule — ~15 calls

- Wrote `report.md`, `ledger.md`; emitted the full §8.3 handoff (R53); applied the apply-handoff rule suggestion (extended QA-playbook R80 to deferral rows; QA-agent-file §4 dated pointer; repo-memory note).
- **Lesson:** rule suggestions were applied in-turn (not deferred), per the same-turn commit lesson.

---

## 2. Call-cost episode table (ranked by cost)

| # | Episode | ~Calls | Verdicts/value | Bottleneck class | Fix class |
|---|---|---|---|---|---|
| 1 | iOS comprehensive real-UI flow (8 verdicts) | ~90 | 8 PASS (11/verdict — efficient) | B7 (absolute cost of long UI flows) | FIX-4/5 fixtures; keep one-flow-many-verdicts |
| 2 | Group J fixture + 3 cancels + restore | ~55 | J01–J05 (11/case) | B5 (fixture list/content artifact; scroll-to-cancel) | FIX-5 fixture; FIX-9 scroll primitive |
| 3 | UX-5c fixture + cap modal + **auto-resubmit chase** | ~45 | UX 5c (core PASS) | **B2 (client-vs-DB contradiction)** | FIX-1 dev fix; FIX-4 fixture |
| 4 | Android instability churn (1c leg) | ~25–30 | 0 (deferred) | **B6 (dev-tooling crash)** | FIX-7 emulator health |
| 5 | Admin portal cleanup (resolve-refund) | ~20 | 1 cleanup | B4 (admin dance) | FIX-8 cleanup fixture |
| 6 | iOS native rebuild (env fix) | ~15–18 | unblocks whole platform | B1 (build wall) | FIX-3 committed build cmd |
| 7 | Recon (Phase 0) | ~15 | — | — | keep |
| 8 | Tracker + report + handoff + rule apply | ~25 | — | — | keep |

---

## 3. (a) WHAT SLOWS EXECUTION — bottleneck analysis (ranked, with root cause + the fix that removes it)

- **B1 · iOS native-build wall (~15–18 calls, recurring on every platform rebuild):** `npx expo run:ios` cannot sign (CLI insists) and the Sentry RN phase needs TWO env vars (`SENTRY_COPY_OPTIONS_FILE=false` + `SENTRY_DISABLE_AUTO_UPLOAD=true`). Root: expo-CLI signing check + Sentry sourcemap-upload org config absent in the debug build. **Fix → FIX-3** (commit the 2-var xcodebuild as a task/script, or fix signing/Sentry org so `expo run:ios` works).
- **B2 · Client-vs-DB contradiction chasing (UX-5c, ~20 calls):** app reported "3 pending" while the DB had 2; resolving it took a source read + re-drive + a direct EF tiebreaker. Root: dev defect (auto-resubmit reads stale pending state) **and** the absence of a cheap client-error surface (only a LogBox dev error). **Fix → FIX-1** (dev fix) + **QA pattern P2** (direct EF call as the immediate tiebreaker).
- **B3 · Deep-link format traps (~3–6 calls each + later LogBox dismissals):** short-UUID item deep links silently produce a 22P02 (invalid uuid) and plant a LogBox entry; trade deep links land on My Trades (need a View-Trade tap). Root: handler requires full UUID; no friendly param error. **Fix → FIX-6** (accept prefix or friendly no-op); **QA pattern P4** (source-verify param format before driving).
- **B4 · Admin portal dance for trade cleanup (~20 calls):** fresh active page (R81) + login + DOM-click workaround for the sidebar intercept, for every cleanup. Root: no cleanup fixture/EF; sidebar intercepts pointer events. **Fix → FIX-8** (one-shot resolve-dispute cleanup); keep R81 active-page discipline.
- **B5 · Synthetic-fixture UI artifacts (Group J, added ~2–3 calls/cancel + confusion):** r41 in_progress trades present as pending/review in the seller's list and render "Awaiting Seller" content on the timeline. Root: direct-insert fixture lacks accept-event markers. **Fix → FIX-5** (a seller-cancel-aware fixture); **QA pattern P5** (judge drivability by the needed action, note the artifact).
- **B6 · Emulator dev-tooling crash (~25–30 calls lost):** SIGSEGV in `libart.so` on Hermes/JVMTI debug-agent attach → repeated launcher exits + item-detail fetch stalls. Root: dev-client debug-agent instability (not app code). **Fix → FIX-7** (health pre-check + cold reboot before long Android batches; detect crash signature early and pivot).
- **B7 · Absolute cost of long UI flows (~90 calls for 8 verdicts):** unavoidable UI driving for real-path evidence (per-verdict ~11 is good), but each extra verdict that needs a REAL flow costs ~40+ more. **Fix → FIX-4** (offer/cap fixtures), **FIX-5** (trade fixtures), and the standing one-flow-many-verdicts pattern (P1).
- **B8 · LogBox pauses on dev console noise (recurring, ~2–4 calls each):** background `[ReferralNotifications] Fallback unread count failed` console.error fires the LogBox mid-flow (X entries to dismiss). Root: a noisy dev-only console.error on a normal background path. **Fix → FIX-2.**

---

## 4. (b) PATTERNS AN AGENT SHOULD ADOPT PROACTIVELY

- **P1 — One real flow carries many verdicts:** read every verdict of a platform/group off a single genuine flow (offer→accept→in_progress→dispute→resolve carried 8 verdicts in ~90 calls). Never drive one case per flow when the states chain.
- **P2 — DB + direct EF as the immediate tiebreaker:** whenever the app says X but the DB says Y (cap counts, balances, statuses), run the DB count and then the **direct EF call (`qa:ef-repro`)** — it distinguishes server behavior from client state in 1–2 calls. Reached for it late in UX-5c; use it first next time.
- **P3 — Full build-log capture + grep, not truncated tail:** the fix was printed by the tool's own error text; write async build output to `/tmp/<run>-build.log` and `grep` for `error:|BUILD FAILED` + the suggested env-var remedy.
- **P4 — Source-verify deep-link param formats before driving** (full UUID for item links; trade links don't land on the timeline directly); treat "not found" + a later 22P02 LogBox as a bad-param artifact, not an app defect.
- **P5 — Judge synthetic-fixture drivability by the ACTION you need, not the content:** an r41 in_progress trade's seller list/content looks "pending", but the seller-cancel button renders and the backend sees `in_progress` — drive via deep link and note the artifact rather than abandoning the fixture.
- **P6 — Detect dev-tooling crashes early and pivot/defer:** on repeated launcher exits, read the crash report; a SIGSEGV in `art::ti::AgentSpec` = Hermes/JVMTI attach crash (dev-tooling, not app) → stop relaunching, pivot to the stable platform or defer with an explicit deferral row (extended R80).
- **P7 — Recon persona counters/flags via DB BEFORE choosing the persona** (test-seller at count 6 + flagged → never consider it for escalation). Pairs with R78-2.
- **P8 — Track per-episode call costs as you go** (this log) so the post-run bottleneck analysis is cheap and exact instead of a manual tally.
- **P9 — Prefer the sanctioned EF/fixture path for setup:** 3 `qa:ef-repro` offers replaced ~90 calls of UI offer-driving for the cap fixture; `qa:r41-*` created trades in 1 call each.
- **P10 — Persona-restore as part of the same run:** when a shared persona's counter is consumed (Group J), restore it (count→0/flag→NULL) and DB-verify before the run ends — never leave a shared persona flagged.

---

## 5. (c) INSTRUMENTATION / FIXTURE WORK THAT REMOVES THE FRICTION (ranked)

- **FIX-1 (dev — highest value, ~20-call sink):** `TradeOfferScreen.handleCancelOldestOffer` → `handleSendOffer` auto-resubmit reads a stale per-seller pending count after the cancel commits; refetch the count (or await the cancel's visibility) before re-sending so the one-tap UX-5c flow completes instead of rejecting "3 pending".
- **FIX-2 (dev — recurring flow interrupt):** stop the noisy dev-only console.error that fires the LogBox on normal background paths (`[ReferralNotifications] Fallback unread count failed`) — a background fetch failure should not pause every flow with a LogBox.
- **FIX-3 (dev/ops — unblock every future iOS rebuild):** commit the working simulator build as a script/task (`SENTRY_COPY_OPTIONS_FILE=false SENTRY_DISABLE_AUTO_UPLOAD=true xcodebuild … CODE_SIGNING_ALLOWED=NO`), or fix `expo run:ios` signing + the Sentry sourcemap org so a plain `expo run:ios` works.
- **FIX-4 (fixture — remove the multi-offer build):** a one-shot "per-seller cap" fixture (create N pending offers to one seller + return the target item) so UX-5c/B05-class drives don't need 3 manual EF offers + a UI drive each time.
- **FIX-5 (fixture — remove the Group-J fixture dance + shared-persona concern):** a sanctioned "seller-cancel consequence" fixture that (a) creates in_progress trades under an ARBITRARY seller (not just registered personas) and (b) has a `reset` that restores that seller's `post_acceptance_cancellation_count`/`admin_review_flagged_at`, so a genuinely disposable persona can be used and restored in one command.
- **FIX-6 (QA tooling):** item deep links should accept a short prefix (resolve by prefix) OR fail with a friendly in-app no-op — never an SQL 22P02 that only surfaces as a LogBox.
- **FIX-7 (QA tooling/ops):** emulator health pre-check + cold-reboot before long Android batches; document the Hermes/JVMTI-agent-attach crash signature and its recovery (restart Metro / reboot emulator) so a future session pivots at the first crash instead of after ~25 wasted calls.
- **FIX-8 (QA tooling):** a one-shot "resolve disputed trade" cleanup (resolve-refund for a trade id) so per-trade cleanup doesn't require the admin portal login + active-page + DOM-click dance (~15 of ~20 calls).
- **FIX-9 (QA tooling — already requested elsewhere):** `qa:ax-tree --coords` and a **scroll-to-element primitive** — the timeline scroll→re-list→tap cycle repeated ~3× per Group-J cancel (~2–3 calls each).
- **FIX-10 (QA tooling):** tracker row edits via a stable row key (or unique minimal oldString guidance) — one E02 edit failed exact-match and needed a retry.

---

## 6. Friction vs. operating rules (§5) observed

- §5.2 keyboard/per-field verify: held (SP input re-verified); no field-corruption relaunch needed.
- §5.4 dialog handling: disclaimer = AX-exposed (checkbox fast-path held); native "Offer Accepted!" alert blanked the AX tree → OCR + the y≈530 device anchor (QA Task 11 data point reused successfully).
- §5.71 R81: held — admin cleanup required a fresh ACTIVE page; the shared "(not visible)" page was never clickable.
- LogBox (§5.8 env-blocker): fired 3× on dev noise (ReferralNotifications fallback; invalid-uuid artifact) → each cost dismiss cycles → FIX-2.
- R15 (idempotency/re-offer caution): the UX-5c 4th offer was on a fresh listing (Roald Dahl) with no prior buyer history — no Stripe collision.
- Tracker R52 (§5.54): full reconciliation done; one exact-match edit retry.

---

## 7. Cross-references

- Full verdict detail + findings: `report.md`
- DB/fixture/ledger read-backs: `ledger.md`
- Evidence screenshots: `screenshots/` (iOS: item-3 "3 days", E03/E04 banners, UX5a/5b/5c; Android: J05 reasons, J01 notif, J04 completed-no-cancel)
- Rule apply-handoff from this session: QA playbook §5.70 R80 extended (deferral rows carry platform-verdict disclosure); QA agent file §4 dated pointer (2026-09-09); dated consolidation `/memories/repo/qa-test-agent.md` (2026-09-08 TRD-R1b entry).

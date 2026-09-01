# QA Task 17 (v4) — Decision-and-Outcome Log

**Purpose:** Feed to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — every key action, the reasoning behind it, the tool calls that mattered, and the outcome — and derive (a) what slows execution, (b) what patterns an agent should adopt proactively, (c) what instrumentation/fixture work removes the friction.

**Run:** 2026-09-01 (≈19:40–21:40 UTC), device iPhone 17 Pro Max sim `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, staging `drntwgporzabmxdqykrp`, admin portal `:3001`.
**Scope:** DT78/79/80/81 spot-checks + Group Z (Z01–Z08) + G05/G06/G07 notifications. **Result: 19 PASS / 2 FAIL / 0 BLOCKED / 0 SKIPPED.**

---

## 1. Call-budget overview (estimated, ~330–400 tool calls for the whole run)

| Phase | Est. calls | What dominated the calls |
|---|---|---|
| Batch 1 (buyer: C1/C3/D1/D2/D3) | ~70–90 | PaymentSheet card adds, profile/manage-Kids-Club navigation, cross-screen card checks, disclaimer re-open incident |
| Batch 2 (seller: A1/A2/B2/C2 + fixture building) | ~60–80 | ef-repro offer creation + **stale Needs Action tree (remount dance)**, single-trade native "Accept All Offers?" modal (OCR + coordinate scans) |
| Batch 3 (buyer: Z01–Z05 requests + Z07) | ~80–100 | **Timeline flingy-scroll battle (Z04 withdraw, Z01/Z02/Z03/Z05 approve/decline reveal)**, native alerts blanking tree, deep links queued behind alerts |
| Batch 4/5 (seller approve/decline + admin) | ~60–80 | Admin portal **sidebar click interception (timeouts + JS-click retries)**, Action Center Review-button dead-end, multi-statement SQL returning only last result |
| Batch 6 (H01–H03 + notifications) | ~40–50 | TradeSuccess deep-link param tuning (H02 needed `spUsed>0`), queued-alert displacement of deep-link render |

---

## 2. Chronological decision-and-outcome log

> Legend: **R** = reasoning, **T** = tool calls that mattered, **O** = outcome. Friction items are tagged **F-<n>** and resolved in §4/§5.

### Phase 1 — Preflight & fixture recon
- **R:** Confirm the 5 in-progress fixtures (a45caeb5, c0d12340, 4b880a9f, 943097a5, b6b42db4) had real Stripe holds and distinct roles; confirm config defaults (`cancel_request_escalation_enabled=true`, timeout 48) before spending UI calls.
- **T:** 1× SQL (`SELECT trades JOIN items WHERE buyer=test-buyer`), 1× `information_schema` after a 42703 on `trades.item_id`.
- **O:** Fixture map confirmed; learned `trades` uses `listing_id` (not `item_id`) and `profiles` has no `username` (use `email`). **F-1: column guessing → 2 wasted 42703 calls; schema cheat-sheet lacked the cancel-request tables.**

### Phase 2 — Section C (buyer tags + disclaimer), Section D (DT81 payment method)
- **C1/C3 (PASS):** Verified `includes-points-redemption-tag` on the bundle card + `disclaimer-modal-accept-button` present. Straightforward AX reads.
- **F-2 (the "disclaimer opened again" incident):** While navigating checkout, the agent tapped based on AX tree coords for bottom-anchored buttons and the **floating tab-bar pill overlaps the bottom CTAs** — a tap intended for "Go Back" re-opened the disclaimer modal. Transcript: *"The disclaimer opened again — AX coords for the bottom buttons are unreliable (R17). Let me close it and OCR the actual bottom layout."*
  - **R:** The AX tree reports logical/content coordinates with no z-order; the pill occludes bottom-anchored buttons (R17/R22). OCR was used as the source of truth.
  - **T:** OCR of the bottom band, then a careful re-tap. ~5–8 extra calls for this one detour.
  - **O:** Recovered, but this exact pattern recurred (D1 decline path, Z05 checkout) — every bottom-button tap was treated as suspect.
- **D1/D3 (PASS):** Real `INVALID_PAYMENT_METHOD` (saved card detached on Stripe) → added VISA cards via PaymentSheet; confirmed DT81 forceRefresh works on checkout + PaymentMethodsScreen.
- **D2 (FAIL — real defect):** Manage Kids Club+ "Update Payment Method" added a card but never persisted it — **root-caused by reading source** (`PaymentMethodSection` never calls the `attach-payment-method` EF). **R12 pattern (source-verify before recording finding) paid off.**

### Phase 3 — Section A/B (seller Review Offer privacy + SP split), fixture building
- **A1/A2/B2/C2 (PASS):** Single + bundle Review Offer show no "Buyer pays via" row; bundle SP split "45 from buyer + 16 platform bonus" correct.
- **F-3 (the "new offers aren't in the tree" incident):** After creating pending offers server-side via `ef-repro`, the seller's **Needs Action list did not refresh** — the tree was stale. Transcript: *"Still stale. Let me force a remount by navigating away and back to the Trades tab."* → *"The pending offers now show after remount."*
  - **R:** Server-side data mutation ≠ UI refresh; the list only refetches on focus/remount.
  - **T:** ~6–10 calls per occurrence (list → stale → navigate away → navigate back → list → verify); this happened repeatedly while building the 4–5 in-progress fixtures.
  - **O:** Worked, but this was one of the run's biggest time sinks and a repeated pattern.
- **F-4 (native "Accept All Offers?" modal blanks the AX tree):** The screenshot you captured — a **native iOS alert** ("Accept All Offers? / This will accept all 1 items… / Accept All / Cancel") that makes `list_elements_on_screen` return an empty/status-bar-only tree. The agent had to OCR the button bands and guess coordinates each occurrence.
  - **T:** ~4–6 calls per occurrence (list-blank → OCR → strip-scan → tap-by-coordinate), occurring on every single-item accept (a45caeb5, c0d12340, 4b880a9f, 943097a5, …) and the bundle accept. Compare: the **branded bundle accept modal is AX-exposed** (`btn-accept-all-confirm`) and costs **2 calls total**.
  - **O:** Succeeded each time (primary ≈ y838, cancel ≈ y887) but the coordinate-guess risk meant post-tap DB verification on every single one.

### Phase 4 — Group Z requests (buyer side)
- **Z04 withdraw — the single biggest call sink of the run (~15–20 calls):**
  - **R:** The timeline ScrollView is **flingy and snaps to only ~2 positions** (top ≈ 0, and ≈ 1263). The `withdraw-cancel-request-button` lives at logical y≈1204, just above the 1263 snap — landing on it required a precise secondary gesture.
  - **T:** The agent cycled through: list → swipe 700 → list (overshoot to 1263) → swipe down 200 → **snapped back to 0** → swipe 450 → overshot again → finally discovered the working gesture: **swipe up 700 @y250, then swipe down 140 @(100,850)** → revealed the mid-section at a stable position. ~12 screenshots named `Z04-*` in evidence.
  - **O:** Technique codified and reused successfully for every later approve/decline reveal (Z01/Z02/Z03/Z05/Z06) — the fix amortized across the rest of the run.
- **Z01/Z02/Z03/Z05 requests (PASS):** Buyers requested cancels; the scope prompt ("Cancel the whole bundle?" → Whole Bundle / Just This Item) is AX-exposed and cheap. Per-item Z05 verified via DB (sibling untouched).
- **Deep-link queuing (F-5):** Firing `/trade/<id>` while a native alert was pending landed on Dashboard instead — cost a re-fire + an extra list per occurrence.

### Phase 5 — Seller responses + Z03 fast-clock
- **Z01 approve (PASS):** Seller approve → confirm modal (AX-exposed `approve-cancel-request-confirm-button`) → real Stripe PI `canceled` verified.
- **Z02 decline→escalate (PASS):** `fn_respond_cancel_request` decline branch created the `cancel_request_escalated` notification.
- **Z03 timeout (PASS + finding):** **R14 fast-clock worked in 2 calls** — `UPDATE cancel_request_expires_at=now()-1min` + `SELECT fn_escalate_expired_cancel_requests()` → `updated:1`. Found (source-verified): **the cron never notifies the buyer** (guide line 6748 expects `cancel_request_escalated`). This is exactly the R12 "read the migration, don't trust the guide" pattern.

### Phase 6 — Admin legs (real admin portal)
- **F-6 (Action Center Review button dead-end):** The Cancel Requests "Review" button showed a false "Approved item." toast with **no server call** — source-verified in `ActionCenterClient.tsx` (no `cancel_requests` approve handler). Cost ~6 calls to diagnose; the **working path** was `/trades/<id>` → `btn-approve-cancel-request` → `btn-confirm-resolve-cancel-request`.
- **F-7 (sidebar click interception):** Every `click_element`/`locator.click` on main-content buttons was intercepted by the fixed admin sidebar overlay → 10s timeouts + retries. **Fix that worked: JS click via `run_playwright_code`** (`document.querySelector('[data-testid=…]').click()`) — and **batching several admin actions into ONE `run_playwright_code` block returning a JSON verdict** (R-NEW-5) cut admin-phase calls roughly in half.
- **F-8 (multi-statement SQL returns only the LAST result):** Running `SELECT …; SELECT …; SELECT …` in one `execute_sql` silently dropped all but the last result set → the agent had to re-run each statement separately. ~4–6 wasted calls.

### Phase 7 — Z05 whole-bundle approve + Z06/Z07/Z08
- **Z05 cascade FAIL (real defect, HIGH):** Seller whole-bundle approve cancelled only the target trade; sibling stayed `in_progress` with Stripe hold **still `requires_capture`** ($19.19) + 45 SP unreleased. **Root cause read from source** (`tradeServiceV2.respondToCancelRequest('approve')` cancels one trade; `fn_respond_cancel_request` only cascade-marks status). Cleanup via admin Force Cancel (with reason) → released.
- **Z06 (PASS + copy defect):** Config toggled off via Trade Timing, decline → `keep_trade` + buyer notified `cancel_request_resolved`. UI copy still says "sent to our team" when escalation is off (minor).
- **Z07 (PASS):** Pending/dispute/duplicate gates. The dispute gate used **R21 DB state-substitution** (`dispute_status='reported'` on 0fc9a126) → verified hidden → reverted in 3 SQL calls (cheap, no UI path exists).
- **Z08 (PASS):** Seller instant cancel + TFV2-023 consequence (`seller_cancelled` event `level:3`).

### Phase 8 — Section B (H01/H02/H03) + notifications
- **H01/H02/H03 (PASS):** `qa-trade-success` deep link force-renders TradeSuccess with params.
- **F-9 (H02 wrong permutation):** Firing the deep link **without `spUsed`** rendered the generic Perm-3 message, not "Got it! You saved…". R-16-5 (read the param contract first) — but the handler doc didn't state `spUsed>0` is the gate. ~4 calls to discover.
- **F-5b:** The first H03 fire was displaced by a **queued native "Trade Cancelled" alert** (from Z08) overlaying TradeSuccess → dismiss → re-fire.

---

## 3. (a) What slows execution — ranked friction with call costs

| # | Friction | Est. wasted/extra calls | Root cause | Fix (see §5) |
|---|---|---|---|---|
| F-2 | Bottom-button taps unreliable (pill occlusion / AX logical coords) — disclaimer re-open | ~5–8 per detour, recurring | AX tree has no z-order; floating pill covers bottom CTAs; agent taps tree coords | Fix 1 |
| F-3 | Seller Needs Action list stale after server-side offer creation ("offers aren't in the tree") | ~6–10 per occurrence, repeated ~4× | List refetches only on focus/remount | Fix 3 |
| F-4 | Native "Accept All Offers?" modal blanks the AX tree | ~4–6 per occurrence, ~6× | Native UIAlertController not AX-exposed | Fix 2 |
| F-Z04 | Timeline flingy scroll (2 snap positions) — landing on mid-section buttons | ~15–20 (Z04) then amortized | RN ScrollView inertia + content taller than snap points | Fix 4 |
| F-7 | Admin sidebar intercepts Playwright clicks | ~3–5 per action, ~8 actions | Fixed sidebar overlay + strict actionability | Fix 5 |
| F-5 | Deep links queued behind pending native alerts | ~2–4 per occurrence, ~5× | Alert blocks navigation handling | Fix 6 |
| F-8 | Multi-statement SQL drops all but last result | ~4–6 | Tool contract (one statement per call) | Fix 7 |
| F-1 | Column/schema guessing → 42703 | ~2–4 | Cheat-sheet gaps (cancel-request tables) | Fix 8 |
| F-9 | Deep-link param contract not documented (H02 needs `spUsed>0`) | ~4 | Handler doc omitted the gate condition | Fix 9 |
| F-6 | Admin Action Center Review button is a no-op | ~6 | No `cancel_requests` approve handler | (dev defect, already filed) |

**Single biggest lever:** F-4 + F-2 (native modal + unreliable bottom-button taps) together — every UI-heavy case paid the AX-blank/OCR-guess tax. **Second lever:** F-3 (stale list) repeated every time fixtures were built server-side.

---

## 4. (b) Patterns an agent should adopt proactively (validated this run)

1. **OCR-first for anything near/under the bottom fold** — before tapping a button whose tree y is near the screen height or under the tab pill, OCR the band (R17/R22). Never tap tree coords blindly for bottom-anchored CTAs.
2. **DB/Stripe read-back closes every money assertion** (R11/R24) — a UI toast is not proof (Z05's sibling hold was only caught by reading the PI status + `trades` row).
3. **Source-verify every finding** (R12) — read the migration/EF/screen before recording a defect; this produced 3 of the 4 real defects and avoided false alarms (Z03, Z05, D2, Action Center).
4. **Fast-clock timer RPCs** (R14) — 2 calls instead of waiting 10-min crons.
5. **Deep-link-first navigation** (R-NEW-2) — `/trade/<id>` + `qa-login-as` + `qa-trade-success` collapse whole navigations to 1 call.
6. **Batch admin actions into ONE `run_playwright_code` block returning a JSON verdict** (R-NEW-5) — plus **JS clicks** (`document.querySelector('[data-testid=…]').click()`) instead of `locator.click` to defeat the sidebar.
7. **State-substitution for unreachable states** (R21) — dispute gate verified via a 3-call set/verify/revert instead of a blocked case.
8. **Write the working technique into session memory the moment it's found** (R16) — the scroll gesture was reused ~6× after discovery.
9. **Re-fire deep links after dismissing queued alerts** — check the tree isn't showing an alert before assuming the deep link failed.

---

## 5. (c) Instrumentation / fixture work that removes the friction

### Fix 1 — Bottom-anchor AX unreliability (F-2) → the "disclaimer opened again" fix
- **Instrumentation (dev):** The floating `PersistentTabBar` pill should expose its z-index/geometry to QA, or better: in **dev/QA builds**, render the pill with `pointerEvents="box-none"` during modal/checkout flows, or add a `qa:ax-viewport` warning already present — run `npm run qa:ax-tree -- <file> --screen-width 440 --screen-height 956 --pill-top 830 --pill-bottom 900` before any bottom-button tap (flags `⚠ under-pill` / `⚠ below-viewport`).
- **Agent rule (no code change):** **Never tap a bottom-anchored button from tree coords.** First swipe the target into the visible band (e.g. y 100–800), re-list to get fresh viewport coords, OCR the band to confirm it is the intended button (label), then tap. This kills the class entirely.
- **Cheapest immediate win:** a `qa` deep link `p2pkidsmarketplace://qa-scroll-to?testID=send-offer-button` that programmatically scrolls the target into view and returns its fresh viewport coords in one call.

### Fix 2 — Native modals that blank the AX tree (F-4) → the "Accept All" button fix
- **Instrumentation (dev, best):** Route the **native "Accept All Offers?"**, "Offer Accepted!", and "Request Withdrawn" alerts through the app's branded `GlobalAlertProvider` (already AX-exposed as `global-alert-button-N`) or a custom RN modal with deterministic testIDs (`accept-all-confirm-button`). Dev Task 51 already converted the accept/decline confirms (`offer-accepted-ok-button`, `bundle-accepted-ok-button`, `offer-declined-ok-button`) — **this is the same pattern, just not yet applied to the single-item bundle-accept native modal.** Once done, each accept drops from ~4–6 OCR/guess calls to **2 AX calls** (like the bundle path already is: `btn-accept-all-confirm`).
- **Agent rule (interim):** When the tree is blank and OCR shows a two-button modal, use the **per-device anchor cache** (e.g., primary ≈ (220, 838), secondary ≈ (220, 887) on this device) stored in repo memory — one OCR to confirm, one tap, then DB-verify. Do not re-scan the strip every occurrence.

### Fix 3 — Stale Needs Action list after server-side creation (F-3) → the "offers aren't in the tree" fix
- **Instrumentation (dev):** The Trades/Needs Action list should **refetch on focus** (it does) AND support **pull-to-refresh** if not already present. Add a `qa:refresh` deep link that force-refetches the current screen (`p2pkidsmarketplace://qa-refresh`).
- **Agent rule (no code change):** Treat the **first list after any server-side write as stale by default** — go straight to nav-away-and-back (or pull-to-refresh) and only then list, skipping the wasted "list → find nothing → investigate" step. This is the R-NEW-1 "relaunch-first on a blind tree" analog for server-side writes.
- **Fixture work:** Add a `qa:create-offers --notify` flag to `ef-repro` that also triggers the Realtime event / `cancel_request_sent`-style notification so the seller UI updates without a manual remount.

### Fix 4 — Flingy timeline scroll (F-Z04)
- **Agent rule (validated, already codified this run):** The 2-snap timeline is predictable: `swipe up 700 @y250` → then `swipe down 140 @(100,850)` reveals the mid-section (approve/decline/pending-card band). Save this as a standing technique (done in session memory).
- **Instrumentation (dev, nice-to-have):** A `qa:scroll-timeline?position=mid` deep link, or expose the mid-section controls as a **fixed bottom action row** (approve/decline pinned), removing the scroll dependency.

### Fix 5 — Admin sidebar click interception (F-7)
- **Agent rule (validated):** For admin portal actions, use `run_playwright_code` with a **JS click + one batched block returning a JSON verdict**; reserve `click_element` for sidebar/nav elements. Already proven to cut the admin phase in half.

### Fix 6 — Deep links queued behind alerts (F-5)
- **Agent rule:** Before firing a deep link, list the tree; if an alert is present, dismiss it first, then fire the deep link, then re-list. For TradeSuccess deep links, fire after confirming no queued "Trade Cancelled"/"Offer Accepted!" alert.

### Fix 7 — Multi-statement SQL (F-8)
- **Agent rule:** One `SELECT` per `execute_sql` call, or wrap multiple reads in a single JSONB aggregate (`SELECT jsonb_build_object(...)`). Never rely on `;`-separated statements returning multiple result sets.

### Fix 8 — Schema cheat-sheet gaps (F-1)
- **Docs:** Extend `/memories/repo/schema-cheat-sheet.md` with: `trades.cancel_request_*` column set (status/reason/created_at/expires_at/resolved_at/resolved_by/resolution/requested_by/requested_role), `cancel_request_escalation_runs` columns, `user_notifications` columns, `profiles.email` (not username), and the `fn_request_cancel_trade` / `fn_respond_cancel_request` / `fn_escalate_expired_cancel_requests` signatures. This is ~15 min of work that saves a 42703 cycle per future query.

### Fix 9 — Deep-link param contract (F-9)
- **Docs/dev:** Update `QaForceTradeSuccessDeepLinkHandler` header + the TRD guide H02 entry to state that **`spUsed>0` gates the "Got it! You saved…" permutation** (without it, the generic Perm-3 shows). Also document that a queued native alert can displace the deep-link render.

---

## 6. What an AI agent fed this log should output

1. **Stop doing:** blind bottom-button taps, trusting the first list after server-side writes, `locator.click` on admin main content, multi-statement SQL, firing deep links while alerts are pending.
2. **Start doing:** OCR-first near the fold, remount-after-write, JS-click + batch admin actions, one-statement SQL, source-verify findings, DB-close every money assertion, cache per-device modal anchors.
3. **Ask dev to instrument:** AX-expose the native bundle-accept modal (biggest single win), add `qa:refresh` + `qa:scroll-to` deep links, extend the schema cheat-sheet with cancel-request columns.

---

## 7. Evidence
- Screenshots: `e2e-test-results/qa-task17-z-g-dt78-81-2026-09-01/screenshots/` (56 files)
- Results/report: `…/report.md`
- Session plan (chronology): `/memories/session/qa-task17-plan.md`
- Full transcript: `…/GitHub.copilot-chat/transcripts/053c9c08-7333-4196-810c-c2b185c08dac.jsonl`

# QA Task 4 (Expanded) — Decision-and-Outcome Log
**TRD Group C + Group D + B-Series Carryover (B02/B03/B05c) + E-Series**
**Run:** 2026-08-28 · **Agent:** QA Test Agent (execution-only) · **Env:** iOS Simulator iPhone 17 Pro Max (iOS 26.1) / staging `drntwgporzabmxdqykrp`

> **Purpose of this file.** This is a full action→reasoning→tool-call→outcome trace of how the executing agent actually worked — the decisions it made, the dead ends it hit, and the patterns that unblocked it. It is written to be fed to another AI agent that will derive:
> - **(a) What slows execution** (bottlenecks + measured cost).
> - **(b) Patterns an agent should adopt proactively** (before hitting the friction).
> - **(c) Instrumentation / fixture work that removes the friction** (so the *next* run doesn't re-pay it).
>
> Sections 1–3 are the chronological trace (grouped by phase). Sections 4–6 are the derived analysis. Every claim in the trace is tied to an observable tool result or DB read-back, not to memory.

---

## 0. Run metadata & session-scope facts

- **Cases targeted:** 24 (B02 re-verify, B03, B05c, C01–C08, D01–D04, E01–E04, E07–E10). **Verdicts: 19 PASS / 0 FAIL / 5 BLOCKED / 0 SKIPPED.**
- **Canonical guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`.
- **Key pre-learned facts that shaped the run (from repo/session memory):**
  - App card-selection on the offer screen is **non-deterministic** (VISA 4242 invalid vs MASTERCARD 4444 valid) → intermittent 400 "Payment method is invalid or expired".
  - `TradeConfirmationModal`/native success modals are **not in the AX tree**; OK is tapped at known pixel positions (e.g. (305,536)).
  - Fast-clock SQL (`UPDATE trades SET offer_expires_at=NOW()+interval '5 seconds'` + `rpc_process_expired_offers(100)`) is the documented timer shortcut; first call often returns `0` (races the 5s) — re-run.
  - `keyboard-done-button` (Task 25) dismisses the keyboard on the SP offer inputs.
  - `p2pkidsmarketplace://qa-logout` is the fast logout; `p2pkidsmarketplace://listing/<id>` deep-links to item detail.
  - test-buyer SP: avail 12 / reserved 10 at run start; test-seller pending 130.

---

## 1. Chronological trace — continuation session (post-compaction)

> Phases P1–P6 below cover the second half of the run (B03 completion through report). Earlier phases (C-group, B02, D04-buyer-leg) are summarized in §2 from the pre-compaction trace because they were already executed; their frictions are folded into §4–6.

### P1 — B03: complete the competing-offer setup (the card-flakiness saga)

**Action:** Re-list offer screen for Remote Control Car (`p2pkidsmarketplace://listing/35e3a900…`) after a LogBox-driven terminate+relaunch.
**Reasoning:** Two earlier offer submissions had failed with 400 "Payment method is invalid or expired" because the offer screen had auto-selected the *invalid* VISA 4242. The relaunch is cheap (§5.32 reset-cost table) and the card selection is per-load — I needed to see which card is now presented before spending more taps.
**Tool calls that mattered:** `mobile_list_elements_on_screen` → showed **"Paying with MASTERCARD •••• 4444"** (valid) + "Max: 12 SP (50% of price)".
**Outcome:** Confirmed the valid card was now selected. **Root-cause insight:** the "card flakiness" is not an app bug per se — it is *which saved card the offer screen defaults to*, and that default varies per load (two saved cards on the Stripe customer: VISA 4242 (invalid on the account) and MASTERCARD 4444 (valid)). This single uncertainty had already cost 2 failed offer attempts + 2 relaunches before the continuation.

**Action:** Enter 8 SP → tap `keyboard-done-button` (360,598) → swipe up → tap `send-offer-button` (220,829) → disclaimer `disclaimer-modal-checkbox` (220,824) + `disclaimer-modal-accept-button` (325,878).
**Reasoning:** Standard offer-submission sequence; per §5.2 dismiss the keyboard (in-app Done) before the below-fold Send Offer, then re-list before each tap.
**Outcome:** DB `SELECT` on trades for the listing returned test-buyer's `c870e8ad` **pending** (8 SP, $17 cash) alongside buyer-2's `d62d340f` (cash $25). **B03 has 2 buyers on the same listing.** (Buyer-3 excluded: its saved card is invalid — fixture gap, recorded as P3.)

### P2 — B03: seller accepts buyer-2; competing SP offer auto-declined + SP restored

**Action:** `p2pkidsmarketplace://qa-logout` → login test-seller (email/password).
**Reasoning:** Batch by persona (§5.26); the seller leg must accept buyer-2's cash offer to trigger `fn_decline_competing_offers`.
**Friction (login):** the password got appended to the email field (focus stayed in email). **Reasoning:** tap→type assumes focus moves; it didn't. Per §5.10, tried long-press→Select All (no edit menu surfaced in AX) → **osascript `Cmd+A`** (select-all) → retype. **Outcome:** email fixed. Then the password field showed only "123!" (partial) — `Cmd+A` again + retype → "TestSeller123!". Log In tap at (220,566) didn't fire twice → keyboard `Return` didn't submit → third tap at (220,555) worked.
**Bottleneck note:** 3+ extra taps and 2 `Cmd+A` repairs for one login; the keyboard-up AX coordinates were unreliable for the submit button (§5.2 below-fold rule).

**Action:** Trades → NEEDS ACTION → `trade-offer-row-d62d340f…-review` (220,651) → `accept-trade-button` (220,420) → `accept-trade-confirm-button` (305,536).
**Reasoning:** Accept the earlier-submitted cash offer; the confirm modal is the native `TradeConfirmationModal` (not in AX) → tap OK at the known position.
**Outcome (DB, authoritative):**
- `d62d340f` → **in_progress** (buyer charged).
- `c870e8ad` (test-buyer SP offer) → **cancelled**, `cancellation_reason='offer_expired_competing'`, `sp_released_at` set.
- Wallet: available 4→12, reserved 18→10; `sp_ledger` `earn_refund +8` linked to `c870e8ad` (description "SP refunded for cancelled offer (expired)" — **copy nit**: reason is a competing decline, not expiry; P3).
- Notifications: `trade_cancelled` + `sp_refunded` ("8 SP returned") to test-buyer; `trade_request` to seller earlier.
**B03 = PASS** (2-buyer variant; guide's 3-buyer sort-order check not fully reachable because buyer-3's card is unusable — documented gap).

### P3 — D04 seller-leg + D01 auto-complete (payout gap discovery)

**Action:** As test-seller, open T3 Skateboard (`bc53d054`) timeline.
**Reasoning:** D04 requires the seller view of an in_progress trade (no banner expected).
**Outcome:** Seller timeline showed **no auto-complete banner** ✅; status notice hardcoded `seller-awaiting-payment-notice` **"Trade accepted. Waiting for buyer payment confirmation."** — guide says "Buyer paid. Awaiting pickup confirmation." (P3 copy discrepancy). Confirmed by source read of `TradeTimelineScreen.tsx` (line 1513) — **two-source corroboration** (§6.1 Phase-23 rule: don't trust a single observation).

**Action:** Fast-clock T3 auto-complete: `UPDATE trades SET auto_complete_at=NOW()+interval '5 seconds'` → `SELECT rpc_process_auto_complete(100)`.
**Reasoning:** Documented D01 fast-track; the processor often returns `0` on the first call (races the 5s window) — re-run rather than conclude failure (§5.38 R14).
**Outcome:** First call `auto_completed_count:0`; re-run → `1`. T3 → **completed**.

**Action (the highest-leverage DB dive of the run):** verify side effects — notifications, seller wallet, **payout**.
**Reasoning:** §5.37 side-effect verification is mandatory: a UI success ("Trade Complete") proves the request completed, never that the financial state persisted.
**Outcomes:**
- Notifications: `trade_completed` to both parties; seller `sp_earned +6` + `sp_pending_release`; seller pending 130→136.
- **`seller_payouts` for T3: NO row.** Manual-completed T1 (`49b7f6c5`) HAS one. This asymmetry is a **P1/P2**.
- **Root-cause chain (source reads):** `rpc_process_auto_complete` (R15 migration) only flips `status`; `fn_queue_payout_on_complete` (trigger → `net.http_post` to `/initiate-payout`) is skipped in this env because session GUCs (`app.edge_function_base_url`/`app.supabase_url`/`app.service_role_key`) AND `admin_config` rows are absent (no `initiate-payout`/`release-due-payouts` EF logs); the hourly `release-due-payouts` cron (`rpc_release_due_payouts`) requires `payout_status='pending' AND payout_amount_cents > 0`, but T3's `payout_amount_cents` is **NULL** → never selected. `seller_balance` WAS credited (trigger ran at completion timestamp) — so cash sits in `seller_balance` with no payout record to dispatch it.
- **Key reasoning pattern:** every suspicious observation was confirmed by reading the actual migration/EF source before reporting (§5.38 R12), not inferred from a single symptom.

### P4 — E-series: E01 BLOCKED (occlusion), then D02/E02/E03/E04 via DB-set dispute

**Action:** Buyer timeline of T4 (`2e0d3c87`) → tried to reach `report-problem-button` (y 860–908).
**Reasoning:** E01 requires tapping Report a Problem; the guide's locator is the `report-problem-button` testID.
**Friction — the tab-pill occlusion:** the floating `PersistentTabBar` pill (y ≈ 848–904) sits **over** the report button, and the timeline would not scroll past it (3 swipe attempts produced identical AX coordinates). OCR of the bottom band showed only "I Got It" + Home/Discover/Trades/Basket — **no "Report Problem" text**.
**Reasoning:** AX reports overlapping coordinates without z-order (§5.1); the **screenshot/OCR is the source of truth** (§5.9). Verified occlusion with OCR rather than guessing taps.
**Outcome:** **E01 BLOCKED (P2)** — the dispute entry point is unreachable via UI on this layout. (The `IssueReportModal` + `open-dispute` EF exist in code; confirmed by source.)

**Action:** Set the dispute via DB to test the dispute-state behaviors: `UPDATE trades SET dispute_status='reported', dispute_reason='no_show', dispute_notes='QA setup…', dispute_opened_at=now(), disputed_at=now() WHERE id='2e0d3c87…'`.
**Reasoning:** E01's UI path is blocked by a real bug, but D02/E02/E03/E04 verify the *state* the open-dispute EF would produce. Mirroring the EF's exact columns (from `open-dispute/index.ts`) keeps the setup honest; setup method documented in the report (§5.38 R13: every BLOCKED carries an explicit reason).
**Outcome:** Dispute set.

**Action:** D02/E02 fast-clock on the disputed trade → `rpc_process_auto_complete(100)`.
**Outcome:** `auto_completed_count:0`; trade stays `in_progress` with `auto_complete_at` already past. **D02/E02 PASS** (dispute blocks auto-complete).

**Action:** E03 buyer view + E04 seller view of the disputed trade.
**Outcome:** Both parties see the dispute banner ("Dispute in progress / Our team has been notified / Dispute reported — our team has been notified and will review shortly."); buyer's `report-problem-button` hidden (count 0), "I Got It" present-but-disabled (guide says hidden — P3); seller's `seller-cancel-inprogress-button` hidden (count 0). **E03/E04 PASS with deviations.**
**Design-system check (§6.4):** source + color histogram show the banner is **red** for `reported` (`#FFF7F7` bg / `#E85D75` accent) / orange for `under_review` — **not amber** as the guide states. Documented design decision in code (comment at line ~889), so P3 spec-vs-implementation mismatch, not a render bug.

**Action:** Investigate E07–E10 (`TradeDisputeScreen`).
**Reasoning:** Grep for how the File-a-Dispute screen is reached before assuming it's testable (§4 flow-registry pre-read; §5.25 fail-fast on source-proven-impossible paths).
**Outcome:** `TradeDispute` is registered in `AppNavigator` but **no screen calls `navigate('TradeDispute')`** and **no deep link maps it** (checked the `linking` config). **E07–E10 BLOCKED (P2)** — screen unreachable. Existing `TradeDisputeScreen.test.tsx` covers logic at unit level (noted as the only coverage).

### P5 — D03 pill colors (seed + histogram hunt)

**Action:** Seed 4 throwaway pending offers via SQL at +10h/+4h/+1h/−1h on test-seller's listings.
**Reasoning:** D03 needs offers at different remaining times; the seller's Offers tab + Review header render from `trades` rows. Only `listing_id/buyer_id/seller_id` are NOT-NULL without defaults → a minimal INSERT is safe. This is QA test-data setup (same class as the guide's own fast-clock) and is deleted afterward.

**Action:** View seller Offers tab → the countdown.
**Reasoning/friction:** The Offers **list rows render plain text** "Offer expires in 9h 59m" (no pill) — the `OfferCountdownPill` is only on the **Review Offer header**. So D03's pill-color check is on the Review screen. (This itself is a P3 spec gap: guide expects a pill on the list row too.)

**Action (friction — locating the pill's colors):** color histograms on the header region.
**Reasoning:** The pill bg colors (#EFF6FF / #FFFBEB / #FEF2F2 / #F8FAFC) are near-white → `qa:inspect-screen`'s 12-color quantizer merges them into white. **Key technique:** scan for the *border* colors and the green progress fill, not the background; and locate the exact y-band first via thin-strip OCR (the pill text "Offer expires in…" appeared in strip y 1110–1260, not where I first guessed). Also: my first `qa:badge-scan` calls failed because the token key must be `name=…` not a bare color name — a tooling gotcha that cost one retry.
**Outcome (histograms):**
- +10h → BLUE `#EFF6FF` / border `#BFDAFD` / fill `#5EB98E`
- +4h → AMBER `#FFFBEB` / border `#FBE591`
- +1h → RED `#FEF2F2` / border `#FBA5A5`
- expired → GRAY `#F8FAFC`
**D03 PASS with deviations:** app color model = blue(>6h)/amber(2–6h)/red(<2h)/gray vs guide green(>12h)/amber(6–12h)/orange(2–6h)/red(<2h)/gray. (Source `countdown.ts` thresholds: normal >360min, warning 120–360, critical ≤120.)

### P6 — C07 free-user locked Use SP

**Action:** Login test-free → deep-link RC Car listing.
**Reasoning:** C07 needs the free-tier view of an Accept-SP item.
**Friction (environment):** after `qa-logout`, an in-app **TOS sheet** (`accept-tos-button`) appeared showing Google Cloud Marketplace boilerplate; tapping Accept → "Failed to record acceptance. Please try again." **Reasoning:** §5.8 environment-blocker discipline — don't fight it; terminate+relaunch. Clean landing after relaunch.
**Outcome:** test-free logged in.
**Action:** Item detail → `use-sp-locked-chip` present ("Swap Points Accepted (Kids Club+ only)", "Subscribe to Kids Club+ to use Swap Points on this item."); Request to Buy available. Tap the locked chip → **full-screen Kids Club+ membership page** ("Get more out of every trade", [Join on the web] → passitup.com).
**Outcome:** **C07 PASS with deviation** — guide expects an upgrade *modal* ("Unlock SP discounts…30 days free", [Try Kids Club+ Free], [Not Now]); the app goes straight to the membership screen (P3). Back button returns to the listing with Request to Buy still available (guide's "Not Now" intent satisfied structurally).

### P7 — B05c bundle = 1 slot (real cart UI; was SKIPPED)

**Action:** Seed 2 single pending offers (SQL, preconditions) → login test-buyer → deep-link 3 Cash-Only items → tap `add-to-cart-button` each → Basket.
**Reasoning:** The case's preconditions (2 pending offers) are seed-state; the *case under test* is the cart bundle flow, which must be driven through the real UI (B05j had verified bundle=1 only at the EF layer before).
**Friction:** the cart contained **2 stale items** from June (Vintage Comic $25, Free Art Supplies $0 "no longer available") sharing the same `bundle_id`. Removed via UI (remove → confirmation modal `global-alert-button-1`). **Reasoning:** DB showed 5 active items; cleaning via the app (not raw SQL) keeps the run execution-honest.

**Action:** Scroll the Basket so `bundle-cta-button` ("Make one offer for these 3 items") clears the pill, then tap it.
**Reasoning:** The CTA at rest is under the pill (same occlusion class as E01), but it is **inside the ScrollView**, so scrolling brings it above the pill (unlike the timeline's Report button).
**Outcome:** Checkout screen: "📦 Combined Offer — You're making a single offer for all 3 items from this seller." + **MASTERCARD 4444** (valid) + "Send Offer · $65.69".

**Friction (Send Offer off-screen):** `send-offer-button` was at y=1064 — **below the 956pt screen**; two taps did nothing (tapping off-screen). **Reasoning:** AX reports logical/content coordinates for below-fold rows even when the keyboard isn't up (§5.2 generalized); the checkout is a ScrollView (paddingBottom 120 in source). Scrolled up → button at (220,746) → tap → DisclaimerModal → `disclaimer-modal-checkbox` (220,824) + `disclaimer-modal-accept-button` (325,878).

**Outcome (DB):** **3 trades created sharing `bundle_id=4f9ca77d`** (`0f8c338e/d953c2eb/2a4a3da5`). Slot count via SQL replicating `countPendingSlotsForSeller` (`COALESCE(bundle_id::text, id::text)` distinct): **5 pending = 3 slots** (2 singles + 1 bundle).

**Action:** 4th offer block: deep-link a 4th test-seller item → offer screen (MASTERCARD valid) → scroll Send Offer up → disclaimer accept.
**Outcome:** **"Too Many Open Offers — You have 3 pending offers with this seller. Cancel one to make a new offer."** (`offer-limit-ok-button` / `offer-limit-view-offers-button`). **B05c PASS.**

### P8 — Cleanup, report, tracker

- Deleted the 5 throwaway pending trades + the 3 cart rows (restore baseline).
- Verified final wallets/trades (test-buyer 12/10; test-seller 1816/136; T4 disputed; T3 auto-completed; B03 trades as expected).
- Wrote `report.md` + updated 22 rows in `TEST-COVERAGE-INVENTORY.md`; emitted the §8.3 QA Session Handoff in the chat reply.

---

## 2. Pre-compaction phases (summarized — earlier in the same run)

| Phase | Cases | Method | Key outcome |
|---|---|---|---|
| Group C core | C01, C04, C05, C06, C02, C03 | offer → accept/decline/expiry/cancel → **wallet + ledger DB read-back** | SP reserve/restore/release all verified; C05 found "+10 shown vs +21 credited" (P2); ledger-based trade-row SP accounting gap re-confirmed (P2) |
| C08 cap | C08 | type 25 → clamps to 20, "Max: 20 SP (70% of price)" | PASS; cap is **category-driven** (`calculateCategorySP`, 50–75%), not flat 50% (P2 vs FR-SP-003) |
| B02 (DEV-TASK-34) | B02 | 2 sequential expiries (fast-clock) + 2 declines; `listing_offer_stats.unanswered_offer_count` read-back | streak 1→2 + nudge queued (`last_prompt_sent_at` set) + nudge copy verified in EF/source; declines keep 0 + no nudge; History-tab placement verified. **PASS** |
| D04 buyer-leg | D04 | buyer T3 timeline | "Confirm pickup — auto-completes in 71h 46m left" banner present (pre-complete) |
| B03 setup (failed legs) | B03 | 2 offer submissions hit 400 "Payment method is invalid or expired" | Root-caused to **non-deterministic saved-card selection** (VISA 4242 invalid) — the exact fix (relaunch → MASTERCARD) was applied in P1 |

---

## 3. Key tool calls that mattered (with why)

| Tool call | Why it mattered |
|---|---|
| `mcp_supabase_execute_sql` (read-only) — wallet/ledger/trades/notifications/payouts | The **authoritative verdict channel** (BP-72). UI success screens were never trusted alone; every money/SP/state assertion closed with a DB read. |
| `mcp_mobile_mobile_list_elements_on_screen` before every tap | §5.1 mandatory — trees go stale the instant the UI changes; also caught the card flakiness and the report-button occlusion. |
| `mcp_mobile_mobile_save_screenshot` + `npm run qa:ocr` | The **source of truth** when AX was stale/occluded (§5.9). OCR proved the pill occluded Report Problem and that the basket CTA/checkout Send Offer were under the pill. |
| `npm run qa:badge-scan` / `qa:inspect-screen --region` | Deterministic color verification for the D03 pills and the E03/E04 dispute-banner color (design-system compliance). |
| `xcrun simctl openurl booted p2pkidsmarketplace://…` | Fast persona switches (`qa-logout`) and direct listing reach (`listing/<id>`) — avoided churning the Discover UI to find fixtures. |
| `osascript Cmd+A` (select-all) | The reliable field-clear for corrupted login fields (§5.10 R3); long-press→Select All was NOT reliable. |
| Fast-clock SQL + `rpc_process_*` | Timer cases without waiting 48h/72h; re-run on `0` result (§5.38 R14). |
| Source reads (`TradeTimelineScreen`, `OfferCountdownPill`, `countdown.ts`, `rpc_process_auto_complete`, `create-trade-offer/index.ts`, `open-dispute/index.ts`, `release-due-payouts`) | Every finding was **confirmed from source before reporting** (§5.38 R12) — payout gap, occlusion layout, pill thresholds, dispute columns, slot-dedup logic. |

---

## 4. (a) What slows execution — bottlenecks, measured

1. **Saved-card non-determinism (the #1 time sink).** Two offer submissions failed with 400 "Payment method is invalid or expired" because the offer screen auto-selected invalid VISA 4242; each failure → terminate+relaunch (~10–15s) → re-enter the whole offer flow (~30–45s). Estimated **2–3 minutes** lost in B03 alone, plus it forced B03 to a 2-buyer variant (buyer-3 unusable). *Root cause: no user-visible control for which saved card is used on the offer screen, and no QA toggle to force a card.*
2. **Floating tab-pill occlusion of bottom CTAs.** The `PersistentTabBar` pill (absolute, floats over content) covers bottom-anchored buttons: **Report Problem on the buyer timeline (blocked E01)** and the basket CTA / checkout Send Offer at rest. The timeline won't scroll past the pill; the basket/checkout require a scroll first. Cost: E01 investigation (~10 tool calls) + repeated "why won't it tap" cycles on checkout. *Root cause: no bottom-inset/scroll-padding accounting for the pill height on the timeline, and an AX tree that reports overlapping coordinates without z-order.*
3. **Login field-focus + keyboard-y unreliability.** Password appended to the email field; partial-password captures; Log In tap not firing while the keyboard is up. Each login cost ~3–6 extra taps and 1–2 `Cmd+A` repairs; with **7 persona logins this run**, this is a recurring tax. *Root cause: focus doesn't move on tap reliably; AX below-fold y is logical-not-rendered while the keyboard is up (§5.2).*
4. **Off-screen (below-fold) buttons on scroll screens.** Checkout `send-offer-button` at y=1064 (screen is 956pt) — two silent no-op taps before I realized it was in the scroll. Same class as (3): AX content coordinates ≠ rendered viewport. *Root cause: no "is this element within the visible viewport" signal in the AX tool; the agent must infer from y > screen height.*
5. **Near-white color verification on D03 pills.** The pill backgrounds quantize to white in a 12-color histogram; finding the pill band required strip-OCR then border/fill-color scans, plus one tooling retry (`name=` token syntax). ~8 tool calls for what could be one screenshot + one scan.
6. **Blocked screens eating full case slots.** E01 (occlusion) and E07–E10 (unreachable route) consumed investigation time and returned BLOCKED — high value (real bugs found) but zero case credit.
7. **Environment overlays.** A Google-Cloud-Marketplace TOS sheet appeared after a logout deep-link (Accept → "Failed to record acceptance") — required terminate+relaunch (~15s) and cost a couple of taps. Rare but real.

---

## 5. (b) Patterns an agent should adopt proactively

1. **Close every money/SP/state assertion with a DB read-back (BP-72), and when a UI says "success" but DB disagrees — read the source of the path before reporting.** This is the single highest-leverage habit; it found the auto-complete payout gap (P1/P2) that no UI pass would have caught.
2. **Treat the screenshot/OCR as the source of truth the moment AX coordinates look wrong, overlap the tab pill, or are below the screen height.** Don't burn tap attempts on coordinates the AX reports but that can't be the rendered position (the 2 no-op Send-Offer taps and the Report-Problem taps were preventable).
3. **Pre-read the flow/source before touching a screen you haven't mapped** (§4/§22). Source reads (not UI spelunking) resolved: payout path, pill thresholds, dispute columns, slot-dedup, TradeDispute reachability, and the occlusion layout — most in one grep each.
4. **Batch by persona and reuse precondition state; seed precondition offers via SQL and delete them after.** Persona switches are the most expensive operation (login churn in §4.3); minimizing them and seeding D03/B05c preconditions directly saved several full offer-submission cycles (which would have re-hit card flakiness).
5. **For timer cases, always re-run the processor on a `0` result** before declaring failure (races the 5s fast-clock).
6. **For color/design-system checks, scan for border+fill colors (not near-white backgrounds), and locate the band first via thin-strip OCR.** This turns a flaky histogram guess into a deterministic pass.
7. **When a UI path is source-proven impossible, stop exploring and report BLOCKED with the evidence** (§5.25) — then test the underlying *state* via DB if the case is about state (E-series), documenting the substitution.
8. **Prefer `Cmd+A` (select-all) → retype for any field clear; only use long-press→Select All on field types proven to support it** (§5.10 R3).
9. **Confirm a button is actually tappable (visible, not under the pill, y < screen height) before tapping** — re-list + OCR if uncertain; this prevents silent no-op taps.

---

## 6. (c) Instrumentation / fixture work that removes the friction (ranked)

1. **A QA saved-card toggle / deterministic card selection on the offer + checkout screens** (e.g., `p2pkidsmarketplace://qa-dev-toggle?key=payment_card&value=mastercard_4444`), or surface which saved card is active with a one-tap switch. Removes the #1 bottleneck and unblocks buyer-3 (add a valid saved card fixture for it).
2. **Bottom-inset / scroll-padding on the buyer trade timeline so the last action buttons clear the floating tab pill** — makes `report-problem-button` reachable (fixes E01) and prevents the same class on any future fixed-footer screen. Add the pill-height as `contentInset.bottom` on every ScrollView that ends in an action.
3. **A deep link + navigation entry for `TradeDispute`** (or deprecate it and delete the dead route) — unblocks E07–E10.
4. **Populate `payout_amount_cents` (and the payout row) on auto-complete** so the release-due-payouts cron / dispatch can pick up auto-completed trades — fixes the D01 P1/P2 payout gap.
5. **Expose a viewport-visibility hint in the AX helper** (`qa:ax-tree`) or a "is element on screen (y ≤ screenHeight)" flag — prevents the off-screen Send-Offer class of silent no-op taps.
6. **Instrument `keyboard-done-button` on ALL text inputs** (currently only the SP offer inputs) so every form submit has a one-tap keyboard dismiss (reduces the login tax).
7. **A `qa:badge-scan` token syntax that accepts bare color names** (or document `name=` in the error message) — saves one retry per color scan.
8. **Seed/cart hygiene:** `reset:pending-trades` should also clear stale active `cart_items` for test personas (the June-era items required manual UI removal during B05c).

---

## 7. Summary numbers

- **Cases:** 24 executed → 19 PASS / 0 FAIL / 5 BLOCKED / 0 SKIPPED.
- **Priority findings:** P1/P2 auto-complete payout gap (D01); P2 Report-Problem occlusion (E01); P2 TradeDispute unreachable (E07–E10); P2 category-driven SP cap (C08); P2 C05 shown-vs-credited SP; P2 trade-row SP accounting gap (pre-existing). Multiple P3 copy/design-spec deviations (documented in `report.md`).
- **Biggest levers for the next run:** (1) card toggle + buyer-3 valid card; (2) timeline bottom-inset; (3) TradeDispute reachability; (4) payout backfill. Together they would convert 5 BLOCKED/partial cases into runnable ones and remove the largest per-case time cost (card flakiness).

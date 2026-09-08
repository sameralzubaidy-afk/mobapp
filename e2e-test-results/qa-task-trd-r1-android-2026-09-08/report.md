# QA Task TRD-R1 — TradeFlowV2 Round 1, Groups A–J (Core Transactional Logic) — Android

**Date:** 2026-09-08 · **Platform:** Android emulator `Medium_Phone_API_36.1` (emulator-5554, Android 16) — same device as the AUTH rounds · **Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (Groups A–J) · **LLM:** DeepSeek V4 Flash (mini-calibration on the guide's first Android round) · **Run folder:** `e2e-test-results/qa-task-trd-r1-android-2026-09-08/`
**Build HEAD:** `7a755959` · **Metro** :8081 · **Admin portal** :3001 · **Exclusive single-task emulator access confirmed** (no concurrent agent task shared the device this session).

---

## Executive summary

This was the **first Android execution of the TradeFlowV2 Groups A–J** (all prior TradeFlowV2 rounds were iOS). The brief's risk-tier model was applied. Execution focused on the **Tier-1 core + the 5 folded-in config-propagation pairs** (systemic-risk items), then sampled the dispute flow on a real UI path. **14 PASS · 1 FAIL (P1) · 0 BLOCKED** among the executed verdicts, plus explicit deferrals of the large unexecuted remainder (with reasons) — consistent with the brief's "report exactly how far you got and defer the rest" instruction.

**Top finding — P1 (money/state):** a buyer-reported dispute does **not** actually pause auto-complete. Driven on the real UI path (Report a Problem → "Seller was a no-show" → Submit), the trade flipped to `dispute_status='reported'` with the buyer banner "Your issue has been reported … **Auto-complete is paused**", but the backend auto-complete processor (`rpc_process_auto_complete`) only gates on the legacy `disputed_at` column — which the `open-dispute` Edge Function **never sets**. When the auto-complete window elapsed, the trade **auto-completed**, the item was marked **sold**, and a **$14.40 seller payout was queued** while the buyer's no-show dispute remained open. The prior iOS D02/E02 "PASS" verdicts were achieved with a DB setup that manually set `disputed_at` — a state the real UI flow never produces — so this gap was masked on iOS and only surfaced on Android's real path. (→ **E02/D02 FAIL**, tracker flipped to OPEN.)

**Also critical (content):** the Liability Disclaimer modal body is a **verbatim Amazon Services Business Solutions Agreement commercial-liability-insurance text** ("Amazon.com", "USD 10,000", S&P A- insurance criteria…). A kids' marketplace showing Amazon's seller insurance terms is a serious copy/content defect on a Tier-1 gating modal.

**Config-propagation result (the 5 folded-in pairs):** all 5 config keys were written to a fresh value, verified live on the mobile app (server + UI), and reverted with DB verification — **no systemic config-fetch/propagation defect** found in any of the 5 pairs. This is consistent with 43a-exec's config-cache model (fresh-on-remount / fresh server reads).

---

## Verdict table (Android — this round's executed cases)

| Guide TC | Tier | Verdict | Top evidence |
|---|---|---|---|
| **A01** Cash-Only full happy path | T1 | ✅ **PASS** | Trade `0b8638a7` (Vintage Comic $25): offer (VISA 4242 hold, fee $1.49) → seller accept (in_progress, auto_complete +72h) → buyer I Got It → Complete → `completed`; seller payout queued `requires_action` $20 net ($25 − 20% seller fee) |
| **A02** Accept-SP full happy path | T1 | ✅ **PASS** | Trade `007e7b4a` (LEGO $30 Toys, 8 SP): cash $22 + 8 SP + fee $1.49 + tax $2.10 (on full $30 base) = $25.59; 16→15 clamp at Toys 50% cap; complete → `completed`, `sp_transferred_at` at completion (single event), `seller_sp_earned` 17 (8 buyer + 9 platform bonus, mult 1.20), buyer reserved 18→10, seller pending 442→459 |
| **B02** Offer expiry mechanics (seller never responds) | T1/CP | ✅ **PASS** | Fresh `offer_timeout_hours` 24 → new offer `40e0bd31` expiry **+24.0h** (baseline +48h) → fast-clock expiry → `cancelled` "Offer expired" |
| **B05d** Expired offer frees slot | T1/CP | ✅ **PASS** | After expiry, 0 pending to seller (slot freed) |
| **B05f–j** Per-seller cap + admin config propagation | T1/CP | ✅ **PASS** | Cap 3→5 fresh → 5 pending built (ef-repro) → 6th **HTTP 409 MAX_PENDING_OFFERS "You have 5 pending offers"** (server) + UI **"Too Many Open Offers / You have 5 pending offers"** modal with named list → reverted to 3 |
| **C01** SP reserved on offer | T3 | ✅ **PASS** | Offer 8 SP: wallet available 490→482, reserved 10→18 |
| **C03** SP restored on offer expiry | T3 | ✅ **PASS** | Expired trade → available 474→482, reserved 18→10 |
| **C05** SP released to seller at completion | T3 | ✅ **PASS** | `sp_transferred_at` at completion; seller pending 442→459 |
| **C08** SP entry capped by category cap | T1/CP | ✅ **PASS** | Toys `sp_spending_cap_percent` 50→60 fresh → RC Car $25 slider "Max: 15 SP (60% of price)"; over-cap 16 → HTTP 400 `SP_CAP_EXCEEDED` "accepts up to 15 SP" → reverted 50 |
| **D06** Pickup window → auto-complete deadline | T1/CP | ✅ **PASS** | `pickup_window_hours` 72→48 fresh → accepted LEGO trade `auto_complete_at` = **+48.0h** (baseline +72h) + buyer banner "auto-completes in 48h" → reverted 72 |
| **E01** Buyer opens Report a Problem + submits | T1 | ✅ **PASS** | IssueReportModal fully AX-exposed; submit → `dispute_status='reported'`, reason `no_show`; buyer banner "Dispute in progress / … Auto-complete is paused" |
| **E02** Disputed trade does not auto-complete | T1 | 🔴 **FAIL (P1)** | Reported dispute auto-completed on clock advance → item sold + seller payout queued (see top finding) |
| **E03** Buyer UI during dispute | T1 | ✅ **PASS** | Amber dispute banner replaces auto-complete banner ("Our team will review within 24 hours") |
| **E07** Report modal — no reason (disabled submit) | T1 | ✅ **PASS** | `issue-submit-button` disabled with no reason |
| **E08** Report modal — non-Other reason enables | T1 | ✅ **PASS** | Selecting "Seller was a no-show" enabled submit; no textarea |
| **H02** Subscriber buyer used SP — "You saved $X" | T2 | ✅ **PASS** | Buyer completion: "Got it! You saved $8.00 using SP! You have 482 SP available." |
| **I01** Safe meetup card (buyer, in_progress) | T2 | ✅ **PASS** | "Trade Smart, Trade Safe" card with tips on buyer in_progress timelines (3 trades observed) |
| **I06** Liability disclaimer gates purchase | T1 | ✅ **PASS** (content FAIL) | Checkbox → Accept & Continue enabled → offer created; ack recorded on trade (`disclaimer_acknowledged=true`, policy `4f41639e`) — **modal body = Amazon TOS text (CRITICAL content finding)** |
| **I07** Disclaimer Cancel — no trade | T1 | ✅ **PASS** | Cancel closed modal, 0 trades created |
| **I08** Disclaimer ✕ close — no trade | T1 | ✅ **PASS** | ✕ closed modal, no trade |
| **I09** Disclaimer checkbox resets on reopen | T1 | ✅ **PASS** | Reopen → unchecked + Accept disabled |

**Roll-up (executed):** 19 PASS · **1 FAIL (P1)** · 0 BLOCKED. **Deferred (explicit, see Known Gaps):** the broad remainder of Groups B–J on Android (Tier 2/3 breadth), G notifications, Group J escalation, E04/E05/E06, B06/B10/B11/H01/H03/H04/H05/I10/I11, and the A03/A04/D05 post-MVP exclusions.

**Deferred-19 / Z-group cross-checks (brief requirement):**
- **Group A deferred cases confirmed excluded:** the guide's top-of-Group-A note defers **TRD-TC-A03** (platform-SP reward for cash-only Accept-SP trades) and **TRD-TC-A04** (Donate listings) to post-MVP (`MODULE-15.1.2-TradeFlowV2-DEFERRED-MANUAL-TESTING.md`). **D05** ("did not test, post MVP") also excluded. No other A–J case is marked deferred by the guide; the "19 deferred" figure referenced in the brief is not enumerated inside A–J (only via the separate DEFERRED guide + the tracker's Remaining list).
- **TRD-TC-Z01–Z08 (cancel-request escalation):** confirmed present in the guide's index (L347–354), bodies marked "did not test". **Not attempted** — out of scope per the brief; needs a dedicated multi-party fixture round.

---

## The 5 folded-in config-pairs — explicit before/after values (43a-exec reporting format)

| Config key | Case(s) | Before → After (fresh) → Reverted | Propagation | Android verdict |
|---|---|---|---|---|
| `max_pending_offers_per_seller` | B05f–j (offer cap enforcement) | 3 → **5** → 3 | Live server read per offer; UI alert built from server error | ✅ PASS — 6th offer HTTP 409 at 5; UI "Too Many Open Offers / You have **5** pending offers" (not the old 3) |
| `offer_timeout_hours` | B02 (offer expiry timing) | 48 → **24** → 48 | Live at offer-creation (offer_expires_at) | ✅ PASS — new offer expires **+24.0h** (baseline +48h) |
| `offer_timeout_hours` | B05d (expired offer frees slot) | 48 → **24** → 48 | Same as above | ✅ PASS — expiry processed → slot freed + SP restored |
| `sp_spending_cap_percent` (Toys category) | C08 (SP slider cap) | 50 → **60** → 50 | Live per mount (`fn_item_effective_sp_cap` server-authoritative) | ✅ PASS — slider "Max: 15 SP (60%)"; server `SP_CAP_EXCEEDED` at 16 |
| `pickup_window_hours` | D06 (pickup countdown) | 72 → **48** → 72 | Live at accept-time deadline computation | ✅ PASS — accepted trade `auto_complete_at` +48.0h + buyer banner "48h" |

**Brief discrepancy recorded (finding-level, not a defect):** the brief (from the 43a audit) listed **C08 → `sp_max_percentage_per_purchase` (global fallback)** as the lever. Source-verified this round (`TradeOfferScreen.fetchData` + `categoryService`): for **categorized** items the slider cap is driven by `categories.sp_spending_cap_percent` (via `fn_item_effective_sp_cap`); `sp_max_percentage_per_purchase` is only the fallback for items **without** a category (all staging items are categorized). C08 was therefore executed via the real category-cap lever (admin `/categories` → SP Config), which is the propagation path that actually reaches the slider.

**All 5 writes were reverted to their baseline values and DB-read-back verified** (`updated_by 1a546991…`). No staging config left changed. See `ledger.md`.

---

## Clock-fast-forward confirmation (brief requirement)

**The clock fast-forward mechanism works identically on Android** — it is a DB-side mechanism (`UPDATE trades SET offer_expires_at/auto_complete_at/pending_sp_release_at = now()+interval`, then `rpc_process_expired_offers` / `rpc_process_auto_complete` / `rpc_release_pending_sp`) against the shared staging DB, fully platform-independent. It was exercised repeatedly and successfully on Android this round: B02/B05d/C03 offer expiry (processed 1), D06 auto-complete deadline (+48h verified via the clock value), and the E02 disputed-trade auto-complete (processed 1). No transfer issue. One note: the first RPC run after the +5s write often returns `0` (races the window) — re-run after ~6s (R14, verified again on Android).

---

## Per-group / per-case detail

### Group A — Core Happy Paths
- **A01 (Cash Only)** — Buyer (subscriber): Request to Buy on Vintage Comic Book Collection ($25, Books, cash-only) → Make Offer (VISA •••• 4242 saved, "Safety & Platform Fee $1.49", "Tax Free $0.00", Total $26.49) → Send Offer → Liability Disclaimer modal (checked → Accept & Continue) → "Trade Initiated!". Seller accept → "Offer Accepted! Payment authorized. Trade is now in progress." → in_progress (auto_complete_at +72h baseline; auth expiry +7d). Buyer I Got It → Complete → "Trade Complete!" + Rate Seller. **DB:** completed 21:30:13; PaymentIntent `pi_3UDWY8…`; seller payout `requires_action` net **$20.00** ($25 − 20% seller fee).
  - Driver notes: the pinned Send Offer / I Got It CTAs render below the floating tab bar and needed anchored scrolls to clear the tab band before tapping (R31/R77#14). All testIDs identical to iOS.
- **A02 (Accept SP)** — Buyer on LEGO Star Wars Set ($30, Toys): SP field max hint "Max: 15 SP (50% of price)" (Toys 50% baseline) → typed 16 → **clamped to 15** (A02 "clamps at $15" ✓) → set 8 SP → card "$22.00 + 8 SP applied"; value stack Offer $22 + SP discount −8 SP + fee $1.49 + Sales Tax $2.10 = Total cash $25.59 (guide's legacy "$23.49" total predates the tax line — **doc-drift note**) → disclaimer accept → "Trade Initiated! / **Got it! You saved $8.00 using SP! You have 482 SP available.**" (H02). Seller Review Offer showed "17 SP releasing in 2 days after completion" + payout $22 − $4.40 = $17.60. Buyer I Got It → Complete → "Trade Complete!". **DB:** completed 21:35:34; `sp_transferred_at` set at completion (single SP event); `seller_sp_earned` 17 = 8 buyer + `seller_sp_bonus` 9 (mult 1.20); buyer reserved 18→10 (only the pre-existing phantom 10 remains), available 482; seller pending 442→459. **(C01/C05/H02 all PASS.)**

### Group B — Offer Lifecycle (executed subset)
- **B02/B05d (offer expiry, config-pair)** — see config table. Expiry fast-clock: trade `40e0bd31` → `cancelled`, `cancellation_reason='Offer expired'`; notification log rows generated to both buyer (`offer_expired`, item_still_available true) and seller (`offer_expired_seller`). SP restored (C03). Slot freed (B05d). The **seller-ignore streak nudge** (2nd sequential unanswered expiry) was **not** driven — needs 2 sequential expiries + seller push environment (Tier-2 sample, deferred).
- **B05f–j (per-seller cap, config-pair)** — see config table. UI alert modal "Too Many Open Offers" listed the 5 named open offers (DT-41 improvement) — good copy. A dev-only LogBox console.error strip (`createTradeOfferWithHold invoke error: …`) surfaced on the expected rejection — **dev-build noise, not user-facing** (expected business rejection logged via console.error).
- B01/B03/B04/B05a–c/B05e/B06–B13 not driven this round on Android (see Known Gaps).

### Group C — SP Behavior (Tier-3 fast pass, folded)
- C01 (reserve on submit), C03 (restore on expiry), C05 (release to seller at completion) verified via DB read-backs during the A/B drives. C02 (restore on decline), C04 (stays reserved on accept), C06 (restore on seller cancel in_progress), C07 (free-user locked chip) not driven this round — C04 is trivially implied by C05's at-completion transfer (SP stays reserved through accept); C02/C06 need decline/cancel drives (deferred).

### Group D — Auto-Complete & Timers (Tier-3 + D06 config-pair)
- D06 config-pair PASS (see config table). D01 (auto-complete fires when buyer never taps) is effectively confirmed *by the E02 finding's mechanism* (the processor auto-completes past-due in_progress trades — it fired on the disputed trade), but a clean non-disputed D01 run was not separately driven (deferred). D04's buyer-only banner observed at both 72h and 48h on buyer timelines (screenshot). D03 countdown pill: seller offers showed "48h left" / "48h 1m left" green pills (baseline). D02 → see E02 P1 (flipped OPEN).

### Group E — Dispute Flow (real UI path — the round's biggest catch)
- **E01/E03/E07/E08 PASS** and **E02 FAIL (P1)** — see top finding + verdict table. The IssueReportModal is fully AX-exposed on Android (5 `issue-reason-*` rows, `issue-submit-button` disabled-until-reason, `issue-cancel-button`).
- E04 (seller dispute UI), E05/E06 (admin resolve Complete/Refund) **not driven** — after the E02 auto-complete the disputed trade is no longer in_progress, so the seller-dispute UI and the admin-resolve loop couldn't be exercised on it this session (deferred; would need a fresh in_progress disputed trade — note: a fresh dispute would re-trigger the E02 P1 unless fixed).
- E09/E10 (Other + min-20 description; submit success/error) not driven (deferred).

### Groups F, G, H, I, J (partial)
- **F** (payout): F01-equivalent observed (seller payout queued on A01 completion, `requires_action`, $20 net) and F03 state observed (test-seller's payout method is `pending_verification` in test mode → `requires_action`). F02 (payout held when dispute open) is **directly contradicted** by the E02 P1 (a payout was *created* on the disputed auto-complete) — F02's "held" premise only holds if `disputed_at` were set. Flag under the P1.
- **G** (notifications): none driven on Android this round (timing/push variants; deferred).
- **H**: H02 PASS (A02). H01/H03/H04 (free-buyer CTA, seller SP-pending notice, cash-only upsell) not driven — the seller completion screens for A01/A02 weren't opened as test-seller post-completion (deferred).
- **I**: I01 PASS (safe meetup card observed on 3 buyer in_progress timelines), I06–I09 PASS (disclaimer modal; **Amazon-text content finding**), I02–I05/I10/I11 not driven (I10 loading state not forceable; I11 non-trade surfaces sampled implicitly — no disclaimer modal appeared on listing/profile/navigation actions observed).
- **J** (seller cancel escalation): **none driven** — needs dedicated in_progress fixtures + prior-post-acceptance-cancel counter management on the shared test-seller persona; J02/J03 would alter the shared seller's cancel counters (fixture-consumption concern). Deferred with explicit reason.

---

## Evidence (screenshots in `screenshots/`)
- `A01-itemdetail-cashonly.png` — Cash-Only listing (single Request to Buy + cart; no SP badge)
- `A01-makeoffer-cashonly.png` — Make Offer value stack ($25 + $1.49 + Tax Free)
- `I06-disclaimer-modal-amazon-content.png` — **Liability Disclaimer modal showing Amazon TOS insurance text**
- `A01-seller-accepted.png` / `A01-buyer-timeline-igotit-safe-meetup.png` / `A01-buyer-trade-complete.png`
- `A02-sp8-entry-max15.png` / `D06-autocomplete-48h-banner.png` / `A02-buyer-trade-complete-saved8.png`
- `B05f-cap5-blocking-alert.png` — "Too Many Open Offers / You have 5 pending offers" modal
- `C08-toys-cap60-max15.png` — RC Car SP hint "Max: 15 SP (60% of price)"
- `E01-dispute-banner-buyer.png` — "Dispute in progress / Auto-complete is paused" banner (proven false by E02)
- `devmenu-check.png` — dev-launcher / splash states

---

## Design-system / copy review highlights (three-layer, per §6)
- **Wording (CRITICAL):** Disclaimer modal body is Amazon's commercial-liability-insurance legal text — a raw, irrelevant legal dump on a kids' marketplace gating modal. Concrete rewrite needed to a short parent-appropriate liability/conduct disclaimer for the platform.
- **Wording (minor):** "17 SP releasing in 2 days after completion" (seller Review Offer) vs the DB `pending_sp_release_at` = +72h (3 days) — the copy says "2 days"; verify which is intended (possible off-by-one or clock-rounding drift).
- **Design-system:** The visited screens/modal used on-brand tokens (primary green pills `#5DBB8E`, correct pill/spacing); no off-brand hex hits observed on the rendered screens. Native-modal palette checks: all buttons rendered in the documented pill colors. Disclaimer modal checkbox row + Cancel/Accept & Continue follow the documented pattern. No raw support-email surfaces seen on visited screens.
- **Design & Copy Compliance:** every screen/modal visited is enumerated in the §8.3 handoff.

---

## Files
- `report.md` (this file)
- `ledger.md` — per-config write/revert ledger
- `screenshots/*.png` — evidence

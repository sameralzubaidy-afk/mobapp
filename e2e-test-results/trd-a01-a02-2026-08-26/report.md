# QA Session Report — TradeFlowV2 Group A (TRD-TC-A01, A02) — 2026-08-26

**Agent:** QA Test Agent · **Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (canonical)
**Device:** iPhone 17 Pro Max simulator (iOS 26.1), app "Pass It Up!" (`com.sameralzubaidi.p2pmarketplace`)
**Staging:** `drntwgporzabmxdqykrp` · **Evidence:** `e2e-test-results/trd-a01-a02-2026-08-26/screenshots/`

---

## Executive summary

**Both TRD-TC-A01 and TRD-TC-A02 are BLOCKED at the offer-submission step** by a confirmed backend defect:
`create-trade-offer` (deployed **v52**) returns **HTTP 402 — "Payment Hold Failed — Missing required param: amount."**
(Stripe `paymentIntents.create` error) on **both** the Cash-Only and the Accept-SP offer paths. No trade row is
created and no SP movement occurs — the atomic D-30 offer creation fails before insert. The guide's inline
**"Passed TRD-TC-A01/A02" markers are NOT accurate**: these cases cannot pass on the current build/staging.

Substantial pre-submission evidence was still collected (item-detail assertions, Make-Offer SP cap/breakdown,
disclaimer gating) plus several independent findings (missing "Cash Only" badge, Amazon boilerplate in the
Liability Disclaimer, seed-data gaps, design-system deviations).

---

## Precondition setup (executed)

1. **Stale pending-offer cleanup:** test-buyer had **3 stale `pending` offers** to test-seller (created 2026-08-25,
   `stripe_payment_intent_id IS NULL`, wrong `cash_amount_cents=4500` on LEGO $30 / Bicycle $60 items — seed/DBA
   artifacts). These sat exactly at the **per-seller cap (3)**, blocking any new offer. Cleared via the **in-app
   buyer cancel flow** (3× cancel → "Trade Cancelled"). DB-verified: all 3 now `status='cancelled'`
   (`cancelled_at` 23:08–23:09Z).
2. **DB precondition verified (read-only):** test-buyer — subscription `active`, wallet `active`, SP **46 available
   / 10 reserved** (≥15 ✓), node Norwalk Central 06850. test-seller — subscription `trial` (still subscriber-class),
   wallet state **`frozen`** (noted; available 1816 / pending 65). test-buyer has a saved card (MASTERCARD •••• 4444).

---

## TRD-TC-A01 · Cash Only happy path — **BLOCKED**

**Guide/TC:** (TradeFlowV2, TRD-TC-A01) — Cash Only: full happy path (buyer confirms receipt).

### Execution trace (abridged, in order)
1. Logged in as **test-buyer** (email/password; keyboard suppressed via Cmd+K; fields verified after each entry — §5.2).
2. Trades tab → cancelled 3 stale pending offers (see precondition).
3. Discover → search **"QA Dev Fixture Item"** (the "Vintage Comic" $25 cash-only item `07af560b` was **not searchable —
   it has 0 images**; used `83c8823b` "QA Dev Fixture Item" $25 cash-only instead — same cash-only class, same seller).
4. Item Detail (`83c8823b`): verified single **Request to Buy** button, **no Use SP** button, **no "Cash Only" badge** (see findings).
5. Request to Buy → **Make Offer** screen: no SP section (cash-only ✓), saved card MASTERCARD •••• 4444 ✓,
   value stack **$25.00 + $1.49 fee + $0.00 tax = $26.49 total cash** ✓.
6. Send Offer → **Liability Disclaimer modal** (gates purchase) → checked checkbox → **Accept & Continue**.
7. ❌ **"Payment Hold Failed — Missing required param: amount."** (in-app GlobalAlertProvider dialog). Tapped OK.
8. DB: **no trade created**; SP wallet unchanged (46/10).
9. Edge log `function_edge_logs` 2026-08-26 23:18:37Z: `POST | 402 | …/create-trade-offer`.

### Assert result: **BLOCKED**
- Item-detail pre-submission: PASS for single Request to Buy + no Use SP. **FAIL** for the "Cash Only" badge (does not render — see findings).
- Offer submission: **BLOCKED** (backend 402). Consequently seller-acceptance, auto-complete banner, completion screens, "Rate Seller"/"Rate Buyer" **not reachable**.

### Screenshots
`09-item-detail-cashonly.png` (item detail), `10-make-offer.png` (value stack), `11-…14-…` (disclaimer + checkbox),
`21-logbox-sp-offer-error.png` (same error surfaced as LogBox).

---

## TRD-TC-A02 · Accept SP happy path — **BLOCKED**

**Guide/TC:** (TradeFlowV2, TRD-TC-A02) — Use SP slider → seller accepts → buyer confirms.

### Execution trace (abridged)
1. Still test-buyer. Discover → search **"LEGO"**. test-seller's canonical $30 Accept-SP item (`b3ab73b6` "LEGO Star Wars Set")
   is **not searchable (0 images)** — **seed-data gap**. Used `2e24f880` "Lego Star Wars Set" $25.99 (Accept SP) instead
   (**actor deviation noted**: seller is `bob.11demo@example.com`, not test-seller).
2. Item Detail: shows **"Swap Points Eligible"** (Accept-SP indicator), single **Request to Buy** button
   (**no [Send offer] + [Use SP] two-button layout** — see findings).
3. Make Offer: **ADD SP OFFER** input present (subscriber), hint **"Max: 12 SP (50% of price)"** ✓ (50% of $25.99 = 12).
4. Entered **8 SP** → YOU OFFER **$17.99** ($25.99−8) + **"8 SP applied"** badge ✓.
5. Over-cap test: typed "13" (field became "813") → **clamped to 12 SP**, YOU OFFER $13.99 ✓.
6. Full value stack @ 12 SP: offer **$13.99**, **SP discount −12 SP**, fee **$1.49**, tax **$1.82**, **total cash $17.30**
   (13.99+1.49+1.82 = 17.30 ✓).
7. Send Offer → Disclaimer modal → checkbox + Accept & Continue → ❌ **LogBox Console Error:
   "[trade] createTradeOfferWithHold invoke error: Missing required param: amount."** (trade.ts:730) — same 402 backend failure.
8. DB: **no trade created**, SP wallet unchanged (46/10) — the guide's "8 SP moved available→reserved" **did not occur**.

### Assert result: **BLOCKED**
- SP cap at 50% + clamp: **PASS** (12 SP = 50%, over-cap clamps).
- 8-SP application + breakdown structure: **PASS** (internally consistent).
- "Accept SP badge" wording: **PARTIAL** (shows "Swap Points Eligible", not "Accept SP").
- Two-button [Send offer]+[Use SP]: **FAIL** (doc drift — single Request to Buy).
- Offer submission + full completion: **BLOCKED** (same backend 402).

### Screenshots
`16-item-detail-accept-sp.png`, `17-make-offer-sp8.png`, `18-make-offer-sp-clamp.png`, `20-make-offer-sp12-breakdown.png`,
`21-logbox-sp-offer-error.png`.

---

## Cross-case findings

### P1 — Backend: `create-trade-offer` Stripe hold fails (BLOCKS all offers)
- **Symptom:** "Payment Hold Failed — Missing required param: amount." on cash-only AND Accept-SP submissions.
- **Evidence:** on-device dialog + LogBox (`createTradeOfferWithHold invoke error`), Edge log `POST 402` @23:18:37Z,
  no trade rows created, no SP movement.
- **Root-cause direction (dev task):** deployed `create-trade-offer` **v52** computes
  `stripeAmount = cashCents + finalTaxCents` then calls `stripe.paymentIntents.create({ amount: stripeAmount, … })`;
  the 402/"Missing required param: amount" indicates `stripeAmount` resolved to `NaN`/undefined at call time on the
  deployed build (fee/tax path). `resolveBuyerFee` throws rather than returning NaN, so the repo source differs from the
  deployed behavior — **deployed-vs-repo drift suspected**. Deployed `updated_at` ≈ 2026-08-09.
- **Blast radius:** every single-item and bundle offer submission on staging. **P0/P1 for any trade testing.**

### P2 — Copy/legal: Liability Disclaimer contains Amazon seller-agreement boilerplate
- The "Liability Disclaimer" modal body is **verbatim Amazon "Services Business Solutions Agreement" text**
  ("…on Amazon.com", "USD 10,000 in gross proceeds… in the Amazon.com store", "occurrence basis", "claims-made policy",
  "$1 million per occurrence"). Irrelevant/confusing for a kids' P2P marketplace; a legal-content defect
  (wording/copy FAIL, §6.3).

### P2 — Spec gap: no "Cash Only" badge on cash-only item detail
- Guide A01 expects a "Cash Only" badge; `ItemDetailScreen.tsx` renders **no such badge** (only an "SP Accepted" badge
  for non-subscribers on Accept-SP items). Source + on-device OCR confirm absence.

### P2 — Doc drift: "Accept SP" item detail shows single "Request to Buy", not [Send offer]+[Use SP]
- Guide A02 expects two buttons on Accept-SP item detail. Build shows a single **Request to Buy** button
  (the "Use SP 🔒" chip is only for free users; SP entry happens on the Make Offer screen).

### P3 — Seed data: test-seller's Accept-SP and key cash-only seed items are not discoverable
- `b3ab73b6` ($30 LEGO, guide's A02 item), `fa44f753` (Harry Potter), `07af560b` (Vintage Comic) all have **0 images**
  and are excluded from Discover search; the node feed only surfaces items with images. This forced A02 onto a
  non-test-seller item.

### P3 — UX/layout: sticky bottom buttons partially occluded by the tab bar
- On Make Offer and Trade Timeline, the primary bottom button (Send Offer / Cancel Trade) renders **behind the bottom
  tab bar** (content `paddingBottom: 32` < tab-bar height). Only a thin ~8–14pt sliver is tappable; the button must be
  scrolled up to use comfortably. Reaches the button only via edge-tap or scroll. **Structural/affordance issue (§6.2).**

### P3 — Design-system deviations (against `docx/design-system-passitup.md`)
- **CancellationReasonModal** "Cancel Trade" primary button uses **`#ff6b6b`** (not the documented error red `#E85D75`);
  selected-reason text uses **`#0066cc`** (not the documented primary green `#5DBB8E`).
- **DisclaimerModal** "Cancel" is an outlined style with green border/text (acceptable as secondary), but the modal is a
  full-screen `Modal` (not a centered dialog per the design doc's modal pattern); disabled Accept renders light-green
  `#ABDAC4` (opacity 0.5) — low-contrast.
- Item-detail price breakdown "Safety & Platform Fee $1.49" vs Make Offer "Safety & Platform Fee $1.49" — consistent.

### Doc drift (guide vs build, empirical)
- Guide "native Alert.alert" categories here render in-app: **"Payment Hold Failed"** is `GlobalAlertProvider`
  (AX-instrumentable `global-alert-button-0`) — Option B not needed. The **Liability Disclaimer** and
  **CancellationReasonModal** are native `ui/Modal`s (buttons not AX-exposed; pixel-scan used).
- A02 "Use SP slider" — the build uses a **numeric SP input** (`sp-amount-input`), not a slider.
- A02 completion copy "Got it! You saved $8 using SP." — `TradeSuccessScreen` actual template is
  "You saved $8.00 using SP! You have N SP left." (unverified at completion; from source).

---

## Locator-gap findings
- Native modal buttons (Disclaimer checkbox/Accept, CancellationReasonModal reasons/buttons) are **not AX-exposed**
  (tree truncates at ~2000 chars); resolved via pixel-scan + OCR. Recommend instrumenting modal footers with
  accessible `testID`s (BP-53) for future runs.
- The AX-tree inline truncation (mobile-mcp) hit every large screen; coordinates for non-exposed modal controls were
  obtained via OCR/pixel-scan (per §5.1/§5.23 approved scripts).

## Friction vs operating rules
- Simulator software keyboard re-showed on field focus repeatedly; Cmd+K did not always stick (known quirk) — handled per
  §5.2/§5.19. One accidental Sell-sheet open from a tab-bar-overlap tap (dismissed via overlay). No field corruption.

---

## App State Left Behind
- test-buyer still logged in (on the Make Offer screen for the $25.99 Accept-SP LEGO item). Session/tab state normal.
- **3 stale pending offers cancelled** (Kids Bicycle `7fe66cf0`, LEGO `03949473`, Nintendo `d0bcedeb`) — now `cancelled`.
- **No new trades created**; **no SP movement** (test-buyer wallet 46/10, reserved 10 unchanged).
- `bob.11demo`'s LEGO item `2e24f880` opened but **no offer submitted** (submission blocked).
- test-seller wallet state `frozen` (pre-existing, unchanged).

## How to Verify/Reproduce
- Evidence: `e2e-test-results/trd-a01-a02-2026-08-26/screenshots/` (`00-…` → `23-…`).
- Repro the blocker: log in as test-buyer → any available item → Request to Buy → Send Offer → accept disclaimer →
  "Payment Hold Failed — Missing required param: amount."; Edge log shows `POST 402` on `/create-trade-offer`.
- Edge log: `function_edge_logs` source, request `01a0405e-44cc-79cf-8ff4-ece9a2f98a08` @ 2026-08-26 23:18:37Z.

---

## 📋 QA Session Handoff

**Test Scope:** TRD-TC-A01 (Cash Only happy path), TRD-TC-A02 (Accept SP happy path) — TradeFlowV2 Group A.
**Design-System Compliance:** PARTIAL — deviations found: CancellationReasonModal primary `#ff6b6b` (vs documented
`#E85D75` error red) + selected-reason `#0066cc` (vs `#5DBB8E`); DisclaimerModal full-screen layout + low-contrast
disabled button; sticky bottom CTAs occluded by tab bar.
**Perceived Load-Time Verdict:** GOOD — all observed transitions (login, Discover, item detail, Make Offer, modal
opens/closes, LogBox) rendered within the ideal UX threshold (<3s); no transition ≥3s flagged. (Dev-build note: none.)
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login screen: layout/copy match design-system (branded, no raw support email).
- CONFIRMED — Home/Discover: node header, tab bar, search/filter controls render consistently.
- CONFIRMED — Item Detail (cash-only & Accept-SP): price breakdown internally consistent; seller info correctly
  masked pre-trade.
- CONFIRMED — Make Offer screen: value stack (offer/fee/tax/total), saved-card display, SP cap hint all correct.
- DEVIATION — Item Detail (cash-only): no "Cash Only" badge (guide expects one; spec gap).
- DEVIATION — Item Detail (Accept-SP): shows "Swap Points Eligible" + single Request to Buy (guide expects "Accept SP"
  badge + [Send offer]/[Use SP] two-button).
- DEVIATION — Liability Disclaimer modal: body is **Amazon seller-agreement boilerplate** (wrong legal copy for a kids
  marketplace); Cancel outlined vs documented secondary; disabled state low-contrast.
- DEVIATION — CancellationReasonModal: primary Cancel Trade `#ff6b6b`, selected-reason `#0066cc` (non-palette).
- DEVIATION — Trade Timeline / Make Offer: bottom CTAs partially occluded by tab bar.
**Verdict Summary:** 0 PASS / 0 FAIL / **2 BLOCKED** / 0 SKIPPED
**Critical Findings:**
1. **P1 backend blocker:** `create-trade-offer` v52 returns 402 "Missing required param: amount." — blocks ALL
   offer submissions (cash + SP). No trade/SP side effects. Root-cause (deployed-vs-repo drift around Stripe `amount`)
   is a dev fix. This is why the guide's inline "Passed" markers are false.
2. **P2 legal/copy:** Liability Disclaimer body is Amazon seller-agreement boilerplate (not marketplace-appropriate).
3. **P2 spec gap:** No "Cash Only" badge; Accept-SP item detail lacks the documented [Send offer]+[Use SP] two-button.
4. **P3 seed data:** test-seller's Accept-SP seed items (incl. guide's $30 LEGO) not searchable (0 images).
5. **P3 design-system:** non-palette modal colors; bottom CTAs occluded by tab bar.
**App State Left Behind:** test-buyer logged in on Make Offer; 3 stale pending offers cancelled; no new trades/SP changes.
**Why It Matters:** The two flagship TradeFlow happy paths — and by extension the entire Group A–… trade suite — cannot
run while `create-trade-offer`'s Stripe pre-auth hold is broken. Any "pass" recorded for these cases is stale/false.
**How to Verify/Reproduce:** See "How to Verify/Reproduce" above (screenshots + edge log request id).
**Known Gaps / Not Tested:** Seller acceptance, buyer I Got It/Confirm, auto-complete banner, completion screens,
Rate Seller/Rate Buyer, SP reservation/release — all unreachable behind the offer-submission blocker. A03/A04
intentionally not executed (post-MVP per guide; out of this batch).
**What Needs To Be Fixed Next:**
1. **Fix (P1): `create-trade-offer` Stripe pre-auth `amount`** — deploy a version where `stripeAmount` is guaranteed a
   finite positive integer before `paymentIntents.create` (guard `cashCents`/`finalTaxCents`; align deployed code with
   repo). Re-run A01/A02 after deploy.
2. **Fix (P2): replace the DisclaimerModal body** with a marketplace-appropriate liability disclaimer (remove Amazon
   boilerplate).
3. **Fix (P2): add a "Cash Only" badge** to `ItemDetailScreen` for `accepts_swap_points=false` listings (and reconcile
   the guide's "Accept SP two-button" expectation with the actual single Request-to-Buy + Make-Offer SP input).
4. **Fix (P3): seed images** for test-seller's Accept-SP/cash-only seed listings so they surface in Discover.
5. **Fix (P3): bottom-CTA padding** on Trade Timeline / Make Offer so Send Offer / Cancel Trade are not occluded by the
   tab bar.
6. **Fix (P3): modal palette** — CancellationReasonModal `#ff6b6b`/`#0066cc` → documented `#E85D75`/`#5DBB8E`.
**UX Enhancement Ideas (optional, not defects):** None this run — the blocking defect precluded observing enough of the
post-submission experience to justify forward-looking ideas beyond the fixes above.
**Suggested Next Session:** Re-run TRD-TC-A01 + A02 immediately after the `create-trade-offer` fix is deployed; then
proceed to Group B (offer lifecycle) which shares the same submission path.
**Suggested to Improve Agent Rules:** Consider a standing "verify deployed Edge Function == repo source (version/updated_at)"
pre-flight for payment-critical cases, since a deployed-vs-repo drift (v52) silently produced a 402 that the repo source
could not explain — a quick check would have predicted the blocker before device time.

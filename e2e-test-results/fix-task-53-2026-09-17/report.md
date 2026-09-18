# FIX-Task-53 — SUB Android Final Closing Round follow-ups (12 items)

**Date:** 2026-09-17
**Source:** QA SUB Android Final Closing Round (2026-09-17) — `e2e-test-results/qa-sub-android-r8-final-2026-09-17/`
**Scope:** 12 items (1 MED-HIGH functional, 4 MED/LOW-MED, 1 audit, 2 tooling/enablement, 1 locator re-check, 4 UX enhancements)
**Verdicts this round:** 1 fixed + driven PASS on device · 1 disproven premise (reported as a different real finding) · 1 audit complete (6 sites fixed) · 2 fixed + unit-verified · 1 tooling fix proven live · 1 re-closed as a non-gap · 1 enablement blocker confirmed · 2 UX items satisfied/deferred · 1 UX item pending an owner design call
**Tier 0:** typecheck **PASS** · lint **0 errors** (3 pre-existing warnings in `PayoutSettingsScreen.tsx`, none added by this change) · focused suites **5/5, 89 tests PASS**

---

## 0. Two brief premises were wrong — verified before coding (§9.1e)

| Brief claim | Verified reality | Consequence |
|---|---|---|
| Item 2: "the same fee-tier ternary bug exists at `TradeInitiationScreen.tsx:436`" | `TradeInitiationScreen.tsx` is an **ORPHAN** — nothing in the app imports it. `AppNavigator.tsx:38` imports `TradeOfferScreen` and line 701 registers it for the route named `TradeInitiation`. | The line cannot bill anyone. Owner chose: document the orphan + apply the predicates for consistency (not a live defect). |
| Item 2: "confirm the actual fee charged to a grace user" | The fee-engine migration (`20260916000121_tiered_buyer_fee_engine.sql:122`) declares `status IN ('trial','active')`, **but the live resolver charged `test-grace` (`status='grace_period'`) the MEMBER fee $1.49** on-device (Make Offer summary **and** the created trade's timeline) — contradicting both that migration comment and `subscription.ts`'s `$2.99 for grace_period` doc/test. | **NEW OPEN ITEM — owner fee-policy decision** (see §3, finding F1). I deliberately kept the fallback behaviour-preserving (grace → 299) and corrected 5 comments to state only verified facts rather than guess the policy. |

---

## 1. What was fixed

### Item 1 [MED-HIGH] — Grace-period users could not spend Swap Points at all — **FIXED + VERIFIED ON DEVICE**

**Root cause.** `TradeOfferScreen.tsx`'s subscriber check listed the literals `'active' | 'trial' | 'grace'` and **omitted `'grace_period'`**. After FIX-Task-51 normalised the last legacy-spelled row (`subscriptions.status` legally admits both spellings — BP-76), the check matched **zero** real grace users: the SP control disappeared and `!isSubscriber` rendered the **"Save up to 75% with Swap Points / Join Kids Club+"** upsell instead — directly beneath the app's own banner saying the user *can* keep spending Swap Points, while the server said `can_spend_sp = true`.

**Fix.** A new dependency-free module `src/services/subscriptionStatus.ts` holds the pure predicates (both spellings handled), and `src/services/subscription.ts` re-exports them so existing imports keep working:

- `isGraceStatus` · `isSubscriberStatus` · `isFeeActiveMemberStatus` · `canSpendSpStatus` · `buyerSubscriptionSnapshotStatus`

`TradeOfferScreen` now gates on `isSubscriberStatus(subStatus.status)` and sends `buyerSubscriptionSnapshotStatus(...)` to the backend.

**On-device proof (iOS simulator `3F3293A3-…`, `test-grace`, trade `0ba80809-9c04-4117-bc65-2fbd09613e42`):**

| # | Frame | What it proves |
|---|---|---|
| 1 | `F53-01-make-offer-grace-sp-input.png` | Make Offer shows **`ADD SP OFFER`** + `sp-amount-input` + "Max: 15 SP (50% of price)" and `send-offer-button` **enabled** — the promised spend is now offered |
| 2 | `F53-02-grace-5SP-applied-no-upsell.png` | 5 SP entered, **`subscribe-upsell-card` absent** (item 9 closed as a consequence) |
| 3 | `F53-03-trade-initiated-grace-spent-5SP.png` | **"Trade Initiated! … Got it! You saved $5.00 using SP! You have 15 SP available."** |
| 4 | `F53-04-trade-timeline-5SP-recorded.png` | Trade Timeline records **"Swap Points Used: 5 SP"** — the spend persisted, not just rendered |

**Guide:** SUB-TC-D01 gained a documented **second leg** ("the promised spend must actually be OFFERED") with fixture recipes and the regression context.

### Item 3 [Audit] — remaining `'grace'`-only status checks — **COMPLETE**

| Site | Result |
|---|---|
| `contexts/AuthContext.tsx:813` | **Already correct** — it already handled both spellings |
| `hooks/useAuth.ts:64` | **Fixed** (was `'grace'` only) + new `src/hooks/__tests__/useAuth.test.ts` (5 tests) |
| `screens/trade/TradeOfferScreen.tsx:409` | **Fixed** (the item-1 defect) |
| `services/referralRewards.ts:326` | **Fixed** |
| `screens/subscription/UpgradePlanScreen.tsx:75` | **Fixed** |
| `contexts/AuthContext.tsx:313` (`mapStatus`) | **Fixed** — now maps both case labels to `'grace_period'` |
| `hooks/usePaymentFailure.ts`, `screens/cart/CartCheckoutScreen.tsx`, `screens/profile/ProfileScreen.tsx`, `screens/dashboard/UserDashboardScreen.tsx` | Swept onto the shared predicates |

All consumers now import from `@/services/subscriptionStatus`.

### Item 4 [MED] — G01's documented success copy was dead code — **FIXED**

**Root cause (QA R8 finding F4).** The code tested `resumingOnboarding` **first**, and that flag is true for exactly the "existing account, onboarding still incomplete" state — so it always won and the guide's documented third-bullet string could never render for its own case.

**Fix.** `result.created` is now tested **first**; the logic was extracted to `src/utils/payoutConnectCopy.ts` (mirroring the `tradeCancellationCopy.ts` convention) with **7 unit tests** pinning the branch order, and the resume path appends the phone-reverify note. Guide G01 corrected with a 🔧 note.

### Item 5 [LOW-MED] — Withdraw-guard modal reused "No Method" wording when a method exists — **FIXED**

`NoMethodModal` now takes `unverifiedMethod` + `onPrimaryAction`:

| Variant | Title | Body | CTA |
|---|---|---|---|
| No method at all | "Payment Method Required" | "To withdraw your earnings, you need to add and verify a payout method first." | "Add Payout Method" |
| **Method exists, unverified** | **"Verify Your Payout Method"** | **"To withdraw your earnings, finish setting up your payout method first."** | **"Continue Onboarding"** (Clock icon) |

The button keeps `testID="no-method-add-btn"` (guide/test stability) and its `accessibilityLabel` branches with the visible label. Pinned by 3 tests in `PayoutSettingsScreen.test.tsx`.

### Item 6 [Tooling] — `qa:set-sp-balance` false negative — **FIXED + PROVEN LIVE**

It compared the read-back against a hardcoded `'active'` instead of the requested wallet state, so every run on a non-`active` wallet printed a spurious failure.

```text
BEFORE: ✅ Wallet updated: available=20 … state=grace_period
        ❌ VERIFY FAILED: read-back does not match the requested state

AFTER:  ✅ VERIFIED: available=20 pending=0 reserved=0 state=grace_period
```

### Item 7 [Locator re-check] — `no-method-cancel-btn` Android AX exposure — **RE-CLOSED AS A NON-GAP**

Re-checked on a **fresh bundle on iOS** with `qa-payout-seller` and **0 payout methods** (`qa:payout-fixture -- methods --scenario none`), then Withdraw Now:

```
@e1 Button label="Cancel"            name="no-method-cancel-btn" at=196,568 size=47x42
@e2 Button label="Add Payout Method" name="no-method-add-btn"    at=50,504  size=340x52
@e4 StaticText "To withdraw your earnings, you need to add and verify a payout method first."
@e6 StaticText "Payment Method Required"
```

Both buttons are exposed, both carry `accessible` + `accessibilityRole="button"` + labels, and the no-method branch keeps the **original** copy. The earlier "missing from the Android AX tree" reading was the **stale-Metro-bundle artifact** (R79-1a/R79-1b) — evidence frame `F53-05-no-method-modal-ax-exposed.png`. Android could not be re-driven this session (§4).

### Item 10 [UX] — one unified "resume or add" entry point — **DONE**

New `findIncompleteOnboardingMethod()` + `resumeOrAddPayoutMethod()` resolve **once** and are reused by the modal hint, the withdraw guard, the "cannot delete only method" alert and the method card, so the app can no longer offer "Add" to a seller who already has a half-finished account. Guide G11/H04 updated.

### Item 9 [UX] — no upsell beneath the grace banner — **SATISFIED BY ITEM 1**

No separate code change was needed: with the subscriber check corrected, a grace user sees the SP control and **`subscribe-upsell-card` is absent** (frame `F53-02`).

### Item 11 [UX] — "Cancelled At" read as a live contradiction — **DONE**

`SubscriptionStatusScreen` now labels the row **`Cancelled At (historical)`** when — and only when — the row has `cancelled_at` **and** a `current_period_end` still in the future **and** a live status (`active`/`trial`/`cancelled`). Otherwise it stays `Cancelled At`. Guide E04 updated. ⚠️ Owed device leg — see §3.

### Item 12 [UX] — Item Detail Seller Info below the fold — **DEFERRED (owner decision)**

Deferred to a design call (owner-approved), not implemented.

---

## 2. Items that were reminders, not code

**Item 8 [Enablement] — `STRIPE_WEBHOOK_SECRET`.** Re-verified absent from **both** `p2p-kids-marketplace/.env` and `.env.staging` (0 occurrences); the deployed function has it. **SUB-TC-L05's positive signed leg remains BLOCKED (enablement) on one owner paste.** No code change is needed or useful until then.

---

## 3. Findings

### F1 [OPEN — owner decision, money] The live buyer-fee resolver charges a grace user the MEMBER fee

- **Observed on device:** `test-grace` (`subscriptions.status='grace_period'`) was charged **$1.49** — both on the Make Offer summary and on the created trade's timeline. **Corroborated twice more on Android (Metro log, 2026-09-18):** `checkout_fee_shown {… "fee_cents": 149 …}` for the same persona on two separate items, while `Q04`'s documented value for `grace_period` is **$2.99** — so the discrepancy is reproducible across platforms and items, not a one-off.
- **Contradicted by:** `supabase/migrations/20260916000121_tiered_buyer_fee_engine.sql:122` declares `status IN ('trial','active')` with an "owner decision 2026-08-09" comment.
- **Also contradicted by:** `src/services/subscription.ts`'s doc/test, which expects **$2.99 for `grace_period`**.
- **Why it matters:** the fee a grace-period buyer actually pays is a **revenue-policy** question, and the code, the migration comment and the unit test currently disagree. I did **not** guess: the fallback was left behaviour-preserving and the discrepancy is documented at each site so the owner can decide which behaviour is correct before anyone "fixes" it.
- **Cheapest next step:** one owner decision → then align the migration comment, the service fallback, the unit test and the on-device behaviour to it.

### F2 [INFO — documentation drift] The tracker's file-header "newest" marker is 2 rounds stale

Line 7's note is labelled `(newest)` but is dated 2026-09-16, while Round 8 (2026-09-17) and now Round 9 sit in the SUB section. Pre-existing, cosmetic, and **not fixed** here (touching another round's note would be a scope breach). Flagged for a tracker-hygiene pass.

### F3 [INFO — pre-existing, not this round] `npm run verify:guides` exits 1 on 2 pre-existing TRD tracker contradictions
`TRD-TC-S15` (status `PASS`, notes say still blocked) and `TRD-TC-T03` (notes record a superseding PASS, status cell still non-PASS). Neither is a SUB row and neither is attributable to this round. Also flagged (pre-existing, warning-level): `SUB-TC-E04`'s index row vs body heading diverge (verified **not** introduced by my edit — `git diff` contains no line mentioning that heading or index row), and 3 duplicate `ADM-TC-R01/R02/R03` headings (a documented baseline). I did **not** silently rewrite another round's TRD verdicts.

---

### F4 [NEW — needs its own task, found in this log] Cold-start auth initialisation throws and drops the user to Landing

```text
WARN  [AUTH] ⚠️ Initialization taking too long, forcing loading to false
ERROR [AUTH] ❌ Failed to initialize auth: {"message": "requestPromise.catch is not a function (it is undefined)", "name": "TypeError"}
LOG   [NAV] route: Landing
```

- **Why it matters:** something handed to `.catch()` returned `undefined` (a Promise-shaped API that isn't one) — and the app's own timeout then forced `loading = false`, so the user lands on the unauthenticated **Landing** screen instead of their restored session. To a real user that presents as *"the app randomly logged me out"*.
- **Status:** **not investigated and not fixed** in FIX-Task-53 (outside the 12-item brief). Flagged so it gets a dedicated task rather than being lost in a terminal buffer. The `[AUTH]` timeout path itself worked as designed (no hang), which is the only reason this is not higher severity.

### F5 [INFO — stale fixture] A retired DT118 fixture Connect account still fails the payout-status sync

```text
WARN  Stripe Connect status sync failed: [Error: The provided key 'sk_test_…o5d0' does not have access to account 'acct_dt118_fixture_unv' (or that account does not exist). …]
```

A leftover fixture account (`acct_dt118_fixture_unv`) that the current test key cannot reach. **Fixture staleness, not an app defect** — but it makes the payout screens log a warning on every open, which is exactly the kind of noise that hides a real one. Worth a cleanup pass.

## 4. Environment / tooling

**Android device leg — initially stalled, then RAN (CORRECTED 2026-09-18).** After `npm run start:single` the Android dev client *appeared* wedged at "Bundling 100% / Loading from 10.0.2.2:8081…" (no `ReactNativeJS` logs, ~1 s frame draws), and two earlier `npm run dev:android` attempts had been OOM-killed (exit 137) — so the device verification was pivoted to iOS, which succeeded end-to-end. **The Metro log tail (pasted 2026-09-18) shows that Android reading was wrong:** the Android client DID bundle and run (`Android Bundled 538ms` / `Android Bundled 224ms`) and completed the Make-Offer → 5 SP → `TradeSuccess` flow **twice** (see §6 item 1), then the host finally OOM-killed `expo start` (exit 137). So the earlier "no JS ever evaluated" observation was a **host-memory-pressure window, not a dead harness** — consistent with the same log showing 16.5 s and 28.8 s `get_subscription_status` RPC calls, a sustained Realtime `CHANNEL_ERROR`/`TIMED_OUT` storm (Profile/Wallet/Subscription/Cart channels), and `setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture` warnings. Per R102's discriminator this remains **tooling/host pressure, not app behaviour**.

**No Supabase MCP tools were available this session**, so the DB read-back of the created trade row could not be run. The SP spend is evidenced by the app's own persisted timeline ("Swap Points Used: 5 SP") + the `qa:set-sp-balance` wallet read-back, **not** by a direct DB query — stated plainly rather than implied.

**Full unit suite:** 3945 passed / **2 failed** — both in `src/__tests__/e2e/referral-analytics-admin.e2e.ts` with `57014 canceling statement due to statement timeout` on the admin `get_top_referrers` RPC. **Environmental (live staging DB timeout), unrelated to these changes.**

**Not attributable to this task:** `.github/agents/QA-Test-Agent.agent.md` and `.github/instructions/QA-Test-Agent.instructions.md` show as modified in `git status` — those are **pre-existing uncommitted changes from an earlier round**, not from FIX-Task-53.

---

## 5. App state left behind

| Item | State | Action needed |
|---|---|---|
| `test-grace` SP wallet | **15 available** (fixture set 0→20; 5 reserved by open offer `0ba80809-9c04-4117-bc65-2fbd09613e42`) | Do **not** run `qa:set-sp-balance --amount 0` while that reservation is live (the script's own header warns it can desync reservation bookkeeping). Clear the reservation first, or leave it. |
| `test-grace` Stripe | New customer `cus_VHK8BgDjkHjQ9k` + PM `pm_1UGlUC4I6kCJlvXoM77Rr38u` | None — test mode |
| `qa-payout-seller` payout methods | Temporarily replaced with `--scenario none`, then **RESTORED** | **Done** — `npm run qa:express-complete -- create --replace` minted a fresh verified account `acct_1UGm4A3qQXHDi0B9` (`submitted=true payouts=true charges=true due=[]`). No leftover. |
| Open trade(s) | `0ba80809-9c04-4117-bc65-2fbd09613e42` — `pending`, 5 SP reserved, awaiting a seller response. **Plus two Android offers created 2026-09-18** on items `fcddf9cf-41b8-4cf3-94a8-bcb9ae8d6152` ($31.00) and `18a41ad8-9cfc-46d4-a6c0-54a2933fb5a9` ($28.00), each with **5 SP** (`checkout_started` → `TradeSuccess`) | **Clear/expire all of these BEFORE zeroing `test-grace`'s wallet** — the SP is now spread over up to 3 reservations, and `qa:set-sp-balance --amount 0` while reservations are live can desync the reservation bookkeeping (the script's own header warns of this) |
| iOS simulator | Logged in as `qa-payout-seller`, on Payout Settings | Log out via `p2pkidsmarketplace://qa-logout` before the next run |
| Metro | Still running on :8081 | Kill when finished |

---

## 6. Known gaps / not tested (owed legs)

1. **Item 1 — Android device leg (CORRECTED 2026-09-18: it RAN — log-evidenced, needs a 30-second confirmation to close).** The Metro log shows the Make-Offer → **5 SP** → `TradeSuccess` flow completing **twice** on Android, on items `fcddf9cf-…` ($31.00, `cash_amount_cents: 2749`) and `18a41ad8-…` ($28.00, `cash_amount_cents: 2449`), each preceded by `checkout_fee_shown` moving from `sp_amount: 0` → `sp_amount: 5` — i.e. the SP control rendered **and accepted input** for a `grace_period` account, which the pre-fix gate made impossible. **Caveats, stated plainly:** (a) the acting user is **inferred**, not printed — the log attaches `user_id …0011` (= `test-grace`, per `scripts/qa/set-sp-balance.mjs`) to `view_recommendations` in the same session and the steps match the item-1 recipe exactly, but the TradeOffer step itself logs no user; (b) there is **no screenshot**; (c) the bundle is **assumed** to be the post-fix one. Closing this needs one confirmation re-drive (or a screenshot) — not a full re-run. Recipe: `npm run start:single` → tap the `http://10.0.2.2:8081` row in the Expo Dev Launcher → `qa-login-as?persona=test-grace` → Discover → Show All Nodes → SP filter → first item → `request-to-buy-button` → assert **`sp-amount-input` present + `subscribe-upsell-card` absent** → 5 SP → Send Offer → accept disclaimer → assert "Trade Initiated!".
2. **Item 11 — no device drive.** The `Cancelled At (historical)` label has **no unit test and no on-device drive** — it needs a row with `cancelled_at` set **and** a future `current_period_end`.
3. **Item 5 — the unverified-method modal variant** is unit-tested but **not device-driven** (needs exactly one `stripe_connect` method with `stripe_onboarding_complete=false`).
4. **Item 7 — Android re-check** not possible this session (§4); resolved on iOS with the fresh bundle instead.
5. **DB read-back of `trades.sp_amount`** for `0ba80809-…` — owed (no MCP tools this session).
6. **Item 12** — deferred by owner decision (design).
7. **Item 8** — blocked on the owner pasting `STRIPE_WEBHOOK_SECRET`.

---

## 7. Files changed

**New:** `src/services/subscriptionStatus.ts` · `src/utils/payoutConnectCopy.ts` · `src/hooks/__tests__/useAuth.test.ts` · `src/utils/__tests__/payoutConnectCopy.test.ts`

**Modified (app):** `src/services/subscription.ts` · `src/screens/trade/TradeOfferScreen.tsx` · `src/screens/trade/TradeInitiationScreen.tsx` (orphan note) · `src/screens/seller/PayoutSettingsScreen.tsx` · `src/screens/subscription/SubscriptionStatusScreen.tsx` · `src/screens/subscription/UpgradePlanScreen.tsx` · `src/screens/cart/CartCheckoutScreen.tsx` · `src/screens/profile/ProfileScreen.tsx` · `src/screens/dashboard/UserDashboardScreen.tsx` · `src/contexts/AuthContext.tsx` · `src/hooks/useAuth.ts` · `src/hooks/usePaymentFailure.ts` · `src/services/referralRewards.ts`

**Modified (tooling):** `scripts/qa/set-sp-balance.mjs` · `scripts/qa/ensure-valid-cards.mjs` (added `test-grace`)

**Modified (tests):** `src/services/__tests__/subscription.test.ts` · `src/screens/trade/__tests__/TradeOfferScreen.test.tsx` (+2 grace tests) · `src/screens/seller/__tests__/PayoutSettingsScreen.test.tsx` (+3)

**Modified (docs):** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (D01, E04, G01, G11, H04) · `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (Round 9 note + 5 row appends; **edited in place, not regenerated**)

---

## 8. Tracker reconciliation (R52 / R56 / R57)

- **No verdict flipped** this round: SUB-TC-D01/E04/G01/G11/H04 were already `✅ PASS`; each received a dated Notes append and (where applicable) the round's named owed leg.
- **Counts unchanged and mutually consistent** — §1 roll-up (line 59) = section header (line 1136) = the Round 9 note: **100 cases · 79 PASS / 1 PARTIAL / 2 OPEN / 0 DRIFT / 0 SKIP / 15 RETIRED / 2 N/A · 0 remaining**.
- The tracker was **edited in place**; `build_status_tracker.py` was **not** run (it would drop every round note and revert materialised rows — §5.54 R52's verified warning).

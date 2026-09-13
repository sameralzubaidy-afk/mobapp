# FIX-Task-27 — Login-As Retry, Item Detail Padding, Sibling Disclaimer Stamp, QA Failure Toggles, Docs + UX

**Date:** 2026-09-13 · **Source:** QA Task — Verify FIX-Task-26 + Bundle-Offer Chain + N2 Mutation Legs + Remainder (2026-09-13)
**Status:** code complete · Tier 0 green · on-device legs: 4 of 8 run this session (see §6)
Amazon liability-disclaimer work excluded. Nothing committed or pushed.

---

## 1. Item 1 [MED] — `qa-login-as` persona switch could wedge the client

**Root cause (confirmed by source):** `loginWithContext` (`src/services/auth.ts`) calls
`supabase.auth.signInWithPassword` FIRST — which replaces the Supabase client's stored session — and only
then reads the profile. The read was a **single attempt**, and ANY failure (0 rows from a briefly-degraded
gateway leg, RLS hiccup, 5xx) was thrown as `PROFILE_NOT_FOUND` / "User profile not found". React's
AuthContext therefore never received `setSession`, so the UI kept rendering the OLD persona while every
request ran as the NEW one — the "stuck on Loading trade…" wedge QA hit. The handler logged `.message` only
(no code, no underlying error), so the failure was indistinguishable from a genuinely missing profile.

**What changed**

| File:line | Change |
|---|---|
| `p2p-kids-marketplace/src/services/auth.ts:372-437` | NEW `readProfileWithRetry()` — bounded 3-attempt retry (300 ms / 600 ms linear backoff) around the profile read, logging the REAL cause via `redactForLogging` each attempt. Idempotent read, no side effects; the deleted-account gate is unchanged. |
| `p2p-kids-marketplace/src/services/auth.ts:497-508` | `loginWithContext` now calls `readProfileWithRetry(userId)`. Message + code unchanged (`User profile not found` / `PROFILE_NOT_FOUND`) — the canonical AUTH guide asserts that copy — and the last underlying error travels on `AuthError.details`. |
| `p2p-kids-marketplace/src/components/QaLoginAsDeepLinkHandler.tsx:76-135` | NEW `describeLoginAsFailure()` (code + message + redacted cause) and `loginAsWithRetry()` (3 attempts, 300/600 ms) around the canonical login. |
| `p2p-kids-marketplace/src/components/QaLoginAsDeepLinkHandler.tsx:186-225` | Failure branch now logs `code=… | message=… | cause=…` instead of a bare message, then **clears the half-switched session on BOTH sides** — `supabase.auth.signOut({ scope: 'local' })` plus `setSession(null)` (AuthContext has NO `onAuthStateChange` listener, so the client-side signOut alone would leave React rendering the stale persona). |
| `p2p-kids-marketplace/src/services/devTestingService.ts:1441-1494` | NEW `profile_read_failure` toggle (`once` = first attempt fails then disarms, proving the self-heal; `persist` = every attempt fails, proving the recovery) so the fix is provable on-device. |

**Verification:** `src/services/__tests__/auth.test.ts` (+3 cases: transient→recovers, persistent→exactly 3
attempts + `details` preserved, fast path→1 attempt) and NEW
`src/components/__tests__/QaLoginAsDeepLinkHandler.test.tsx` (5 cases incl. bounded retry + both-sided
recovery). On-device: `qa-login-as?persona=test-buyer` completed the switch (SP pill 2256 → 459), no
"User profile not found", no wedge.

---

## 2. Items 2 + 6 [LOW] — Item Detail's sticky CTA band clipped the last section

**Mechanism:** `ItemDetailScreen` renders the CTA band as an **in-flow sibling AFTER** the `ScrollView`
inside a `flex: 1 / column` wrapper. The `ScrollView` had no `style` and **no `contentContainerStyle`**, so
the content's tail had no trailing inset to sit clear of the band (QA measured the Seller Info footer note
at 797 × **4** px).

**What changed**

| File:line | Change |
|---|---|
| `src/screens/home/ItemDetailScreen.tsx:83-103` | NEW exported `CTA_BAND_FALLBACK_HEIGHT = 200` + `computeItemDetailBottomPadding(bandHeight)` (pure, mirrors `TradeTimelineScreen.computeTimelineBottomPadding`). |
| `src/screens/home/ItemDetailScreen.tsx:127-129` | NEW `ctaBandHeight` state. |
| `src/screens/home/ItemDetailScreen.tsx:640-655` | `ScrollView` gained `contentContainerStyle={{ paddingBottom: computeItemDetailBottomPadding(ctaBandHeight) }}` — the measured band height becomes the content's bottom inset, so the last card can always be scrolled fully clear of the band (this is also item 6's "broader inset"). |
| `src/screens/home/ItemDetailScreen.tsx:1113-1117` | Band `<View>` gained `onLayout` → `setCtaBandHeight(layout.height)`; the inset follows the real band instead of a guessed constant. |

**⚠️ Tried and REVERTED — do not repeat:** adding `flex: 1` to that `ScrollView` was proposed as
"bounding the scroll viewport". Investigation on-device produced a **false** regression reading (the CTA
buttons appeared to vanish) that was actually the **owner view** — both band buttons are gated on
`user?.id !== listing?.seller_id`, so on your own listing the band renders empty and the AX tree shows no
buttons. `flex: 1` was reverted because the padding alone satisfies items 2/6 and the extra layout change
was not needed; a comment at the ScrollView records this so it is not re-attempted blindly.

**On-device evidence (Android `Medium_Phone_API_36.1`, as test-buyer, item not owned):**
`add-to-cart-button` 42,1949 289×136 and `request-to-buy-button` 357,1949 681×136 (band intact, same
coordinates as QA's pre-fix reading), and at the scrolled tail the last content element
("Buying more than one item? Add to basket to bundle and save on fees.") renders **996 × 84 px** — full
height, ~580 px clear of the band. The QA-named note ("Start a trade to see seller details and contact
them.") only renders in the verified-seller/hidden-name state; the element measured here is the same
content tail.

---

## 3. Item 3 [investigation] — `disclaimer_acknowledged` on bundle siblings

**Result: a per-sibling OMISSION, not by design — and it is FIXED.**

Evidence:
- The only runtime writer is the single-trade RPC `acknowledge_trade_disclaimer(p_trade_id, …)`
  (`supabase/migrations/307_liability_disclaimer_tracking.sql:85-136`), which does
  `UPDATE trades SET disclaimer_acknowledged = TRUE … WHERE id = p_trade_id` and records the policy
  acceptance with `ON CONFLICT DO NOTHING`.
- `create-trade-offer` never touches the column (0 matches) and inserts ONE `trades` row per item sharing a
  `bundle_id`, so siblings 2/3 kept the column default `FALSE`.
- The bug site `src/screens/cart/CartCheckoutScreen.tsx` carried the comment
  "for each trade (best effort)" while passing **`tradeIds[0]` only** — the comment described the intent the
  code did not implement.

**Fix:** `src/screens/cart/CartCheckoutScreen.tsx:688-703` now loops every `tradeIds` entry through
`acknowledgeTradeDisclaimer(tradeId, policyId, 'CartCheckoutScreen')` (sequential; the RPC is idempotent and
safe to repeat). The misleading comment was corrected.

**Not covered by a new unit test:** driving `handleConfirm` needs a ~150-line mock harness for a whole
checkout screen that no existing suite has; the fix is verified by the SQL read-back leg in §6 instead. This
is an explicit deferral, not a silent gap.

---

## 4. Item 4 — QA failure-injection toggle family (one consistent family, not three one-offs)

Built on the existing `devTestingService` + `qa-dev-toggle` deep-link machinery (same shape as
`pref_save_failure`), so there is **no new handler** and **no `admin_config` write** — session-local
AsyncStorage, 60-minute TTL, cleared on logout, fail-closed outside dev/test.

| Short name | Values | Consumer (file:line) | What it proves |
|---|---|---|---|
| `cart_remove_failure` | `remove_failure \| none` | `screens/cart/CartScreen.tsx:404-437` | X11-b removal rollback + inline retry on a REAL failure. Short-circuits BEFORE `removeFromCart`, so the server cart is untouched. |
| `offer_load_stall` | `stall \| none` | `screens/trade/ReviewOfferScreen.tsx:132-165` | F6's 20 s `withTimeout` bound → `review-offer-load-error` + retry. A never-settling promise replaces the query, so no request is sent. |
| `seller_read_failure` | `read_failure \| none` | `services/listing.ts:1302-1312` | F11's Item Detail retry card. Skips the seller sub-query and returns `sellerLoadFailed: true`. |
| `profile_read_failure` | `once \| persist \| none` | `services/auth.ts:395-400` | Item 1's retry: `once` self-heals on attempt 2; `persist` exhausts and exercises the wedge recovery. |

Registry wiring (all four): `QA_TOGGLE_SHORT_NAMES`, `QA_TOGGLE_ALLOWED_VALUES`, `clearQaLocalValues()`, the
default export, and the handler's documented key list
(`src/components/QaDevToggleDeepLinkHandler.tsx:1-20`).

Arming recipe (unchanged shape):
```
adb -s <serial> shell am start -W -a android.intent.action.VIEW -d "p2pkidsmarketplace://qa-dev-toggle?key=seller_read_failure\&value=read_failure" com.sameralzubaidi.p2pmarketplace
```
(escape `&` for the device shell; the handler's `[QA] Toggle Applied` alert is the arming proof.)

---

## 5. Item 5 [docs] — N2 duplicate-key wording

**Canonical guide only** (`cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`):

- Index line `:341`: `Duplicate idempotency key → rejected, no partial write` (was "→ prior result").
- Body heading `:7474` + `Objective` `:7477`: the objective no longer claims the prior result is returned;
  it now says the replay is REJECTED (or no-ops) instead of being applied twice.
- Steps now add the EF leg: a byte-identical re-POST of `create-trade-offer` (same `submission_nonce`)
  captured with its HTTP status, plus the row-count checks.
- Expected Result `:7494-7498`: the re-POST is **REJECTED with HTTP `409` + `DUPLICATE_OFFER`** (the
  active-offer guard) — the caller does **not** receive the prior result — with 1 trade / 1 payment intent /
  1 audit row per key (the 2026-09-13 live observation). The SP-RPC bullet is corrected to name the SP RPCs
  as the one path that DOES return the prior outcome (`idempotent: true` + prior `ledger_entry_id`), and a
  final bullet records the single-item `23505` replay branch (absent on the bundle path).

**Deliberately NOT edited:** `docx/SYSTEM_REQUIREMENTS_V2.md` (requirement source — SR-N2-008 already
permits "a specific `DUPLICATE_MUTATION`-style code"), `archive/misc./*` and `temp/*` (older/derived copies).
`npm run verify:guides` → **0 hard findings, 188 warnings** (unchanged baseline).

---

## 6. Items 7 + 8 — Trade List UX (must-implement)

| Item | Change (file:line) |
|---|---|
| 7 — pending count on the bundle card | `src/screens/trade/TradeListScreen.tsx`: buyer card `:1320-1330` (`trade-bundle-<id>-awaiting-count`) and seller Needs-Action card `:1530-1542` (`trade-bundle-<id>-pending-count`) now render the **pending** count from the shared `getBundleCounts` helper (one predicate, one counter — the F8 rule). The batch actions now pass the **pending** sibling ids and a pending-aware confirm label (`:1620-1670`, previously raw `bundleOffers.length`), and disappear once `pending === 0` (mirrors the status-filtered batch prompt precedent). |
| 8 — consistent button treatment | `src/screens/trade/TradeListScreen.tsx:1720-1738`: the single-offer "Review Offer" button moved from the secondary (outline) style to the same green primary style the bundle's "Accept All" uses. testID + label unchanged. |

---

## 7. Verification status

**Tier 0**
- `npx tsc -p tsconfig.json --noEmit` → exit 0, clean.
- Scoped `eslint` on all 16 changed files → **0 errors** (33 pre-existing `no-console` warnings in files that
  already carry them).
- Full `npm test` → **328 suites passed / 0 failed, 3855 tests passed / 0 failed**, 54 E2E-gated suites
  skipped (env variance). Baseline at FIX-Task-26 r2 was 326 suites / 3834 tests → the delta is exactly the
  2 new suites + 21 new tests (devTestingService +7, QaLoginAsDeepLinkHandler +5, auth +3, CartScreen +2,
  ReviewOffer +2, listing.sellerReadFailure +2).
- `npm run verify:guides` → 0 hard findings (188 warnings, unchanged baseline).
- Prettier: the 7 changed files that are not Prettier-clean were **already unformatted at HEAD**
  (verified with `git show HEAD:<file> | prettier --check`), so per the standing rule no `--write` was run;
  edits match each file's existing style. Diff sizes are proportionate (961 insertions / 97 deletions across
  17 files).

**On-device legs RUN this session** (Android emulator `Medium_Phone_API_36.1`, app already installed, Metro
:8081):
1. **Item 1 happy path — PASS.** `qa-login-as?persona=test-buyer` logged in and switched the persona
   (Home SP pill 2256 → 459, avatar changed); no "User profile not found", no wedge.
2. **Item 4 registration — PASS.** `seller_read_failure` armed via the deep link with the handler's own
   read-back alert ("seller_read_failure = read_failure (verified read-back: read_failure)") and disarmed
   the same way.
3. **Item 4 `seller_read_failure` → F11 card — PASS.** On Item Detail,
   `seller-info-error-card` (996 × 235) and `seller-info-retry-button` (996 × 115) rendered, fully clear of
   the CTA band. With the toggle disarmed, a fresh open rendered the healthy Seller Info instead
   (Test Seller, 4.5 ★, 6 reviews, Contact Seller / View Profile, more-from-seller CTA).
4. **Items 2 + 6 — PASS.** CTA band intact at y=1949; the content tail renders at full height (996 × 84)
   above the band.

**On-device legs OWED (not run this session — BP-91 disclosure):**
- Item 4 `cart_remove_failure` → trash an item → row restores + `cart-remove-error-card` +
  `cart-remove-retry-button`; disarm → retry succeeds.
- Item 4 `offer_load_stall` → open Review Offer → after ~20 s `review-offer-load-error` +
  `review-offer-retry-button` (unit-tested with fake timers; the real-time firing is the device leg).
- Item 4 `profile_read_failure=once` (retry self-heals) and `=persist` (recovery clears both sides + the
  logged cause) on-device.
- Item 1 retry-recovery of the F11 card: the armed error card was verified; the in-place "Try again"
  recovery was not cleanly observed (the disarm deep link may not have landed before the tap — the
  post-disarm fresh open proves the healthy path).
- Items 7 + 8 visuals (bundle card pending line; single-vs-bundle button treatment) — no unit test was added
  (the bundle fixture/harness cost); screenshots still owed.
- Item 3 SQL read-back after a real 3-item bundle checkout:
  `SELECT id, disclaimer_acknowledged FROM trades WHERE bundle_id='<bundle>';` → expect TRUE on **all**
  siblings.
- Item 1 edge: `profile_read_failure=persist` + `qa-login-as` on-device.

---

## 8. Docs registered

- `.github/instructions/QA-Test-Agent.instructions.md:882` — the `qa-dev-toggle` registry row now lists the
  four new short names, their values, and that `value=none` disarms.
- `docs/flow-registry.md` — in-place toggle notes on the four affected flows: FLOW-01 auth (`:135-136`),
  FLOW-06 discovery/Item Detail (`:256`), FLOW-07 cart (`:279`), FLOW-08 trade (`:309`).

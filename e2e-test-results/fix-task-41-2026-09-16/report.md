# FIX-Task-41 — verification round (2026-09-16)

**Source finding:** SUB Android Round 3 — `e2e-test-results/qa-sub-android-r3-2026-09-16/report.md`
**Device:** Android `Medium_Phone_API_36.1` (emulator-5554) · 1080×2400 (AX coords == px)
**Metro:** single instance on `:8081` (R63a verified — nothing on `:8082`)
**HEAD at run:** working tree (uncommitted) — see §1

---

## 1. What this round is (and is not)

A **dev-side fix round**, not a QA drive. It implements the 11 FIX-Task-41 items and verifies the
device-observable ones in-session. It does **not** re-drive the QA test cases — the tracker entries
for the affected cases carry "code-level verified, device leg owed" notes where a re-drive is needed.

---

## 2. Item-by-item outcome

| # | Item | Outcome | Evidence |
|---|---|---|---|
| 1 | JoinKidsClub ghost notification bell | ✅ **FIXED + VERIFIED ON-DEVICE** | `screenshots/ITEM1-…png`. Root cause: `AppHeader` rendered `<View style={styles.headerActionBtn} />` — the grey 40×40 icon-button style — in the bell's slot whenever `showBell={false}`. Now a transparent `headerActionSpacer` (`pointerEvents="none"`). AX tree on JoinKidsClub: `back-button` → `screen-title` → **`header-bell-spacer`** (ViewGroup, no role/label) → `header-chat-btn`; **no `header-notifications-btn`** (correct — `showBell={false}` is intentional for this payment-family screen) and **no grey disc**. Contrast on the same run: Transaction History shows `header-notifications-btn` normally. |
| 1b | *Class sweep (deliberate scope extension)* | ✅ done | The **same** empty-grey-disc placeholder was the `tab` variant's LEFT spacer (`<View style={styles.headerActionBtn} />` on Discover/Messages/Basket headers). Swept to the transparent spacer too. Flagged here so the owner can revert if the symmetric disc was intended. |
| 2 | Transaction History Retry has no locator | ✅ **FIXED + VERIFIED ON-DEVICE** | `screenshots/ITEM2-3-8-…png`. AX now exposes `Button label="Retry" id="transaction-history-retry-button"` (was `ViewGroup label="Retry"` with no testID/role). |
| 3 | K02 guide promises a receipt icon the error state doesn't render | ✅ **CLOSED — resolved by adding the icon (not by editing the guide)** | Same screenshot/AX frame: `TextView "Failed to load billing history"` + **`SvgView id="phosphor-react-native-receipt-regular"`** (168×168) + Retry. The guide's "receipt icon + error text + [Retry]" is now literally accurate. |
| 4 | JoinKidsClub web CTA unreachable from the emulator | ✅ **FIXED + VERIFIED ON-DEVICE** | `logcat`: `ReactNativeJS: [subscriptionWeb] opening http://10.0.2.2:3002/join?email=…` (was `localhost:3002`). `toEmulatorReachableBase()` rewrites **only** a `localhost`/`127.0.0.1` host on Android; `https://passitup.com` is untouched (unit-tested). A dev-only log line was added so the resolved URL is verifiable from `adb logcat` — the CTA hands off to the external browser, so no in-app surface shows it. |
| 5 | M07 retry-success fixture | ⚠️ **BUILT — Phase 2 (executing it) NOT run (BP-80, needs owner approval)** | `npm run qa:payfail-retry -- ensure \| status \| reset`. Creates `test-payfail-retry`: payfail-shaped (`payment_retry_count=1`, `payment_failed_at`) **plus** real Stripe customer/subscription/PM and **no open invoice**, so all four `retry-failed-payment` guards pass in order. Failure state is applied **after** the first `invoice.payment_succeeded` webhook settles (that handler calls `record_payment_attempt(p_success:true)`, which resets those columns — applying it earlier is a race). `-- status` prints a guard-by-guard verdict. |
| 6 | SUB-TC-M07 headline should be PARTIAL | ✅ **APPLIED** | Tracker: `Status` ✅ PASS → 🟡 PARTIAL, `Latest` PASS → PARTIAL, `iOS` column mirrored to 🟡 PARTIAL, Date/Source re-pointed. §1 roll-up + SUB section header reconciled (78/2 → **77/3**), R56. |
| 7 | F5 warm account-switch PM-fetch wedge | ✅ **INVESTIGATED + HARDENED** — see §3 | — |
| 8 | Transaction History error needs the receipt icon | ✅ = item 3 (same change) | as item 3 |
| 9 | ContinueKidsClub: pill clips "Continue on the web" / "Maybe later" | ✅ **FIXED + VERIFIED ON-DEVICE** (with one named residual) | `screenshots/ITEM9-…-REST-…png` (clipped before scrolling) vs `…-BOTTOM-…png`. `content` paddingBottom 20 → 100 (BP-58). At the true bottom (two identical frames ⇒ scroll bottomed out, R103) **both CTAs are fully visible and clear of the pill**. **Residual:** the final fine-print line still sits partly under the pill in the bottomed-out frame — reported as an observation, not claimed fixed. |
| 10 | Document the inverse-hero pill as canonical | ✅ done | `docx/design-system-passitup.md` new **§4.2b Inverse-Hero Pill Button** + v1.1 version-history row. Canonical instance: Payout Settings `balance-hero-card` → `request-payout-btn` "Withdraw Now" (white pill `#FFFFFF`, radius 26, green `#5DBB8E` text, `alignSelf: flex-start`) on the `#5DBB8E` hero. |
| 11 | JoinKidsClub footnote under the pill | ⚠️ **PARTIALLY ADDRESSED — residual named, needs an owner decision** | `contentContainer` paddingBottom 48 → 100. **On this device the change does not move the footnote at rest**, because the content (~2063 px) is *shorter* than the ScrollView viewport (2166 px) → the view does not scroll at all → bottom padding cannot lift the last child. Making it "readable without scrolling" therefore needs a layout decision: (a) move the footnote above the CTA, (b) trim the vertical spacing so the content fits with the footnote clear of the pill, or (c) accept scroll-to-read on shorter devices. Flagged for the owner rather than decided unilaterally. |

---

## 3. Item 7 — F5 investigation result

**Stance (9.1a): partially ruled out, partially confirmed, and hardened.**

**RULED OUT: the auth-js lock deadlock class.**
`@supabase/auth-js@2.89` selects its lock in the GoTrueClient constructor: `navigatorLock` only when
`persistSession && isBrowser() && globalThis.navigator.locks` — otherwise **`lockNoOp`**
(`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` L126-138). React Native satisfies none of
the `navigatorLock` conditions, so the "`getSession()` called inside an auth callback deadlocks"
class cannot occur here. That is consistent with `AuthContext`'s onAuthStateChange comment, which was
written to avoid a hazard that this platform does not actually expose.

**CONFIRMED (the wedge is real and its mechanism is provable):**
1. `supabase.functions.invoke('get-payment-method', …)` had **no timeout**. A request that stalls at
   the socket layer (a warm `qa-login-as` session flip tears down the keep-alive connection mid-flight)
   never settles.
2. The caller (`PaymentMethodsScreen.fetchPaymentMethod`) awaits it with no timeout of its own → the
   screen's `loading` never clears → the permanent "📤 Fetching payment method…" spinner.
3. **`_pmPromise` was never released on settle**, so every later read for the same user re-adopted the
   same dead promise → a single stalled request became a **process-lifetime wedge**, which is exactly
   why only terminate + relaunch recovered it (the R101 in-process wedge).

**RELATED-EDGE-CASE (the "mount that happens mid-transition" half):** yes — the same path, and the
residual defect is **not** the cache. `PaymentMethodsScreen`'s fetch effect depended on
`[fetchPaymentMethod]` where that callback is `useCallback(…, [])` → **identity-stable** → the effect
ran exactly once per mount. A warm account switch therefore never re-fetched on an already-mounted
screen: it kept the previous user's card (or the stuck loading state) until the process restarted.
FIX-Task-37 item 1 scoped the *cache* to the user but left the *screen* mount-scoped.

**Fixes (all on the item-1 path, all unit-tested):**
- `PM_FETCH_TIMEOUT_MS = 15000` passed to `functions.invoke` (`timeout` is supported by
  `functions-js` — verified in the installed `FunctionsClient.js`, which builds an `AbortController`).
- The in-flight slot is released when the request settles (`if (_pmPromise === inFlight) _pmPromise = null`).
- Writes to the cache are guarded by `cacheSlotIsStillOurs()` so a reply that lands **after**
  `invalidatePaymentMethodCache()` (identity change / remove-card) cannot overwrite a newer entry.
- `PaymentMethodsScreen` now re-fetches on `userId` change (the same identity boundary item 1 enforces
  for the cache).

Two new regression guards in `src/services/__tests__/subscription.test.ts`: the invoke carries the
timeout, and a late cross-identity reply never overwrites the new user's cached entry.

---

## 4. Tier 0 / Tier 1 status

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | **PASS** (exit 0) |
| Lint (changed files) | `npx eslint <11 files>` | **0 errors**, 12 pre-existing `no-console` warnings |
| Unit tests (full) | `npx jest` | **331 suites / 3903 tests PASS**, 0 fail (54 suites `RUN_SUPABASE_E2E`-gated) |
| Guide/tracker drift | `npm run verify:guides` | 3 duplicate TC-IDs + 2 contradictions — **all pre-existing** (ADM R01–R03, TRD S15/T03); the M07 contradiction is **gone** |
| Tier 1 (device) | Android emulator, items 1/2/3/4/8/9 | as §2 |
| Tier 2 | n/a — no migration/RPC/RLS/Stripe-logic change in this round | — |

**Not run (needs the owner's approval — BP-80):** `npm run qa:payfail-retry -- ensure` (creates a real
Stripe test subscription + fixture rows) and the on-device M07 drive. Regression tiers 1/2 for item 5
are **DEFERRED**, not PASS.

---

## 5. Files touched (16)

```
docx/design-system-passitup.md                                   (item 10)
e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md                (item 6 + K02 note)
p2p-kids-marketplace/package.json                                (item 5 script)
p2p-kids-marketplace/scripts/qa/qa-payfail-retry-fixture.mjs     (new — item 5)
p2p-kids-marketplace/scripts/qa/lib/r41-common.mjs               (item 5 persona)
p2p-kids-marketplace/src/components/AppHeader.tsx                (item 1 + 1b)
p2p-kids-marketplace/src/components/__tests__/AppHeader.test.tsx (item 1 test)
p2p-kids-marketplace/src/screens/profile/PaymentMethodsScreen.tsx (item 7)
p2p-kids-marketplace/src/screens/profile/TransactionHistoryScreen.tsx (items 2,3,8)
p2p-kids-marketplace/src/screens/subscription/ContinueKidsClubScreen.tsx (item 9)
p2p-kids-marketplace/src/screens/subscription/JoinKidsClubScreen.tsx (item 11)
p2p-kids-marketplace/src/services/__tests__/subscription.test.ts (item 7 tests)
p2p-kids-marketplace/src/services/qaPersonas.ts                  (item 5 persona)
p2p-kids-marketplace/src/services/subscription.ts                (item 7)
p2p-kids-marketplace/src/utils/subscriptionWeb.ts                (item 4)
p2p-kids-marketplace/src/utils/__tests__/subscriptionWeb.test.ts (new — item 4 test)
```

> ⚠️ `git status` also lists ~20 modified `supabase/migrations/*` files + 3 untracked
> `2024121300000*_base_schema_repair_*.sql` / `20260913000000_base_schema_repair_deferred_constraints.sql`.
> **Those are NOT part of this round** — they are the pre-existing FIX-Task-40 migration-chain working
> tree. Untouched here.

---

## 6. App state left behind

- Android emulator `emulator-5554`: app running, **logged in as `test-trial`** (was `qa-payout-seller`
  at session start). No data created.
- QA toggles: `payout_fetch_failure` armed then **disarmed and verified** (`verified read-back: none`)
  — R28 satisfied. No toggle left armed.
- Staging: nothing created — item 5's fixture was **not executed**.
- `/tmp`: fixture state file `qa-payfail-retry/test-payfail-retry.json` does not exist yet (no `ensure`).

# FIX-Task-41 follow-through — M07 drive + device re-checks (2026-09-16)

**Source:** FIX-Task-41 (`e2e-test-results/fix-task-41-2026-09-16/report.md`) item 5 Phase 2 + the device legs it left owed.
**Device:** Android `Medium_Phone_API_36.1` (emulator-5554), 1080×2400 (AX coords == px)
**Metro:** single instance on `:8081` (R63a verified — nothing on `:8082`)
**Local stack:** Supabase up (`:54321` 200 · `:54322` accepting)
**Evidence:** `screenshots/` (13 frames) + the DB read-back quoted below.

---

## 1. Outcome table

| # | Item | Outcome | Evidence |
|---|---|---|---|
| 1 | Execute the M07 fixture (owner-approved) | ✅ **DONE** | `npm run qa:payfail-retry -- ensure` → persona `test-payfail-retry` (id `a1234567-0000-0000-0000-000000000018`), Stripe customer `cus_VGuy7SRAI8T6Ko`, sub `sub_1UGN8j4I6kCJlvXo7xNiCSuD`, PM `pm_1UGN8i4I6kCJlvXoOV9YMJ2U`; fixture printed `✅ no open invoices (guard #3 satisfied)` and applied the failure state **after** the 10 s webhook settle window (`failed_at=2026-09-16T18:01:14Z`, `retry_count=1`). |
| 1b | Guard verification (`-- status`) | ✅ **4/4 guards → DRIVABLE** | `✅ 1` failure flags · `✅ 2` both Stripe ids · `✅ 3` zero open invoices (live Stripe) · `✅ 4` client sends `resolve_without_invoice:true`. |
| 2 | Drive M07's retry-success leg | ✅ **PASS — branch reached and fired** | `M07-01-payment-method-added-alert.png`: **"Payment Method Added" / "Your card was saved successfully."** |
| 3 | Flip SUB-TC-M07 back to PASS | ✅ **APPLIED** | Tracker `Status/iOS/Android/Latest` → ✅ PASS ×3 + PASS; Date/Source re-pointed; SUB totals 77/3/2 → **78/2/2** (header ⇄ §1 roll-up ⇄ section header, R56); guide §3 roll-up reconciled to the tracker (it read `PARTIAL 2 · OPEN 3`, disagreeing with the tracker's `3 / 2`). |
| 4 | Confirm the tab-variant left-spacer sweep | ⚠️ **INCOMPLETE — found and fixed a MISSED FILE** | `DiscoverHeader.tsx` L45 still painted the grey `headerActionBtn` disc. See §3. |
| 5 | Re-drive SUB-TC-K02 | ✅ **PASS — all three legs on the post-fix build** | See §4. |
| 6 | Item 11 — footnote above the CTA | ✅ **APPLIED + VERIFIED ON-DEVICE** | See §5. |

---

## 2. M07 — the retry-success drive (three-layer verification)

**Recipe actually run** (`-- status` prints the iOS form; Android needs the `am start` form):

```
adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW \
  -d "p2pkidsmarketplace://qa-login-as?persona=test-payfail-retry" \
  com.sameralzubaidi.p2pmarketplace
# Payment Methods → pm-update-button → Stripe sheet ("Set up", saved ····4242) → confirm
```

**Layer 1 — pixels.** `M07-01-payment-method-added-alert.png` shows the branded in-app dialog: title **Payment Method Added**, body *Your card was saved successfully.*, single green (`#5DBB8E`) OK pill.

**Layer 2 — AX tree.** The dialog surfaced as a **`GlobalAlertProvider`** element pair:

```
@e26 View label="Payment Method Added, Your card was saved successfully." at=68,961 size=945x478
@e27 View text="Payment Method Added"
@e28 TextView text="Your card was saved successfully."
@e29 Button label="OK" id="global-alert-button-0" at=126,1251 size=830x137
```

So the alert **is** locator-instrumentable — §5.4's Option-B pixel-scan fallback was **not** needed. (The guide's `Dependencies`/locator note said "native `Alert.alert`"; source does call `Alert.alert(...)`, but the build routes it through the in-app provider. Doc-drift recorded and the guide's M07 locator hints were corrected in this round.)

**Layer 3 — backend read-back.** `npm run qa:payfail-retry -- status` immediately after the drive:

```
subscriptions: status=active retry_count=0 failed_at=—
stripe_subscription_id=sub_1UGN8j4I6kCJlvXo7xNiCSuD     (unchanged)
stripe_customer_id=cus_VGuy7SRAI8T6Ko                   (unchanged)
    ❌ 1 payment_failed_at + payment_retry_count<>0 — no failure state
    → M07 true-retry-success branch: NOT DRIVABLE
```

`payment_retry_count` 1 → **0** and `payment_failed_at` → NULL is the **positive** proof: the retry-success path fired and `record_payment_attempt(p_success:true)` consumed the failure state. A `NO_FAILED_PAYMENT`/`Saved` outcome would have shown *"Payment Method Saved"* instead of *"Payment Method Added"* — the alert title is what discriminates the two branches (`PaymentMethodsScreen.tsx` L166 vs L176).

**Design note (unchanged, non-blocking):** the sheet offered the already-saved card and it was used, so **no new PM was created** (the F2 "Update path leaves the replaced PM attached" orphan-accumulation class was not exercised and not worsened here).

**Residual, unchanged:** the *unauthenticated-remove* branch stays source-confirmed only — the app always holds a session, so that Edge Function guard is not reachable from the UI. Disclosed so the PASS is not read as "every branch driven".

---

## 3. Item 4 — the spacer sweep had MISSED a third file

**Finding (dev-side, same session fix).** FIX-Task-41 item 1b's report claimed the class sweep covered "the `tab` variant's LEFT spacer (`Discover/Messages/Basket`)". That is wrong for **Discover**: Discover does **not** render `AppHeader`'s `tab` variant at all — it owns a separate header component, `src/screens/home/DiscoverHeader.tsx` (rendered by `DiscoverScreen.tsx` L1789), whose left slot was still `<View style={styles.headerActionBtn} />` — i.e. the grey 44×44 disc with `backgroundColor: ds.neutral[100]`.

**Measured before/after** (full-resolution pixel probe of the left header slot, x 45..165 / y 55..175, row y=110):

| Frame | non-white px on row y=110 (x 0–310) | left-slot 120×120 mean |
|---|---|---|
| `ITEM4-01` (pre-fix) | **97** | **248** (grey disc present) |
| `ITEM4-04` (post-fix, fast refresh) | 0 | 255 |
| `ITEM4-05` (post-fix, post cold relaunch) | 0 | 255 |

> Process note: the disc is **not** visible in the AX tree (a bare `<View>` is not an accessibility element), and the first post-fix frame *looked* like the disc was still present in the downscaled preview — the measurement is what settled it, and it showed the fix had already landed.

**Fix applied** — `DiscoverHeader.tsx`: new transparent `headerActionSpacer` (44×44, no background) + `pointerEvents="none"`, mirroring `AppHeader`'s canonical `headerActionSpacer`, with a comment naming Discover as the reason the first sweep missed it.

**Whole-class sweep (Copy-Consistency discipline).** Every header-spacer style definition in the app was inspected:

- **Transparent (correct):** `AppHeader.headerActionSpacer`, `CartScreen.headerSpacer`, `SpTransactionHistoryScreen`, `SpWalletScreen`, `ReviewOfferScreen`, `ReferralsScreen`, `NotificationPreferencesScreen`, `NotificationSettingsScreen`, `RequestPayoutScreen`, `PayoutDashboardScreen`.
- **Defect:** `DiscoverHeader` only (now fixed).

**On-device confirmation:**
- `ITEM4-02-messages-header.png` — Messages (`ScreenLayout variant="tab"`) header **clean**, title centred, bell + chat only. ✅
- `ITEM4-03-basket-header.png` — Trade Basket (`variant="tab"`) header **clean**. ✅
- `ITEM4-05-…-postreload.png` — Discover left slot **0 non-white px / mean 255**. ✅

**Verdict:** the sweep is now **confirmed-correct and no longer provisional**, but the confirmation is *"incomplete as shipped, completed in this round"* rather than the requested *"already correct"* — Discover was a genuine miss, not a screen that relied on the disc for visual balance (nothing on that screen needed it; the title stays centred because the spacer keeps the same 44 px box).

---

## 4. Item 5 — SUB-TC-K02 re-drive (all three legs, post-fix build)

FIX-Task-41 items 2/3/8 were code-only; the row's PASS had been earned on the **pre-fix** build. Re-driven now:

| Leg | Result | Evidence |
|---|---|---|
| Empty | ✅ `test-free` (0 billing rows) → receipt icon + **"No billing history yet."** | `K02-08-empty-leg-test-free.png` |
| Error | ✅ armed `payout_fetch_failure=fetch_failure` (handler read-back `verified read-back: fetch_failure`) → fresh mount renders **`SvgView id="phosphor-react-native-receipt-regular"`** (168×168) + **"Failed to load billing history"** + **`Button label="Retry" id="transaction-history-retry-button"`** (193×114) | `K02-04-toggle-armed-readback.png`, `K02-05-error-state-armed.png` + the AX dump |
| Recovery | ✅ disarmed (`verified read-back: none`) → Retry → list reloads (1 SUCCEEDED row) | `K02-06-toggle-disarmed-readback.png`, `K02-07-retry-recovered.png` |

Both FIX-Task-41 fixes are therefore **confirmed on device**, not just in code: item 2 (Retry is now a real `Button` with `testID`/`accessible`/`role`/label — was a bare `ViewGroup` with no testID) and item 3/8 (the error branch renders the same `Receipt` icon as the empty branch, so the guide's wording is accurate again).

**Harness friction worth keeping (R96):** the QA toggle only takes effect on a **fresh mount** — a deep link into the already-mounted screen merely re-focuses it, so the first attempt silently rendered the stale list. Navigate away *first*, then deep-link in.

---

## 5. Item 6 — item 11: the footnote now sits above the CTA

**Change** (`JoinKidsClubScreen.tsx`): the `No charge in the app…` footnote moved to sit **between the "Membership is managed on the web" card and the `Join on the web` CTA**, with a comment recording the measurement that made padding non-viable (content ≈ shorter than / flush with the viewport at rest, so `paddingBottom` cannot lift the last child clear of the floating pill).

**Verified on-device** (`ITEM11-01-joinkidsclub-footnote-above-cta.png`): the footnote renders **above** the green CTA, is **immediately visible without scrolling** (≈y 1860–1920 of 2400), and is **well clear of the floating tab pill** (pill top ≈ y 2160). Both requested assertions met.

**Residual (named, NOT fixed — owner decision):** the CTA's hint line *"Manage your membership at passitup.com"* is now the screen's last child and is partly behind the pill at rest; it **is** readable after a small scroll (`ITEM11-02-joinkidsclub-scrolled-bottom.png`). This is the same class as FIX-Task-41 item 9's `ContinueKidsClub` fine-print residual — the fix is a layout decision (trim vertical spacing), not padding, so it is surfaced rather than made unilaterally.

---

## 6. Tracker / doc reconciliation

| File | Change |
|---|---|
| `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` | New round note at the head (old one demoted from "(newest)"); **SUB-TC-M07 row → ✅ PASS** on all four verdict cells + source re-pointed; SUB section header `PASS 77 / PARTIAL 3` → **`78 / 2`**; SUB-TC-K02 row's "OWED a device re-check" closed with the three legs; the row's pre-existing `BOTH remaining legs STILL BLOCKED` sentence re-worded to historical so the note no longer contradicts the new PASS cell |
| `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` | §3 roll-up reconciled to the tracker (**PASS 78 · PARTIAL 2 · OPEN 2 · Remaining 0**) with the previously-stale `PARTIAL 2 · OPEN 3 · Remaining 1` called out and the current non-PASS set named (C05, L05 · D06, D07); §4 known-fixture-gates gained the now-live **`test-payfail-retry`** entry (`ensure`/`status`/`reset` + the "driving M07 clears the flags" warning); M07's locator hints corrected — the alert is reachable as `global-alert-button-0`, and the saved-card / `Set up` sheet shape recorded |

**Drift check:** `npm run verify:guides` → **2 hard findings, both pre-existing** (TRD-TC-S15, TRD-TC-T03). The M07 contradiction that the flip introduced was caught by the checker, root-caused with the checker's own regex (§9.1d), and fixed — it is **gone** from this run.

---

## 7. Tier status

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | **PASS** (exit 0) |
| Lint (changed files) | `npx eslint src/screens/home/DiscoverHeader.tsx src/screens/subscription/JoinKidsClubScreen.tsx` | **PASS** (exit 0) |
| Unit tests (full) | `npx jest` | **331 suites / 3903 tests PASS**, 0 fail (54 suites `RUN_SUPABASE_E2E`-gated) — identical to the FIX-Task-41 baseline |
| Guide drift | `npm run verify:guides` (repo root) | 3 duplicate TC-IDs + 2 contradictions — **all pre-existing**; no new drift |
| Tier 1 (device) | Android `Medium_Phone_API_36.1` | items 2, 4, 5, 6 as above |
| Tier 2 | n/a — no migration/RPC/RLS/Stripe-logic change in Part A | — |

---

## 8. Files touched (Part A)

```
p2p-kids-marketplace/src/screens/home/DiscoverHeader.tsx                       (item 4 fix)
p2p-kids-marketplace/src/screens/subscription/JoinKidsClubScreen.tsx           (item 6 / item 11)
e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md                              (M07 flip + totals + K02 close + round note)
cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md  (roll-up + fixture gate + M07 locator hints)
e2e-test-results/fix-task-41-followthrough-2026-09-16/report.md                (this file)
```

**Mutation ledger (BP-80 disclosure):** the fixture's `ensure` **wrote to staging** — 1 auth user, 1 profile, 1 `subscriptions` row, 1 `sp_wallets` row, and (in Stripe **test mode**) 1 customer + 1 card + 1 subscription. Nothing was deleted. `qa:payfail-retry -- reset` tears all of it down (repo convention for every fixture), but the fixture is **deliberately left live** so M07 stays re-drivable — say the word and I will run `-- reset`.

**App-state residue:** the device is left signed in as **`test-free`** (last persona used for K02's empty leg) on the Landing/Home route; all QA toggles are **disarmed** (`payout_fetch_failure` read-back `none`, verified).

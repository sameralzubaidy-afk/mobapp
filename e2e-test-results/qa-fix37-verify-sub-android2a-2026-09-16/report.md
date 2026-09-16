# QA Round — FIX-Task-37 Device Verification + SUB Android Round 2a (Groups I + J)

**Run:** `e2e-test-results/qa-fix37-verify-sub-android2a-2026-09-16/`
**Date:** 2026-09-16
**Device:** Android emulator `Medium_Phone_API_36.1` (Android 16, `emulator-5554`) — dev-client build, Expo/Metro `:8081`
**App:** `com.sameralzubaidi.p2pmarketplace` · Supabase project `drntwgporzabmxdqykrp` (staging)
**Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (Groups I + J) + FIX-Task-37 verification brief

**Platform note:** both parts were executed on **Android**. The F1/F2 fixes are platform-agnostic JS/Edge-Function changes, so Android is a valid vehicle; it also matched the session's Part-2 mandate (one device, one bundle).

---

## Verdict summary

| Part | Scope | Result |
|---|---|---|
| **Part 1.1** | F1 — cross-account saved-card leak (HIGH privacy) | ✅ **PASS — fix confirmed on device** |
| **Part 1.2** | F2 — replaced PaymentMethod never detached | ✅ **PASS — fix confirmed (UI + DB + Stripe)** |
| **Part 1.3** | Items 8–11 UX additions | ✅ 3 PASS, ⚠️ 1 PASS-with-finding (item 9) |
| **Part 2** | SUB Groups I + J (13 cases) | **9 PASS / 2 PARTIAL / 0 FAIL / 0 BLOCKED** |

---

## PART 1 — FIX-Task-37 device verification

### 1.1 — F1 (HIGH privacy): cross-account saved-card disclosure — ✅ PASS

**Precondition (read-only DB gate, §4):** `qa-wallet` `stripe_payment_method_id = NULL` (expect empty state); `test-buyer` holds `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` (4444) — so the leak has a valid discriminator.

**Repro driven exactly as briefed (no relaunch anywhere in the sequence):**

1. Cold app restart → dev-client → **fresh bundle** (`Android Bundled 2016ms index.ts (5413 modules)`).
2. Warm switch → `test-buyer` (`qa-login-as`); Home confirms 458 SP = DB.
3. Open Payment Methods → **MASTERCARD •••• 4444** (`pm-saved-card`) — correct for test-buyer, and this **deliberately seeds the module-level `_pmCache`** with test-buyer's card.
4. **No relaunch.** Warm switch → `qa-wallet` (Home confirms 100 SP = DB, greeting "QA").
5. Open Payment Methods → **`pm-empty-state` / "No Payment Method"** ✅

**Result: the correct empty state renders. The old card does NOT leak.** Pixels + AX tree agree (`P1-06-F1-qa-wallet-PM-empty-state.png`).

**Third corroborating source — the app's own log (Metro):**

```
[QaLoginAsDeepLink] Logged in as qa-wallet ...
[NAV] route: PaymentMethods
[subscription] 📤 Fetching payment method...
[subscription] ℹ️ No payment method found
```

versus for test-buyer in the same session:

```
[NAV] route: PaymentMethods
[subscription] 📤 Fetching payment method...
[subscription] ✅ Payment method retrieved
```

The qa-wallet read performed a **fresh fetch** and concluded *no payment method*. Pre-fix, a global cache hit would have **skipped the fetch entirely** and served 4444. This is direct evidence the cache is now user-scoped, not merely absent.

**Cache still functions (not just disabled)** — after switching back to test-buyer the saved 4444 card rendered correctly, and a **third** persona cross-check fell out incidentally: test-free's Payment Methods showed *its own* MASTERCARD 4444 (matching its DB-named `pm_1UFatX…`), not another persona's card.

**Source confirmation:** `src/services/subscription.ts` — cache is user-scoped (`_pmCacheUserId`), the getter reads `supabase.auth.getSession()` before consulting the cache and treats an owner mismatch as a miss (L881-886), and `invalidatePaymentMethodCache()` clears the owner (L1001-1003).

### 1.2 — F2: replaced PM never detached — ✅ PASS

`retirePreviousPaymentMethod` (source-read first, so the assertion matches its real contract) detaches **only the single previous DB-named PM**, skipping `no_customer` / `no_previous_pm` / `unchanged` / `not_attached_to_customer`. So the fix's contract is **net-zero per replacement**, not "sweep the customer".

Evidence is labelled **`key_scope=SECRET_KEY_BREAK_GLASS`** (F3 excluded per standing instruction — the restricted `STRIPE_QA_READONLY_KEY` was not used).

| Step | DB `stripe_payment_method_id` | Stripe attached PMs on `cus_Ungj4MptKp9CUg` | Verdict |
|---|---|---|---|
| Baseline | `pm_1UFatV4…` (4444) | **4** = the named one + **3 known orphans** | matches the recorded pre-state |
| After update → new Visa 4242 (`pm_1UGLe04…`) | `pm_1UGLe04…` | **4 — unchanged**; `pm_1UFatV4…` **DETACHED** | ✅ **no accumulation** (pre-fix → 5) |
| After Remove | **NULL** | **3** (orphans only; `pm_1UGLe04…` detached) | ✅ removed properly |

The Stripe PaymentSheet was fully **AX-drivable on Android** (card fields + `primary_button` exposed), so no pixel-scan was needed. Card entry: `4242 4242 4242 4242`, `12/29`, ZIP `06850`; `address_postal_code_check: pass`, `cvc_check: pass`.

**On the brief's "exactly one attached PM / zero after Remove":** that literal count is unreachable on test-buyer because of the **3 pre-existing orphans the brief itself declares intentional and not backfilled** (and qa-wallet turned out to carry a 4th, undocumented one — see Findings). The meaningful, achieved assertion is the fix's actual contract: **an update does not grow the attached set (4→4) and the replaced PM is detached by identity**; Remove detaches the remainder, leaving only the documented orphans. On a customer with no orphans this yields exactly 1 → 0.

### 1.3 — Items 8–11

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 8 | Link explainer on Payment Methods | ✅ **PASS** | `pm-link-explainer` renders in the empty state: "Stripe may also offer to save your details with Link for faster checkout next time. That is optional — you can always just pay with a card." Present in both the empty and saved-card states |
| 9 | Payout Settings aggregate summary line | ⚠️ **PASS-with-FINDING** | `payout-action-required-summary` renders — but reads "**5** payouts need a payout method" while the DB holds **17** `requires_action` rows for test-seller. **Finding M1** |
| 10 | Profile stats placeholder (no false "0/0" flash) | ✅ **PASS** (two-source) | Loaded state shows real values (188 Listings / 39 Trades / 2263 SP — never `0`); source shows the pre-load path is `statsLoaded ? value : '—'` with `statsLoaded` initialised `false` and AX label `Loading listings count`. **The transient frame was not captured** — see Known Gaps |
| 11 | `settings/payment-methods` deep link on a **cold** launch | ✅ **PASS** | App terminated → `am start` deep link (`LaunchState: COLD`, DevLauncherActivity) → Metro row → Metro log: `[ENTRY] registerRootComponent - App starting` → `[NAV] route: PaymentMethods` → screen rendered correctly for the restored session |

---

## PART 2 — SUB Android Round 2a (Groups I + J)

### Pre-state (read-only DB gate, taken before any device work)

| Persona | `sp_wallets.state` | `available` | `pending` | `reserved_sp` | `lifetime earned/spent` | `sub.status` | DB-named PM |
|---|---|---|---|---|---|---|---|
| test-buyer | active | 458 | 0 | 0 | 97 / 115 | active | `pm_1UFatV4…` |
| test-seller | active | 2263 | **503** | 0 | 2741 / 0 | active | — |
| test-free | active | 0 | 0 | 0 | 0 / 0 | free | `pm_1UFatX…` |
| test-grace | **grace_period** ✅ | 0 | 0 | 0 | 0 / 0 | grace | — |
| test-expired | **frozen** ✅ | 0 | 0 | 0 | 0 / 0 | expired | — |

**FIX-Task-37's fixture repair is live:** `test-grace`'s wallet is now correctly `grace_period` (previously `active`, which suppressed the banner).

### Per-case results

| TC-ID | Verdict | Top evidence |
|---|---|---|
| **SUB-TC-I01** | ✅ PASS | test-buyer hero 458 + lifetime 97/115/0 = **DB-exact**; footer "🔒 SP can only be used for item purchases" present (below fold). test-seller 2263 + 2741/0/503 = DB-exact |
| **SUB-TC-I02** | ✅ PASS | Shop → **Discover**; Sell → **New Item** (photo-first gating intact); History → **SP History** — all three device-driven |
| **SUB-TC-I03** | ✅ PASS | "Sell an item" + "Refer a friend" rows present; "How Trading Works" → **Help** education screen (sections + SP Calculator) |
| **SUB-TC-I04** | ✅ PASS (negative leg) | "Points expire after **700** days of inactivity…" (N from config); expiring-soon alert correctly **absent** (`expiringSoonTotal` = 0). Positive alert leg fixture-gated |
| **SUB-TC-I05** | ✅ PASS (3 states) | active → **no banner**; grace_period → amber **"Grace Period Active"** (scan **86.21% #FFF3E0 / 1.00% #FFA726 / 0.00% red**); frozen → info-blue **"Swap Points Frozen"** (**87.66% #EBF4F9 / 0.00% red**). Tokens **match QA31-T's record exactly**. `suspended` not re-driven (no persona; already PASS in ADM-TC-L08/QA31-T) |
| **SUB-TC-I06** | ✅ PASS | test-free: normal 0-SP wallet, quick actions enabled, **`sp-wallet-join-kids-club-card`** upsell, **no banner**. Lifetime 0/0/0 = DB |
| **SUB-TC-I07** | 🟡 PARTIAL | "Reserved in trades" card correctly **absent** at `reserved_sp = 0` (all personas). Positive leg fixture-gated |
| **SUB-TC-I08** | ✅ PASS | Driven deterministically via the `sp_wallet_not_found` toggle → 💳 "Wallet Not Found" / "Unable to load your SP wallet." Toggle disarmed + verified cleared |
| **SUB-TC-I09** | ✅ PASS | "⏳ **39 SP Pending Release**" + "…**3 days** after each trade you complete." Both pending numbers DB-reconciled (see below) |
| **SUB-TC-J01** | ✅ PASS | Header "SP History"; All/Earned/Spent all filter correctly; active tab bold + green underline (screenshot — **AX tree was stale** here) |
| **SUB-TC-J02** | ✅ PASS | Earned = green **"+N SP"** with the coins icon; Spent = red **"−N SP"** with a *different* swap-arrows icon; labels + timestamps present |
| **SUB-TC-J03** | ✅ PASS | Spent tab on test-seller (`lifetime_spent` 0) → `sp-history-empty-state` + grey Coins icon + "No transactions yet" |
| **SUB-TC-J04** | 🟡 PARTIAL | Pull-to-refresh **fired** (spinner captured mid-flight) and the list reloaded with **12 rows**; "newest entry after a *new* earning event" leg not driven (fixture) |

### Double-checked before filing (R100 — named the writers, avoided 2 false findings)

- **"39 SP Pending Release" vs "Pending 503"** looked like a contradiction. Named both writers: the note = `sum(trades.sp_earned_at_completion)` over the release queue (`sp_earned_at_completion > 0`, `pending_sp_release_at` set, `sp_released_at` null) = **39 (exact)**; the chip = `sp_wallets.pending_balance` = **503 (exact)**. Two legitimate concepts → **NOT a finding** (logged as an optional wording idea instead).
- **Payout Settings "5 vs 17"** survived the same discipline and **is** a real finding (below) — the window scope is visible in source.

### ADM-TC-L08 cross-reference (SP Wallet warning banners) — PARTIAL / premise corrected

- **3 of 4 banner states are device-verified in this session** (active / grace_period / frozen) with pixel-level tint evidence, exactly matching ADM-TC-L08's already-recorded PASS (QA31-M + QA31-T, 2026-09-04) — including its **`suspended` = #E85D75 on #FFF0F2** leg, which this round did not re-drive (no persona holds `suspended`).
- **The dispatch's premise — "verify with a freshly-changed config value" — does not apply.** Source-read of `WalletWarningBanner.tsx`: the banner keys off the **wallet `state`** (not the subscription), and its copy is **not config-driven** — there is no config-supplied day count. The ADMIN guide's expected *"Grace Period Active — 90 days…"* and *"yellow banner"* wording is therefore **DOC-DRIFT** vs the live R6 copy.

### Cron/caller awareness (R110)

No case in this round depended on a scheduled transition: I05's grace state was a **static fixture state** (not a grace *entry* transition), and I09's release queue was read as data. R110's `cron.job` caller check was therefore not triggered here — noted so the omission is deliberate, not overlooked. (FIX-Task-37 item 5 already verified `release-pending-sp` jobid 66 → EF, `qa:cron-health` 21 PASS / 0 WARN / 0 FAIL.)

---

## Findings

### M1 — MED · Payout Settings "needs a payout method" summary under-reports (new feature, window-scoped)
`PayoutSettingsScreen.tsx:177` derives `actionRequiredPayoutCount` from `recentPayouts`, which is set from `getRecentPayouts(payoutLimit)` where **`payoutLimit` starts at 5** (L255-256; grows only via "Load More"). The line therefore renders **"5 payouts need a payout method"** while test-seller has **17** `requires_action` rows in `seller_payouts` (DB-verified).
The irony is in the code's own comment: it states the motivation as *"A seller with **17** stuck rows previously had to read all 17"* — but the implementation counts only the first page, so the feature under-reports the exact situation it was written for. **Same class as the R54 window-scoped-labeling trap** (QA Task 30's `/payouts/earnings` cards).
**Suggested fix:** compute from a dedicated aggregate (`count(*) where status='requires_action' for this user`) — or, if the windowed count is intended, label it ("…so far — Load More for all") so the number cannot be misread as the seller's whole backlog.

### L1 — LOW · DOC-DRIFT: SUB-TC-I08's "rare / unreachable" note is stale
The guide says the Wallet-Not-Found state is rare because `getWallet` auto-inserts a missing row. A first-class `sp_wallet_not_found` QA toggle now exists (`getSimulatedWalletNotFoundMode()` short-circuits before any DB read/auto-insert, `src/services/sp/wallet.ts:54-63`), making it deterministically testable. Recommend updating the guide note.

### L2 — LOW · DOC-DRIFT: ADM-TC-L08 expected copy
"Grace Period Active — **90 days**…" + "**yellow** banner": the live banner renders the R6 copy with **no day count**, in the documented **warning-amber** token. (Recorded; no code change needed.)

### L3 — OBSERVATION (verified, not a defect) · a 4th persona carries an unattributed attached PM
`qa-wallet`'s Stripe customer `cus_VDA6aCp5fY8Uci` holds **1 attached PM** (`pm_1UGKRu4I6kCJlvXoTAjHd9K3`, Visa 4242, created `2026-09-16T15:08:38Z` — **75 min before this session started**, so not created by this run) while `subscriptions.stripe_payment_method_id` is **NULL** and the app correctly shows the empty state. Same class as test-buyer's 3 documented orphans, but **undocumented**. Also visible to the user: the Stripe PaymentSheet offers "Saved ···· 4242" to a user the app says has no card.
Not filed as a defect (it is the declared, intentionally-not-backfilled orphan class); recorded so the orphan inventory is complete. Tooling note: `qa:stripe-inspect` has **no** "list PMs by customer" subcommand and its `by-user` persona map does not resolve `qa-wallet` (resolved via the raw UUID instead) — an instrumentation ask.

---

## Run friction (for the next round)

1. **R63a violation found and fixed at session start — TWO Metro instances** (8081 + 8082) were running; the stray one would have made the Android dev-client cold-connect ambiguous. Killed via `npm run metro:kill` + `npm run start:single` (single instance verified).
2. **AX-tree staleness on SP History** — after tapping the Earned tab the tree still returned the Spent empty state; the screenshot was the truth. **SP History added to the known-stale screen list** (this is the 2nd distinct screen this round where the tree lagged a tab switch).
3. **R96 confirmed twice** — `sp-wallet` / `profile` deep links into an **already-mounted** route only re-focus it: the Profile stats pre-load frame could not be captured (no remount → no fetch), and the I08 toggle initially appeared not to work until the Wallet was unmounted first.
4. **Android text-injection gap** — `mobile_type_keys` typed the Stripe card number fine but **silently dropped the expiry**; `adb shell input text` worked. (Entered CVC reads `122` rather than the intended `123` — a valid 3-digit test CVC whose value cannot affect the attach assertion; recorded as a deliberate, reasoned deviation rather than spending a relaunch cycle. §5.2's corrupted-field rule targets untrustworthy/mangled form state; the field here holds a complete valid value and the form progressed correctly.)
5. **Android IME gate worked as designed** — after text entry the "Set up" button vanished from the tree; the screenshot proved the Gboard keypad was up, BACK dismissed it, the next tree showed the restored layout, then the tap landed.
6. `view_image` **did** return readable pixels this session (contradicting R5) at the documented ~0.815× downscale — recorded, tree coordinates preferred throughout (R104).

---

## Known Gaps / Not Tested

- **Item 10's transient pre-load frame was not captured** — the Profile deep link re-focused an already-mounted screen (R96), so no fetch/loading state occurred. The claim rests on two-source corroboration (source + loaded-state device check), not a captured frame; stated as such rather than claimed as observed.
- **SUB-TC-I07 positive leg** — no persona has `reserved_sp > 0` (needs an open SP-backed offer).
- **SUB-TC-I04 expiring-soon alert positive leg** — no batch expires within 30 days.
- **SUB-TC-J04 new-earning-event leg** — no SP-earning event created.
- **I05 `suspended` (red) banner** — no persona holds `suspended`; covered by ADM-TC-L08's existing PASS (QA31-T), not re-driven here.
- **ADM-TC-L08 not executed as an admin-driven flow** this round (its premise — a config-driven banner — was source-disproven; see above).
- **A migration/probe process (`supabase db reset --workdir /tmp/probe-root`) and a Playwright admin test-server were running** at session start — judged to be an idle non-driving developer process (R29 check found no Maestro/`run-suite` and no in-flight agent driving either device), so the session proceeded. Recorded for transparency.
- **F2's second update cycle** (4242 → 4444) was deliberately not repeated: the retire path is deterministic and already proven by identity at the first update; budget was reallocated to the 13 SUB cases.

## App State Left Behind

- **`test-buyer`'s saved card changed and then removed.** Baseline `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` (4444) → new Visa 4242 (`pm_1UGLe04…`) → **removed**. Net: `subscriptions.stripe_payment_method_id = NULL` (was `pm_1UFatV4…`), and `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` is now **permanently detached on Stripe** (Stripe does not allow re-attaching a detached PM). The 3 pre-existing orphans remain. **test-buyer has no saved card at the end of this run** — restore via `npm run qa:ensure-cards -- --persona test-buyer` before any offer-flow test.
- **Stripe objects created:** 1 new test-mode PM (created then detached) + 1 SetupIntent on test-buyer's customer. Test-mode only.
- **QA toggles:** `sp_wallet_not_found` armed → **disarmed and verified cleared** (handler read-back `none` + a fresh mount showing the normal wallet). No residue.
- **Signed-in persona at end:** `test-free` (SP Wallet screen). Session left open; no code/config/DB writes were made.
- No tracker/guide source files were modified (guide edits are recommendations only).

---

## 📋 QA Session Handoff

**Test Scope:** Part 1 — FIX-Task-37 device verification (F1 cross-account card leak, F2 replaced-PM detach, items 8–11 UX additions); Part 2 — SUB Android Round 2a, Groups I + J (SUB-TC-I01–I09 + SUB-TC-J01–J04 = 13 cases) + the ADM-TC-L08 cross-reference.
**Design-System Compliance:** PASS — no deviations found on the screens/dialogs reviewed (Payment Methods empty + saved-card states, Payout Settings, Profile, SP Wallet × 5 personas, SP History × 3 tabs, Stripe PaymentSheet, `GlobalAlertProvider` dialogs, Help). Token checks were deterministic where the case demanded them: **grace banner 86.21% #FFF3E0 + 1.00% #FFA726 / 0.00% red**; **frozen banner 87.66% #EBF4F9 / 0.00% red** — both matching ADM-TC-L08's QA31-T record. (R62d's full forbidden-hex sweep was not run this round — the visible surfaces were colour-scanned for their semantic tokens instead.)
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered well within the <3s ideal on Android (deep-link navigations ~0.5–2s; wallet/history renders ≤2s). The one >10s case was the **dev-build cold start** (`LaunchState: COLD`, `TotalTime 10109ms` through DevLauncherActivity + bundle load) — an environment artifact of the dev client, not app behaviour.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Payment Methods (empty state): correct empty-state copy + Link explainer; single primary CTA.
- CONFIRMED — Payment Methods (saved card): MASTERCARD/VISA + masked number + expiry; Update/Remove as secondary.
- CONFIRMED — Stripe PaymentSheet (add card): standard Stripe chrome, "Set up" primary, Link opt-in clearly optional.
- CONFIRMED — `GlobalAlertProvider` dialogs: "Payment Method Saved", "Remove Payment Method" (Cancel/Remove), "Removed" — sensible titles, one primary each, destructive action clearly labelled.
- CONFIRMED — Payout Settings: summary line + rows; "Payout Settings" title header.
- CONFIRMED — Profile: stats row, badges, membership cards; no layout defects observed.
- CONFIRMED — SP Wallet (active/grace/frozen/free): hero, quick actions, earn section, expiration box, banners using the documented semantic tints.
- CONFIRMED — SP History (All/Earned/Spent): tab styling (bold + green underline), row layout, red/green signed amounts, per-tab empty state.
- CONFIRMED — Help (education): section cards with expand/collapse affordances + SP Calculator.
- DEVIATION — ADMIN guide SUB-TC-L08/ADM-TC-L08 expected copy ("Grace Period Active — 90 days…", "yellow banner") is stale vs the live R6 copy and amber token (**guide doc-drift, not a UI defect**).
**Verdict Summary:** Part 1: **F1 ✅ PASS / F2 ✅ PASS** (highest-priority items clean); items 8–11 = 3 PASS + 1 PASS-with-finding. Part 2: **9 PASS / 2 PARTIAL / 0 FAIL / 0 BLOCKED** (13 cases).
**Money Verification Layers:**
- `F2 (PM add/update/remove)` — UI ✓ (Saved Card VISA 4242 → empty state) | DB ✓ (`subscriptions.stripe_payment_method_id` NULL at end; `updated_at` stamped) | Stripe ✓ (attached set by identity: `pm_1UFatV4…` and `pm_1UGLe04…` both detached; count 4→4→3; `saved_pm_attached_to_expected_customer: AGREE`) — **`key_scope=SECRET_KEY_BREAK_GLASS`**.
- `SUB-TC-I09` — UI ✓ ("39 SP Pending Release", "3 days") | DB ✓ (release-queue sum = 39 exact; `sp_wallets.pending_balance` = 503 exact — two distinct concepts reconciled) | Stripe **N/A** — SP is a closed-loop in-app currency with no Stripe object.
- `SUB-TC-I01 / I05 / I06 / I07 / J01–J04` — UI ✓ | DB ✓ (balances/lifetime/reserved/state all read back) | Stripe **N/A** — SP-only surfaces, no provider object.
- `Part 1 item 9` — UI ✓ ("5 payouts need a payout method") | DB ✓ (**17** `requires_action` rows — **DISAGREE, filed as finding M1**; writer named: `getRecentPayouts(payoutLimit)`, payoutLimit initialised to 5) | Stripe **N/A** (payout rows are pre-dispatch; no Stripe payout object).
**Coverage Tracker Updated:** YES — `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (SUB section). **13 rows updated** with Android verdicts + new Date/Source/Notes (SUB-TC-I01–I05, I07–I09, J01–J04); **SUB-TC-I06 row ADDED** (R57 — it previously had no inventory home in either the Completed or never-run table); **SUB-TC-I08 flipped `🔴 STILL OPEN` → `✅ PASS`**. Roll-up deltas: **PASS 77 → 78**, **OPEN 3 → 2** (both from the I08 flip); a Round-2a note added to the SUB section header. SUB section header now reads: **Cases 100 · PASS 78 · PARTIAL 2 · OPEN 2 · DOC-DRIFT 0 · SKIPPED 0 · RETIRED 15 · N/A 2 · Remaining (ACTIVE) 1**.
**Critical Findings:** 1) **M1 MED** — Payout Settings "N payouts need a payout method" is window-scoped to the first 5 loaded rows, rendering "5" against a true backlog of 17 (the very scenario the feature was built for). 2) **L1/L2 LOW doc-drift** — SUB-TC-I08's "rare/unreachable" note (a toggle now exists) and ADM-TC-L08's grace copy ("90 days", "yellow"). 3) **L3 OBSERVATION** — a 4th, undocumented attached PM (`qa-wallet`) + the absence of a "list PMs by customer" inspect subcommand. No HIGH findings — **F1 and F2 are genuinely fixed**.
**App State Left Behind:** `test-buyer`'s saved card **changed twice and removed** — `stripe_payment_method_id` is now **NULL** and the original `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` is **permanently detached on Stripe** (detached PMs cannot be re-attached). **Restore with `npm run qa:ensure-cards -- --persona test-buyer` before any offer-flow test.** 1 new test-mode PM + 1 SetupIntent created (test mode). QA toggle `sp_wallet_not_found` armed then **disarmed + verified**. Session left signed in as `test-free` on the SP Wallet. No repo/DB/config writes.
**Why It Matters:** This run was the device leg owed by FIX-Task-37 (BP-91) — and it closes the **HIGH privacy defect** with three independent sources (pixels, AX tree, and the app's own fetch log proving a scoped re-fetch rather than a cache hit), plus proves the provider-side PM-retirement fix stops orphan accumulation on the exact customer that had the problem. It also delivers the first **Android** verdicts for the SP Wallet/History groups, confirming `test-grace`'s repaired `grace_period` state now renders the correct amber banner — closing the wallet-state contradiction FIX-Task-37's fixture fix was written to unblock.
**How to Verify/Reproduce:** All evidence in `e2e-test-results/qa-fix37-verify-sub-android2a-2026-09-16/screenshots/`. F1: `P1-05-PM-testbuyer.png` (card seeded) → `P1-06-F1-qa-wallet-PM-empty-state.png` (**no relaunch between them**); corroborate via the Metro log lines quoted above. F2: `P1-10…`/`P1-11…` (card entry), `P1-13…` (post-attach), `P1-16…`/`P1-18…` (post-Remove empty state); re-run `npm run qa:stripe-inspect -- by-user test-buyer --break-glass-secret-key` and compare the attached set by PM **identity**. I05: `P2-I05-grace-banner.png` / `P2-I05-expired-banner.png` (re-scan with the `qa:badge-scan` RGB ranges recorded above). M1: `SELECT status, count(*) FROM seller_payouts WHERE user_id=(SELECT id FROM auth.users WHERE email='test-seller@kidsmarketplace.test') GROUP BY status;` → `requires_action = 17` vs the rendered "5".
**Known Gaps / Not Tested:** item 10's transient pre-load frame (R96 re-focus — not remounted, so no fetch state existed to capture); SUB-TC-I07 positive leg (no `reserved_sp > 0` fixture); I04 expiring-soon alert positive leg (no ≤30d batch); J04's new-earning-event leg; I05's `suspended` banner (no persona — covered by ADM-TC-L08's existing PASS); ADM-TC-L08 not re-executed as an admin-driven flow (its config premise was source-disproven); F2's redundant second update cycle; R62d's full forbidden-hex sweep. See the full Notes section above for each leg.
**What Needs To Be Fixed Next:**
1. **Fix M1 — Payout Settings summary.** `src/screens/seller/PayoutSettingsScreen.tsx:177`: replace the page-derived filter with a user-scoped aggregate count (e.g. a `seller_payouts` count where `status='requires_action'`), or explicitly label the windowed figure ("…so far"). Today it reads "5" when 17 rows are stuck — the exact confusion it was added to remove.
2. **Fix L1 — guide drift.** Update SUB-TC-I08's note to reference the `sp_wallet_not_found` QA toggle (the state is deterministic, not "rare").
3. **Fix L2 — guide drift.** Correct ADM-TC-L08's expected result to the live R6 grace copy and the amber (not "yellow") token.
4. **Instrumentation (L3).** Add a `qa:stripe-inspect … pm-list --customer <cus_…>` subcommand and extend the `by-user` persona map to cover `qa-wallet` (and other QA personas), so orphan inventories can be enumerated without guessing PM ids.
5. **Fixture (optional).** Restore `test-buyer`'s saved card (`npm run qa:ensure-cards -- --persona test-buyer`) — this run left it with none by design of the F2 cycle.
**UX Enhancement Ideas (optional, not defects):**
- On the **SP Wallet**, two different quantities both read as "pending" ("Pending 503" chip and "39 SP Pending Release" note; both DB-exact but conceptually distinct) — consider differentiating the chip label (e.g. "Held" / "Pending release") to reduce parent confusion.
- On **Payout Settings**, 17 rows all reading "Action Required" are scanned individually — once M1 is fixed to a true total, consider an inline "Why?" affordance so a seller learns the single shared cause without opening a row.
- On the **SP History** tabs, the active-tab styling is the only state affordance while the AX tree exposes no `selected` flag — consider adding `accessibilityState={{selected}}` so the tab state is programmatically and assistively determinable.
**Suggested Next Session:** Finish the remaining SUB groups on Android (K/L/N + the Group M payment-methods legs that already hold iOS PASS) and re-drive the 2 PARTIAL rows from this round once a `reserved_sp > 0` offer fixture and an SP-earning event exist. If any further admin-linked SUB case is queued, pair it with the M1 fix so the corrected summary can be DB-reconciled at the same time.
**Suggested to Improve Agent Rules:** **Add a standing rule that a NEWLY-INTRODUCED aggregate/summary UI element must be DB-reconciled against its own claimed scope before it can be marked PASS** — this round's item 9 rendered correctly, looked right, and was silently wrong by 12 rows; the only reason it was caught is that the R54 discipline happened to be applied to a UX *addition* rather than an existing admin number. The rule should read: when verifying a fix that *adds* a count/stat/summary, assert the rendered number against the authoritative total for the scope its **label implies**, and name the writer (page-derived vs aggregate) — "the element renders" is not the same as "the element is right".

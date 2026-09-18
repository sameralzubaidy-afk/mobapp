# QA Round — FIX-Task-53 **Android Verification Leg** (2026-09-18)

**Platform:** Android only — AVD `Medium_Phone_API_36.1` (emulator-5554), 1080×2400 (tree coords == px, R77 #1). **iOS NOT driven (R80).**
**Run folder:** `e2e-test-results/qa-fix53-android-verify-2026-09-18/` (report.md · ledger.md · 20 screenshots)
**Personas:** `test-grace` → `test-buyer` → `qa-payout-seller` → `test-expired`
**Source brief:** FIX-Task-53 Android Verification Leg (item 1 core fix · item 2 DB read-back · items 11/5/7 owed variants)
**Prior handoff:** `e2e-test-results/fix-task-53-2026-09-17/report.md` §6 (owed legs 1–5)

---

## 0. Verdict summary

| # | Item | Verdict | One-line |
|---|---|---|---|
| 1 | Grace-Spend fix confirmed on Android (device) | ✅ **PASS** | `sp-amount-input` present + `subscribe-upsell-card` absent; 5 SP spent; timeline "Swap Points Used: 5 SP" |
| 2 | DB read-back of the SP spend | ✅ **PASS** | `trades.sp_amount = 5` for the owed iOS-leg trade; Android spend DB-confirmed (wallet 15 → 10) |
| 11 | `Cancelled At (historical)` label | ✅ **PASS** (both legs) | Qualifying row → `(historical)` shown; non-qualifying row → plain `Cancelled At` |
| 7 | `no-method-cancel-btn` AX exposure | ✅ **PASS** | Both buttons genuinely in the AX tree on a fresh bundle |
| 5 | Unverified-method guard copy variant | ⏸ **BLOCKED (fixture gap)** | Needs a state no shipped fixture scenario produces — source-verified |

**Totals: 4 PASS · 0 FAIL · 1 BLOCKED · 0 SKIPPED.** No SUB status flips (all affected rows were already ✅ PASS).

---

## 1. Environment

| Check | Result |
|---|---|
| Devices | `emulator-5554` attached, `device` state |
| Metro | **Single instance on :8081** (R63a satisfied — nothing on :8082) |
| Host load | **3.34 / 10.71 / 9.88** — healthy vs Round 6's 29.05 |
| Admin portal (:3001) | not running — **not needed** (no admin-dependent case in this brief) |
| MCP Supabase | **401 UNAUTHORIZED** — no MCP DB path this session |
| Local DB path | ✅ **available** — `scripts/qa/*` use the service-role key from `.env` via `lib/r41-common.mjs` (`qa:start-state`, `qa:stripe-inspect`, `qa:payout-fixture`) |
| `stylus_handwriting_enabled` | set to `0` at round start (R77 #2) |

### 1.1 Bundle-freshness gate — applied BEFORE any drive (R79-1b)

| Fact | Value |
|---|---|
| FIX-Task-53 commit | `73426d4d` — **Fri Sep 18 06:25:16** (today) |
| Metro start | **Thu Sep 17 16:01:06** (≈14.5 h earlier) |
| App bundle at round start | loaded **before** the fix commit ⇒ **pre-fix** |

⇒ A cold reload was forced first (terminate → launch → Dev Launcher → tap the `:8081` row → bundle load), per R79-1b's ordering (**cold reload FIRST**, then re-fire, then control-test). Two independent freshness corroborations afterwards: (a) the Home SP strip rendered **`15 SP`** for the grace user instead of the free-tier "Unlock Swap Points / Upgrade →" upsell (a `UserDashboardScreen` behaviour swept onto the shared predicates by FIX-Task-53 item 3); (b) the grace banner recomputed **54 → 53 days** — i.e. the fresh JS recomputed from `grace_ends_at`, which the day-old bundle could not have done.

---

## 2. Item 1 — Grace-Spend fix on Android ✅ PASS

**Assert (per FIX-Task-53 §6.1 recipe):** the SP control is present **and** `subscribe-upsell-card` is absent for a `grace_period` user; spending SP succeeds; the timeline records the spend.

### 2.1 Trace

| Step | Action | Evidence |
|---|---|---|
| 1 | `qa:start-state -- test-grace` → `subscriptions.status=grace_period`, `sp_wallets.state=grace_period`, **avail 15 SP**, `grace_end 2026-11-09` | pre-state |
| 2 | Discover tab → `discover-show-all-nodes-toggle` OFF→**ON**, `discover-sp-toggle` OFF→**ON** → `94 results · all nodes` | `A04-discover-sp-filter-on.png` |
| 3 | Opened the **2nd** SP-accepting card ("QA Bundle Fixture 1 of 3 (2026-09-13)", $28.00) — deliberately **not** the 1st, which is the item carrying the pre-existing pending offer (R15 idempotency avoidance) | Item Detail |
| 4 | **Request to Buy** | Make Offer |
| 5 | **ASSERT:** `sp-input-wrapper` + **`sp-amount-input` PRESENT**; **`subscribe-upsell-card` ABSENT**; grace copy present | `A05-make-offer-grace-android.png` + AX tree |
| 6 | Entered `5` → **"5 SP applied"**, YOU OFFER `$23.00` (28 − 5) | `A06-grace-5sp-applied-android.png` |
| 7 | IME gate (R19): screenshot proved the keypad was up → BACK → screenshot proved it was gone → **re-listed** (the layout had shifted: `send-offer-button` y1980 → **y1854**) | `A07-ime-dismissed-preaction.png` |
| 8 | **Send Offer** (its own step — R106; it opens a modal) | → disclaimer |
| 9 | `disclaimer-modal` AX-exposed; `disclaimer-modal-accept-button` **`disabled`** until the checkbox was ticked (R30). Tapped the checkbox **square** at (84,2107), not the row centre (FIX-Task-27 Android lesson) → `checked`, accept un-disabled | `A08-disclaimer-modal-android.png` |
| 10 | **Accept & Continue** | → Trade Initiated |
| 11 | **"Trade Initiated! Your trade request has been sent… Got it! You saved $5.00 using SP! You have 10 SP available."** (15 − 5 = 10, DB-consistent) | `A09-offer-submit-poll1.png` |
| 12 | Trades badge incremented **1 → 2** (second corroboration) | same frame |
| 13 | **View Trade Details** → Trade Timeline | `A10-trade-timeline-android.png` |
| 14 | **ASSERT:** `Payment Details` → **`Swap Points Used: 5 SP`** (Payment authorized $23.00 · Platform Fee $1.49 · Est. Sales Tax $1.96 · Total $26.45) | `A10` |

### 2.2 Verdict

**✅ PASS.** The pre-fix failure mode — the SP branch skipped and `subscribe-upsell-card` rendered in its place — is **reversed on Android**, and the spend persisted to the timeline (not merely rendered). The exact assertions the brief named all hold.

---

## 3. Item 2 — DB read-back of the SP spend ✅ PASS

The brief asked to close the gap FIX-Task-53 §6 item 5 recorded: *"DB read-back of `trades.sp_amount` for `0ba80809-…` — owed (no MCP tools this session)."*

```
npm run qa:stripe-inspect -- by-trade 0ba80809-9c04-4117-bc65-2fbd09613e42 --break-glass-secret-key
```

| Layer | Value |
|---|---|
| DB `trades.sp_amount` | **5** ✅ |
| DB `payments.sp_amount` | **5** |
| Provider PI metadata | `sp_amount: "5"` |
| PI (`pi_3UGm2B4I6kCJlvXo1I6s5sgG`) | `requires_capture`, `amount 2966`, `amount_received 0` |

**Android spend additionally DB-confirmed:** `qa:start-state -- test-grace` re-read → wallet **avail 15 → 10**, `state` still `grace_period`.

⚠️ **Key-scope disclosure.** `qa:stripe-inspect` **correctly refused** to run first — `STRIPE_QA_READONLY_KEY` currently holds a full `sk_test_…` secret, not an `rk_test_…` restricted key (the tool's designed guard, §5.37 rule 6). The read above therefore used the documented `--break-glass-secret-key` path and is labelled **`key_scope=SECRET_KEY_BREAK_GLASS`** — the **DB** values are the evidence here; the **provider** layer is corroboration, **not** restricted-read-only evidence.

**✅ PASS** — the one verification gap named in the prior handoff is closed.

---

## 4. Item 11 — `Cancelled At (historical)` ✅ PASS (both legs)

**Source:** `SubscriptionStatusScreen.tsx:274` → `label={cancellationIsHistorical ? 'Cancelled At (historical)' : 'Cancelled At'}`, where the qualifier requires `cancelled_at` **AND** a future `current_period_end` **AND** a live status (`active`/`trial`/`cancelled`).

| Leg | Persona / state | Observed | Verdict |
|---|---|---|---|
| **Positive** | `test-buyer` — `status=active`, `cancel_reason=too_expensive` residual `cancelled_at`, `current_period_end` **2026-09-27** (future) | `Cancellation` → **`Cancelled At (historical)`** | ✅ qualifier rendered |
| **Negative** | `test-expired` — `cancelled_at` set but `current_period_end` **2026-08-01** (past) + status `expired` | `Cancellation` → **plain `Cancelled At`** (no qualifier) | ✅ eligibility gate holds |

Reached via `p2pkidsmarketplace://qa-subscription-status` (FIX-Task-52 item 4 — the screen has no in-app entry).
Evidence: `B07-subscription-status-historical.png` · `D02-subscription-status-expired.png`.

**Both legs confirm the fix's intent:** the historical date is disambiguated exactly when a bare "Cancelled At" beside a live ACTIVE status would read as a contradiction, and not otherwise.

### 4.1 ⚠️ LOW layout finding — the longer label wraps

Measured boxes (`qa:ocr --coords`) in the Cancellation row:

```
Cancelled At              {x:80,  y:1765, w:206, h:35}
9/17/2026, 6:48:03 AM     {x:627, y:1765, w:366, h:42}
(historical)              {x:80,  y:1807, w:174, h:38}
```

The label is a **single string** that **wraps onto a second line** inside the label column, roughly doubling that row's height vs its single-line siblings. The text is fully readable and the string is complete — so this is **cosmetic, not a functional failure** — but it is the same class FIX-Task-52 flagged (*"a longer copy string can break a layout that typecheck/lint/tests cannot see"*). Suggested (dev-side, optional): give the label column `flex:1` + allow the row to size to content, or shorten to `Cancelled At (hist.)`.

---

## 5. Item 5 — Unverified-method guard copy variant ⏸ BLOCKED (fixture gap)

**Expected:** `NoMethodModal` with `unverifiedMethod` → title **"Verify Your Payout Method"**, body *"To withdraw your earnings, finish setting up your payout method first."*, CTA **"Continue Onboarding"**.

### 5.1 What was driven

`qa:payout-fixture -- methods --scenario single-unverified` (1 row: `stripe_connect`, `is_primary: true`, `is_verified: false`, `stripe_onboarding_complete: false`) → `qa-login-as?persona=qa-payout-seller` → `payout-settings` → screen correctly rendered the unverified method (`acct_****_unv`, **"Onboarding required"**, "Continue Onboarding" row) → **Withdraw Now**.

**Observed:** the ordinary **`Withdraw Funds`** modal (fee summary, `Confirm`/`Cancel`) — **not** the guard. Evidence: `C03-item5-FINDING-guard-did-not-fire-ordinary-withdraw-modal.png`. *(Cancelled safely — no withdrawal was made; `$50.00` intact in `C04`.)*

### 5.2 Why — source-verified (R12/R79-2)

```
PayoutSettingsScreen.tsx:343   setPrimaryMethodId(response.primary_method?.id || null);
PayoutSettingsScreen.tsx:681   if (!primaryMethodId) { setShowNoMethodModal(true); return; }
PayoutSettingsScreen.tsx:1292  unverifiedMethod={hasIncompleteOnboardingMethod}
PayoutSettingsScreen.tsx:572   findIncompleteOnboardingMethod() =
                                 stripe_connect && !!stripe_account_id && !stripe_onboarding_complete
```

`showNoMethodModal` is set `true` at **exactly one** site (`:682`) — the guard fires **only when the server reports no primary method**. The `unverifiedMethod` copy is passed only from that same modal (`:1292`).

Reaching the variant therefore needs **both**: (a) an incomplete `stripe_connect` carrying a `stripe_account_id`, **and** (b) `primary_method` absent from the server response. `single-unverified` writes `is_primary: true`, so (b) is false and the guard cannot fire. **None of the five shipped scenarios** (`none`, `single-verified`, `single-unverified`, `two`, `mixed`) produces that shape.

### 5.3 Verdict

**⏸ BLOCKED — fixture gap, not an app defect, not a test bug.** The unit tests pin the copy, but the *device* leg needs a state the fixture set cannot mint.

**Fixture ask (dev-side):** add a scenario such as **`single-unverified-nonprimary`** (one `stripe_connect`, `stripe_account_id` set, `stripe_onboarding_complete:false`, **`is_primary:false`**) — and, if the server still synthesises a primary, an **`unverified-no-primary`** variant. Worth pairing with a dev-side reachability check: if the product always promotes a seller's only method to primary, the `unverifiedMethod` branch is **dead code** (the **R79-2** class — a mocked-green unit test is not a reachable branch).

---

## 6. Item 7 — `no-method-cancel-btn` AX exposure ✅ PASS (fresh build)

State: `qa:payout-fixture -- methods --scenario none` (0 methods) → Payout Settings re-fetched (navigated away via the Home tab, then re-entered by deep link — R59/R92 staleness discipline) → **PAYOUT METHOD** rendered `+ Add Bank Account` → **Withdraw Now**.

Full AX tree (fresh bundle):

```
@e62 TextView "Payment Method Required"
@e63 TextView "To withdraw your earnings, you need to add and verify a payout method first."
@e64 Button  label="Add Payout Method"  id="no-method-add-btn"     at=128,1269 size=825x137
@e67 Button  label="Cancel"             id="no-method-cancel-btn"  at=479,1437 size=122x117
```

**Both buttons are genuinely present**, each carrying `accessible` + `accessibilityRole="button"` + a label, and the no-method branch keeps its original copy. Evidence: `C06-item7-no-method-modal-ax-exposed.png`.

**✅ PASS** — this closes FIX-Task-53 item 7 on the Android side and **confirms the Round-8 Android "missing from the AX tree" reading was the stale-Metro-bundle artifact** (R79-1a/R79-1b), exactly as the iOS re-check concluded.

### 6.1 ⚠️ New locator finding — `WithdrawModal` is NOT AX-exposed on this Android build

While on the same screen, the **`WithdrawModal`** (Confirm/Cancel) did **not** appear in the AX tree at all — only the underlying Payout Settings screen did (two consecutive listings), matching the iOS behaviour FIX-Task-52 recorded. This is a **per-build reversal** of FIX-Task-52's note that *"Android DOES expose them"* ⇒ §5.31's "drivability is build-dependent, re-check empirically per run" applies to it. Mitigation used: `qa:ocr --coords` to measure the buttons before tapping (R104/R107), which is how the correct `Cancel` was targeted.

**Note:** on the *same* build the sibling `NoMethodModal` **is** AX-exposed — so this is per-**component**, not per-platform.

---

## 7. Findings

| # | Sev | Class | Finding |
|---|---|---|---|
| F1 | **LOW** | layout/copy | Item 11's `Cancelled At (historical)` label **wraps to two lines** in the Cancellation row, ~doubling that row's height vs siblings. Readable and complete — cosmetic. Same class as FIX-Task-52's "string length is a layout input". |
| F2 | **LOW-MED** | tooling/fixture | **Item 5's `unverifiedMethod` variant is undrivable from the shipped fixture set** — `qa:payout-fixture` has no "incomplete `stripe_connect` without a primary" scenario. Add `single-unverified-nonprimary` / `unverified-no-primary`. Pair with a dev-side reachability check: the branch may be dead code (R79-2). |
| F3 | **LOW** | locator/AX | **`WithdrawModal` is not AX-exposed on this Android build** (its Confirm/Cancel are absent from the tree while `NoMethodModal` on the same build IS exposed). Locator-gap of the §5.31 build-dependent class — screenshots/OCR remain the fallback. |
| F4 | INFO | env/tooling | One dev-client death with the **R87/R107 JVMTI signature** — see §8. Not app code. |
| F5 | INFO | doc-drift | `test-expired` now renders a **real date** on SubscriptionExpired — *"Your Kids Club+ plan ended on **August 1, 2026**"* — whereas `qa-test-accounts.md` records that branch as param-starved (rendering "no longer active" copy). Looks fixed since; flagged, not re-verified in scope. |
| F6 | **LOW-MED** | design token | **Off-brand hex on the SP amount input** — `TradeOfferScreen.tsx:735` sets `placeholderTextColor="#D97706"` (Tailwind amber — on the R62d forbidden list) for the `sp-amount-input` placeholder `"0"`, while the **sibling `Coins` icon in the same `sp-input-wrapper` uses the canonical SP gold `#F59E0B`** (`:729`). The two-token mix sits side-by-side in one control. **Liveness: source-verified LIVE** (the guard at `:723` — `isSubscriber && canSpendSPNow && item.accepts_swap_points && maxSpToUse > 0` — is exactly the state driven in §2, and the AX tree confirmed `sp-amount-input` rendered). ⚠️ **On-device pixel/presence confirmation was NOT run** (§6.4/R62c/R62e) — treat as source-verified-pending-pixel, not an on-device-confirmed deviation. Suggested: `#F59E0B` (SP-500) or the tertiary-text token. |

### 7.1 Design-system sweep (R62b/R62d) — scope + result

The **R62d full forbidden-hex sweep** was run against the screen sources actually rendered this round
(`PayoutSettingsScreen.tsx`, `SubscriptionStatusScreen.tsx`, `TradeOfferScreen.tsx`) rather than the whole
`src/` tree: **one hit** — F6 above. No deviations were found on the visited screens' colours/typography/
spacing/component usage by direct observation of the rendered frames (Make Offer, disclaimer modal, Trade
Timeline, Subscription Status, Payout Settings, NoMethodModal, Discover, Home). **The whole-repo sweep was
not re-run** (Round 6 recorded ≈150 hits across ≈50 files with liveness triage incomplete) — so this is a
scoped, not a global, design pass: **do not read it as "the app is design-clean".**

**Deliberately NOT pursued (per the brief):** the grace-user fee discrepancy (member **$1.49** was shown to `test-grace` here too, consistent with FIX-Task-53 F1) — owner decision, tracked separately. `STRIPE_WEBHOOK_SECRET` / SUB-TC-L05's positive leg — no workaround attempted.

---

## 8. Environment incident — dev-client crash + recovery (documented, not an app defect)

Mid-round the dev client died. Crash report `2026-09-18_06:37:18.036_29715`:

```
signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x…5150
  #01  …/com.sameralzubaidi.p2pmarketplace/mobilecli/mobilecli.so
  #02  libart.so  art::ti::AgentSpec::DoLoadHelper(…)
  #03  libart.so  art::ti::AgentSpec::Attach(…)
  #04  libart.so  art::Runtime::AttachAgent(…)
  #05  libart.so  art::VMDebug_nativeAttachAgent(…)
```

This is the **documented mobile-mcp JVMTI debug-agent attach crash** (R87 / R107) — **tooling, not app code**. It followed an `mobile_list_elements_on_screen` issued while the **Trade Timeline was in a load/error state** ("Loading trade…" → "Failed to load trade"), i.e. an **R107 violation on my part** (R107: on any pending/slow-loading screen, poll with **screenshots only** — never AX-dump). No rules were invented to explain it.

**Recovery (worked, ~9 calls):** terminate → launch → Dev Launcher (the deep link cold-started the launcher because the process was already gone) → list the launcher → tap the `http://10.0.2.2:8081` DEVELOPMENT SERVERS row → poll (screenshots only) → app loaded as `test-buyer` with the persona switch already applied.

**Why this is NOT the Round-8-era wedge:** that incident was attributed to host/degraded environment (Round 6 measured load avg 29.05; the app wedged at "Bundling 100%"). Here the host was **healthy (1-min load 3.34)**, Metro was a single instance on :8081, and the **first** cold reload of the round loaded fine. The trigger was identifiable and is a **known rule** (R107), not a mystery. **Recommended next step if it recurs:** treat the AX dump as the cause, not the environment — screenshot-only polling on any loading screen; no further environment troubleshooting is warranted on the current evidence.

---

## 9. Friction vs. the operating rules

| # | Friction | Rule / note |
|---|---|---|
| 1 | AX dump on a loading/error screen killed the dev client | **R107** — my violation; screenshots-only on pending screens. Cost ≈ 9 recovery calls. |
| 2 | IME-dismiss shifted the layout (`send-offer-button` y1980 → y1854) | **R19/R78-7** — re-listing after the IME gate caught it; a tap at the old coordinate would have missed. |
| 3 | A blind AX tree while the error dialog was up | **R-NEW-1** — screenshot was rendered, tree was blind ⇒ used `qa:ocr --coords` for coordinates; established the app was alive. |
| 4 | `qa:stripe-inspect` refused the full secret key | **§5.37 rule 6 working as designed** — used the labelled break-glass path. Consider provisioning a real `rk_test_…` so future money rounds carry restricted-read-only evidence. |
| 5 | Dev Launcher lists a stale `http://10.0.2.2:8082` development server | Long-standing (R63a/R77 #16) — only :8081 is live; tapped the correct row. |
| 6 | Claiming the item-11 positive leg needed a persona with residual `cancelled_at` **and** a future period end | Located in one `qa:start-state` read (`test-buyer`) — the R63-step-3 helper paying off. |

---

## 10. App state left behind

| Item | State | Action |
|---|---|---|
| `test-grace` SP wallet | **avail 10** (`state='grace_period'`) — was 15 for this round; 20 banked, **10 now reserved by 2 open offers** (`0ba80809-…` + the new Android trade) | ⚠️ Still a live reservation — do **not** `qa:set-sp-balance --amount 0` while reserved |
| `test-grace` trade | **NEW `pending` offer** on listing `18a41ad8-9cfc-46d4-a6c0-54a2933fb5a9` ("QA Bundle Fixture 1 of 3"), 5 SP reserved, `pending` seller response (48 h window) | None required; expire or leave |
| `test-grace` Stripe | existing `cus_VHK8BgDjkHjQ9k` + PM reused (no new customer) | test mode only |
| `qa-payout-seller` method | **RESTORED** — verified PRIMARY `stripe_connect`, `acct_1UGzIcKsNs2cG8fW` (`submitted=true payouts=true charges=true due=[]`) | Done. ⚠️ The pre-round account `acct_1UGm4A3qQXHDi0B9` is **gone** — the method scenarios delete-replace and an exact-id restore is impossible; this is the **documented convention** (FIX-Task-44 item 4 / R8). |
| `qa-payout-seller` balance / payout | unchanged — **avail 5000¢**, payout `e1893558…` + transfer `tr_1UGeom4I6kCJlvXoMOti9yRj` untouched (it is in the **Stripe** account, not the replaced Connect account) | None |
| `test-buyer` | unchanged (no writes made as this persona) | None |
| `test-expired` | unchanged | None |
| App session | **logged out** (`qa-logout`) | clean |
| Config / toggles | **no** `admin_config` writes, **no** dev toggles armed | clean |

---

## 11. Known gaps / not tested

1. **Item 5's device leg** — undriven on **both** platforms; blocked on a fixture scenario, not on tooling (§5).
2. **`WithdrawModal` AX exposure** — reported as a per-build locator gap; not fixed (execution-only).
3. **SUB-TC-L05 positive leg** — still blocked on `STRIPE_WEBHOOK_SECRET` (owner paste); not attempted.
4. **The grace fee-policy discrepancy ($1.49 live vs $2.99 documented)** — deliberately not pursued (owner decision).

---

## 12. Tracker reconciliation (R52 / R56 / R57)

- Tracker `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` **edited in place** (hand-maintained — **not** regenerated).
- **Round 10 note** added to the SUB section; row appends on **SUB-TC-D01**, **SUB-TC-E04**, **SUB-TC-G11** (G11 also absorbed the item-5 fixture-gap note).
- **No status flips** ⇒ the §1 roll-up, the guide section header, and the never-run table header are **unchanged and still mutually consistent**: `100 cases · 79 PASS / 1 PARTIAL / 2 OPEN / 0 DRIFT / 0 SKIP / 15 RETIRED / 2 N/A · Remaining 0`. Verified the G11 row's cell separators after editing (no extra column introduced).
- ⚠️ The pre-existing residuals carried in earlier notes (row-level PARTIAL set vs the `PARTIAL 1` roll-up; the 99-vs-100 column sum) are **untouched** — still an owner reconciliation pass, not silently repaired here.

# QA Report — SUB Android Round 5: Groups A / B / C / D / F

**Run date:** 2026-09-16 (17:00–17:25 local)
**Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
**Platform:** Android emulator `Medium_Phone_API_36.1` (emulator-5554), 1080×2400, **tree coords == device px** (R77 #1)
**Evidence:** `evidence/` (27 screenshots)
**Personas used:** `qa-payout-seller`, `test-seller`, `test-free`, `test-buyer`

---

## 0 · Step 0 reconciliation (before any device time)

| Item | Result |
|---|---|
| Group B RETIRED status | ✅ **Confirmed already correct** — tracker SUB §RETIRED block lists all 13 `SUB-TC-B01…B13` rows as 🔁 RETIRED; guide §"Round scope & priorities" §1 lists them + D02/D04 as 🔴 RETIRED. Source evidence re-verified in Round 1 (`AppNavigator.tsx` DEPRECATED; 0 `navigate('SubscriptionPayment'\|'SubscriptionSuccess')` call sites). **N/A status carries over correctly — no action needed.** |
| SUB canonical totals | 100 cases · PASS 78 · PARTIAL 2 · OPEN 2 · RETIRED 15 · N/A 2 · Remaining 0 (tracker §SUB header, the authoritative line) |
| Android-coverage gap | Group A (5), Group C (12), Group D (D01/D03/D05), Group F (F04–F08) all held `—` in the `Android` column — i.e. **no platform-qualified Android verdict**. Only F01/F02/F03 + Groups G/H/I/J/K/L/M/N had Android verdicts. |
| `test-grace` fixture (FIX-Task-37 item 4) | ✅ **Repair persists** — `qa:start-state -- test-grace` → `subscription grace · grace_end 2026-11-09 · sp_wallet state grace_period` (the exact wallet state the repair was built to pin) |
| Persona preconditions | `test-buyer` active (period_end 2026-09-27, has_pm) · `test-free` free (has_pm) · `test-expired` expired + wallet frozen · `qa-payout-seller` $50.00 + verified primary Connect method · `test-seller` 19 payouts (18 `requires_action` + 1 `failed`) |

### Environment health (FIX-Task-46 mandatory pre-check) — **HEALTHY**

| Reference | Value | Degraded-session comparison (FIX-Task-46) |
|---|---|---|
| qemu CPU (`qemu-system-aarch64`) | **9.5% → 5.0%** | was **65%** |
| Host load average | **4.88 → 5.22** | was **8.5** |
| Device ICMP RTT (8.8.8.8) | **21.6 ms** avg (19.4/23.1) | was ~22 ms (fine) |
| Host → Supabase REST | **256 ms** (401 = healthy edge, R102) | was 146 ms |
| Host → google.com | **344 ms** | — |
| Metro Android bundle | **HTTP 200, 28.16 MB, 0.35 s** | — |
| **Independent app-path reference** | `qa:start-state -- test-free` (same persona's subscription+wallet+balance+method reads) completed in **0.80 s** wall | — |

**Verdict: the emulator's network/CPU was NOT degraded this round.** Every load-time observation below is therefore reported as an **app-side** measurement, not an environment artifact.

---

## 1 · Verdict roll-up

| TC-ID | Guide | Android verdict | Top finding |
|---|---|---|---|
| SUB-TC-A01 | SUB | ✅ **PASS** | Live "plans cards" surface = `UpgradePlanScreen`; guide's `SubscriptionPlansScreen` ref is **dead** (doc-drift) |
| SUB-TC-A02 | SUB | ✅ **PASS** | Comparison table complete + POPULAR badge + dynamic values; CTA row verified + back-nav |
| SUB-TC-A03 | SUB | ✅ **PASS** (price) / ⚠️ fee limb doc-drift | Price propagates from admin config; the guide's fee key is **not** the one the screen reads |
| SUB-TC-A04 | SUB | ✅ **PASS** | "Current Plan" chip + disabled CTA on KC+; Free card "Downgrade" disabled |
| SUB-TC-A05 | SUB | 🟡 **PARTIAL** | free ✅ + active ✅ driven; **grace leg not re-driven** |
| SUB-TC-C01 | SUB | ✅ **PASS** | Plan card + ACTIVE MEMBER + Renew Date DB-exact |
| SUB-TC-C03 | SUB | ❌ **FAIL** | **"Next Billing Date" shows a stale `trial_end_date`**; days-remaining row missing |
| SUB-TC-C04 | SUB | ✅ **PASS** | Retention screen copy exact; "Keep My Benefits" aborts, subscription unchanged |
| SUB-TC-C05 | SUB | ✅ **PASS** | Reason modal fully driven incl. Other + free-text + disabled→enabled Confirm + "Cancellation Confirmed" |
| SUB-TC-C06 | SUB | ❌ **FAIL** | **"Access Until" shows the same stale trial date**; Status "Cancelled" + Auto-Renew OFF ✅ |
| SUB-TC-C07 | SUB | ✅ **PASS** | Auto-renew toggle drove state + persisted (DB); update-flow sub-leg not driven |
| SUB-TC-C08 | SUB | ✅ **PASS** | Exact copy + CTA → JoinKidsClub |
| SUB-TC-C10 | SUB | ✅ **PASS** | Free card, no ACTIVE badge, Renew Date N/A, no Member Since, Upgrade CTA |
| SUB-TC-C12 | SUB | ✅ **PASS** (doc-drift) | Value is derived from `auth.users.created_at`, DB-exact; guide's "hardcoded May 2024" is stale |
| SUB-TC-D05 | SUB | ✅ **PASS** | Reactivation works + **no new charge**; but the guide's "[Reactivate Membership]" button does not exist |
| SUB-TC-F04 | SUB | ✅ **PASS** | Hero 3/3 DB-exact + per-row net DB-exact + failed-payout reason line |
| SUB-TC-F05 | SUB | ✅ **PASS** | "No payouts yet" on the clean `qa-payout-seller` state |
| SUB-TC-F07 | SUB | ✅ **PASS** | Error copy exact (`GlobalAlertProvider`, AX-exposed) + recovery |
| SUB-TC-F08 | SUB | ❌ **FAIL** | **"Load More" never disappears** (unconditional render) |

**Roll-up: 15 PASS · 1 PARTIAL · 3 FAIL · 6 not driven (BLOCKED).**

**Not driven (environment/dev-client failure, §5 below):** `C02`, `C09`, `C11`, `D01` (screen), `D03`, `F06`.

---

## 2 · Findings

### 2.1 HIGH — wrong billing date on Manage Kids Club+ (C03 **and** C06)

**Root cause (source-confirmed, `ManageKidsClubScreen.tsx:353`):**

```js
const periodEndDate = subscription.subscription_expires_at || subscription.trial_ends_at;
const daysLeft = daysRemaining(periodEndDate);
```

The screen **omits `next_billing_date`** from the chain. When `subscription_expires_at` is unpopulated (it is, on staging) the expression falls back to **`trial_ends_at`**.

**DB evidence (test-buyer, `subscriptions`):**
| Field | Value |
|---|---|
| `trial_end_date` | **2026-07-27T12:41:17Z** ← what the screen renders |
| `next_billing_date` | 2026-09-27T12:41:17Z |
| `current_period_end` | 2026-09-27T12:41:17Z |
| `status` (at time) | `active` |

**Device evidence:**
- Active branch → label "Next Billing Date" → **"July 27, 2026"** (`evidence/C03-FAIL-manage-next-billing-shows-stale-trial-date.png`)
- Cancelled branch → label "Access Until" → **"July 27, 2026"** (`evidence/C06-FAIL-cancelled-state-access-until-wrong-date.png`)
- **No "days remaining" row renders** — `daysLeft = daysRemaining("2026-07-27")` is ≤ 0, so the `daysLeft > 0` guard is false.

**Intra-app contradiction:** the *same subscription* renders **"Sep 27, 2026"** on My Subscription (`MySubscriptionScreen` uses the fuller chain `next_billing_date || subscription_expires_at || trial_ends_at`) — so two screens in one app disagree about the next charge date.

**Impact:** any member who has ever trialled (`has_used_trial: true`) sees a **stale, past** date presented as their next billing date — here **~7 weeks in the past**. Money-adjacent misinformation.

**Recommended fix:** `subscription.next_billing_date || subscription.subscription_expires_at || subscription.trial_ends_at` (mirror `MySubscriptionScreen`), and drive `daysLeft` from the same value.

### 2.2 MED — `Load More` is rendered unconditionally on Payout Settings (F08 FAIL)

`PayoutSettingsScreen.tsx` L999–1011 renders `<TouchableOpacity testID="load-more-button">` whenever `recentPayouts.length > 0` — there is **no `hasMore` guard**. `handleLoadMore` only raises `payoutLimit` by 5.

**Device proof (test-seller, 19 payouts = 18 `requires_action` + 1 `failed`):**
- pages loaded **5 → 10 → 15 → 19** (each exact vs the DB, ordered by `created_at DESC`)
- with **all 19 loaded** the button **still renders** (`evidence/F08-c-loadmore-still-present-after-all-19-loaded.png`)
- a **4th tap changed nothing** (no 20th row) and the button remained

**Doc-drift:** the guide's H03 note says the payout shows as **PENDING** in PAYOUT HISTORY; the live row lands **`completed`** (Round 4, unchanged).

### 2.3 MED — A03: the guide's fee key is not the key the surface reads

- ✅ **Price limb PASSES**: wrote `subscription_price_monthly` 599 → 699 → Upgrade Plan + Compare Plans both rendered **"$6.99" / "$6.99/mo"** on a fresh process; reverted → **"$5.99"** again (revert verified in-app *and* by DB read-back).
- ⚠️ **Fee limb**: wrote `transaction_fee_subscriber_cents` 149 → 249; the Comparison table **still rendered "$1.49 flat"**.

**Writer named (R100):** `PlanComparisonScreen` calls `getActiveMemberFeeCents(true)`, which reads **`buyer_fee_active_member_cents`** (live = `149`) and, when that key is absent/non-finite, returns a **hardcoded `149`** (`adminConfig.ts:504-515`).

**Config-key duplication (informational, for the owner):** four competing fee keys exist —
| key | value | category |
|---|---|---|
| `buyer_fee_active_member_cents` | **149** | fees ← **the one rendered** |
| `buyer_fee_first_trade_cents` | 149 | fees |
| `transaction_fee_subscriber_cents` | 149 | feature_flags ← the guide's key |
| `transaction_fee_member_cents` | 99 | fees |

Also note the guide's A03 fail-safe expectation ("show a loading spinner / $0.00 placeholder and log an error") does **not** hold for the fee: the fallback is a **hardcoded `$1.49`**, i.e. it silently shows a plausible-but-possibly-wrong fee.

### 2.4 LOW/MED — `#4CAF50` on a live surface (BP-82)

Standing R62b/R62d sweep with the **full** forbidden list (3 legacy hexes + the iOS-system-blue family + `#4CAF50`): **50 hits / 19 files**.

Liveness triage:
- **LIVE DEVIATION — `src/components/NotificationSetup.tsx` lines 135, 173, 181**: `#4CAF50` used as a real colour (ActivityIndicator + Button `color`). BP-82 forbids it; canonical Success = **`#5DBB8E`**.
- **Comments only, not deviations:** `components/subscription/AutoRenewToggle.tsx:87` and `screens/subscription/ContinueKidsClubScreen.tsx:31` (both reference removed hexes).
- Known-dead from prior rounds: `LoginScreen(.old).tsx`, `SignupScreen(.old).tsx`, `atoms/Button`, `SellerEarningsScreen`.
- Token-level (already recorded, FIX-Task-37 item 6): `src/theme/colors.ts` `success.500 = '#4CAF50'`.
- Remaining ~40 hits across 14 files were **not** liveness-triaged this round (named as a gap).

**On-device design check:** every screen rendered this round is on-brand — the primary CTA pill `#5DBB8E`, `#FFF3E0`/`#FFA726` warning, `#E85D75` destructive ("Action Required"), white modal surfaces, 17px/700 centred header titles with the canonical 40×40 grey `#F4F4F4` back button (`back-button`, caret-left, icon-only). No raw support-email surfaces were observed.

### 2.5 Raw internal string on a user-facing surface (§6.3 MANDATORY check)

The failed-payout row renders, verbatim:

> ⚠️ **`qa cleanup: FIX-Task-7 P1 auto-complete artifact (dispute should have paused auto-complete)`**

i.e. a QA/cleanup script's internal note — including an **internal task id** and internal jargon — is displayed to a seller as the payout failure reason (`history-status-<id>` = "Failed"). The value comes straight from `seller_payouts.failure_reason`.
**Recommended:** either sanitise fixture/cleanup writes, or map non-user-facing reasons to friendly copy before display.

### 2.6 Doc-drift summary (guide vs live Android build)

| Case | Guide says | Live |
|---|---|---|
| A01 | `Ref: SubscriptionPlansScreen`; header "Plans"/"Choose Your Plan"; CTA **[Start {N}-day Trial]**; "{N}-day free trial" label | No such file/route — `SubscriptionPlans` renders `JoinKidsClubScreen`; the plans-cards surface is **`UpgradePlanScreen`** ("Upgrade Plan"/"Manage Your Plan"); CTA **"Join Kids Club+"**; no trial label (`trial_enabled=false`) |
| A02 | trial row "{N} days" | **"No"** (same `trial_enabled=false`) |
| A03 | key `transaction_fee_subscriber_cents` | surface reads `buyer_fee_active_member_cents` |
| C03 | helper text "You'll continue to have access until the end of your current billing period." | live copy: "You will keep your benefits until the end of your billing period." (guide's own ⚠️ flag) |
| C06 | "a 'can reactivate' message" | live: "Your subscription is cancelled / You will continue to have Kids Club+ benefits until your billing period ends. After that, your Swap Points will be frozen for a 30-day grace period." |
| C12 | renders literal **`May 2024`** (latent bug) | derived from `auth.users.created_at` → **"Jan 31, 2026"**, DB-exact |
| D05 | tap **[Reactivate Membership]** | **no such control** — reactivation is done by **re-enabling Auto-Renew** (copy: "…unless you re-enable it") |
| F08 | "Load More disappears when no more payouts remain" | never disappears |

---

## 3 · Perceived load-time table (§5.7)

Every value is wall-clock from tap/intent-issue → key element rendered, ±poll. **Environment health verified above**, so these are app-side.

| Screen / transition | Elapsed | Flag |
|---|---|---|
| Payout Settings (warm deep-link) | ~2 s | ok |
| Payout Settings Load More (+5 rows) | <1 s | ok |
| Payout Settings pull-to-refresh (reset to 5) | ~2 s | ok |
| Upgrade Plan — **first mount after `qa-login-as`** | **~50 s** | ⚠️ **≥3 s** |
| Compare Plans — first mount after config write | **~45 s** | ⚠️ **≥3 s** |
| My Subscription — first mount after switch | **~20 s** | ⚠️ **≥3 s** |
| Manage Kids Club+ — first mount after switch | **~40 s** | ⚠️ **≥3 s** |
| Manage Kids Club+ (cancelled state, warm) | ~12 s | ⚠️ **≥3 s** |
| Cancel-reason modal open | <1 s | ok |
| Cancellation Confirmed alert | <1 s | ok |
| Retention screen open | ~3 s | borderline |
| Auto-renew toggle → Success alert | ~2 s | ok |

**Instrumented evidence for the slow path** (Manage Kids Club+, R101/R102-ordered — read the client's own log first):

```
[NAV] route: ManageKidsClub          17:05:38.400
[subscription] 📤 Fetching payment method...   17:05:54.531   (+16.1 s after the route was pushed)
[subscription] ✅ Payment method retrieved     17:06:02.105   (that fetch alone: 7.6 s)
resolved ("You don't have an active Kids Club+ subscription.") ~17:06:1x
```

⇒ **40 s to first paint**, of which **16 s elapsed before the fetch even started**. The independent host-side read of the same persona's data took **0.80 s**, and qemu was at 5–9.5% CPU — so **not** the FIX-Task-46 network/CPU starvation. Reported as an **app-side load-time finding (MED)**, not as a network artifact.

---

## 4 · Evidence index

| File | Contents |
|---|---|
| `F05-a-payout-settings-empty-history-android.png` | qa-payout-seller empty PAYOUT HISTORY |
| `F04-a-payout-settings-testseller-preaction.png` | test-seller hero + 18-summary |
| `F04-b-...-19-rows-failed-reason-android.png` | all 19 rows incl. the failed row + raw reason string |
| `F08-a/b/c…` | Load More tap 1, post-tap list, and the still-present button with 19/19 loaded |
| `F07-a…e` | armed toggle, error leg, recovery leg |
| `A01/A02/A03/A04-*` | Upgrade Plan (free + subscriber), Compare Plans baseline + post-config-change |
| `C01/C04/C05/C06/C08/C10/C12-*` | My Subscription active/free, retention screen, reason modal, cancelled state |
| `cold-start-blank-state.png`, `final-state-devclient-not-rendering.png` | the dev-client failure (§5) |

---

## 5 · Environment blocker (truncated the round) — dev-client failure + tooling crash

Two independent failures cost the remainder of the round:

**(a) mobile-mcp JVMTI agent-attach SIGSEGV (R87/R107 class — tooling, NOT app code).** At 17:15:55 the app process died with `Fatal signal 11 (SIGSEGV)`. The tombstone's **top frames**:

```
#00 pc 0x5150                    <unknown>
#01 pc 0x4a20  /data/data/com.sameralzubaidi.p2pmarketplace/mobilecli/mobilecli.so
#02 art::ti::AgentSpec::DoLoadHelper
#03 art::ti::AgentSpec::Attach
#04 art::Runtime::AttachAgent
#05 art::VMDebug_nativeAgentAttach
#06..#08 dalvik.system.VMDebug.attachAgent / ActivityThread.attemptAttachAgent
```

This is the documented R87/R107 signature. **New context:** R107 records the trigger as an AX dump while a *deliberately-stalled* screen (an armed failure-injection toggle) was pending. Here **no toggle was armed** — the trigger was **repeated AX dumps while an ordinary slow-loading screen was pending** (Manage Kids Club+, ~40 s). Recommend extending R107's condition from "deliberately stalled" to **"any pending/slow screen"**.

**(b) The dev client then stopped loading the bundle.** Post-crash recovery (`terminate → launch → tap Metro row`) left a **blank root view** indefinitely, with:

```
E unknown:ReactHost: ReactNoCrashSoftException: raiseSoftException(onWindowFocusChange(hasFocus =
"true")): Tried to access onWindowFocusChange while context is not ready
```

Controls that rule out the obvious causes: Metro healthy (28.16 MB bundle in 0.35 s), qemu 5% CPU, host load 5.2, device ICMP 21.6 ms. A subsequent `adb shell am start` deep link recovered the client, after which it rendered normally.

**⚠️ Costly false conclusion (agent-rule lesson):** the AX tree returned **status-bar-only / empty-root** dumps for ~10 minutes across many polls while the app was in fact **either** not-yet-rendered **or** (later) **fully rendered** — a screenshot (`final-state-devclient-not-rendering.png`) showed the Dashboard painted while the tree still reported only `action_bar_root` + `android:id/content`. I concluded "dev client dead" from the empty tree and burned ~25 calls before a screenshot disproved it. **Falsifiable rule proposal:** *a repeating blank/status-bar-only AX tree is NOT evidence the app is blank — confirm with ONE screenshot before concluding a dev-client failure.* (Sharpens R-NEW-1 / §5.9.)

There was also a transient `uiautomator dump: no XML content found` error (R77 #3 — transient, not a hang).

---

## 6 · App state left behind

| Persona | State | Notes |
|---|---|---|
| `test-buyer` | **restored to `active`** ✅ | `cancel_at_period_end=false`, `auto_renew_enabled=true`, `current_period_end=2026-09-27` (**no new charge**) |
| ⚠️ `test-buyer` **audit residue** | `cancel_reason='too_expensive'`, `cancelled_at=2026-09-16T21:20:41Z` | left on the now-active row by the C05→D05 cancel/reactivate chain; visible only in the DB, not in the UI. **Named for cleanup/awareness.** |
| `test-free` | unchanged (free) | logged in last |
| `test-seller` / `qa-payout-seller` | unchanged | 0 writes; `qa-payout-seller` still $50.00 + verified method + 0 payouts |
| `admin_config` | **reverted + verified** | `subscription_price_monthly` 699→**599**; `transaction_fee_subscriber_cents` 249→**149** (DB read-back each) |
| QA toggles | **disarmed + verified** | `payout_fetch_failure=none` (handler read-back `none`) |
| App | left on My Subscription as `test-buyer`; emulator warm | — |

---

## 7 · Known gaps / not tested

1. **`C02`** (quick-menu routing: Billing History / Payment Method / Get Help) — rows observed present; the three taps were not driven.
2. **`C09`** (Manage expired state) and **`D03`** (Subscription Expired screen) — `test-expired` precondition verified (`expired`, wallet `frozen`) but the screens were not driven.
3. **`D01`** screen — the **fixture cross-check the brief asked for was done** (`test-grace` wallet = `grace_period` ✅) but the grace banner itself was not re-rendered this round.
4. **`A05` grace leg** — free + active legs driven; grace leg not.
5. **`C11`** — `benefits-learn-more-button` present; the Help/`sp_definition` navigation not driven.
6. **`F06`** — not driven (needs an admin `pending_sp_release_days` write + a trade producing pending earnings; `qa:payout-fixture stage-trade`).
7. **`C07` update-flow sub-leg** — `update-payment-method-btn` present; not tapped.
8. **Design sweep** — ~40 of 50 off-brand-hex hits not liveness-triaged.
9. **Provider layer (Stripe)** — **not read this round**. No case drove a new charge/refund/transfer, so there was no new provider object to inspect. `STRIPE_QA_READONLY_KEY` **is still an `sk_test_…` secret (F3 unresolved)** ⇒ any provider read still requires `--break-glass-secret-key` and must be labelled `key_scope=SECRET_KEY_BREAK_GLASS`.
10. Emulator left warm but the dev client required a deep-link nudge to recover — a `adb reboot` may be needed before the next round.

---

## 8 · Does this bring SUB to full Android coverage? — **NO. One more round is required.**

**Delivered:** 19 Android verdicts (15 PASS · 1 PARTIAL · 3 FAIL) — the first ever for Groups A, C, D and F04–F08.

**Still without an Android verdict after this round (named):**

| Group | Cases |
|---|---|
| SUB | `C02`, `C09`, `C11`, `D01`, `D03`, `F06` (blocked this round), plus `A05` grace leg |
| SUB (other groups, pre-existing) | `E01`–`E04` · `G01`, `G06`, `G07`, `G10` · `H01`, `H04`, `H06`, `H07` |
| SUB | `D06`, `D07` (fixture/clock-gated, 🔴 OPEN by design) |

So Groups A/C/D/F are **substantially but not fully** Android-covered, and roughly a dozen further SUB cases across E/G/H remain `—`. **Recommend one focused follow-up round** (C02/C09/C11/D01/D03/F06 + the E/G/H set) after the dev client is restarted.

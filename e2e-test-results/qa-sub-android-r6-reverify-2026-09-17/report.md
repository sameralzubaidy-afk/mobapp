# QA Round — SUB Android Round 6: Re-Verify the R5 FAILs + Close the Remainder

**Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
**Platform:** Android emulator (AVD `Medium_Phone_API_36.1` = `emulator-5554`), 1080×2400 (AX tree coords == device px)
**Date:** 2026-09-17
**Mode:** QA Test Agent — execution only (no source/test/seed/config edits; read-only DB + sanctioned QA helpers)
**iOS:** **not driven** (R80 — no iOS verdict claimed or changed)

---

## 1 · Verdict roll-up

**14 Android verdicts: 12 PASS · 1 PARTIAL · 0 FAIL · 0 BLOCKED**

| TC-ID | Case | Verdict | Top finding |
|---|---|---|---|
| SUB-TC-C03 | Manage Kids Club+ — status / next billing / days remaining | ✅ **PASS (flip from R5 FAIL)** | FIX-Task-47 item 1 confirmed on-device; the two screens now agree |
| SUB-TC-C06 | Cancelled stays active until period end | ✅ **PASS (flip from R5 FAIL)** | Same fix, cancelled branch: "Access Until: September 27, 2026" + Days Remaining |
| SUB-TC-F08 | Payout history Load More pagination | ✅ **PASS (flip from R5 FAIL)** | `load-more-button` gone at 19/19; "That's all your payouts" renders |
| SUB-TC-A05 | Kids Club+ overview by subscription status | ✅ **PASS (flip from R5 PARTIAL)** | Grace leg driven; SP notice wording deviation filed |
| SUB-TC-C02 | My Subscription quick menu | ✅ PASS | All 3 rows driven; guide's "support email" is doc-drift |
| SUB-TC-C07 | Auto-renew toggle / update payment method | ✅ PASS | Update-PM sub-leg driven (Stripe setup sheet); toggle re-driven |
| SUB-TC-C09 | Manage Kids Club+ expired state | ✅ PASS | First Android verdict |
| SUB-TC-C11 | My Subscription "Learn More" | ✅ PASS | First Android verdict; lands on `sp_definition` |
| SUB-TC-D01 | Grace banner + SP notice | ✅ PASS (structure) | **MED copy deviation** — banner says SP "frozen"; SP Wallet says spendable |
| SUB-TC-D03 | Subscription Expired screen | ✅ PASS | **MED occlusion** — "Continue with Free Plan" sits under the Sell pill |
| SUB-TC-D05 | Reactivate from cancelled | ✅ PASS | Re-confirmed on the C06 chain |
| SUB-TC-F04/F05 (re-observed) | Payout hero + failed-row copy | ✅ PASS | Raw QA string from R5 is now the generic sentence |
| SUB-TC-F06 | Pending earnings follow release timing | 🟡 **PARTIAL (downgrade from PASS)** | Release transition legs not drivable; reasons named |
| FIX-Task-47 item 13 | Cancel-reason modal height | ✅ VERIFIED | All 6 reasons visible; 6th was previously clipped |
| FIX-Task-47 NotificationSetup hex | Brand green on-device | ✅ VERIFIED | 94.07 % `#5DBB8E` / 0.00 % `#4CAF50` |
| FIX-Task-47 item 12 | Slow-load hint | ⚠️ **NOT VERIFIED** | Duration-gated; needs a temporary source edit (outside the execution-only boundary) |

---

## 2 · Step 0 — reconciliation before device time

### 2.1 R29 busy check
- `adb devices -l` → **one** device, `emulator-5554`, state `device` (not `offline`).
- Metro: **exactly one** `expo start` instance (pid 62584) — but on **:8082**, not :8081 (R63a note below). Nothing listening on :8081.
- No `run-suite.sh` / Maestro orchestrator process; no `e2e-test-results/<run>` being written by another agent.
- Mobile-mcp device id resolved from `emulator -list-avds` → **`Medium_Phone_API_36.1`** (R77 #17).

### 2.2 Environment health (FIX-Task-46 mandatory pre-check) — **DEGRADED**
| Probe | Value | R5 comparison |
|---|---|---|
| Host load average | **29.05 / 27.32 / 17.89** | R5: 4.9–5.2 |
| CPU | 49.5 % user / 35.5 % sys / 15 % idle | — |
| Memory | 15 G used, 79 M unused, 4.6 G compressor | — |
| Metro on :8082 | `packager-status:running` | — |

⇒ **Any slow-load number this round must be read against a host that is ~6× more loaded than Round 5's.** Load-time claims are labelled accordingly; the app-side fixes were judged on *correctness of rendered values*, which is load-independent.

### 2.3 Read-only fixture / persona precondition verification (§4 / R78-2)

| Persona | `subscriptions.status` | `next_billing_date` | `current_period_end` | wallet | Verdict |
|---|---|---|---|---|---|
| `test-buyer` | active | **2026-09-27** | 2026-09-27 | active, 458 SP | the stale-`trial_end_date` trap lives here (`trial_end_date` = 2026-07-27) |
| `test-free` | free | — | — | active | free legs |
| `test-grace` | **grace** | — | — | **grace_period**, `grace_ends_at` 2026-11-09 | D01 / A05 grace |
| `test-expired` | expired | — | 2026-08-01 | **frozen** | C09 / D03 |
| `test-seller` | active | **NULL** | 2026-10-11 | active, 2263 SP, pending 509 | F06 / F08; 19 `seller_payouts` rows (18 requires_action + 1 failed) |

Other pre-reads: `pending_sp_release_days` = `3`; `grace_period_days` = `30`; `buyer_fee_active_member_cents` = 149; `subscription_price_monthly` = 599.
⚠️ **Schema surprise (1 retry, R7):** `subscriptions` has **no `subscription_expires_at`** column (42703) — which is precisely the app bug's mechanism; the live column set is `next_billing_date` / `current_period_end` / `trial_end_date` / `grace_started_at` / `grace_ends_at`.

### 2.4 Session-start friction (recorded, not defects)
1. **The dev client needed a cold restart.** The first frames showed a frozen `Bundling 81.0%…` that never advanced; a terminate + relaunch + tapping the `http://10.0.2.2:8082` Metro row cleared it. Screenshot evidence also proved the **screenshot tool can return a stale cached frame** — the "stuck 81 %" was in fact progressing once re-polled (see §6 friction #2).
2. **The DevLauncher's bridgeless dev-support manager still targets `ws://10.0.2.2:8081`** (`Couldn't connect … will silently retry`) while the only live Metro is on **:8082**. The app loaded anyway, but this is the R63a single-instance hazard in a new form — the safest fix is one Metro on :8081.
3. **`qa:ocr` was not used this round** (R5 recorded it failing on an unaccepted Xcode licence); tap coordinates came from the **AX tree**, with `qa:badge-scan` used for the one colour assertion.

---

## 3 · Case-by-case results (with evidence)

### 3.1 SUB-TC-C03 — Manage Kids Club+ billing date ✅ **PASS (R5 FAIL → PASS)**

**Drive:** `qa-login-as?persona=test-buyer` → `manage-kids-club` deep link.

**On-device (AX tree):**
```
Status              = "Active"
Next Billing Date   = "September 27, 2026"        ← R5 rendered "July 27, 2026"
Days Remaining      = "11 days"                    ← R5: row did NOT render
manage-kids-club-billing-helper
                    = "Your plan renews monthly on the date shown above."   (FIX-Task-47 item 10)
```
**Cross-screen check (the assertion that exposed the bug) ✅** — My Subscription, same user/session:
```
Renew Date    = "Sep 27, 2026"          (`renewal-date`)
Member Since  = "Jan 31, 2026"
```
⇒ **The app no longer contradicts itself.**

**Second-persona confirmation ✅** — `test-seller` (`next_billing_date` **NULL**, `trial_end_date` 2026-10-06, `current_period_end` 2026-10-11) renders **"Next Billing Date: October 11, 2026"** — i.e. the new chain returns the real period end, **not** the stale trial date. This is a stronger test than `test-buyer`'s, because the primary key is absent.

**DB read-back:** `next_billing_date` = `current_period_end` = `2026-09-27 12:41:17+00` — matches the rendered date exactly.

**Load time:** first mount after a cold app start ≈ **13 s** (stopwatch 06:46:53 → 06:47:06, includes one screenshot round-trip) — flagged ≥3 s, attributed to the **load-29 host**.

**Evidence:** `screenshots/C03-a-manage-kids-club-active-billing-date.png`, `C03-b-manage-active-after-reactivation.png`, `C03-c-my-subscription-renew-date-sep27.png`.

**Assertions:** status ✅ · next billing date ✅ · days remaining ✅ · cancel entry point ✅ · billing-history link ✅ · auto-renew toggle ✅ · payment-method section ✅.

---

### 3.2 SUB-TC-C06 — Cancelled stays active until period end ✅ **PASS (R5 FAIL → PASS)**

Driven on a **real cancel** (see C05/C07 below), then a remount:

```
Status           = "Cancelled"
Access Until     = "September 27, 2026"        ← R5 rendered "July 27, 2026"
Days Remaining   = "11 days"
helper           = "Your plan will not renew — you keep access until the date shown above."
info box         = "Your subscription is cancelled / You will continue to have Kids Club+
                    benefits until your billing period ends. After that, your Swap Points
                    will be frozen for a 30-day grace period."
Auto-Renew       = Switch element with NO `checked` attribute  → renders OFF ✅
auto-renew note  = "⚠️ Auto-renew is disabled. Your subscription will end after this
                    period unless you re-enable it."
```
- `grace_period_days` = **30** in `admin_config` ⇒ the "30-day grace period" copy is **config-consistent** (not a hardcode).
- **SP spendable during the period:** wallet `state = active`; Home shows **458 SP** with "Earn More →".
- **DB read-back:** `status='canceled'`, `cancel_reason='too_expensive'`, `cancelled_at=2026-09-17T10:48:03Z`, `current_period_end` unchanged.

⚠️ **Observation (driving rule, not a defect — R59/R96):** immediately after re-enabling Auto-Renew the Manage screen **kept the stale cancelled copy** ("Cancelled / Your plan will not renew") beside the now-ON switch and the "will automatically renew" label — i.e. the screen contradicted itself until it was remounted (deep link → re-focus does not reset; leaving and re-entering fixed it). Recorded as a **LOW-MED UX observation**; the DB was correct throughout.

**Evidence:** `C06-a-cancelled-state-access-until-sep27.png`, `C06-b-autorenew-off-disclosure.png`, `C05-b-cancellation-confirmed-alert.png`.

---

### 3.3 SUB-TC-F08 — Load More pagination ✅ **PASS (R5 FAIL → PASS)**

- **Increments:** page-size witness `payout-action-required-hint` advanced **"5 of them are in the list below…" → "10 of them are in the list below…"** across Load More taps; the list kept growing (5 → 10 → 15 → 19).
- **End-of-list (the R5 failure):** after the final page **`load-more-button` is ABSENT from the AX tree** and **`payout-history-end` / "That's all your payouts"** renders in its place.
- **Row-set reconciliation:** the DB holds **19** `seller_payouts` rows for `test-seller` (18 `requires_action` + 1 `failed`) = the loaded set.
- **Bonus — the R5 §6.3 raw-string leak is FIXED:** the failed row now renders the generic *"⚠️ We couldn't complete this payout. Please check your payout method and try again."* instead of `qa cleanup: FIX-Task-7 P1 auto-complete artifact (…)`.
- **Hero ↔ DB (R54):** Available **$909.40** / Pending **$1177.60** / Lifetime **$2087.00** = `seller_balance` **90940 / 117760 / 208700¢ → 3/3 exact**.
- **Tap-placement note (R31 class, re-confirmed):** the button's centre sits close to the elevated Sell pill; the taps were placed at **x=250** (inside the 975-wide button, outside the pill's 467–614 band) and landed first-try every time.

**Evidence:** `F08-a-payout-settings-page-1-of-5.png`, `F08-b-failed-row-generic-copy-fixed.png`, `F08-c-end-of-list-thats-all-your-payouts.png`.

---

### 3.4 SUB-TC-A05 — per-status overview ✅ **PASS (R5 PARTIAL → PASS)**

`test-grace` → Manage Kids Club+ renders the **"Grace Period"** badge + a SP notice + **[Re-subscribe to Kids Club+]** — the three elements the case asserts, so the grace leg is now **driven**.
❌ **The SP notice's wording is wrong** and is filed as a MED copy deviation (see D01 below). The element renders ⇒ the case passes on structure; the copy is tracked as a defect rather than as a case failure.

---

### 3.5 SUB-TC-C02 — My Subscription quick menu ✅ **PASS** (first Android verdict)

| Row | Destination | Result |
|---|---|---|
| `billing-button` | **Transaction History** | 4 rows: $5.99 Sep 3 **FAILED** (with decline copy), $5.99 Aug 27 SUCCEEDED, $5.99 Jul 27 SUCCEEDED, $0.00 Jun 30 SUCCEEDED |
| `payment-button` | **Manage Kids Club+** | opens, dates correct |
| `support-button` | **Contact Support** | form: subject + message + Send Message; "Have a question or issue? Send us a message and we'll get back to you within 24 hours." |

**DOC-DRIFT:** the guide's Get-Help expectation ("an alert with the **support email**") is stale — the live surface is the in-app Contact Support form, which is the §6.4 canonical (no raw support email permitted).

⚠️ **Near-miss recorded (NOT filed):** a tap intended for `support-button` landed on the **Payouts** tile because the preceding BACK had already returned to **Home** (verified from the tree: `action-tile-payouts` spans x804–1014 / y766–1096, which contains the tapped point). A "Get Help routes to Payout Settings" finding would have been false — caught by re-deriving from the fresh tree before writing anything up.

**Evidence:** `C02-a-billing-history-transaction-history.png`, `C02-b-unexpected-payout-settings-after-gethelp-tap.png`, `C02-c-get-help-contact-support-form.png`.

---

### 3.6 SUB-TC-C07 — auto-renew toggle + update payment method ✅ **PASS** (Round-5 gap closed)

- **Update-PM sub-leg ✅ driven:** `update-payment-method-btn` → native **Stripe PaymentSheet (setup mode)** — "Pay with Link" / "Or use a card" / Saved Mastercard •••• 4444 / New card / **Set up**; closed cleanly (X) with no state change. Load to sheet ≈ 10–15 s (polled, host-degraded).
- **Toggle leg ✅ re-driven:** cancelled → switch ON → **"Success / Auto-renew enabled. Your subscription will continue automatically."** → DB `auto_renew_enabled=true`, **`status` `canceled`→`active`**, `current_period_end` **unchanged ⇒ no new charge** ⇒ this also re-verifies **SUB-TC-D05**.

**Evidence:** `C07-a-update-payment-method-stripe-sheet.png`, `C07-b-autorenew-enabled-success-alert.png`.

---

### 3.7 SUB-TC-C09 — Manage expired state ✅ **PASS** (first Android verdict)

`test-expired` (DB `status='expired'`, wallet `frozen` — verified pre-drive):
- Badge **"Expired"**
- Info box **"Your subscription has expired"** / **"Re-subscribe to restore Kids Club+ access and unfreeze any remaining Swap Points."** — both strings verbatim vs the guide
- **[Re-subscribe to Kids Club+]** CTA + View Billing History

**Evidence:** `C09-a-manage-expired-state.png`.

---

### 3.8 SUB-TC-D03 — Subscription Expired screen ✅ **PASS** (first Android verdict) + **MED occlusion finding**

`test-expired` login gates directly to the screen:
```
title   = "Subscription Expired"
message = "Your Kids Club+ plan ended on" + "August 1, 2026"   (DB current_period_end exact)
"What you're missing out on:"
  ✓ Trade with PIPs   — "Use your points to buy items and save cash."
  ✓ Reduced Fees      — "Save significantly on every transaction fee."
  ✓ Keep Your Points  — "Your earned PIPs never expire. They are waiting for you!"
renew-button        = "Renew Plan"
continue-free-link  = "Continue with Free Plan"
```
- ✅ **[Renew Plan]** → the **web-first Kids Club+ join surface** ("Membership is managed on the web" + **Join on the web**). **DOC-DRIFT:** the guide's "payment screen with isRenewal = true" is stale (Group B retired 2026-09-02).

❌ **NEW FINDING F3 (MED — layout/occlusion, functional mis-hit).** At maximum scroll, `continue-free-link` occupies **y2200–2296**, overlapping the persistent tab bar (y2190–2295); its centre (540, 2248) falls inside the **Sell pill** (`tab-sell`, x467–614 / y2169–2287). **Driving it opened the Sell sheet** ("List One Item / Bulk Upload / Cancel") instead of continuing on the free plan — confirmed by tree + screenshot. `renew-button` is also partly under the band at the default scroll position, though it clears after a swipe.
**Recommendation (dev):** hide the persistent tab bar on this full-screen gate, or add bottom padding ≥ the tab-bar + gesture height.

**Evidence:** `D03-a-subscription-expired-screen.png`, `D03-b-expired-max-scroll-continue-free-under-tabbar.png`, `D03-c-renew-plan-opens-join-kids-club-web.png`, `FINDING-D03-continue-free-tap-opened-sell-sheet.png`.

---

### 3.9 SUB-TC-D01 — grace banner + SP notice ✅ **PASS (structure)** with **MED copy deviation**

`test-grace` → Manage Kids Club+:
```
badge    = "Grace Period"
notice   = "Grace Period Active / Your Swap Points are frozen. Re-subscribe before
            November 9, 2026 to restore access, or they will be permanently deleted."
CTA      = "Re-subscribe to Kids Club+"
```
The date is **DB-exact** (`grace_ends_at` = 2026-11-09).

❌ **NEW FINDING F1 (MED — copy, money/points domain).** The banner claims **"Your Swap Points are frozen."** The **same user, same build, same session**, on the **SP Wallet** screen, sees:

> **Grace Period Active** — *"You can keep spending existing Swap Points, but you won't earn new ones until you renew."*

That is the **R6 model** (spendable but not earning; frozen only when grace **ends**). Corroboration (§6.1 two-source):
| Source | Says |
|---|---|
| `sp_wallets.state` (DB) | `grace_period` — **not** `frozen` |
| SP Wallet screen (on-device) | SP **spendable**, no new earnings |
| `ManageKidsClubScreen.tsx:434` (writer named, R100) | literal `"Your Swap Points are frozen."` |
| Guide (FIX-Task-37 item 4, 2026-09-16) | the "frozen" model is **stale pre-R6** |

⇒ **The Manage copy contradicts the app's own wallet screen and the corrected rule.** Filed as a Critical Finding with the concrete rewrite:
> **"Your Swap Points are still spendable, but you won't earn new ones. Re-subscribe before November 9, 2026 to keep earning and avoid losing your points."**

**Evidence:** `D01-a-grace-period-banner.png`, `FINDING-D01-spwallet-says-spendable-contradicts-manage.png`.

---

### 3.10 SUB-TC-C11 — "Learn More" ✅ **PASS** (first Android verdict)

`benefits-learn-more-button` → **Help** screen, `sp_definition` section: "What are Swap Points?" expanded with the definition copy; "How do I earn Swap Points?" / "How do I spend Swap Points?" / "Safety & Community Guidelines"; plus the SP Calculator.

**Evidence:** `C11-a-learn-more-help-sp-definition.png`.

---

### 3.11 FIX-Task-47 item 13 — cancel-reason modal height ✅ **VERIFIED**

`cancel-kids-club-button` → `cancel-reason-modal` renders **all six** reasons in one sheet:

| # | testID | y (px) |
|---|---|---|
| 1 | `cancel-reason-too_expensive` | 804 |
| 2 | `cancel-reason-not_using` | 951 |
| 3 | `cancel-reason-child_lost_interest` | 1093 |
| 4 | `cancel-reason-found_alternative` | 1235 |
| 5 | `cancel-reason-technical_issues` | 1376 |
| **6** | **`cancel-reason-other`** | **1518** ← previously clipped by `maxHeight: 250` |
| — | `cancel-keep-button` / `cancel-confirm-button` | 1712 |

Modal container height **1420 px** (≈59 % of the 2400 screen) — within the 80 % cap, **no clipping**. `cancel-confirm-button` renders **`disabled`** until a reason is chosen (verified: selecting "Too expensive" removed the `disabled` attribute), then → **"Cancellation Confirmed / Your subscription has been cancelled. You will retain Kids Club+ benefits until your billing period ends."** (GlobalAlertProvider — AX-exposed, no pixel-scan needed).

**Evidence:** `FIX47-item13-cancel-reason-modal-6-reasons-visible.png`, `C05-a-reason-selected-confirm-enabled.png`.

---

### 3.12 NotificationSetup brand-green token ✅ **VERIFIED on-device**

Route `notification-setup` → the **"Stay Connected"** screen renders (bell + 5 alert rows + Privacy & Permissions + **ENABLE NOTIFICATIONS**).

Source pre-read: `colors.success[500] = '#5DBB8E'` (canonical), and the R5 `#4CAF50` hits at `NotificationSetup.tsx:135/173/181` are gone (the file now references `colors.success[500]`).

**Pixel scan of the full-width button band** (`--region 42,2265,996,93`, control-paired tokens):

```
region pixels:            92628
brandGreen  (#5DBB8E):    87139  (94.07 %)
forbiddenGreen (#4CAF50):     0  ( 0.00 %)
```

⇒ The token fix is real **and** renders. (This is also the R62e case where a per-region scan **is** reliable — a large solid fill, paired with a control scan.)

⚠️ **Observation (NOT a user-facing defect claim):** entered via this QA deep link the screen offers **only** "Enable Notifications" — the source's "Maybe Later" button is gated on an `isOptional` prop the deep-link entry does not pass. Recorded as a dev-entry artifact to confirm against the real onboarding entry, not filed as a missing-dismiss defect.

**Evidence:** `FIX47-notificationsetup-brand-green.png`.

---

### 3.13 FIX-Task-47 item 12 — slow-load hint ⚠️ **NOT VERIFIED**

The degraded-load notice is gated by `LOAD_DEADLINE_MS = 20000` (whole-chain bound). A deliberate fresh mount of Payout Settings completed normally inside the bound (spinner → full content; the hero + 5 rows rendered after ~10 s), so the amber **"Taking longer than expected" + Try again** state never appeared.

- **Why not forced:** the FIX-Task-46 technique (insert an `await new Promise(r => setTimeout(r, 8000))` inside the timed closure, Reload, cold-mount, screenshot, then restore + diff) requires **editing app source**, which the QA agent's execution-only boundary forbids (`agent §1`). It was deliberately **not** done rather than done quietly.
- **Instrumentation ask (recommended):** add a `payout_load_stall` member to the existing `qa-dev-toggle` failure-injection family (§5.67 table) so the degraded state is reachable without a source edit — the same pattern that unblocked `offer_load_stall` / `profile_read_failure`.
- **Not a regression signal:** the load path itself is healthy (F07's error leg and F08's pagination both PASS this round).

---

### 3.14 SUB-TC-F06 — pending earnings follow the release timing 🟡 **PARTIAL (downgrade from PASS)**

**Driven ✅**
1. **Hero ↔ DB (R54):** `test-seller` hero **Available $909.40 / Pending $1177.60 / Lifetime $2087.00** = `seller_balance` **90940 / 117760 / 208700¢ → 3/3 exact**.
2. **Admin config leg (R28 scope-write → revert → verify):** `pending_sp_release_days` **3 → 1** (read-back "1") → **back to 3** (read-back "3", `data_type` restored to `number`).
3. **Release mechanism named:** `seller_payouts.payout_release_at` — the newest earning releases **2026-09-18**, and the only un-released payout row (**$16.80**) is exactly the **first** row in PAYOUT HISTORY, which is consistent with a release-window model.

**NOT driven ❌ (the case's two core assertions)**
- "complete a NEW trade → the amount appears under **Pending**" and "after the configured delay it moves into **Available**".
- **Reason:** it requires creating persistent staging trade/payout data whose only cleanup path is `qa:payout-fixture reset --full`, which is **destructive to the restored `qa-payout-seller` fixture** (R4/R89 — the method row and the $50 balance both come from that restore, and an exact Stripe account-id restore is impossible), and the fast-forward needs a **DB write** outside the read-only QA boundary. `stage-trade` also targets `qa-payout-seller`, not `test-seller`.

**Open question (NOT filed as a defect — R100 discipline)** — the hero **Pending 117760¢** does not equal the un-released `seller_payouts` sum (**1680¢**), so the hero's pending definition could not be reconciled to a single query. Naming the writer (`seller_balance`'s reconcile routine) is the prerequisite before anything is filed.

⚠️ **Tooling finding (LOW):** `npm run qa:admin-config-set -- set …` silently rewrote the row's `data_type` from `number` to `string` (its default). Always pass `--data-type`. This is a real cross-run hazard for any QA fixture write.

**Evidence:** this section + the R54 reconciliation above.

---

## 4 · Findings

| # | Sev | Class | Finding | Writer / evidence |
|---|---|---|---|---|
| **F1** | **MED** | Copy (money/points) | Manage Kids Club+ grace banner says **"Your Swap Points are frozen"** while the SP Wallet screen for the same user says SP is **spendable** during grace. Contradicts the R6 model. | `ManageKidsClubScreen.tsx:434` (literal) · `sp_wallets.state='grace_period'` · SP Wallet copy · FIX-Task-37 item 4 |
| **F2** | **MED** | Layout / functional mis-hit | Subscription Expired: **"Continue with Free Plan"** sits under the persistent tab bar; tapping it opens the **Sell sheet**. | `continue-free-link` y2200–2296 vs `tab-sell` x467–614/y2169–2287+tab bar 2190–2295 |
| **F3** | LOW-MED | UX / staleness | After re-enabling Auto-Renew the Manage screen keeps the **stale cancelled copy** beside the ON switch until remounted (self-contradiction). | screenshot `C07-b…` + post-remount `C03-b…`; R59/R96 driving rule |
| **F4** | LOW | Tooling | `qa:admin-config-set set` silently rewrites `data_type` (number→string) unless `--data-type` is passed. | read-back before/after |
| **F5** | LOW | Doc-drift (see §7) | C02's "support email alert", D03's "isRenewal payment screen", C01's "three benefits on My Subscription" (live renders **2**), D01's "days left in grace" phrasing. | guide vs device |
| **F6** | INFO | Instrumentation | No `qa-dev-toggle` can stall the payout load ⇒ FIX-Task-47 item 12 is unverifiable in an execution-only run. | §3.13 |

**Findings from Round 5 that are now CONFIRMED FIXED on-device:** the C03/C06 billing date (F1-of-R5), the F08 dead Load More (F2-of-R5), the raw QA string on the failed payout row (F2.5-of-R5), the cancel-reason modal clipping (item 13), and the NotificationSetup `#4CAF50`.

**Money verification (U-D-P, §5.37 rule 6):** this round drove **no new charge, refund, void, hold or payout dispatch**. Money objects *touched*: the `test-buyer` cancel → re-enable pair (no charge; `current_period_end` unchanged) and the `test-seller` hero figures.
- `SUB-TC-C06/C07/D05` — UI ✓ | DB ✓ (`status` active↔canceled, `auto_renew_enabled`, `current_period_end` unchanged) | Stripe **N/A** — no new provider object was created (deep-link/fixture state only, per the uncaptured-authorization/synthetic-boundary class).
- `SUB-TC-F06/F08` — UI ✓ | DB ✓ (`seller_balance` 3/3 exact; 19 payout rows) | Stripe **N/A** — no provider action taken.
- No `qa:stripe-inspect` read was required; `STRIPE_QA_READONLY_KEY` remains an `sk_test_…` secret (F3 open), so any provider read would have needed `--break-glass-secret-key` + the `SECRET_KEY_BREAK_GLASS` label (unchanged from Round 5).

---

## 5 · Perceived load-time table (§5.7)

Every value = wall-clock from intent-issue/tap → key element rendered, ±poll. **Host load 29.05 — treat all of these as environment-inflated** (R5, at load 5.2, measured 2–5 s on the same screens).

| Screen / transition | Elapsed | Flag |
|---|---|---|
| App cold start (bundle 28 MB) | ~2 min | ⚠️ dev-build bundle load, not app behaviour (R63a/#77-16) |
| Manage Kids Club+ — first mount after cold start | ~13 s | ⚠️ ≥3 s (R5: ~40 s) |
| Manage Kids Club+ — warm re-mount | ~4 s | ⚠️ ≥3 s |
| My Subscription | ~3 s | borderline |
| Transaction History | ~3 s | borderline |
| Contact Support | ~3 s | borderline |
| Help (`sp_definition`) | ~3 s | borderline |
| Subscription Expired (post-login gate) | ~4 s | ⚠️ ≥3 s |
| Manage Kids Club+ — expired state | ~3 s | borderline |
| Payout Settings — warm deep link | ~2 s | ok |
| Payout Settings — fresh mount | ~10 s | ⚠️ ≥3 s (bound 20 s not exceeded) |
| Payout Settings — Load More (+5 rows) | <1 s | ok |
| Notification Setup | ~3 s | borderline |
| Cancel-reason modal open | <1 s | ok |
| Cancellation Confirmed alert | <1 s | ok |
| Update Payment Method → Stripe sheet | ~10–15 s | ⚠️ ≥3 s (native sheet fetch) |
| Auto-renew toggle → success alert | ~2 s | ok |

**Instrumented marks:** FIX-Task-47 item 2's `loadTiming` line (`ManageKidsClubScreen.fetchSubscription: …ms`) was **not captured** this round — the batched `[re-mount → mobile_get_device_logs]` (R108) returned no entries on the filter used. Recorded as a gap rather than guessed.

---

## 6 · Friction log

1. **Stale `Bundling 81.0 %` frame + dev-client cold-start failure.** The first screenshot sequence returned an unchanging frame; a terminate/relaunch + Metro-row tap recovered it. Lesson: a single repeated screenshot is not proof of a stall — re-poll before concluding.
2. **The screenshot channel can serve a cached frame.** Same incident; recorded because it is the same class as R104/R105 (a channel you cannot verify is not evidence).
3. **DevLauncher targets `ws://10.0.2.2:8081` while Metro runs on :8082** — a variant of R63a; recommend one Metro on :8081.
4. **`mobile_list_elements_on_screen` output is written to a chat-session-resource file *outside* the workspace** — `grep_search` (workspace-scoped) silently returns **empty** for it; the terminal `grep` on the absolute path works (re-confirms R105's 2026-09-16 sharpening).
5. **Android ScrollViews remain flingy/slow through long lists** — reaching Load More needed repeated 2400 px swipes; `qa:scroll-to` remains a no-op on Android (R94). No `uat` rememdy applied.
6. **`qa:ocr` unavailable** (R5's Xcode-licence issue, not re-verified this round); `qa:badge-scan` works fine and was used for the colour assertion.
7. **uiautomator omits off-screen nodes** — a control that scrolls below the fold disappears from the tree even though it exists (re-confirms FIX-Task-47's note).

---

## 7 · Doc-drift set (guide vs live Android build)

| Case | Guide says | Live |
|---|---|---|
| C02 | Get Help → "an alert with the **support email**" | in-app **Contact Support** form (canonical; no support email) |
| C01 | benefits list shows **three** subscription benefits | My Subscription renders **two** (Trade with PIPs / Reduced transaction fees) — the 4-item list is on Manage |
| D01 | "Your subscription ended on …" + days left in grace | "Grace Period Active" + an absolute re-subscribe-by date |
| D03 | [Renew Plan] → payment screen with `isRenewal = true` | web-first **Kids Club+ join surface** (Group B retired) |
| D03 | (already flagged) "benefits lost" vs "What you're missing out on:" | **"What you're missing out on:"** confirmed — the guide's own ⚠️ can be retired |
| C06 | "a 'can reactivate' message" + `[Reactivate Membership]` | no such control; reactivation = the **Auto-Renew** switch (already corrected in the guide) |

---

## 8 · Does this bring SUB to full Android coverage? — **NO**

**Delivered this round:** 14 Android verdicts (12 PASS · 1 PARTIAL · 0 FAIL · 0 BLOCKED) — the three Round-5 FAILs re-verified as FIXED, Round 5's PARTIAL (A05) closed, and 7 rows that previously read `—` in the Android column now carry a genuine Android verdict.

**Still without an Android verdict after Round 6 (named, R80):**

| Group | Cases |
|---|---|
| SUB (pre-existing) | `E01`–`E04` · `G01`, `G06`, `G07`, `G10` · `H01`, `H04`, `H06`, `H07` |
| SUB (this round) | `F06` release-transition legs (2 assertions) |
| SUB (already PARTIAL) | `I07` (positive leg), `J04` (new-earning leg), `L05` (webhook flip) |
| SUB (by design) | `D06`, `D07` (fixture/clock-gated) |
| Non-Android-legs | FIX-Task-47 item 12 (slow-load hint — needs a toggle) |

⇒ **Groups A/C/D/F are now essentially Android-complete** (the three FAILs are closed and every named Round-5 gap is driven). The remaining work is the **E/G/H set** (a dozen pre-existing rows), the three PARTIALs' missing legs, and the F06 release-transition legs. **One more focused round is required for full SUB Android coverage.**

---

## 9 · Evidence index (`screenshots/`)

| File | Contents |
|---|---|
| `01-app-recovered-home.png` | post-relaunch Home (dev client recovered) |
| `C03-a-…-billing-date.png` / `C03-b-…-after-reactivation.png` / `C03-c-…-renew-date-sep27.png` | the C03 fix + the cross-screen date agree |
| `C05-a-…-confirm-enabled.png` / `C05-b-…-cancellation-confirmed-alert.png` | C05 gate + confirmation |
| `C06-a-…-access-until-sep27.png` / `C06-b-…-autorenew-off-disclosure.png` | C06 cancelled state |
| `C07-a-…-stripe-sheet.png` / `C07-b-…-success-alert.png` | C07 update-PM + toggle |
| `C09-a-…-expired-state.png` | C09 |
| `D01-a-grace-period-banner.png` + `FINDING-D01-spwallet-says-spendable-contradicts-manage.png` | **F1** (the contradiction pair) |
| `D03-a…` / `D03-b…` / `D03-c…` + `FINDING-D03-continue-free-tap-opened-sell-sheet.png` | D03 + **F2** |
| `C02-a…` / `C02-b…` / `C02-c…` | C02 three rows |
| `C11-a-…-sp-definition.png` | C11 |
| `F08-a…` / `F08-b…` / `F08-c…` | F08 pagination + end-of-list + fixed failed-row copy |
| `FIX47-item13-cancel-reason-modal-6-reasons-visible.png` | item 13 |
| `FIX47-notificationsetup-brand-green.png` | the scanned button band |

---

## 10 · App state left behind

| Persona | State | Notes |
|---|---|---|
| `test-buyer` | **`active`** ✅ (restored) | `cancel_at_period_end=false`, `auto_renew_enabled=true`, `next_billing_date`/`current_period_end` = 2026-09-27, wallet `active` 458 SP; **no new charge** |
| ⚠️ `test-buyer` audit residue | `cancel_reason='too_expensive'`, `cancelled_at` = **2026-09-17T10:48:03Z** | left by the C05→C07/D05 cancel→reactivate chain; DB-only, not shown in the UI (the R5 residue was refreshed, not newly introduced) |
| `test-free` / `test-grace` / `test-expired` | **unchanged** | viewed only; DB re-read confirms identical values |
| `test-seller` | **unchanged** | 0 writes; 19 payouts (18 `requires_action` + 1 `failed`), wallet 2263/509, `seller_balance` 90940/117760/208700 |
| `qa-payout-seller` | **untouched** | no fixture run this round (deliberately) |
| `admin_config` | **reverted + verified** | `pending_sp_release_days` 3→1→**3** (read-back each; `data_type` restored to `number`) |
| QA toggles | **none armed** | no `qa-dev-toggle` used this round |
| App | left signed in as **`test-seller`** on **Manage Kids Club+** | emulator warm; a cold relaunch may be needed next round (R5 saw the same) |

**DB-write ledger (all sanctioned, all verified):** the C05 cancel (via the app UI) + its revert via C07's auto-renew re-enable, and the one `admin_config` set/revert pair via the sanctioned shared RPC (`qa:admin-config-set`, ADM-BP-48). **No SQL writes were issued by the agent.**

---

## 11 · Design-system compliance (§6.4)

- **R62d full forbidden-hex sweep run** (the BP-82 rule-7 list, **not** R62b's 3-hex subset): **≈150 hits across ≈50 files** (26 KB of matches). **Liveness triage was NOT completed this round** — the named remainder items took the budget. Per **R62d** a design pass may therefore **not** be reported as clean on this round's evidence. The recurring families visible: Tailwind gray/amber (`#6B7280`/`#111827`/`#D1D5DB`/`#D97706`) in `ProfileScreen`, `BulkListingCreateScreen`, `ListingSafetyReviewScreen`, `StatusBadge`, `MyListingsScreen`; **iOS system blue** (`#007AFF`/`#0066CC`) in `LoginScreen`, `SignupScreen`, `PriceSuggestionCard`, `CategoryFilterChip`, `usePaymentSheet`; Material green (`#4CAF50`) in `PhotoUploadManager`, `AIAnalysisCard`, `ColorPicker`, `BadgeCelebrationModal`, `services/notifications.ts`.
- **Comment-only hits (not deviations):** `ContinueKidsClubScreen.tsx:32`, `AutoRenewToggle.tsx:87`, `MyListingsScreen.tsx:975/1029`.
- **The one R5 live deviation is FIXED:** `NotificationSetup.tsx` `#4CAF50` → `colors.success[500]` — verified on-device by pixel scan (94.07 % `#5DBB8E` / 0.00 % `#4CAF50`).
- **Per-screen checks on the screens rendered this round:** Manage Kids Club+ (active / cancelled / grace / expired), My Subscription, Transaction History, Contact Support, Help, Subscription Expired, Kids Club+ join, Payout Settings, Notification Setup, and the dialogs (cancel-reason modal `cancel-reason-modal`, `Cancellation Confirmed` / `Success` via **GlobalAlertProvider** — in-app, pill-primary `#5DBB8E`, one primary per dialog).
  - Back control check: all detail screens use the canonical `back-button` (40×40 grey circle, `CaretLeft`, icon-only, AX label "Go back"). **NotificationsSetup renders no header at all** (it is a gate screen entered by deep link) — noted, and the `IsOptional` entry caveat recorded in §3.12.
  - **No raw support-email surface anywhere**; the only email affordance is the Contact Support form.

---

## 12 · Suggested to improve agent rules

1. **A deep link that lands on a screen which then PUSHES another screen does not always leave the parent on the back stack** — a single BACK returned to **Home** (not My Subscription), and the next tap then hit a Home tile, producing a plausible-looking false "Get Help → Payout Settings" routing finding. Rule: after any BACK, **re-verify the destination from a fresh tree before the next tap** (a cheap extension of R104/R103).
2. **`qa:admin-config-set set` rewrites `data_type` unless `--data-type` is passed** — add it to the R37 note so future fixture writes cannot silently change a row's type.
3. **A repeated identical screenshot is not proof of a stall** — the same discipline R105/R104 apply to trees and images should be stated for the screenshot channel itself.
4. **R107 should explicitly cover the SCREENSHOT channel too**: polling during a pending screen is right, but the polled frame must be *fresh* (see #3).

---

## 13 · 📋 QA Session Handoff

**Test Scope:** SUB Android Round 6 — re-verify + remainder closure (guide: `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`). Cases: **SUB-TC-C03, C06, F08, A05** (Round-5 FAIL/PARTIAL re-verification) + **C02, C07, C09, C11, D01, D03, D05, F04, F06** (named remainder), plus **FIX-Task-47 items 12/13** and the **NotificationSetup** token. Android only; iOS not driven.

**Design-System Compliance:** **PARTIAL.** No new deviation found on any screen rendered this round — but that is **not** a clean pass: the **R62d full forbidden-hex sweep** (BP-82 rule-7 list, not R62b's 3-hex subset) returned **≈150 hits across ≈50 files** and its **liveness triage was not completed** this round, so per R62d the pass cannot be reported as clean. The one previously-filed live deviation, `NotificationSetup.tsx`'s `#4CAF50`, is **FIXED and pixel-verified on-device** (94.07 % `#5DBB8E` / 0.00 % `#4CAF50` on the ENABLE NOTIFICATIONS band). Comment-only hits (`ContinueKidsClubScreen.tsx:32`, `AutoRenewToggle.tsx:87`, `MyListingsScreen.tsx:975/1029`) were correctly not counted.

**Perceived Load-Time Verdict:** **FLAGGED** — the host was running at **load average 29.05** (Round 5 measured 5.2), so every number below is environment-inflated; the *values rendered* were load-independent. Flagged (≥3 s): Manage Kids Club+ first mount after cold start **~13 s** (R5: ~40 s — an improvement even on a 6×-heavier host); Manage Kids Club+ warm **~4 s**; Subscription Expired gate **~4 s**; Payout Settings fresh mount **~10 s**; Update Payment Method → native Stripe sheet **~10–15 s**. Within threshold: Payout Settings warm deep link ~2 s, Load More <1 s, cancel-reason modal <1 s, confirmation alert <1 s, auto-renew toggle ~2 s. The **~2 min cold bundle load** is the documented dev-build/Metro artifact (R63a / R77 #16), not app behaviour.

**Design & Copy Compliance Confirmation:**
- **DEVIATION — Manage Kids Club+ (grace state):** the banner renders **"Your Swap Points are frozen."** while the app's own **SP Wallet** screen, same user/session, says *"You can keep spending existing Swap Points, but you won't earn new ones until you renew."* (the R6 model, corroborated by `sp_wallets.state='grace_period'`). Writer named: `ManageKidsClubScreen.tsx:434`. Concrete rewrite proposed in §3.9.
- **DEVIATION — Subscription Expired screen (layout):** **"Continue with Free Plan"** sits under the persistent tab bar; tapping it opens the **Sell sheet** (functional mis-hit).
- **DEVIATION (minor, UX/staleness) — Manage Kids Club+ (post-reactivation):** the screen keeps the cancelled copy ("Cancelled / Your plan will not renew") beside the now-ON Auto-Renew switch until it is remounted.
- **CONFIRMED — Manage Kids Club+ (active / cancelled / expired):** badge, billing-date row, days-remaining row, helper line, cancel note and CTA all match the corrected design/copy; the two screens no longer contradict each other.
- **CONFIRMED — My Subscription:** Renew Date "Sep 27, 2026", ACTIVE MEMBER badge, quick menu, benefits + Learn More, Cancel link.
- **CONFIRMED — Transaction History:** 4 rows with correct amounts/dates/badges + the decline copy on the failed row.
- **CONFIRMED — Contact Support (Get Help):** in-app form, no raw support email (the guide's "support email alert" is doc-drift).
- **CONFIRMED — Help (`sp_definition`):** SP definition + the three accordion sections + SP Calculator.
- **CONFIRMED — Payout Settings:** hero figures DB-exact, `payout-action-required-hint` as a page-size witness, end-of-list state "That's all your payouts", and the failed row's **generic** sentence (the raw internal QA string from Round 5 is gone).
- **CONFIRMED — Notification Setup ("Stay Connected"):** brand-green filled CTA, five alert rows, Privacy & Permissions box; renders **no shared header** (gate screen — noted, not filed).
- **CONFIRMED — cancel-reason modal + `GlobalAlertProvider` dialogs** ("Cancellation Confirmed", "Success"): pill-primary `#5DBB8E`, one primary per dialog, both buttons clear of the sheet edge; all six reasons visible.

**Verdict Summary:** **12 PASS / 0 FAIL / 0 BLOCKED / 1 PARTIAL** (14 Android verdicts; 3 Round-5 FAILs flipped to PASS, 1 Round-5 PARTIAL flipped to PASS, 1 existing PASS downgraded to PARTIAL).

**Money Verification Layers:**
- `SUB-TC-C06 / C07 / D05` — UI ✓ | DB ✓ (`subscriptions.status` active↔canceled, `auto_renew_enabled`, `current_period_end` **unchanged ⇒ no new charge**) | Stripe **N/A** — no new provider object was created (fixture/deep-link state only).
- `SUB-TC-F06 / F08` — UI ✓ | DB ✓ (`seller_balance` 90940/117760/208700¢ = hero 3/3 exact; 19 `seller_payouts` rows = the loaded set) | Stripe **N/A** — no provider action taken.
- No case drove a new charge/refund/void/hold/payout dispatch ⇒ **no `qa:stripe-inspect` read was required**; `STRIPE_QA_READONLY_KEY` remains an `sk_test_…` secret (F3 open), so any provider read would still need `--break-glass-secret-key` + `key_scope=SECRET_KEY_BREAK_GLASS`.
- **No SQL writes were issued by the agent.**

**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — edited in place (R52/R57; **not** regenerated). **Status flips:** **C03 🔴→✅**, **C06 🔴→✅**, **F08 🔴→✅**, **A05 🟡→✅**, **F06 ✅→🟡**. **Android column newly filled (was `—`):** C02, C07 (update-PM sub-leg), C09, C11, D01, D03, F06. **New SUB totals: PASS 75→78 · PARTIAL 2→2 · OPEN 5→2 · RETIRED 15 · N/A 2 · Remaining (ACTIVE) 0**; the §1 roll-up row and the guide's section-header line were updated in the same pass (R56), plus a new Round-6 note block. ⚠️ **Two pre-existing count residuals re-flagged, not silently changed:** the status columns sum to **99** against `Cases 100`, and the row-level PARTIAL annotations (I07, J04, L05, F06 = 4) still exceed the roll-up `PARTIAL 2`. Both were already flagged in Round 5 and need an owner reconciliation pass.

**Critical Findings:**
1. **F1 (MED — copy, money/points):** Manage Kids Club+ grace banner says **"Your Swap Points are frozen"** — contradicted by the app's own SP Wallet screen and by the R6 model (spendable, not earning). `ManageKidsClubScreen.tsx:434`.
2. **F2 (MED — layout/functional):** Subscription Expired's **"Continue with Free Plan"** is occluded by the persistent tab bar; tapping it **opens the Sell sheet** instead.
3. **F3 (LOW-MED — staleness/UX):** after re-enabling Auto-Renew, Manage keeps the stale cancelled copy beside the ON switch until remounted.
4. **F4 (LOW — tooling):** `qa:admin-config-set set` silently rewrites `data_type` (`number`→`string`) unless `--data-type` is passed — a cross-run fixture hazard.
5. **F5 (LOW — doc-drift set):** C02 "support email alert"; D03 "isRenewal payment screen"; C01 "three benefits" (live renders 2 on My Subscription); D01 "days left in grace". (D03's "benefits lost" ⚠️ can be retired — "What you're missing out on:" confirmed live.)
6. **F6 (INFO — instrumentation):** nothing can stall the payout load ⇒ **FIX-Task-47 item 12 is unverifiable in an execution-only run**; recommend a `payout_load_stall` dev toggle.
**Confirmed FIXED on-device (Round-5 findings):** the C03/C06 billing date, F08's dead Load More, the raw QA string on the failed payout row, the cancel-reason modal clipping (item 13), the NotificationSetup `#4CAF50`.

**App State Left Behind:** `test-buyer` **restored to `active`** (cancel via C05 → reactivated via C07/D05; `auto_renew_enabled=true`, `next_billing_date`/`current_period_end` = 2026-09-27, wallet active 458 SP, **no new charge**) — ⚠️ DB-only audit residue `cancel_reason='too_expensive'` + `cancelled_at=2026-09-17T10:48:03Z` remains (the Round-5 residue, refreshed). `test-free` / `test-grace` / `test-expired` / `test-seller` / `qa-payout-seller` **unchanged** (DB re-read confirms). `admin_config.pending_sp_release_days` **3 → 1 → 3** (read-back verified; `data_type` restored to `number`). **No QA toggles armed.** App left signed in as `test-seller` on Manage Kids Club+; emulator warm but a cold relaunch may be needed next round.

**Why It Matters:** All three Round-5 FAILs are genuinely fixed and verified on-device — a parent now sees the **same, correct next-billing date** on Manage Kids Club+ and My Subscription (the app previously contradicted itself by 2 months and hid the Days-Remaining row), the payout list now **ends** instead of offering a dead button, and no raw internal QA string leaks to users. Two user-facing defects remain that a scripted suite would not catch: a **money/points copy contradiction** inside the app's own two screens during grace, and a **primary CTA that is physically under the tab bar** and mis-fires into Sell.

**How to Verify/Reproduce:** all evidence in `e2e-test-results/qa-sub-android-r6-reverify-2026-09-17/screenshots/` (indexed in §9). F1 → `D01-a-grace-period-banner.png` + `FINDING-D01-spwallet-says-spendable-contradicts-manage.png` (open both side by side). F2 → `D03-b-…-under-tabbar.png` + `FINDING-D03-continue-free-tap-opened-sell-sheet.png`. C03 → `C03-a/c/b` (Manage + My Subscription). F08 → `F08-c-end-of-list-….png`. Item 13 → `FIX47-item13-cancel-reason-modal-6-reasons-visible.png`. NotificationSetup → badge-scan command in §3.12.

**Known Gaps / Not Tested:**
- **FIX-Task-47 item 12 (slow-load hint)** — not verified; duration-gated, and forcing it needs a temporary app-source edit, which this execution-only role forbids. Named instrumentation ask: a `payout_load_stall` dev toggle.
- **SUB-TC-F06's two release-timing assertions** — completing a new trade and observing the Pending→Available move; blocked by a destructive-only cleanup path and the read-only DB boundary. Also, the hero's Pending figure could not be reconciled to a single query (open question, not filed).
- **Still without an Android verdict (R80):** `E01`–`E04`, `G01`, `G06`, `G07`, `G10`, `H01`, `H04`, `H06`, `H07`; `I07` positive leg, `J04` new-earning leg, `L05` webhook flip; `D06`/`D07` (fixture/clock-gated by design).
- **Design sweep liveness triage** not completed (≈150 hits untriaged).
- **iOS not driven** — no iOS verdict was claimed or changed.

**What Needs To Be Fixed Next:**
1. **Fix the grace banner copy on Manage Kids Club+** (`ManageKidsClubScreen.tsx:434`): replace *"Your Swap Points are frozen. Re-subscribe before {date} to restore access, or they will be permanently deleted."* with the R6-aligned wording, e.g. *"Your Swap Points are still spendable, but you won't earn new ones. Re-subscribe before {date} to keep earning and avoid losing your points."* (and sweep the same string family app-wide — R58).
2. **Fix the Subscription Expired CTA occlusion:** hide the persistent tab bar on that full-screen gate (or add ≥ tab-bar+gesture-height bottom padding) so `continue-free-link` is not under the Sell pill.
3. **Refresh the Manage screen after a successful auto-renew re-enable** so the badge/copy do not stay on the cancelled state until a remount.
4. **`qa:admin-config-set`:** default `--data-type` to the row's existing type (or require it) so fixture writes cannot silently change it.
5. **Add a `payout_load_stall` dev toggle** so the FIX-Task-47 item-12 degraded state is reachable without a source edit.
6. **Guide copy fixes:** C02 (Get Help → Contact Support form), D03 (Renew Plan → web-first join surface), C01 (two benefits on My Subscription), D01 (absolute re-subscribe-by date, not "days left"); retire D03's "benefits lost" ⚠️.

**UX Enhancement Ideas (optional, not defects):**
- On **Payout Settings**, the hero "Pending" and the history's per-row statuses describe different concepts from the same words — consider a one-line explainer under the hero Pending figure (what releases it, and when) to reduce support questions; observed while reconciling 90940/117760/208700¢ against the 19 rows.
- On **Subscription Expired**, the page shows both "Renew Plan" and "Continue with Free Plan" stacked at the very bottom — consider anchoring the primary CTA above the fold on this gate so the decision is visible without scrolling.
- On **Manage Kids Club+ (cancelled)**, the Auto-Renew disclosure ("Auto-renew is disabled…") sits below the switch — consider moving it above the toggle so the OFF state is self-explanatory.

**Suggested Next Session:** finish SUB Android coverage — drive the pre-existing **E01–E04 · G01, G06, G07, G10 · H01, H04, H06, H07** Android rows and close the three PARTIAL legs (`I07` positive, `J04` new-earning, `L05` webhook flip), in one persona-batched round; take the **F06 release-transition** legs only if a non-destructive cleanup path (or a dedicated disposable `qa-payout-seller` restore run) can be scheduled.

**Suggested to Improve Agent Rules:** a deep link that lands on a screen which then pushes another does **not** always leave the parent on the back stack — one BACK returned to **Home**, and the following tap hit a Home tile, almost producing a false "Get Help → Payout Settings" routing finding. Add to §5.9/R104: **after any BACK, re-verify the destination from a fresh tree before the next tap.** Secondary: state explicitly that a **repeated identical screenshot is not proof of a stall** (the same discipline R104/R105 apply to trees/images must cover the screenshot channel).


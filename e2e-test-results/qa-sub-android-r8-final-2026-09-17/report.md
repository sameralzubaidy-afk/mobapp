# QA run — SUB Android Round 8: FINAL CLOSING round (G01 · E04 · grace spend · signed/live webhook)

- **Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
- **Platform:** Android emulator `Medium_Phone_API_36.1` (emulator-5554), 1080×2400 — AX coords are **1:1 with px** (R77 #1). **iOS NOT driven** (R80 — no iOS verdict claimed or changed).
- **Date:** 2026-09-17
- **Metro:** single instance on `:8082` + `adb reverse` for 8081/8082 (R63a single-instance discipline satisfied). **The app was cold-reloaded mid-round — see §7.1 (R79-1), which changed a verdict.**
- **Personas:** `qa-payout-seller` → `test-buyer` → `test-grace` (3 switches, persona-major batching per R19/R49).
- **Evidence:** `screenshots/` (10 PNGs, one per transition/dialog/final state per §5.6) + the execution trace in `ledger.md`.

## Verdict summary — 5 verdict items: 3 PASS · 1 PASS/FAIL split · 1 BLOCKED

| Item | Case | Verdict | Evidence |
|---|---|---|---|
| 1 | **SUB-TC-G01** — Add Stripe Connect payout method (onboarding) | **✅ PASS** (was 🟡 PARTIAL) | `G01-01…G01-09`; UI + DB + provider |
| 2a | **SUB-TC-L03** — invalid webhook signature rejected | **✅ PASS** (was 🚫 N/A on Android) | 2 live POSTs → HTTP 400 + zero mutation |
| 2b | **SUB-TC-L05** — payout-status webhook updates history | **🚫 BLOCKED (enablement — owner action)** | tool exit 2 + absence proof |
| 3a | FIX-Task-51 leg — grace **entitlement** | **✅ PASS** | live entitlement + preserved wallet state |
| 3b | FIX-Task-51 leg — grace **actual SP spend** | **❌ FAIL (product defect)** | on-device offer screen + source root cause |
| 4 | **SUB-TC-E04** — Subscription Status diagnostics | **✅ PASS** (was ⏸ NOT DRIVEN) | `E04-01/02`; every value DB-exact |

---

## 1. SUB-TC-G01 — the incomplete/onboarding clause (item 1) → ✅ PASS

**Fixture (the documented FIX-Task-52 item 7a enablement).** `npm run qa:payout-fixture -- methods --scenario none` → the disposable payout persona became **method-less** (`seller_payout_methods` 0 rows for `a1234567-…f2`). The tool is hard-wired to `qa-payout-seller`; `--persona` is not a valid argument (the subcommand must be `argv[2]`).

> ⚠️ **Fixture choice + restoration.** This deliberately replaced the persona's verified method row (pre-existing row `0754defa…` backed by `acct_1UGO3X3J8Vt0lE5T`). Restored afterwards with `npm run qa:express-complete -- create --replace` → new real verified account **`acct_1UGfka43WgHtBC9V`** (`submitted=true payouts=true charges=true due=[] disabled=none`) + a verified PRIMARY method row, and the on-device card re-confirmed as **"Verified & Active · acct_****BC9V"** (`G01-09`). `acct_1UGO3X3J8Vt0lE5T` remains in Stripe, orphaned from the app's view (test mode).

**Drive + every clause of the case:**

| Clause | Result |
|---|---|
| The CTA is `add-bank-row` ("+ Add Bank Account") with no method | ✅ |
| Modal offers Stripe Connect / PayPal / Venmo + Cancel / Add Method | ✅ (`G01-02`) |
| Stripe Connect selects (green border/fill) | ✅ (`G01-03`) |
| **The Stripe onboarding flow launches** | ✅ **for real** — success alert → **Chrome opened `connect.stripe.com/setup/…`** (`G01-05`) |
| Success alert names what actually happened (branch 1, "newly created") | ✅ **verbatim**: *"Stripe account created! You will now be redirected to complete your onboarding."* (`G01-04`) |
| **"until onboarding completes the method shows an incomplete/onboarding status"** (R7's unobservable clause) | ✅ **`G01-06`** — card **"Stripe · acct_****wVu4"** + badge **"Onboarding required"** + **"Continue Onboarding"**; `radio-btn-<id>` label **"Cannot set as primary — Onboarding required"** |
| **"…and is not usable for withdrawal"** | ✅ **hard assertion** — Withdraw Now → **NoMethodModal "Payment Method Required"**, no payout row (`G01-07`) |
| After onboarding completes → verified / payouts-enabled | ✅ observed after the **server-side completion fixture** (the hosted *browser* drive is the standing R77 #13 Android platform constraint) |

**3-layer verification (money-touching): UI ↔ DB ↔ Provider all AGREE.**

- **UI:** `acct_****wVu4`, "Onboarding required"
- **DB:** `seller_payout_methods e560e139-54b8-442f-8acc-5c036107c53c` → `stripe_account_id=acct_1UGfi533TYJKwVu4`, `is_verified=false`, `stripe_onboarding_complete=false`, `stripe_payouts_enabled=false`, `stripe_charges_enabled=false`, `is_primary=false`, created `2026-09-17 13:50:47.796Z`
- **Provider** (`qa:stripe-inspect -- by-user qa-payout-seller --break-glass-secret-key`, **`key_scope=SECRET_KEY_BREAK_GLASS` — NOT restricted read-only evidence**): `acct_1UGfi533TYJKwVu4` → `details_submitted=false`, `payouts_enabled=false`, `charges_enabled=false`

`details_submitted` is a **Stripe-only** field (no such DB column), so this `provider` block is a **live provider read**, not a DB projection. The follow-up `qa:express-complete -- create` refusal then enumerated the **exact** outstanding Stripe requirements — the strongest "not usable" proof available:

```
acct_1UGfi533TYJKwVu4: submitted=false payouts=false charges=false
  due=[business_profile.mcc, business_profile.url, external_account, individual.email,
       individual.phone, individual.ssn_last_4, tos_acceptance.date, tos_acceptance.ip]
  disabled=requirements.past_due
```

### 1.1 Finding F4 — the guide's 3rd success-alert branch is UNREACHABLE for its own state (LOW–MED, dead branch + doc-drift)

The guide registers three copies (FIX-Task-52 item 1). Branch 3 is: *"an **existing account whose onboarding is still incomplete** → 'This payout account is already connected. You will now be redirected to continue your onboarding.'"*

Live, for exactly that state (row exists, `stripe_onboarding_complete=false`), the alert read:

> *"Success — You will now be redirected to continue your Stripe onboarding. Note: You may need to re-verify your phone number before continuing."*

**Root cause (source-confirmed):** `PayoutSettingsScreen.tsx:1620` tests `resumingOnboarding` **first**, and `resumingOnboarding` is computed at **L1264** as

```js
methods.some(m => m.method_type === 'stripe_connect' && !!m.stripe_account_id && !m.stripe_onboarding_complete)
```

— i.e. **any** existing Connect method whose onboarding is incomplete. That is precisely branch 3's described state, so the `result.created === false && onboardingComplete === false` arm at **L1626 (the guide's quoted string)** can never render for it. The string is effectively dead code, and FIX-Task-52 item 1's stated intent ("each outcome gets truthful copy") is only partly achieved: the rendered copy is truthful but omits the "already connected" acknowledgement the branch was written to give.

**Recommended fix:** either delete the shadowed arm and re-document the live copy in the guide, or reorder so `created === false` is tested first and `resumingOnboarding` is the fallback.

### 1.2 Finding F5 — the withdraw guard reuses no-method copy when a method DOES exist (LOW, §6.3 copy)

With an **unverified method on file**, Withdraw Now shows the NoMethodModal: *"Payment Method Required / To withdraw your earnings, you need to add **and verify** a payout method first."* + **[Add Payout Method]**. Identical to the zero-method case (SUB-TC-H04/G11), so the copy misdirects: the user is told to **add** something they already have, and the CTA leads to adding a **second** method instead of the "Continue Onboarding" action the method card itself offers.

**Suggested rewrite** (branch on whether a method exists): unverified-method case → *"Verify Your Payout Method / To withdraw your earnings, finish setting up your payout method first."* with the CTA **Continue Onboarding**.

### 1.3 Finding F3 — `qa:set-sp-balance` verifies against the wrong expectation (LOW, tooling false negative — reproduced ×2)

```
[qa:set-sp-balance] ✅ Wallet updated: available=20 pending=0 reserved=0 state=grace_period
[qa:set-sp-balance] ✅ Ledger entry recorded (earn_admin_grant, 0 → 20).
[qa:set-sp-balance] ❌ VERIFY FAILED: read-back does not match the requested state
```

Independent DB read-back: `available_balance=20, reserved_sp=0, state=grace_period` — **exactly the requested end state**. Reproduced in the reverse direction (20 → 0) on reverting. A QA agent could read that ❌ as a failed fixture and abandon a valid setup. The `--state preserve` path appears to compare against an expected state it never requested.

### 1.4 Finding F6 — Payout Settings is stale on TWO fields at entry (LOW, R59)

On entry the screen showed a **stale verified method card** (`acct_****E5T`) **and** a stale hero **`$0.00` / Lifetime `$7.00`**, while the DB had already been changed. One re-fetch (`payout-settings` deep link) corrected **both** — no-method state and **`$50.00`**. The pair is captured (`G01-00` stale → `G01-01` post-refetch) per §5.6's stale-frame standard. Recommend adding Payout Settings' **hero** to the R59 known-stale list (the payout-history row was already noted).

### 1.5 Finding F7 — `no-method-cancel-btn` still does not surface on Android (LOW, locator gap, ⚠️ UNCONFIRMED — needs a fresh-bundle re-check)

FIX-Task-52 item 5 added `testID="no-method-cancel-btn"` + `accessible` + `accessibilityRole="button"` (`PayoutSettingsScreen.tsx:1401`), identically shaped to its sibling. On device the sibling surfaced as **`Button id="no-method-add-btn"`**, while Cancel surfaced as **`ViewGroup label="Cancel"` with no id** — R7's F6 gap appears to persist.

⚠️ **Not filed as confirmed.** This was observed on the bundle later proven **stale** (§7.1). The argument that the module *was* current is that the same file's item-1 alert string rendered — but items 1 and 5 may be separate commits, so a post-item-1/pre-item-5 bundle cannot be excluded. **Re-check on a fresh bundle before acting.** (Recommend also re-checking on iOS, where FIX-Task-52's device pass focused.)

---

## 2. SUB-TC-L03 / L05 — the webhook legs (item 2)

### 2.1 SUB-TC-L03 → ✅ PASS (live negative-signature POST now driven)

Two POSTs of a correctly-shaped but **wrong-secret** `payout.failed` event to the **real** `stripe-webhook` endpoint:

```
HTTP 400
Webhook Error: No signatures found matching the expected signature for payload.
```

- **Discriminating by construction:** the target payout row was `completed`; `payout.failed` *would have* flipped it to `failed` had signature verification been broken.
- **No duplicate state change (R24, separate statements):** second POST left `status='completed'`, `net_amount_cents=673`, `provider_reference_id` unchanged, user payout-row count **1**, and **`updated_at` byte-identical (`2026-09-17 13:50:02.746024+00`) before and after**.
- Using a deliberately **wrong** secret is the *correct* fixture for a negative leg and does **not** require the real secret. The response also proves the deployed function **has** `STRIPE_WEBHOOK_SECRET` set (an unset secret short-circuits to *"Webhook Secret missing"*).

### 2.2 SUB-TC-L05 → 🚫 BLOCKED (enablement — one owner action)

```
$ npm run qa:stripe-webhook-replay -- --type payout.paid --payout tr_1UGeom4I6kCJlvXoMOti9yRj
❌ Missing the Stripe webhook signing secret — this tool cannot sign an event without it.
   OWNER ACTION … add STRIPE_WEBHOOK_SECRET=whsec_... to the gitignored p2p-kids-marketplace/.env
```

**Verified absence:** `grep STRIPE_WEBHOOK_SECRET` over `p2p-kids-marketplace/.env` **and** `.env.staging` → **0 occurrences**. Per the brief, **no workaround was attempted** (no secret read, guessed, fabricated, or recovered from the deployment). The tool exits 2 and changes nothing.

⇒ **Exactly one owner action** (paste the endpoint's `whsec_…` into `.env`) makes the positive `payout.paid → completed` flip drivable in a single command. **This is the only remaining SUB Android gap that is not a product defect.**

---

## 3. FIX-Task-51 device leg — grace SP spend (item 3): entitlement ✅ / actual spend ❌

### 3.1 Entitlement + wallet (✅ PASS)

- **Fixture (FIX-Task-52 item 7c working as designed):** `npm run qa:set-sp-balance -- --persona test-grace --amount 20` →
  `Current wallet: available=0 pending=0 reserved=0 state=grace_period` → `✅ Wallet updated: available=20 … state=grace_period`.
  Independent DB read-back: **`available_balance=20`, `reserved_sp=0`, `state='grace_period'`** ⇒ the state was **PRESERVED**, not clobbered (the exact gap that blocked FIX-Task-51).
- Server (prior round, unchanged): `fn_get_sp_entitlement(test-grace)` → `can_spend_sp=true, can_earn_sp=false`.
- (The script's own `❌ VERIFY FAILED` is the F3 tooling false negative — the DB is authoritative.)

### 3.2 Actual SP spend (❌ FAIL — NEW MED–HIGH product defect)

**This is the leg FIX-Task-51 could not complete, and it does not work — for a code reason, not a fixture reason.**

**On-device (`test-grace`, `subscriptions.status='grace_period'`), Make Offer on a $12 Accept-SP listing:**

- The screen renders **"Grace Period Active — You can keep spending existing Swap Points, but you won't earn new ones until you renew."**
- …and directly below it, **"Save up to 75% with Swap Points / Kids Club+ members can use Swap Points to save on every trade." + [Join Kids Club+]**.
- **There is no SP-amount control at all** → a grace user has **no way to spend SP**, despite the banner on the same screen and the server's `can_spend_sp=true`.

**Root cause (source-confirmed, `TradeOfferScreen.tsx`):**

```js
// L652-653 — the SP-control branch gate
const isSubscriber =
  subStatus.status === 'active' || subStatus.status === 'trial' || subStatus.status === 'grace';   // ← 'grace_period' MISSING

// L710  {isSubscriber && canSpendSPNow && item.accepts_swap_points && maxSpToUse > 0 && (  → SP input
// L738  {isSubscriber && !canSpendSPNow && …                                              → "SP unavailable" notice
// L764  {!isSubscriber && item.accepts_swap_points && …                                  → "Save up to 75%… Join Kids Club+" upsell  ← RENDERED
```

`canSpendSPNow` (L87-88) is **correct** — it allows `walletState ∈ {active, grace_period}`. So the *only* blocker is the **subscription-status** check at L653, which lists the legacy `'grace'` but not `'grace_period'`.

**Why it broke now:** FIX-Task-51 normalized the single legacy row `'grace' → 'grace_period'` (correctly, to match the widened server allow-list) — and this screen's gate was written against the **legacy spelling**, so normalizing the data silently removed grace users from the subscriber branch. The file is **internally inconsistent**: the sibling gate at `TradeInitiationScreen.tsx:328-331` **does** include both spellings (with a DEV-TASK-66 comment), and `TradeOfferScreen.tsx:363-367` does too — only **L653** does not. This is a **money/points defect + a copy contradiction** (the same screen promises spendability and withholds it).

**Recommended fix:** add `|| subStatus.status === 'grace_period'` (and align `'canceled'`) at `TradeOfferScreen.tsx:653`, mirroring `TradeInitiationScreen.tsx:328-331`.

**Additional candidate sites (grep-identified, NOT individually device-verified — audit, do not assume):**

| File:line | Pattern | Consequence |
|---|---|---|
| `TradeOfferScreen.tsx:653` | `'active' \|\| 'trial' \|\| 'grace'` | **CONFIRMED defect** — SP control withheld (above) |
| `TradeInitiationScreen.tsx:436` | `'active' \|\| 'trial' \|\| 'grace' ? … : 'free'` | a `grace_period` subscriber is labelled **`'free'`** for the offer's fee → wrong fee tier (299 vs 99). **Reachability of this screen NOT verified this round** — flag, don't assert |
| `AuthContext.tsx:813` | `subscriptionStatus === 'grace' \|\|` | gate may treat normalized rows as non-grace |
| `hooks/useAuth.ts:64` | `'free' \|\| 'grace'` | same class |

Correct-by-construction siblings for reference: `TradeInitiationScreen.tsx:328-331`, `TradeOfferScreen.tsx:363-367`, `CartCheckoutScreen.tsx:103`, `usePaymentFailure.ts:53`, `SubscriptionStatusScreen.tsx:71/180`, `UserDashboardScreen.tsx:167/481`, `ProfileScreen.tsx:413`.

**Verdict:** the "full grace-spend path end-to-end" does **not** hold. Entitlement + wallet: correct. **User-reachable spend: impossible.**

---

## 4. SUB-TC-E04 — Subscription Status diagnostics (item 4) → ✅ PASS

Driven via the new dev-only deep link `p2pkidsmarketplace://qa-subscription-status` (FIX-Task-52 item 7d), logged in as `test-buyer` (`E04-01`, `E04-02`).

| Field (UI) | DB | Match |
|---|---|---|
| `ACTIVE` badge | `status='active'` | ✓ |
| Last updated `9/17/2026, 8:09:35 AM` | `updated_at 2026-09-17 12:09:35.607Z` | ✓ (local-time render) |
| Customer ID `cus_Ungj4MptKp9CUg` | `cus_Ungj4MptKp9CUg` | ✓ exact |
| Subscription ID `sub_1To5Vg4I6kCJlvXoebiAvLZJ` | `sub_1To5Vg4I6kCJlvXoebIAvLZJ` | ✓ exact |
| Period Start `8/27/2026, 8:41:17 AM` | `current_period_start 2026-08-27 12:41:17Z` | ✓ |
| Period End `9/27/2026, 8:41:17 AM` | `current_period_end 2026-09-27 12:41:17Z` | ✓ |
| Renews On `9/27/2026, 8:41:17 AM` | `next_billing_date 2026-09-27 12:41:17Z` | ✓ |
| Time Left `10 days remaining` | 9/27 − 9/17 | ✓ |
| Cancelled At `9/17/2026, 6:48:03 AM` | `cancelled_at 2026-09-17 10:48:03.599Z` | ✓ (local-time render) |

**Conditional sections correctly absent** for this persona: retry count (`payment_retry_count=0`), trial (`trial_end_date` past + status `active`), grace (`grace_started_at`/`grace_ends_at` historical). The case's "(if any)" phrasing covers this — **not** a gap. Also surfaces `Manage Billing & Payment` + `Refresh Status`, and no raw/code strings on the surface.

*Observation (LOW, data not screen):* `cancelled_at` renders alongside `ACTIVE` + a future `Renews On`. That is genuine DB residue from the R5/R6 cancel→reactivate cycle (R6 recorded `cancel_reason='too_expensensive'`-era residue), not a screen bug — but on a diagnostics screen a reader may misread it. Optional: label it "Cancelled At (historical)".

---

## 5. Perceived load times (§5.7 — simulator, wall-clock, ±polling precision; not a formal profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Cold dev-client reload → Dev Launcher → Metro row → app Home | ~2 min (cold bundle load) | environment artifact (dev-client cold load), not app behaviour |
| `+ Add Bank Account` → Add Payout Method modal | < 1 s | ok |
| Add Method tap → EF `create-stripe-connect-account` → success alert (spinner shown meanwhile) | ~6 s | **borderline — loading feedback WAS shown** (button spinner), so not a UX finding |
| Alert OK → Chrome opens hosted onboarding | < 2 s | ok |
| `qa-login-as` persona switch | < 5 s | ok |
| `qa-subscription-status` deep link → screen rendered (fresh bundle) | < 3 s | ok |

**No app-attributable transition ≥ 3 s.** The one ~6 s EF call displays a spinner (§6.2 satisfied).

---

## 6. Design & copy compliance (§6.4)

Screens/dialogs reviewed: **Payout Settings** (no-method + verified + unverified states), **Add Payout Method modal**, **success/GlobalAlert dialogs ×2**, **Withdraw-guard NoMethodModal**, **Item Detail**, **Make Offer** (grace), **Subscription Status**, **Dev Launcher**.

- **CONFIRMED:** single primary per dialog; pill-primary styling; `GlobalAlertProvider` in-app dialogs (AX-instrumentable, §5.4 empirical check — **not** native alerts); method card / badge / CTA hierarchy consistent; "Onboarding required" badge + "Continue Onboarding" CTA are a coherent pair; the Add Payout Method modal's option rows + Cancel/Add Method row are on-brand; Subscription Status card stack uses the documented greys/green; no raw error-code or developer strings on any user-facing surface; **no raw support-email surface** observed.
- **DEVIATION (F5):** the withdraw-guard NoMethodModal's copy is wrong for the unverified-method state (says "add and verify" when a method exists) — rewrite proposed in §1.2.
- **DEVIATION (copy accuracy):** the G01 branch-3 alert copy documented in the guide never renders (F4, §1.1).
- **DEVIATION (contradiction):** Make Offer shows "Grace Period Active — You can keep spending existing Swap Points…" **and** the "Join Kids Club+ to save with Swap Points" upsell, with no SP control between them (§3.2).
- ⚠️ **The off-brand-hex sweep was NOT re-run as a clean pass.** R6's R62d full-list grep (≈150 hits / ≈50 files) still has **incomplete liveness triage**; this round's screens rendered on-brand but, per R62d, a design pass is **not** reportable as clean off a partial sweep. Carried forward as an open item.

---

## 7. Environment / tooling notes

### 7.1 ⚠️ Stale-bundle near-miss (R79-1) — the round's most important process lesson

`qa-subscription-status` **no-op'd 3 times** (2 re-fires per R111 + 1 more). Controls proved *both* linking channels alive: the custom-handler sibling **`qa-dev-toggle` fired its arming alert**, custom-handler **`qa-login-as` switched personas**, and the navigator-linked **`sp-history`** navigated. Device-log capture proved **ReactNativeJS forwarding works** (a `[CartContext]` line was captured) while showing **no** `[QaSubscriptionStatusDeepLink]` line at all. Source review found the matcher **byte-identical to dev-toggle's proven matcher**, the route registered (`AppNavigator.tsx:808`) and the handler mounted (`:1141`) in the same block as dev-toggle. Every sign pointed at a broken enablement.

**It was a stale bundle.** After a **cold dev-client reload**, the same link rendered the screen first try.

⇒ **A Metro bundle can be fresh for one edited module and stale for a newly-added one.** The R79-1 discriminator I used ("a FIX-Task-52 copy string rendered on PayoutSettingsScreen") proved *that file* fresh but did **not** prove the **new handler file** was in the loaded bundle. **Do not file a broken-enablement finding without the R79-1 cold reload.**

### 7.2 Other tooling facts

- **`qa:payout-fixture` arg shape:** the subcommand must be **`argv[2]`** (`npm run qa:payout-fixture -- methods --scenario none`); passing `--persona X` first makes it print usage. The persona is **hard-wired** to `qa-payout-seller`.
- **`qa:ensure-cards` does NOT support `test-grace`** (known: `test-buyer, test-free, test-buyer-2, test-buyer-3`) — there is **no sanctioned way to give the grace persona a saved card**, which is what makes §3.2's client gate the *only* remaining blocker to a full wallet-level grace spend.
- **SP caps make a card mandatory for every offer:** `fn_item_effective_sp_cap` is ~40–70 % of item price across all 25 available Accept-SP listings (max observed 17 SP on a $23 item), so `cash_amount_cents > 0` **always** holds and `create-trade-offer`'s `NO_PAYMENT_METHOD` guard (L601, single-item mode: *"A saved payment method is required…"* is returned only when `cash_amount_cents > 0`) always applies. A "$0-cash offer" route to bypass the card is therefore not available in practice.
- **`qa:express-complete` refuses to complete a real-but-unverified account without `--replace`** (BP-71 discipline working as designed) and its refusal message enumerates the exact `requirements.currently_due` — a genuinely useful provider read.
- **R111 reproduced** (first post-`qa-login-as` deep link dropped; the correct response is one re-fire + a sibling control test).
- **R77 #12 extension verified again:** the 2-param `qa-dev-toggle` link needed the device-shell-escaped `\&`.
- **R107 respected:** no AX dump while any screen was loading — the ~2 min cold bundle load was polled with screenshots only.
- **A repeated identical screenshot is not a stall** (§5.9): mid-load screenshots returned an unchanging blank frame while the app was in fact rendering (proved by device logs showing Home RPCs at the same timestamps).

---

## 8. App state left behind

- **`qa-payout-seller` — RESTORED.** Verified method row replaced by `acct_1UGfka43WgHtBC9V` (real, `submitted/payouts/charges=true`, `due=[]`) + balance `$50.00` (5000¢). The G01-drive account `acct_1UGfi533TYJKwVu4` was **deleted** by `--replace`. `acct_1UGO3X3J8Vt0lE5T` remains in Stripe but is no longer referenced by any DB row (test mode, harmless). R7's payout row `e1893558…` + transfer `tr_1UGeom4I6kCJlvXoMOti9yRj` **untouched** (used only as the L03 read-back target).
- **`test-grace` — RESTORED.** SP `available` 0 → **20** → **0** (reverted), wallet **`state='grace_period'` throughout** (never clobbered). Two `sp_ledger` `earn_admin_grant` audit rows (0→20, 20→0) remain as the fixture's audit trail. **No offer/trade row was created** (the spend path never became submittable).
- **`test-buyer` — unchanged** (E04 is read-only). Payout/payout-method/subscription rows untouched.
- **No session-local QA toggles armed** (the `qa-dev-toggle` fire used `value=none`, i.e. a disarm; handler read-back confirmed `none`).
- **No `admin_config` writes** this round.
- **Two rejected webhook POSTs** (invalid signature) — no DB mutation (proven).
- App left **logged in as `test-grace`** on the Make Offer screen; emulator warm; Metro `:8082` left running.

---

## 9. Coverage statement — is SUB now fully Android-covered?

**Practically yes — 1 case remains, and it is a one-line owner enablement action, not untested surface area.**

| Remaining | Status | Exact reason |
|---|---|---|
| **SUB-TC-L05** (positive signed-webhook leg) | 🚫 BLOCKED | **Enablement gap, owner action pending.** `STRIPE_WEBHOOK_SECRET` absent from `.env` AND `.env.staging`. One paste unblocks it; the negative half (L03) is now PASS. **Not** a platform constraint, **not** a product defect. |
| **SUB-TC-F06** (release-timing transition) | 🟡 PARTIAL (carried from R6) | Needs persistent trade/payout rows whose only cleanup is destructive to the restored `qa-payout-seller` fixture + a DB write outside the read-only boundary. **Fixture/scope decision, not untested surface.** |
| **SUB-TC-D06 / D07** | 🚫 by design | Clock fast-forward + real-push fixtures (Fixture-Gated Backlog). |
| **Grace SP *spend*** (FIX-Task-51 leg) | ❌ FAIL | **Not a coverage gap — a live defect** (`TradeOfferScreen.tsx:653`). Fixable in one line. |

**Closed this round (the three named Rounds 6/7 gaps with landed enablers):** E04 ✅ · G01 ✅ · L03 ✅ (+ the grace **entitlement** leg ✅), and the grace **spend** leg was converted from "named gap" into a **root-caused defect**. ⇒ **After this round, every remaining SUB Android item is a named, non-overlapping reason — no case is without a verdict for lack of a fixture except the two by-design entries above.**

Tracker: **SUB 79 PASS / 1 PARTIAL / 2 OPEN / 15 RETIRED / 2 N/A** (§1 roll-up + file header + rows updated in one pass, R52/R56). ⚠️ The **pre-existing 2-row roll-up ⇄ row-set gap persists** (row-level PARTIAL set `{F03, F06, L05}` = 3): carried forward unchanged rather than inventing a reconciliation.

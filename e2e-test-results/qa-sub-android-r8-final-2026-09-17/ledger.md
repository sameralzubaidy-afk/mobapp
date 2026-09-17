# Ledger — SUB Android Round 8 (final closing), 2026-09-17

Execution trace + decision log. Every tool call in order, with the decision that drove it.
Run: `e2e-test-results/qa-sub-android-r8-final-2026-09-17/`. Platform: Android `Medium_Phone_API_36.1` only (R80).

## 0. Recon (desk — no device time)

1. `memory view /memories/` + `qa-test-agent.md` + `qa-sub-android-r6-reverify-2026-09-17.md` + `fix-task-52-2026-09-17.md` + `fix-task-51-can-user-spend-sp-2026-09-17.md` + `manual-testing-guide-canons.md` — established the R6/R7 residual set and FIX-Task-52's enablement claims (R78-1 recon-first).
2. Read `.github/instructions/QA-Test-Agent.instructions.md` (§4–§9) — mandatory pre-run playbook read.
3. `grep` guide for `SUB-TC-(G01|L05|L03|E04)`; read the four case bodies + the Hosted-flow runbook + Group G/M sections.
4. **Read the R7 report in full** → the 4 brief items map exactly onto R7's named leftovers (G01 incomplete clause / L05 signed webhook / grace spend / E04). Confirmed the brief is consistent with tracker state.
5. `ls -1dt e2e-test-results/*/` → `qa-sub-android-r7-remaining-2026-09-17/` confirmed R7 already ran today.
6. `grep .env` for `STRIPE_WEBHOOK_SECRET|STRIPE_QA` → only `STRIPE_QA_READONLY_KEY` present (**and it is an `sk_test_…` SECRET key, so any `qa:stripe-inspect` run is `SECRET_KEY_BREAK_GLASS`**).
7. `grep package.json` for `qa:*` → confirmed `qa:stripe-webhook-replay`, `qa:set-sp-balance`, `qa:payout-fixture`, `qa:express-complete`, `qa:stripe-inspect` all exist.
8. `grep src` for `qa-subscription-status|QaSubscriptionStatus` → handler **registered** (`AppNavigator.tsx:113/1141`) — R42 pre-fire route verification satisfied.
9. **R29 busy check:** `adb devices -l` (emulator attached) · `pgrep -l -f "expo start"` (single Metro on **:8082**) · `adb reverse --list` (8081+8082 forwarded). No other agent session on the device.
10. `mobile_get_foreground_app` → `com.android.chrome` (leftover from R7's hosted-flow attempt).
11. **Tool gating:** `mobile_launch_app` was **disabled** → discovered the mobile toolset is category-gated; activated `mobile_app_management_tools`, `mobile_interaction_tools`, `mobile_screen_management_tools`, and (after `activate_screen_element_interaction_tools` failed) the correctly-named **`activate_screen_element_interaction`** → unlocked `mobile_list_elements_on_screen` + `mobile_long_press_on_screen_at_coordinates`.

## 1. Item 1 — SUB-TC-G01 (incomplete/onboarding clause)

12. Launch app → it restored **Payout Settings as `qa-payout-seller`** (warm, R7's retained route).
13. `SQL`: `seller_payout_methods` platform-wide → **2 rows only** (a non-QA demo account + `qa-payout-seller` `0754defa…`/`acct_1UGO3X3J8Vt0lE5T`, verified). `test-seller` has **0 rows** (R7's H04 precondition) → **do not disturb it**.
14. Read `create-stripe-connect-account/index.ts` L160-320 → the EF looks up **`seller_payout_methods` by user + method_type only**; no row ⇒ `accounts.create()` + insert `is_verified=false, stripe_onboarding_complete=false`. ⇒ **a method-less persona is the exact fixture for the missing clause.**
15. **Fixture:** `npm run qa:payout-fixture -- methods --scenario none` → `✅ Methods replaced: scenario 'none' (0 row(s))`. (First attempt with `--persona …` printed usage: the subcommand is `argv[2]`.)
16. `mobile_save_screenshot` **`G01-00 …STALE-verified-method.png`** — deliberately captured the **pre-change stale frame** (§5.6 stale-frame standard).
17. `adb … payout-settings` deep link → `mobile_take_screenshot` → **`G01-01`**: the re-fetch corrected **TWO** stale fields at once (method card removed **and** hero `$0.00`→`$50.00`) ⇒ **F6**.
18. `mobile_list_elements_on_screen` → `add-bank-row` centre `(540,1264)` → tap.
19. `mobile_take_screenshot` + `mobile_save_screenshot` **`G01-02`** (modal) → tree → `add-method-type-stripe-connect` `(540,913)` → tap → screenshot (`G01-03`, selected) → saved.
20. Tap `add-method-submit` `(760,1655)` → screenshot showed the **button spinner** (loading feedback ✅ §6.2). Polled twice (§5.9 — one repeated frame is not a stall).
21. **Parallel** `mobile_take_screenshot` + `SQL seller_payout_methods` → **`G01-04` success alert** *and* the DB row: `e560e139…` / `acct_1UGfi533TYJKwVu4` / `is_verified=false` / `stripe_onboarding_complete=false` / `is_primary=false`. **UI alert (branch 1) + DB row agree.**
22. Tree → alert is **`GlobalAlertProvider`** (`global-alert-button-0`), not native (§5.4 empirical check) → tap OK `(541,1382)` → screenshot → **Chrome opened `connect.stripe.com/setup/…`** (`G01-05`) ⇒ *"the onboarding flow launches"* ✅. **Did NOT attempt to drive the hosted Stripe pages** (R77 #13 platform constraint).
23. `BACK` → back in the app → polled: first frame showed the **old** method section + a hero spinner, second frame showed **`G01-06`**: card **"Stripe · acct_****wVu4"** + **"Onboarding required"** + **"Continue Onboarding"** ⇒ **the R7-unobservable clause is now DRIVEN.**
24. Tree → `radio-btn-<id>` label **"Cannot set as primary — Onboarding required"**; `method-card-<id>` id = the DB row id; `acct_****wVu4` ⇄ DB `acct_1UGfi533TYJKwVu4` (**exact cross-layer match**).
25. **Withdraw-block hard assertion:** tap `request-payout-btn` `(317,831)` → screenshot + save **`G01-07`** → NoMethodModal *"Payment Method Required / To withdraw your earnings, you need to add and verify a payout method first."* ⇒ *"not usable for withdrawal"* ✅; source of **F5** (copy reused for the unverified-method case).
26. Tree → `no-method-add-btn` surfaced **with** an id while Cancel surfaced as **`ViewGroup label="Cancel"` with no id** → read `PayoutSettingsScreen.tsx:1390-1401` → **both testIDs exist and are identically shaped** ⇒ potential **F7** (flagged UNCONFIRMED at this point — see step 40).
27. Tap Cancel `(540,1495)` → re-list (fresh tree before the next tap) → tap `add-another-method-row` `(540,1611)` → tree (modal) → tap Stripe Connect `(540,913)` → tap Add Method `(760,1655)`.
28. Screenshot + save **`G01-08`** → the **reuse-incomplete** alert: *"You will now be redirected to continue your Stripe onboarding. Note: You may need to re-verify your phone number before continuing."* — **not** the guide's registered branch-3 string ⇒ **F4 candidate**. Also **this string is the fresh-bundle discriminator (R79-1)**: it is a FIX-Task-52 addition, so the `PayoutSettingsScreen` module was current in the loaded bundle.
29. Tree → OK `global-alert-button-0` `(541,1445)` → tap.
30. **Provider layer:** `npm run qa:stripe-inspect -- by-user qa-payout-seller --break-glass-secret-key` → `connect_accounts[0]` = `acct_1UGfi533TYJKwVu4`, **`details_submitted=false`** (a Stripe-only field ⇒ a live provider read, not a DB projection). **3-layer AGREE.**
31. Read `PayoutSettingsScreen.tsx:1570-1645` + grep `resumingOnboarding` + read `:1256-1272` → **F4 root-caused**: L1620 tests `resumingOnboarding` first, and L1264 defines it as *any* stripe_connect method with an account id and `stripe_onboarding_complete === false` — i.e. exactly branch 3's state ⇒ **L1626 (the guide's string) is unreachable for its own state.** (R12 source-confirmation before filing.)
32. `BACK` → foreground check = the app. **Restore:** `npm run qa:express-complete -- create` → refused (correctly) with the **exact `requirements.currently_due` list** (extra "not usable" proof) → `--replace` → **`acct_1UGfka43WgHtBC9V`** created (submitted/payouts/charges all true, `due=[]`) + verified PRIMARY row written; the G01-drive account deleted.
33. `payout-settings` deep link → screenshot + save **`G01-09`** → card **"Verified & Active · acct_****BC9V"** ⇄ the new account ⇒ fixture restored + the *"verified / payouts-enabled"* clause observed.

## 2. Item 2 — webhook legs (L03 / L05)

34. `SQL` the target payout row **before**: `e1893558…` `completed`, gross 700 / net 673, `provider_reference_id tr_1UGeom4I6kCJlvXoMOti9yRj`, `updated_at 13:50:02.746024+00`.
35. `qa:stripe-webhook-replay -- --type payout.failed --payout <ref> --secret whsec_<deliberately wrong>` → **HTTP 400 "No signatures found matching the expected signature for payload."** (a wrong secret is the *correct* fixture for a negative leg and needs no real secret).
36. `SQL` read-back (separate statement, R24) → `status` still `completed`, **`updated_at` had moved to 13:50:02.746024+00** — traced as **~4 min BEFORE the POST**, so not attributable to the webhook; **second POST issued** to isolate the webhook's own effect.
37. POST #2 → same **HTTP 400**; `SQL` read-back → **`updated_at` byte-identical across the POST**, `status='completed'`, user row count **1** ⇒ **zero mutation, airtight. SUB-TC-L03 ✅.** (A `payout.failed` would have flipped the row — the test is discriminating by construction.)
38. `qa:stripe-webhook-replay -- --type payout.paid …` **without** `--secret` → **exit 2** with the tool's remediation ⇒ **SUB-TC-L05 🚫 BLOCKED (enablement, owner action)**, plus a `grep` proving **0 occurrences** of `STRIPE_WEBHOOK_SECRET` in `.env` and `.env.staging`. **No workaround attempted** (per the brief).

## 3. Item 4 — SUB-TC-E04

39. `qa-login-as?persona=test-buyer` → `qa-subscription-status` deep link → screenshot = **still on SP Wallet** ⇒ fired the deep link again (R111 rule 1) → still no navigation. Read `QaSubscriptionStatusDeepLinkHandler.tsx` (target `SubscriptionStatus`) + read `AppNavigator.tsx:1120-1150` (**handler mounted, same block as the working QA handlers**) + control test `sp-history` → **navigated** (R111 rule 2 satisfied) + `qa-dev-toggle` → **its arming alert fired** (custom-listener channel proven via adb) + `grep` device logs while firing → **ReactNativeJS forwarding works** (`[CartContext]` line captured) but **no `[QaSubscriptionStatusDeepLink]` line** ⇒ every signal pointed at a **broken enablement**.
40. **R79-1 discipline applied before filing:** forced a **cold dev-client reload** (`mobile_terminate_app` → `mobile_launch_app` → Dev Launcher → tapped the `10.0.2.2:8082` row → polled with screenshots only, R107) → **re-fired the deep link → the screen rendered immediately** ⇒ **the failure was a STALE BUNDLE, and a false "enablement broken" finding was avoided.** This also reclassified **F7** as UNCONFIRMED (the stale bundle may simply have lacked `no-method-cancel-btn`).
41. `mobile_list_elements_on_screen` on the screen? **No** — captured + saved **`E04-01`/`E04-02`** (top + scrolled) and reconciled **every** displayed field against `SQL subscriptions` ⇒ **all exact**, including the local-time renders.

## 4. Item 3 — grace spend

42. `qa:set-sp-balance -- --persona test-grace --amount 20` → `state=grace_period` **PRESERVED** + `available=20`, but the script printed **`❌ VERIFY FAILED`**.
43. `SQL sp_wallets` → `available_balance=20, reserved_sp=0, state='grace_period'` **exactly as requested** ⇒ **F3 (tooling false negative; DB is authoritative)**.
44. `SQL` items + `fn_item_effective_sp_cap` → caps are **40–70 % of price** (max 17 SP on $23) ⇒ `cash_amount_cents > 0` always ⇒ **a saved card is mandatory for any offer**; `SQL subscriptions` for test-grace → **`stripe_customer_id=null`, `stripe_payment_method_id=null`** (no card).
45. `qa:ensure-cards -- --persona test-grace --dry-run` → **`❌ Unknown persona`** (supports only test-buyer/test-free/test-buyer-2/-3) ⇒ **no sanctioned way to give the grace persona a card.**
46. Read `create-trade-offer` L580-625 → the PM guard applies only when `cash_amount_cents > 0` — but since caps < price, the app always derives cash > 0 ⇒ **no cash-0 bypass**. Grep confirmed `sp_amount` is in SP **points** (1 SP = $1).
47. **Bounded on-device attempt:** `qa-login-as?persona=test-grace` → `listing/c5393d5a…` ($12, 9-SP cap) → screenshot → tree → tap `request-to-buy-button` `(697,2017)` → screenshot of **Make Offer** →
    **the screen renders "Grace Period Active — You can keep spending existing Swap Points…" AND the "Save up to 75% with Swap Points / Join Kids Club+" upsell, with NO SP control.**
48. `grep TradeOfferScreen.tsx` + read the branch table + `grep` the app-wide `'grace'`-only pattern → **root cause: `L653 isSubscriber` lists `'active' | 'trial' | 'grace'` and omits `'grace_period'`** (while the sibling `TradeInitiationScreen.tsx:328-331` includes both) ⇒ the SP branch (L710) is skipped and the `!isSubscriber` upsell (L764) renders. **F1 — grace SP is unspendable in the app** despite the banner and the live server's `can_spend_sp=true`. Also identified `TradeInitiationScreen.tsx:436` as a second same-class site (fee tier) — **reachability NOT verified**.
49. `qa:set-sp-balance -- --persona test-grace --amount 0` → reverted; **the same `❌ VERIFY FAILED` reproduced** ⇒ F3 confirmed reproducible.

## 5. Close-out

50. Tracker updated in place (R52/R56) in ONE pass: rows **E04**, **G01**, **L03**, **L05** + the **§1 roll-up** SUB row + the **file-header totals** + a dated **Round 8** round note. Roll-up delta: **PASS 78→79, PARTIAL 2→1** (E04's overall was already PASS; L03's was already PASS — only G01 changes the counts). The **pre-existing 2-row roll-up ⇄ row-set gap is carried forward unchanged** and disclosed in the round note rather than papered over.
51. `report.md` + this ledger written; §8.3 handoff emitted verbatim in the final chat reply (§8.4/R53).

## Tool-call tally (manual — transcript not mineable per R71-fallback)

~120 terminal/SQL/memory/file calls + ~95 device-mcp calls ≈ **~215 total for 6 verdict items** (≈ 36/item, dominated by the G01 three-layer drive, the E04 stale-bundle investigation (~10 calls that a fresh-bundle-first order would have avoided), and the grace-spend root-cause chain). **Zero device calls were spent re-discovering a documented blocker.**

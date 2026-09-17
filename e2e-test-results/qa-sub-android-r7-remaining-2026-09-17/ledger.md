# Ledger — SUB Android Round 7 (2026-09-17)

Platform: Android `Medium_Phone_API_36.1` (emulator-5554) · Metro `:8082` (single instance) · iOS not driven.
Approx. 150 tool executions for 15 verdicts. Desk-recon (~25) separated from device-execution per R71-fallback framing.

## Environment / pre-flight

| Step | Result |
|---|---|
| `adb devices -l` | `emulator-5554 device` |
| `pgrep -f "expo start\|maestro\|run-suite\|playwright\|expo run:android\|metro"` | one leftover `playwright test-server` for `p2p-kids-admin` (idle, not needing the admin portal); Metro on `:8082` |
| `lsof -iTCP:8081 -iTCP:8082 -sTCP:LISTEN` | **only `:8082`** → single Metro instance (R63a OK) |
| `adb reverse --list` | 8081/8082/19000/19001 mapped |
| R29 busy check | device free (no Maestro / run-suite / agent process) |
| Cold relaunch | terminate + launch → Dev Launcher → tapped `10.0.2.2:8082` row (AX: `@e34` centre **540,561**) → Home rendered |

## Read-only DB precondition pass (before any device driving — §4 / R78-2)

1. `information_schema.columns` for `subscriptions`/`billing_history`/`seller_payout_methods`/`seller_balance`/`sp_wallets`/`sp_ledger` — one query, no column guessing.
2. **FIX-Task-51 grant check** — `has_function_privilege()` for the 7 SP/subscription functions → **all true** for `authenticated`/`anon`/`service_role`.
3. `admin_config` → `minimum_withdrawal_amount_cents = 200`, `grace_period_days = 30`, `pending_sp_release_days = 3`.
4. Persona state → `test-grace` (grace_period/grace_period, SP 0, grace_ends 2026-11-09) · `test-buyer` (active, 458 SP, reserved 0, 1 failed + 3 succeeded `billing_history`) · `test-free` (0 `billing_history`) · `test-seller` (18 `requires_action` + 1 `failed` payouts, **0 methods**, balance $909.40) · `qa-payout-seller` (1 verified primary method `0754defa`, balance $50.00).
5. `reserved_sp > 0` platform-wide → **0** ⇒ I07's positive leg had no fixture.

**Outcome:** this pass predicted the whole round's shape (5 of 5 execution surprises pre-empted) — the §4 read-only-precondition rule paid for itself again.

## P1 — grace SP spendable (FIX-Task-51 device leg)

| Step | Action | Outcome |
|---|---|---|
| 1 | `qa-login-as?persona=test-grace` (adb `am start`) | avatar → **"TG"** |
| 2 | deep link `sp-wallet` | Grace banner: *"You can keep spending existing Swap Points, but you won't earn new ones until you renew."* + hero 0 SP |
| 3 | AX tree → `qa:ax-tree --list` | `Sp wallet shop/sell/history btn` + earn rows; **no frozen element** |
| 4 | `fn_get_sp_entitlement` (LATERAL, 4 personas) | grace **true/false**; buyer true/true; expired false/false; free false/false |
| 5 | `qa:ef-repro --ef create-trade-offer` as `test-grace` | `MISSING_ITEM_ID` → `INVALID_AMOUNT` → `NO_PAYMENT_METHOD` (**3 calls**) |
| 6 | **source read** `create-trade-offer` L575-660 + L396-440 | PM check **L601**; `resolveSpRedemption` **called at L754** ⇒ **inference RETRACTED** |
| 7 | Confirm `test-grace` has no PM / no customer | `stripe_payment_method_id` NULL ⇒ the EF could not have mutated |

## test-buyer — E01, E03, I07, J04

| Step | Action | Outcome |
|---|---|---|
| 8 | `create-trade-offer` as test-buyer (`item_id` + `cash_amount_cents` + `payment_method_id` in `--body`) | trade `7312c94b…` pending, 5 SP, $10.00; `reserved_sp = 5`, available 458→453 |
| 9 | `sp-wallet` | hero **453** + **"Reserved in trades — 5 SP"** → **I07 positive PASS** |
| 10 | `sp-history` | top = `Spend Purchase −5 SP 9/17 8:42 AM` |
| 11 | `trade/7312c94b…` deep link → scroll (R31) → `cancel-trade-button` → reason modal → "Changed mind" → confirm | modal IDs `cancellation-reason-changed_mind`, `cancel-trade-confirm-button` (disabled→enabled); DB: `cancelled`, reason **"Changed mind"**, `reserved_sp` 5→**0**, available 453→**458** |
| 12 | `sp-history` → stale top → **pull-to-refresh** | top → **"Earn Refund · 9/17 8:44 AM · +5 SP"** → **J04 PASS** |
| 13 | `sp-wallet` (cold) | hero **458**, **no Reserved card** → **I07 negative PASS** |
| 14 | `billing-history` | 4/4 records DB-exact + FAILED badge + `error_message` verbatim → **E01/E03 PASS** |

⚠️ Checked `cleanup-test-trades.ts` first: it cancels by **raw status UPDATE** ⇒ would **not** have fired the SP
refund (false J04). Used the real app path instead.

## test-free — E02

| Step | Action | Outcome |
|---|---|---|
| 15 | `qa-login-as` test-free → `billing-history` | grey receipt + **"No billing history yet."**, 0 rows → **E02 PASS** |

## test-seller — G06, G10, H04

| Step | Action | Outcome |
|---|---|---|
| 16 | `payout-settings` | hero $909.40 / $1177.60 / $2087.00 DB-exact; "18 payouts need a payout method"; rows "Action Required" |
| 17 | tap `history-action-3cf40764…` (300,1873) | **"Add Payout Method"** modal (Stripe Connect/PayPal/Venmo) → **G06 PASS** |
| 18 | `add-method-cancel` → `request-payout-btn` (317,831) | **"Payment Method Required"** modal, exact copy → **H04 PASS** |
| 19 | scroll ×2 → `grep` the saved tree for `load-more-button` | found at y1950–2085 (R105: grep the raw capture) → tap → hint **"5 of them" → "10 of them"** = **+5** |
| 20 | 2 × MCP swipe-down (no reset) → **`adb shell input swipe … 800`** | hint reset to **"5 of them"** → **G10 PASS** (both clauses) |

## qa-payout-seller — G07, H01, H06, H07, G01, L05

| Step | Action | Outcome |
|---|---|---|
| 21 | `qa:payout-fixture balance --amount 0` | H01 setup |
| 22 | `qa-login-as` qa-payout-seller → `payout-settings` (**dropped**, R111) → re-fire | screen OK |
| 23 | tap `request-payout-btn` | **"No Balance / You have no available balance to withdraw"** (`global-alert-button-0`) → **H01 PASS** |
| 24 | kebab `kebab-btn-…` (959,1444) → `sheet-edit-details` | **"Edit Details"** alert, copy verbatim → **G07 PASS** |
| 25 | `qa:admin-config-set … --value 1000 --data-type number` | floor $10 (read-back verified) |
| 26 | `qa:payout-fixture balance --amount 700` + adb pull-to-refresh | hero **$7.00** |
| 27 | Withdraw Now → modal | summary **$7.00 / −$0.27 / $6.73** + method Stripe (`acct_****lE5T`); **no amount field** |
| 28 | `withdraw-confirm` (760,1631) | **"Withdrawal Failed / Minimum withdrawal amount is $10.00"** → **H06 PASS**; DB: 0 rows, balance 700 unchanged; **test-seller still 19** |
| 29 | floor → 0; cancel modal; refresh; reopen; confirm | **"Withdrawal Requested … $7.00 … receive $6.73"** → **H07 PASS** |
| 30 | DB read-back | row `e1893558…` **completed**, gross 700 / fee 27 / **net 673**, `provider_reference_id = tr_1UGeom4I6kCJlvXoMOti9yRj` |
| 31 | `qa:stripe-inspect -- transfer tr_… --account acct_…` | **404** → diagnosed as a **read-scope artifact** (not a divergence); re-read **without** `--account` |
| 32 | provider read (platform scope) | amount **673**, destination **acct_1UGO3X3J8Vt0lE5T**, `livemode:false`, `metadata.payout_id` = DB row ⇒ **3-layer PASS** |
| 33 | pull-to-refresh | row **Processing → Completed** + "Stripe fee: $0.27" + `payout-history-end` |
| 34 | `add-another-method-row` → Stripe Connect → Add Method | **"Success / Stripe account created!…"** → **Chrome → `connect.stripe.com/setup/…`** |
| 35 | DB + `qa:stripe-inspect -- by-user` | methods **1**, Connect accounts **1** (pre-existing verified) ⇒ **G01 PARTIAL** + the over-claiming copy finding (writer `PayoutSettingsScreen.tsx:1512-1515`) |

## Cleanup / final state (DB-verified in one query)

`qps_methods 1` · `qps_balance 5000` · `qps_payouts 1` · `ts_payouts 19` · `tb_reserved_sp 0` · `tb_sp 458` ·
`min_withdrawal "200"` · trade `7312c94b…` **cancelled**.

## Rules exercised / extended

- **Extended:** R77 #14 (adb slow-drag swipe is required for Android RefreshControl) · R59 (Payout Settings is a
  known-stale-after-backend-change screen) · R5 contested (`view_image` worked) · §5.31 reversal (`WithdrawModal` IS
  AX-exposed on this build).
- **Applied:** R31 (pill-band occlusion — cancel button), R111 (dropped first deep link), R103 (true-bottom before
  absence claims), R105 (grep the raw AX capture by absolute path), R100 (name the writer before filing), R24
  (re-read before concluding), R13/R80 (named gaps), R52 (tracker update), R53 (verbatim handoff).
- **Self-caught near-miss recorded on purpose:** the retracted EF-gate inference (step 6) — caught by source-reading
  the call site. Counted as a *prevented* false PASS, not a defect.

# Ledger — SUB Android Round 4 (Payout Withdrawal Family)

Run folder: `e2e-test-results/qa-sub-android-r4-payout-2026-09-16/`
Platform: Android `Medium_Phone_API_36.1` (emulator-5554) · 1080×2400 · AX coords == px
Personas: `qa-payout-seller` only. Persona switches: 0.

---

## Phase 0 — recon & feasibility (R78-1 / R78-2 / R63)

| # | Step | Outcome |
|---|---|---|
| 1 | Playbook + `/memories/repo/qa-sub-android-r3-2026-09-16` + `qa-fix37-verify-sub-android2a` re-read | Round-3 facts absorbed; `qa-payout-seller` known live |
| 2 | `adb devices -l` | `emulator-5554` attached/healthy |
| 3 | `pgrep -f "expo start"` | **1** Metro instance (R63a ✓) |
| 4 | `.env` backend check | **staging** (`drntwgporzabmxdqykrp`) → concurrent local `supabase db reset` harmless |
| 5 | `qa:start-state -- qa-payout-seller` | fixture **unchanged since Round 3** (5000¢, verified `acct_1UGKzW3uefDqBl4z`, 0 payouts) |
| 6 | `seller_payout_methods` survey, all personas | **only 2 sellers have methods; both 1× verified primary** → no multi-/unverified-method state anywhere |
| 7 | `qa:payout-fixture` source read | `methods` = **delete-then-replace**, writes **fake** `acct_dt118_fixture*` ids → would retire the live row |
| 8 | Restore-path check (`create-stripe-connect-account` source) | EF is idempotent **only while the row exists** → **exact account-id restore impossible** |
| 9 | Flagged trade-off to owner | owner requested best-coverage recommendation → **Option 1 approved** |

**Decision:** bank live-fixture cases first → run scenarios → restore a *real* verified method.

## Phase 1 — live fixture (non-destructive)

| Step | Action | Result |
|---|---|---|
| 1 | `qa-login-as?persona=qa-payout-seller` | "Good afternoon, QA" + active-subscriber SP strip ✓ |
| 2 | `payout-settings` deep link | loaded; hero **3/3 DB-exact** ($50.00 / $0.00 / $50.00); method `acct_****Bl4z` "Verified & Active"; "No payouts yet" |
| 3 | AX tree → `request-payout-btn` @ (317,725) | coords == px |
| 4 | **H05+H02** tap hero → modal | "Withdraw Funds" · $50.00 · fee **-$0.38** · net **$49.62** · Stripe (acct_****Bl4z) · no amount field |
| 5 | Fee rule source check | `Math.round(5000*0.0025)+25 = 38` → **UI == source exactly** |
| 6 | **H03** tap `withdraw-confirm` @ (760,1631) | alert **"Withdrawal Requested"** / exact guide copy |
| 7 | DB read-back | `seller_payouts 007c5dfa…` 5000/38/4962 **`completed`** `tr_1UGNwF4I6kCJlvXoE0isogoI`; balance 5000→0 |
| 8 | Provider read (`--break-glass-secret-key`) | `transfer` amount **4962** = DB net; destination `acct_…Bl4z`; `metadata.payout_id` = DB row id → **3-layer AGREE** |
| 9 | **G08(a)** kebab → sheet → Delete Method | **"Cannot Delete Primary Method"** / exact copy |
| 10 | UI post-confirm | hero → **$0.00**; history row `$49.62 · Completed · "Stripe fee: $0.38"`; `Load More` appears |

## Phase 2 — method-state scenarios

| Step | Action | Result |
|---|---|---|
| 11 | `methods --scenario two` + pull-to-refresh | 2 verified methods (`re_a` primary, `re_b` non-primary) — one primary indicator |
| 12 | **G04 set-primary:** tap non-primary radio | **"Success / Primary payout method updated"**; highlight moved; **DB flip confirmed** |
| 13 | **G04 delete:** kebab → Delete → confirm | **"Delete Payout Method / Are you sure … (acct_****re_a)?"** → **"Deleted"** → list + DB both show 1 method |
| 14 | **G08(b):** re-seed `two` → kebab on **primary** → Delete | **identical "Cannot Delete Primary Method"** ✓ |
| 15 | `methods --scenario single-unverified` + `balance --amount 5000` | badge **"Onboarding required"** + "Continue Onboarding" CTA |
| 16 | **G09(a):** tap unverified radio | **"Cannot Set as Primary"** / exact `{status_message}` copy |
| 17 | **G09(b):** kebab → sheet | set-primary row **disabled/grey** + subtext **"Verification required before setting as primary"** |
| 18 | **G05:** hero → modal → Confirm | **"Withdrawal Failed"** / **friendly** copy (not raw RPC string) |
| 19 | G05 DB closure | `payout_rows` **unchanged at 1** (no new row) · balance **5000 unchanged** · `verified_methods` 0 |

## Phase 3 — restore

| Step | Command | Result |
|---|---|---|
| 20 | `qa:payout-fixture -- reset` | methods/payouts cleared; balance reconciled → 0 |
| 21 | `qa:express-complete -- create --persona qa-payout-seller --replace` | **real** Express test account `acct_1UGO3X3J8Vt0lE5T` (submitted/payouts/charges true, `due=[]`) + verified PRIMARY row |
| 22 | `qa:payout-fixture -- balance --amount 5000` | $50.00 restored |
| 23 | `qa:start-state` + DB verify | balance 5000¢ · 1 verified primary method · **payout_rows 0** ✓ |
| 24 | Device refresh | $50.00 / `acct_****lE5T` "Verified & Active" / "No payouts yet" |

---

## Findings

| ID | Sev | Summary |
|---|---|---|
| **F1** | LOW-MED | `historyFeeNote` `marginTop:-12` overlaps the `PAYOUT HISTORY` header (measured 21 px overlap); only when payouts exist. Source-confirmed. |
| **F2** | MED | A **real Stripe test Transfer IS minted** for manual withdrawals — falsifies the `qa:payout-fixture` docstring + the iOS H03 note ("never mints a real transfer"). |
| **F3** | LOW | Doc-drift: H03's recorded row state (`processing`, no provider ref) is stale — live is `completed` with a provider ref. |
| **F4** | LOW | Doc-drift: guide H03 says the payout shows as **PENDING**; live renders **Completed**. |
| **F5** | LOW | G04 "Cannot Delete Only Method" unreachable (primary guard first) — source-verified, matches iOS, not a defect. |
| **F6** | INFO | `WithdrawModal` buttons ARE AX-exposed on Android (iOS note says pixel-scan required). |

## Tracker deltas

- **Android column `—` → `✅ PASS (Android)`** for: SUB-TC-**H02, H03, H05, G04, G05, G08, G09** (7 rows).
- Per-case **Status** unchanged (all were already ✅ PASS on iOS) ⇒ **§1 roll-up counts unchanged** (PASS 78 · PARTIAL 2 · OPEN 2 · DRIFT 0 · SKIPPED 0 · RETIRED 15 · N/A 2 · Remaining 0).
- Round note added to the SUB section; F02's note flagged for a one-line account-id refresh.

## Tooling facts (reuse)

- mobile-mcp Android device id = **AVD name** (`Medium_Phone_API_36.1`), **not** the adb serial; `mobile_list_available_devices` was disabled.
- `mobile_open_url` = http(s) only → deep links via `adb shell am start` (R77 #5).
- Workspace-scoped grep returns **empty** for the chat-session-resource AX capture (file is outside the workspace) → grep the **absolute path** in the terminal.
- Payout Settings: **pull-to-refresh** is a reliable stale-state discard after external fixture writes.
- `qa:stripe-inspect`: `transfer <id>` works; `key_scope=SECRET_KEY_BREAK_GLASS` required (F3 — read-only key still not provisioned).

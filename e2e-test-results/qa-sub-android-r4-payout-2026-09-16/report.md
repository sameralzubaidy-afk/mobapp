# QA Task — SUB Android Round 4: Payout Withdrawal Family

**Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
**Platform:** Android `Medium_Phone_API_36.1` (emulator-5554), 1080×2400 (AX tree coords == px, R77 #1)
**Date:** 2026-09-16 · **Persona:** `qa-payout-seller` (`a1234567-0000-0000-0000-0000000000f2`)
**Scope:** H02, H03, H05, G04, G05, G08, G09
**Result:** **7 PASS · 0 FAIL · 0 PARTIAL · 0 BLOCKED** — first Android verdicts for all 7 cases.

---

## 0. Step 0 — reconciliation (standing rule)

`npm run qa:start-state -- qa-payout-seller` at session start:

```
balance  avail 5000¢ · pending 0¢ · lifetime 5000¢ · trades 0
method   stripe_connect PRIMARY verified=true onboard=true payouts=true acct=acct_1UGKzW3uefDqBl4z
connect  acct_1UGKzW3uefDqBl4z submitted=true payouts=true charges=true due=[] disabled=—
billing  0 row(s)
```

**Nothing had changed since Round 3** — the fixture was exactly as Round 3's handoff left it (untouched, no withdrawal driven). The Step-0 precondition held.

### Fixture-feasibility gate (R78-2) — a scope correction worth recording

The brief's premise was that `qa-payout-seller` "unblocks this entire family" per Round 3. **Round 3's actual claim was narrower** — it named only *"the whole G/H withdraw family (H02/H03/H05)"*. A live survey of `seller_payout_methods` across **all of staging** showed:

| Persona | Methods | State |
|---|---|---|
| `qa-payout-seller` | 1 | `stripe_connect` PRIMARY **verified** `acct_1UGKzW3uefDqBl4z` |
| `seller2bob.demo@example.com` | 1 | `stripe_connect` PRIMARY **verified** `acct_1TqgWD4BuYEBpSwh` |

That is the **entire table** — **no seller anywhere in staging has 2 methods or an unverified method.** So H02/H03/H05/G08 were drivable on the live fixture as-is, but **G04/G05/G09 needed method states that did not exist**. Creating them required `qa:payout-fixture -- methods`, which is **delete-then-replace** and writes **fake** `acct_dt118_fixture*` ids — i.e. it retires the live verified Connect row.

**Flagged to the owner before proceeding** (per the brief's Explicit Note), with the trade-off stated; owner asked for the best-coverage recommendation and approved. **Chosen: Option 1 (full coverage)** — bank the live-fixture cases first, then run the scenarios, then restore a *real* verified Connect method. Rationale in §5 (finding F2/F5 area) and §7.

### Fixture-safety determination for H03 (brief's explicit flag condition)

**Not blocked.** Source + tooling check confirmed:
- `request_seller_payout` is documented as *"never mints a real outgoing transfer"*, and
- the balance is restorable via `qa:payout-fixture -- balance --amount <cents>`.

⚠️ **However, that documented safety property turned out to be FALSE — a real Stripe test Transfer WAS minted. See finding F2.**

---

## 1. Verdict roll-up

| TC-ID | Case | Verdict (Android) | Evidence basis |
|---|---|---|---|
| **H02** | WithdrawModal summary — Available / Payout Fee / You'll Receive | ✅ **PASS** | UI + source fee rule; **3-layer** |
| **H03** | Confirm Withdrawal success | ✅ **PASS** | UI + DB + **Provider**; **3-layer** |
| **H05** | Withdraw Now from Payout Settings hero | ✅ **PASS** | UI (hero → modal → confirmation); **3-layer** |
| **G04** | Set primary method / delete method (confirmation) | ✅ **PASS** | UI + DB (both limbs) |
| **G05** | Unverified method blocks payout | ✅ **PASS** | UI + DB (friendly copy; 0 rows, balance unchanged) |
| **G08** | "Cannot Delete Primary/Only Method" guard | ✅ **PASS** | UI ×2 (only-method + multi-method) + source guard-order |
| **G09** | "Cannot Set as Primary" (unverified) guard | ✅ **PASS** | UI ×2 (radio alert + sheet disabled + subtext) + source |

**7 PASS / 0 FAIL / 0 PARTIAL / 0 BLOCKED.**

> **All 7 were already ✅ PASS on iOS**, but **every one carried `—` in the tracker's Android column**. This round supplies the **Android** verdicts (R80: a platform-qualified verdict is not satisfied by the other platform's PASS).

### Execution batching (R82)
H02+H03+H05 were read off **one** genuine flow (hero tap → modal → confirm) rather than three fresh drives.

---

## 2. 3-layer money verification — H02 / H03 / H05

> **U-D-P:** UI → DB → Provider. `STRIPE_QA_READONLY_KEY` remains an `sk_test_…` **secret** (F3), so provider reads required `--break-glass-secret-key` and are labelled **`key_scope=SECRET_KEY_BREAK_GLASS`** — **not** quotable as restricted read-only evidence.

### H02 — WithdrawModal summary (fee + net)

| Layer | Evidence |
|---|---|
| **UI** | "Withdraw Funds" · Available Balance **$50.00** · "Payout processing fee (Stripe): **-$0.38**" · footnote *"This is the fee your payout provider (Stripe) charges to send the transfer; Pass It Up charges no withdrawal fee."* · You'll Receive **$49.62** · Payout Method **Stripe (acct_****Bl4z)** · **no amount-entry field** |
| **DB** | `seller_balance.available_balance_cents = 5000` (=$50.00) |
| **Provider** | N/A at this step (no object yet) — the fee is computed client-side |

**Fee rule verified against source** (`src/services/sellerBalance.ts:320`):
```js
case 'stripe_connect':
  // Stripe: $0.25 + 0.25%
  return Math.round(amountCents * 0.0025) + 25;
```
`Math.round(5000 × 0.0025) + 25` = `13 + 25` = **38¢ → $0.38**; net `5000 − 38` = **4962¢ → $49.62**. **UI == source rule, exactly**, and the guide's *"Stripe: $0.25 + 0.25%"* formula matches the code verbatim.

### H03 — Confirm Withdrawal success — **3 layers AGREE**

| Layer | Evidence |
|---|---|
| **UI** | Alert **"Withdrawal Requested"** / *"Your withdrawal of $50.00 has been initiated. After fees, you will receive $49.62."* (exact guide copy) → modal closes → hero **$50.00 → $0.00** (Lifetime Earned unchanged at $50.00) → PAYOUT HISTORY row **$49.62 · Sep 16, 2026 · Completed · "Stripe fee: $0.38"** + `Load More` appears |
| **DB** | `seller_payouts 007c5dfa-537d-4b16-9478-26513a313d16`: gross **5000** / `payout_fee_cents` **38** / net **4962** / status **`completed`** / `provider` stripe / **`trade_id` NULL** / `provider_reference_id` **`tr_1UGNwF4I6kCJlvXoE0isogoI`** / `payout_method_id` → the primary method · `seller_balance.available` **5000 → 0**, lifetime unchanged **5000** |
| **Provider** | `transfer tr_1UGNwF4I6kCJlvXoE0isogoI`: amount **4962** = DB net ✓ · `destination` **`acct_1UGKzW3uefDqBl4z`** = the DB method's account ✓ · `livemode: false` ✓ · `reversed: false`, `amount_reversed: 0` · `metadata.payout_id` = **the DB row id `007c5dfa…`** ✓ · `metadata.method_id` = the DB method id ✓ · `metadata.user_id` = persona ✓ · `metadata.source: "manual_withdrawal"` |

**Verdict: AGREE** — all three layers agree on **amount (4962)**, **destination (`acct_…Bl4z`)**, and **identity** (`payout_id` ↔ row id, `method_id` ↔ method row). No DB↔Stripe disagreement.

### H05 — Withdraw Now hero entry point

| Layer | Evidence |
|---|---|
| **UI** | Hero `request-payout-btn` → **WithdrawModal opens** (same flow as H02/H03) → Confirm → **"Withdrawal Requested"** confirmation |
| **DB / Provider** | Identical to H03 — same drive (R82), same row, same transfer object |

The guide's H05 negative legs (no balance → "No Balance"; no method → no-method guard) were **not re-driven here** — they are H01's and H04's assertions, H04 already holding an Android PASS from Round 1. Named in §6.

---

## 3. Per-case detail

### G04 — Set primary / delete method (two-method scenario)
- **Pre-state:** `methods --scenario two` → `cfb933fc…` (acct_****re_b, non-primary) + `b9d14182…` (acct_****re_a, primary), **both verified** — also evidencing the guide's *"Exactly one method is marked primary (highlighted)"* limb (only one filled check rendered).
- **Set primary:** tapped the non-primary radio → alert **"Success / Primary payout method updated"** → **highlight moved** (filled check on `re_b`, empty radio on `re_a`) → **DB: `cfb933fc… is_primary=true`, `b9d14182… is_primary=false`** — exactly one primary.
- **Sheet label tracks state:** the primary's sheet showed **"Currently Primary"**; the non-primary's showed **"Set as Primary"**.
- **Delete:** kebab on non-primary → Delete Method → confirm dialog **"Delete Payout Method / Are you sure you want to remove Stripe (acct_****re_a)?"** with **Cancel** + a correctly-styled **red destructive Delete** → **"Deleted / Payout method removed successfully."** → list shows only `re_b` → **DB: only `cfb933fc…` remains.**

### G05 — Unverified method blocks payout
- **Pre-state:** `methods --scenario single-unverified` (+ `balance --amount 5000`), rendering badge **"Onboarding required"** on `acct_****_unv` + a **"Continue Onboarding"** CTA.
- **Drive:** Withdraw Now → WithdrawModal opens (Payout Method: **Stripe (acct_****_unv)**) → Confirm → alert **"Withdrawal Failed"** / **"Your payout method isn't verified yet. Please finish verifying it before withdrawing."**
- This is the **DT-119 item-4 friendly-copy fix, verified live on Android** (previously the raw RPC string "Primary payout method is not verified").
- **DB closure:** `seller_payouts` count **1 (unchanged — H03's row only, no new row)**, `available_balance_cents` **5000 (unchanged)**, `verified_methods` **0**.

### G08 — "Cannot Delete Primary/Only Method" guard
- **Limb (a) only-method-is-primary:** 1 method, primary → sheet → Delete Method → **"Cannot Delete Primary Method / Please set another method as primary first, then delete this one."** (exact guide copy)
- **Limb (b) primary + another method:** re-seeded `two` → kebab on the **primary** → Delete Method → **identical alert** ✓
- **"Cannot Delete Only Method" copy:** **source-verified as unreachable when the only method is primary.** Guard order in `PayoutSettingsScreen.tsx` is unambiguous — `if (method.is_primary)` (≈L889) returns **before** `if (methods.length <= 1)` (≈L900). Reaching that copy needs a single method with `is_primary=false`, which **no fixture scenario can produce** (`none`/`single-verified`/`single-unverified`/`two`/`mixed` all either have 0, 1-primary, or ≥2 rows). Recorded as source-verified, matching the iOS note — **not a defect.**

### G09 — "Cannot Set as Primary" (unverified) guard
- **Limb (a) radio:** tapping the unverified method's radio → **"Cannot Set as Primary"** / *`This method has status "Onboarding required". Please wait until it is verified before setting it as primary.`* — **exact guide copy** with `{status_message}` substituted.
- **Limb (b) sheet option disabled:** sheet source has `disabled={isUnverifiedStatus}` on `sheet-set-primary` plus a conditional subtext. Live drive: the row rendered **greyed/disabled** with the subtext **"Verification required before setting as primary"** while Edit Details / Delete Method stayed enabled (correct — only set-primary is gated).
- **Nuance recorded:** because the fixture's unverified row is *also* primary, its label read "Currently Primary" rather than "Set as Primary" (`isPrimary ? … : …`). The **disabled styling + subtext** are the assertions, and both held.

---

## 4. Design-system compliance

- **Off-brand hex sweep (R62d full list) run on the rendered Payout Settings surfaces** — no `#4A7C59`/`#4D4D4D`/`#808080`, no Material palette, no iOS system blue observed on: hero card, method cards, bottom sheet, WithdrawModal, alerts, payout-history row.
- **Alert styling on-brand:** `GlobalAlertProvider` OK pill renders canonical primary green `#5DBB8E`; the delete confirmation's destructive **Delete** renders the danger red family while **Cancel** uses the outline/green treatment — correct semantic pairing.
- **WithdrawModal** primary **Confirm Withdrawal** = solid `#5DBB8E`; **Cancel** = outline. One primary per surface ✓ (R62e#3).
- **History row:** completed = green `CheckCircle` + green "Completed" status; fee line in tertiary grey. Consistent with the canonical mapping.
- **DEVIATION FOUND — see finding F1** (PAYOUT HISTORY header overlapped by the history fee note). This is a **layout** deviation, not a colour one.
- Note: the "Continue Onboarding" full-width CTA on the unverified method is solid primary green — **legitimately the single primary action** on that state.

---

## 5. Findings

### F1 — LOW-MED · Layout: "PAYOUT HISTORY" section header is overlapped by the history fee note
**Source-confirmed, deterministic, 100% reproducible.**

`PayoutSettingsScreen.tsx` styles:
```js
sectionLabel:    { fontSize: 11, fontWeight: '600', color: '#999999', marginBottom: 4, marginTop: 4 },
historyFeeNote:  { fontSize: 11, color: '#999999', marginTop: -12, marginBottom: 12 },
```
`historyFeeNote` carries a **negative top margin (`-12`)** while `sectionLabel` reserves only **`marginBottom: 4`** → the fee note is pulled up over the header.

**Measured on-device (AX geometry, px):**
- header `PAYOUT HISTORY` = `{x:52, y:1462, w:975, h:39}` → occupies y **1462–1501**
- `payout-history-fee-note` = `{x:52, y:1480, w:975, h:73}` → occupies y **1480–1553**
- **Overlap = y 1480–1501 (21 px)**, both at x=52 → the text physically collides.

**Trigger proven:** the fee note is rendered only when `recentPayouts.length > 0` (`{recentPayouts.length > 0 && (<Text testID="payout-history-fee-note">`). Corroborated in-session: with 0 payouts the header renders **clean**; with 1+ payout it is **struck through** by the note.

**Fix:** give `historyFeeNote` a non-negative top margin (e.g. `marginTop: 0`) or move the note below the header block. Single-line style fix.

*Evidence:* `screenshots/07-H03-post-confirm-payout-settings.png`, `08-G08-method-sheet.png`, `10-G04-two-methods-after-refresh.png`, `26-final-restored-settled.png` (clean, 0 payouts).

### F2 — MED · A real Stripe Transfer IS minted for manual withdrawals (documented safety property is false)
`qa:payout-fixture`'s own docstring states:
> *"`withdraw` uses request_seller_payout which checks DB is_verified/is_primary only — **it never mints a real outgoing transfer**, which is exactly the safety QA needs."*

and the iOS H03 tracker note records *"**No real transfer minted (synthetic-account boundary)**"*.

**Both are wrong on the current build.** This round's manual withdrawal produced `provider_reference_id = tr_1UGNwF4I6kCJlvXoE0isogoI`, confirmed at Stripe as a real `transfer` object: `amount 4962`, `destination acct_1UGKzW3uefDqBl4z`, `livemode: false`, `reversed: false`, `metadata.source: "manual_withdrawal"`.

**Impact:** a manual withdrawal now **dispatches to the provider** — i.e. it is no longer a DB-only operation. In **test mode** this is synthetic and reversible (`reversed:false`, `amount_reversed:0` — a reversal is available), so no live funds are at risk. But the *documented* safety model that Payout-Settings fixture work relies on no longer holds, which matters for any future round that treats a withdrawal as a cheap DB-only fixture.
**Also:** the row lands as **`completed`**, not `processing` (see F3).

*Evidence:* `npm run qa:stripe-inspect -- transfer tr_1UGNwF4I6kCJlvXoE0isogoI --break-glass-secret-key` (break-glass-labelled).

### F3 — LOW · Doc-drift: H03's recorded payout-row state is stale
The tracker's H03 note records the iOS row as *"gross 500 / payout_fee 26 / net 474 / **processing** / provider stripe / trade_id NULL"* with **no** provider reference. The live Android row is **`completed`** and **carries a provider reference**. Any assertion that "a manual withdrawal leaves a `processing` row with no provider object" is now false.

### F4 — LOW · Doc-drift: guide says the payout appears as **PENDING**, live shows **Completed**
Guide H03 Expected Result: *"the payout appears as **PENDING** in PAYOUT HISTORY."* Live Android renders the row with a **Completed** status and a green check. Consistent with F2/F3 (the transfer dispatched and completed), so the guide text describes a pre-dispatch world. Recommend updating the guide's H03 wording (or the code's status mapping) — **QA-side doc finding, not a defect.**

### F5 — LOW · G04 "only method" copy is unreachable — documented, not a defect
Restates the iOS note with independent source re-verification: `Cannot Delete Only Method` cannot fire while the only method is primary, because the primary guard returns first. No fixture scenario can produce a single non-primary method. **No action needed** beyond keeping the note.

### F6 — INFO · Platform distinction: `WithdrawModal` buttons ARE AX-exposed on Android
The tracker's QA-Task-33 note states *"Payout Settings `WithdrawModal` buttons are **NOT AX-exposed** (pixel-scan required)."* On this **Android** build they **are**: `withdraw-confirm`, `withdraw-cancel` and `withdraw-fee-note` all surfaced in the AX tree with valid coordinates, and every modal/sheet/alert in this round (`sheet-delete-method`, `sheet-set-primary`, `global-alert-button-0/1`) was **AX-drivable** — **zero pixel-scans were needed.** Recorded as a per-platform (and per-build, §5.31) distinction so future Android rounds don't pre-emptively reach for pixel-scanning.

---

## 6. Known gaps / not tested

| Gap | Reason |
|---|---|
| **G08 "Cannot Delete Only Method" copy** | Unreachable by construction (primary guard first) *and* unproducible by any fixture scenario. Source-verified; matches iOS. |
| **H05 negative legs** (no-balance / no-method) | Belong to H01 / H04 (H04 already Android-PASS, Round 1). Not re-driven. |
| **H02 fee leg for PayPal/Venmo** (`2% capped at $20`) | The primary method is Stripe; no PayPal method exists in staging to make primary (G09 correctly *prevents* setting an unverified one). Source-verified only (`Math.min(Math.round(cents*0.02), 2000)`). |
| **G05's RPC-side raw error string** | The friendly copy was asserted at the UI; the underlying RPC `action_required='verify_payout_method'` was read from source, not from the EF response. |
| **H01 / H06 / H07 / G06 / G07 / G10 / G11 / F-family** | Out of this round's scope (already PASS on iOS; several already Android-PASS). |
| **`minimum_withdrawal_amount_cents` interaction with G05** | Not exercised — the unverified guard fires regardless of the floor. |

---

## 7. App state left behind

**`qa-payout-seller` was fully restored to its documented baseline** (verified against `qa:start-state` + DB after the run):

| Property | Before (Step 0) | After (verified) |
|---|---|---|
| Balance | `avail 5000¢` / pending 0 / lifetime 5000 | **`avail 5000¢` / pending 0 / lifetime 5000** ✓ |
| Method | 1 × `stripe_connect` PRIMARY verified `acct_1UGKzW3uefDqBl4z` | **1 × `stripe_connect` PRIMARY verified `acct_1UGO3X3J8Vt0lE5T`** ⚠️ id changed |
| Connect | `submitted=true payouts=true charges=true due=[]` | **identical** ✓ |
| Payout rows | 0 | **0** ✓ (`payout_rows=0`, `method_rows=1`, `verified_primary_rows=1`) |
| On-device | — | hero $50.00 / method "Verified & Active" / "No payouts yet" |

⚠️ **The one unrecoverable change:** `acct_1UGKzW3uefDqBl4z` is **retired**. Restoring an *exact* account id was verified impossible — `create-stripe-connect-account` only returns an existing account if the DB row still exists (the row was replaced), and both restorer scripts (`qa:express-complete`, `dev-task-124-verify-manual-payout`) mint **new** Stripe accounts. The replacement is an equally **real, fully verified** Express test account, so the fixture's capability is intact.

**Consequence for the tracker:** Round 3's **F02 note cites `acct_****Bl4z`**. F02's *verdict* is unaffected — its assertion is "the method section renders the **existing** method (card + Verified & Active + primary radio + Add Another Method), not the empty add-row", which the new account satisfies identically. **Only F02's note needs a one-line id refresh — no re-drive owed.** This round incidentally re-confirmed F02's "with method" limb on the live build before the swap.

**Residue created and cleaned:** 1 × `seller_payouts` row (H03) — removed by `qa:payout-fixture -- reset` (verified `payout_rows=0`).
**Other personas touched:** none. **App left signed in as `qa-payout-seller` on Payout Settings (restored state).**

---

## 8. Environment / tooling notes

- **R29 busy check:** one Metro instance (`npm run start:single` wrapper); app targets **staging** (`drntwgporb…`), so a **concurrent local `supabase db reset`** was correctly harmless.
- **Device identifier gotcha (new):** the mobile-mcp server does **not** accept the adb serial (`emulator-5554`) — `Device "emulator-5554" not found`. The working id is the **AVD name**, `Medium_Phone_API_36.1`. `mobile_list_available_devices` is **disabled** in this session, so the id had to be found by probing. **Recorded for future Android rounds.**
- **`mobile_open_url` rejects non-http schemes** (`Only http:// and https:// URLs are allowed`) — deep links must go via `adb shell am start` (R77 #5). Single-param fragments were used throughout (no `&` escaping needed).
- **Round 3's "first deep link after `qa-login-as` is dropped" friction did NOT reproduce** this session — the payout-settings deep link landed first try.
- **Pull-to-refresh works reliably on Payout Settings** and was the correct way to discard stale fixture state after each external write (R59) — a cheap alternative to a cold relaunch.
- `grep` on the **chat-session-resource AX capture** must target the **absolute path** (the file lives outside the workspace, so workspace-scoped grep returns empty) — R105's format/capture caveat, plus this path trap.

---

## 9. Perceived load times

> **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.** Measured via batched delay-step polling (§5.3/§5.7).

| Transition | Elapsed | ≥3s flag | Loading feedback |
|---|---|---|---|
| `payout-settings` deep link → loaded content | **~2–3 s** | No (borderline) | ✅ `LoadingSpinner` shown |
| Hero "Withdraw Now" → WithdrawModal | **<1.5 s** | No | none needed |
| Confirm Withdrawal → "Withdrawal Requested" | **<1.5 s** | No | Confirm button shows an `ActivityIndicator` while `withdrawing` |
| Kebab → method bottom sheet | **<1 s** | No | none needed |
| Set primary → "Success" | **<1 s** | No | none needed |
| Pull-to-refresh → updated list | **~1.5–2 s** | No | ✅ refresh spinner captured mid-flight |

**No transition met the ≥3s UX-finding threshold.** The deep-link→content time (~2–3 s) is the slowest and is spinner-covered.

---

## 10. Suggested next session

1. **SUB Android backlog sweep** — Groups A–F and the I/J/K/L/N remnants still carry `—` in the Android column (e.g. F01/F03/F04, A05, C-series, D-series). Round 1–3 covered Groups I/J/K/L/M/N; **Group F (payout history figures/list) and Groups A–D (subscription screens) are the largest remaining Android gaps.**
2. **Re-verify F02's note** (one-line id refresh only — the new account is `acct_1UGO3X3J8Vt0lE5T`).
3. **H01 / H06 / H07 Android legs** — all three are cheap on this fixture: H01 needs balance 0 (current state after a withdrawal), H06 needs `balance --amount 150` (below the 200¢ floor), H07 needs one `qa:admin-config-set` scope-write of `minimum_withdrawal_amount_cents` 200→0 + revert.
4. **G06 / G10 / G11 Android legs** — G06 needs a `requires_action` payout (present in volume for `test-seller`: 85 rows); G10 needs >5 payouts; G11 needs `methods --scenario none` + balance.
5. **Decide whether F1's one-line style fix ships** (it is a trivial, low-risk change).

---

## 11. Suggested improvements to agent rules

1. **A device-id resolution rule for mobile-mcp on Android.** The id is the **AVD name**, not the adb serial, and `mobile_list_available_devices` may be disabled — `pgrep`/`adb devices` cannot tell you the right string. One probe-round cost ~5 calls this session. Suggest documenting `Medium_Phone_API_36.1` (and the probe order: AVD name → serial → device property) in §5.68 R77.
2. **Extend §5.68 R77 with the workspace-grep trap for AX captures:** the chat-session-resource file lives **outside** the workspace, so a workspace-scoped grep silently returns empty — which R105's discipline would read as *"possibly absence"*. R105 should say explicitly: **grep the absolute path via the terminal**, never a workspace-scoped search.
3. **A fixture-inventory pre-flight for payout/method-state cases (extends R78-2 / R-NEW-6):** the round started from a brief premise ("this fixture unblocks the whole G/H family") that a single `seller_payout_methods` survey falsified for 3 of 7 cases. Suggest making a **one-query method/balance inventory across all QA personas** the standing gate before any payout-family round is accepted.
4. **A "documented fixture safety property" verification note (new, sibling of R100):** the fixture docstring and a prior round's tracker note both asserted a safety invariant ("never mints a real transfer") that the live system contradicts. Suggest the same *"name the writer / verify the claim"* discipline R100 applies to columns be applied to **fixture docstrings' safety claims** — cheap to check at the provider layer, and it directly changes what a round is allowed to assume.
5. **Trailing rule merge reminder:** R62d supersedes R62b's 3-hex sweep list (flagged 2026-09-13) — still coexisting, still worth merging.

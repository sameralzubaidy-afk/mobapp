# QA Task 43L — Group L + Full AUTH Closure & Reconciliation — 2026-09-08

**Run folder:** `e2e-test-results/qa-task43l-group-l-auth-reconcile-2026-09-08/`
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Platform:** Android Emulator (`Medium_Phone_API_36.1`, emulator-5554) + real admin-portal session (desktop browser `:3001`)
**LLM:** DeepSeek V4 Flash · Agent-Improvement-1 (R78) + R79-1 cold-reload discipline applied.
**Mobile HEAD:** `08cd458c` (# FIX-Task-5 — committed, clean tree) — fresh bundle loaded from Metro `:8081` (R79-1: cold relaunch → Expo Dev Launcher → 8081 row → Landing confirmed).
**Verdict roll-up (Part 1):** **6 PASS** (L01, L02, L03, L04 + J10 typed-OTP completion leg) · **0 FAIL** · **0 BLOCKED** · S08/S11-Case2 deferred (corrected reason, not "harness absent").
**Part 2 (reconciliation):** **99 / 138 AUTH rows have a genuine on-file Android verdict** — see §3.

---

## 1. Executive summary

- **Group L (L01–L04) fully PASSed on Android** for the first time (previously deferred across 43b–43g as a mixed-surface admin+mobile unit). Real admin approval of the staged fixture item `73670a8f` (`QA Dev Fixture Item`, $20, accepts-SP, test-seller) + real mobile legs on both buyer and seller personas + DB read-backs throughout.
- **J10 completion leg fully closed on Android at committed HEAD `08cd458c`** with the **genuine typed-OTP user path** (43h had verified the chain via the dev-autofill button, which carries the F1 double-item artifact). The typed path fired the auto-verify exactly once → **one** pending item (no duplicate) → the residual F1 nuance is confirmed not to affect real users.
- **S08 / S11-Case2 deferred** — but with a **corrected reason**: the reset-link minting harness **EXISTS and is live** (source-verified in `supabase/functions/admin-trigger-password-reset/index.ts`; documented live since 2026-08-16; S08/S11 were PASSed on iOS via it in Phase 16 and the 2026-08-23 calibration round). The 43c–43g "absence of a reset-link minting harness" reason is **stale/inaccurate** (flagged as a reconciliation discrepancy). Android closure additionally needs (a) verification of fragment-bearing deep-link delivery on Android and (b) a shared-persona password mutation + reset-back — a dedicated session's work (R40/R41 discipline), not attempted here to avoid risking test-free/test-buyer (both in active cross-round use).

---

## 2. Part 1 — Group L (L01–L04) + J10 + S08/S11-Case2

### Preconditions (DB-verified before device time — R78-2/R-NEW-6)

| Item | Verified state |
|---|---|
| Fixture item `73670a8f-b911-4c81-8542-4e15a997992f` | `QA Dev Fixture Item`, **pending**, $20.00, `accepts_swap_points=true`, `approved_at NULL`, seller = test-seller (`14be337c…`, node Norwalk Central), created 2026-09-08 11:07Z |
| Seller listing landscape | Exactly **1 pending** under test-seller; **0 available** items titled "QA Dev Fixture Item" → a buyer title-search cleanly distinguishes the anchor (0 → 1 → 0 across L01/L02/L04) |
| Personas | test-seller / test-buyer / test-free all in Norwalk Central (`550e8400…`); test-seller all in-app notification channels ON |
| Admin portal | Started fresh on `:3001` (was down at recon); logged in as the documented staging admin |

### AUTH-TC-L01 · New listing not visible until approved — ✅ PASS (Android)

- **Buyer leg (test-buyer):** Discover search `QA Dev Fixture Item` → **No Results Found** (empty state) while item pending. Evidence `L01-android-buyer-search-pending-no-results.png`.
- **Seller leg (test-seller):** My Listings → top card `QA Dev Fixture Item` with **PENDING** tag + "Awaiting approval — this item is under review and will go live once approved. You'll be notified when it's ready." Evidence `L01-android-seller-mylistings-pending.png`.
- DB cross-check: item still `pending`, 0 available matches → the search-zero is genuine, not a query artifact (query entered clean; stylus-handwriting tutorial disabled system-wide mid-run, see §7 tooling).

### AUTH-TC-L02 · Admin approves → item becomes visible — ✅ PASS (Android + real admin)

- **Admin leg (real portal, :3001):** `/listings` → filtered Pending → located the `73670a8f` row → **Actions → Listing Details** → "✅ Approve Listing" → Admin-notes step → **Confirm Approval** → native alert **"Listing approved! Starter Pack awarded to seller."** (accepted). Evidence `L02-admin-approve-clicked.png`, `L02-admin-approve-confirmed.png`.
- **DB read-back:** item `73670a8f` → `status=available`, `approved_at=2026-09-08 15:00:56Z`.
- **Mobile buyer leg (test-buyer):** Discover search `QA Dev Fixture Item` → **"1 result · near CT"** (the approved item). Evidence `L02-android-buyer-search-approved-1-result.png`.
- **Seller own-view:** My Listings "Active" 25→**26**; item shows **ACTIVE**. (captured in the L04 pre-edit screenshot context)
- R55 note: admin approve + mobile buyer/seller legs driven same-session on the SAME fixture.

### AUTH-TC-L03 · Seller receives approval notification — ✅ PASS (Android, in-app)

- **DB:** `user_notifications` row `1ecb29ce` — type `listing_approved`, title **"Listing Approved"**, body **"Your listing \"QA Dev Fixture Item\" was approved and your Starter Pack reward has been applied."**, `data.deep_link=/listing/73670a8f…`, created 15:00:56Z, read_at NULL. (Also a `sp_earned` "+10 SP Earned!" starter-pack row — SP 2199→2209 on the seller Home.)
- **Mobile (test-seller):** Notification Center (bell, badge **1**) → "Listing Approved" row → **tap** → **Item Detail** screen for `QA Dev Fixture Item` ($20, Books, Swap Points Eligible). Evidence `L03-android-seller-home-bell-badge.png` + `L03-android-seller-notification-deeplink-itemdetail.png`.
- **DB read-back:** notification `1ecb29ce` `read_at` = 15:03:24Z (set on tap). Push leg out of scope per the standing no-push rule — in-app confirmed.

### AUTH-TC-L04 · Editing an approved listing returns to pending — ✅ PASS (Android)

- **Mobile (test-seller):** My Listings → the ACTIVE `QA Dev Fixture Item` → pencil **Edit** (`listing-edit-73670a8f…`) → Edit Listing → price **20 → 25** (CTRL+A select-all + type replace, R77 #4) → scroll to **Save Changes** (`edit-listing-save-button`) → tap → in-app modal **"Changes Saved / Your listing was updated successfully."** (`edit-listing-success-ok`) → Done. Evidence `L04-android-edit-price25-save-button.png`.
- **DB read-back:** item `73670a8f` → `status=pending`, `price=25.00`, `approved_at=NULL` (cleared), `updated_at=15:06:39Z`.
- **Seller own-view:** My Listings → **PENDING** + `$25.00` + "Awaiting approval…" (Active 26→25). Evidence `L04-android-seller-mylistings-pending-25.png`.
- **Buyer leg (test-buyer):** Discover search `QA Dev Fixture Item` → **No Results Found** again (dropped from buyer-visible feed). Evidence `L04-android-buyer-search-pending-again-no-results.png`.

### AUTH-TC-J10 · Phone-verification gate before publish — Completion leg (typed OTP) — ✅ PASS (Android, committed HEAD)

**FIX-Task-5 status:** LANDED + COMMITTED (`08cd458c`, "# FIX-Task-5 — J10 Listing Phone-Gate Modal: Wrong Phone Prefill"). The brief's J10 item is fully satisfied.

43h verified the J10 chain on Android at the same code state (uncommitted then) using the **dev-autofill** button (which carries the F1 double-verify artifact → duplicate items). This round drove the **genuine typed-OTP user path** at the committed HEAD on a fresh bundle:

| # | Assertion | Result | Evidence |
|---|---|---|---|
| 1 | Phone-unverified persona (test-free, phone `5551234004`, `phone_verified_at NULL` — gate fires) | ✅ | DB pre-check |
| 2 | Submit for Review → gate modal fires | ✅ "Verify Your Phone" | `J10-android-gate-modal-prefill-correct-number.png` |
| 3 | **Modal prefills the real number** `+15551234004` (NOT the old `+1 (555) 123-4567` placeholder) | ✅ AX `listing-phone-verification-phone-input` value = `+15551234004` | same |
| 4 | Send Code **enabled + fires** → OTP step | ✅ "We sent a 6-digit code to +15551234004" | (OTP step captured) |
| 5 | **Type the code 123456** (not dev-autofill) → auto-verify fires ONCE → publish resumes | ✅ "Submitting Item For Review…" → "Thanks for submitting!" | `J10-android-typed-otp-success-submitted.png` |
| 6 | Exactly **one** item created (no F1 duplicate) | ✅ single row `356c46b5` (pending, $20) at 15:12:14Z | DB |
| 7 | `phone_verified_at` set | ✅ 15:12:10Z, method `sms` | DB |
| 8 | **test-free restored to baseline** (phone_verified=true, phone_verified_at=NULL, method NULL) | ✅ | DB read-back |

→ The typed-OTP path confirms: single auto-verify fire = single item; the F1 duplicate is confined to the QA-only dev-autofill button. **J10 = full PASS on Android including the real user path** (tracker row already PASS from 43h; this round strengthens the Android leg to the typed path).

### AUTH-TC-S08 + AUTH-TC-S11 Case 2 — NOT ATTEMPTED — deferred with a corrected reason

Per the brief: "attempt only if newly unblocked… check whether this harness now exists (source-read or ask)." **Source-read result:** the reset-link minting harness **exists and is intact** — `supabase/functions/admin-trigger-password-reset/index.ts` carries the QA `email`/`return_link` params + the `APP_ENV=staging|development` fail-closed gate; the registry (`/memories/repo/qa-test-accounts.md`) documents it **live since 2026-08-16**, and S08 + S11-Case2 were PASSed on **iOS** via it (Phase 16, 2026-08-16; tracker rows dated 2026-08-23).

**Deferral reason (explicit, corrected):** the harness is NOT newly available this round (unchanged since August) and therefore S08/S11-Case2 are not "newly unblocked" in the sense the brief conditions on. A first Android execution additionally requires (a) proving fragment-bearing reset deep-link delivery on Android (never attempted on this platform; iOS requires warm delivery from a mounted screen) and (b) a **shared-persona password mutation** (S08 actor = test-free) with reset-back discipline — the brief explicitly warns against risking a shared persona's password when the newness precondition is not met, and test-free/test-buyer are in active cross-round use. Recommend a **dedicated S-closeout session on Android** (mirroring Phase 16's dedicated iOS S-closeout) with the harness minting verified live first.

**Reconciliation note:** the recurring "blocked on the absence of a reset-link minting harness" reason across 43c–43g is **stale/inaccurate** — flag in §3 discrepancies.

---

## 3. Part 2 — Full AUTH Android reconciliation (PRIMARY DELIVERABLE)

### Method

The AUTH guide's canonical Test Case Index carries **138 rows** (A8+B12+C7+D3+E5+F6+G6+H7+I3+J15+K6+L4+M10+N4+O5+P19+Q7+S11 = 138). Each row was classified against **on-file Android execution records** from the 43-series run folders (43a–43h — each round's `report.md`/`ledger.md` read directly, plus this round's Group L/J10 evidence) and the canonical status tracker `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`. A row has an **Android verdict** only when an actual Android run (43b/43c/43d/43e/43f/43g/43h-Android-leg/43L) recorded PASS/PARTIAL/FAIL/BLOCKED for it. iOS-era PASSes (Phase 13–26, qa-task41/43-v3) are **NOT** Android verdicts and are so flagged.

### Definitive per-group table

Legend — **✓Android**: has a genuine on-file Android verdict (last-verified round). **Excluded**: not a gap (dead/REMOVED or config-pending 43a-exec-owned). **No Android verdict**: iOS-only PASS on record or never attempted on Android → real remaining Android backlog unless stated otherwise.

| Group | Total | Android-verified rows (round last verified) | Android-confirmed count | Excluded (not gaps) | No Android verdict (reason) |
|---|---|---|---|---|---|
| **A** Signup | 8 | A01–A08 (43b; A06 re-ver 43c/d/e) | **8** | — | — |
| **B** Login/Session | 12 | B01–B12 (43b; B01-incomplete leg 43f) | **12** | — | — |
| **C** Social | 7 | C03 (43e pre-check PASS — real-Apple leg env-blocked), C05 (43d/e), C06 (43c) — all PASS | **3** | C01/C02/C04 (Android **BLOCKED** 43c — external-OAuth toolset, permanent), C07 (Android **BLOCKED** 43c — ticket #19) | — |
| **D** Logout | 3 | D01–D03 (43b/43c) | **3** | — | — |
| **E** Phone Verify | 5 | E01/E02/E03 (43b/43c/43d) | **3** | — | E04 (rate-limit induction — iOS PASS 2026-08-24), E05 (not separately driven as E05 — **same phone-gate mechanism Android-verified via J10** 43h/43L) |
| **F** Node/ZIP | 6 | F01/F05/F06 (43c) | **3** | — | F02/F03/F04 (fresh-signup inactive-ZIP legs — iOS PASS 2026-08-23) |
| **G** Node mgmt (Admin) | 6 | — | **0** | — | G01–G06 (admin-portal node CRUD — canonical PASS 2026-08-23 via live admin, iOS-era; no Android-specific mobile leg owed/run) |
| **H** Profile/Onboard | 7 | H01/H02/H03 (43b/43c/43d) PASS, H06 PARTIAL (43b — Get-Started leg PASS, **Skip leg never Android-run**), H07 (43b) PASS | **5** (4 PASS + 1 PARTIAL) | H04/H05 (REMOVED dead) | — |
| **I** Sub Choice | 3 | — | **0** | I01–I03 (REMOVED dead) | — |
| **J** Listing (Single) | 15 | J01/J03/J04/J06/J08/J09 (43f), J02/J07/J11/J12/J13 (43g), J10 (43h+43L typed) — PASS; J05 PARTIAL (43f — blocked-submit leg source-verified only, Android field-clear limitation) | **13** (12 PASS + 1 PARTIAL) | J14/J15 (config-pending, 43a-exec-owned) | — |
| **K** Bulk | 6 | K01–K06 (43g) | **6** | — | — |
| **L** Admin Review | 4 | **L01–L04 (43L — THIS ROUND)** | **4** | — | — |
| **M** Discover Search | 10 | M01–M10 (43c) | **10** | — | — |
| **N** Category/Fav | 4 | N02/N03/N04 (43c) | **3** | N01 (config-pending, 43a-exec-owned) | — |
| **O** Node Scope/SP | 5 | O01/O02 (43c/43d/43e), O03 (43c), O04 (43c+43f free leg) | **4** | O05 (config-pending, 43a-exec-owned) | — |
| **P** Header/Nav/Composer | 19 | P04 (43b) | **1** | — | P01/P02/P03/P05–P19 (18 — Home/header/composer/trades surface; canonical iOS PASS 2026-08-23 group-p-full-run; P03 iOS PASS 43-v3; not in the Android rounds' brief scope) |
| **Q** Trading Education | 7 | Q01–Q07 (43f) | **7** | — | — |
| **S** Password Recovery | 11 | S02/S06/S07/S09/S10 (43c) PASS, S03/S04/S05 (43d) PASS, S01 PARTIAL (43c — delivery leg env-blocked #15), S11 PARTIAL (43c — Case1+3 PASS, Case2 deferred) | **10** (8 PASS + 2 PARTIAL) | — | S08 (reset-success leg — iOS PASS via harness 2026-08-16/23; Android needs harness mint + fragment delivery + shared-persona reset-back, dedicated) |
| **TOTAL** | **138** | | **99** | **9** (5 REMOVED + 4 config-pending) | **30** |

**Bottom line: 99 of AUTH's 138 rows (71.7%) have a real on-file Android verdict.** 9 are excluded dispositions (5 dead-screen REMOVED + 4 config-pending 43a-exec-owned = H04/H05/I01–I03 + J14/J15/N01/O05). **30 rows have no Android verdict** — these are the genuine remaining Android backlog (every one already has a platform-agnostic verdict on record, almost all iOS PASS):

1. **E04** — OTP rate-limit induction (needs a dedicated number or the dev toggle, per 43c/43f).
2. **E05** — not separately driven on Android as its own row; the phone-gate mechanism IS Android-verified via J10 (43h/43L). Residual is only the E05-id-specific execution.
3. **F02/F03/F04** — inactive-ZIP waitlist consent/fallback legs (each needs a fresh signup entering an inactive ZIP; iOS PASS 2026-08-23).
4. **G01–G06** — admin-portal node CRUD (admin surface; canonical live-admin PASS 2026-08-23; no Android-specific mobile leg).
5. **P01/P02/P03/P05–P19 (18)** — Home header/nav/composer/Trades/badges surface (canonical iOS PASS 2026-08-23; P03 iOS PASS 2026-09-07; deliberately out of the Android rounds' brief scope).
6. **S08** — reset-success → Login leg (iOS PASS via the harness; Android closure needs the harness + Android fragment-delivery + shared-persona reset-back — dedicated session).
   (S11-Case2 = same S08 dependency; S11 row is Android-PARTIAL with Case 1+3 PASS.)

### Discrepancies found (round-to-round vs this audit — flagged explicitly)

| # | Discrepancy | Detail |
|---|---|---|
| D1 | **43g's "near-full closure" understated the Android-unexecuted set** | 43g reported "only S08/S11-Case2 + config-pending would remain." The per-row audit shows **30 rows** (not 3) lack an Android verdict — Groups G (6) and most of Group P (18) plus E04/E05/F02–F04/S08 were treated as closed on their iOS PASSes without Android verdicts. Not wrong per se (many are iOS-PASS / admin-surface), but the round-to-round "closure" framing did not disclose the 30-row no-Android-verdict set. |
| D2 | **S08/S11-Case2 "absence of a reset-link minting harness" reason is STALE** | The harness has existed + been live since 2026-08-16 (registry, source-verified this round) and S08/S11 were iOS-PASSed via it (Phase 16 + 2026-08-23). The 43c–43g repeated reason misstates the blocker; the true Android blockers are fragment-delivery verification + shared-persona reset discipline. |
| D3 | **Tracker header inconsistency (R56)** | `QA-TESTCASE-STATUS-2026-09-03.md`: AUTH section header = PASS **128**/PARTIAL **1**/… but §1 per-guide roll-up = PASS **127**/PARTIAL **2**. The section header (updated through 43g/43h) is the newer truth; §1 table is stale. |
| D4 | **43c internal count inconsistency** | 43c report claims 27 PASS / 10 BLOCKED but its own enumerated table totals 29 PASS / 9 BLOCKED (29+4+9+1 = 43, matching its "~43 executed" claim). |
| D5 | **43b B01 ledger-vs-report conflict** | 43b ledger marks B01 `PARTIAL` (and H06) but its report counts B01 in the 25-PASS list with H06 as the only PARTIAL. Resolved by 43f closing B01's incomplete-onboarding leg → B01 full PASS. |
| D6 | **C03 tracker row stale vs 43e on-device PASS** | Tracker C03 row = 🔴 STILL OPEN (2026-08-16, env-blocked). 43e Item 1 PASSed the friendly Apple pre-check banner on BOTH platforms on-device (43d's raw-JSON FAIL closed). The row should reflect "PASS for the drivable pre-check surface; real-Apple-sign-in leg env-blocked (#14)" rather than a bare OPEN. |
| D7 | **J10 trajectory** | 43g PARTIAL-Android (Send Code not firing + placeholder prefill) → 43h PASS (FIX-Task-5, dev-autofill leg) → **43L PASS (typed-OTP leg)**. Tracker correctly reflects PASS; this round adds the real-user-path confirmation. |

---

## 4. Perceived load-time table

Simulator/emulator wall-clock, ±polling precision — no formal profile. **No app transition ≥ 3 s** (cold-bundle dev-client loads excluded as environment artifacts).

| Transition | Platform | Elapsed | Flagged? |
|---|---|---|---|
| Discover search → results (debounce) | Android | ~1–2 s | no |
| Admin Approve → native success alert | Admin web | ~2 s | no |
| Notification bell → Notification Center | Android | <1 s | no |
| Notification tap → Item Detail deep link | Android | ~1 s | no |
| Save Changes → "Changes Saved" modal | Android | ~1–2 s | no |
| Submit for Review → phone-gate modal | Android | <1 s | no |
| Send Code → OTP step | Android | ~1–2 s | no |
| Typed OTP verify → "Submitting…" → Thanks | Android | ~2 s | no |

---

## 5. Design-system & copy compliance (three-layer UX review)

- **Group L surfaces:** My Listings PENDING badge (yellow `#FFB020`-family on pale yellow — matches the listing-status token family), awaiting-approval info box (light-yellow, consistent with warning tokens); Edit Listing form + green `Save Changes` pill (primary `#5DBB8E`); "Changes Saved" success modal green checkmark + green Done pill — all consistent with `design-system-passitup.md`. No off-brand hexes observed on any rendered Group-L/J10 surface (canonical palette: primary green, warning amber, gray text).
- **J10 phone-gate modal:** "Verify Your Phone" + E.164-pre-filled field + solid-green Send Code — clean, no raw strings. OTP step shows the friendly "We sent a 6-digit code to +15551234004" + DEV-mode helper (dev-only).
- **Admin approval flow:** native browser alert "Listing approved! Starter Pack awarded to seller." — clear user-facing copy.
- No machine/system strings observed on any driven surface this round (R58 clean for this scope).
- R62b app-wide off-brand hex grep not re-run this round (no screens with styling changes driven beyond the already-audited Listing/Edit/Discover surfaces; Group-L surfaces use canonical tokens as above).

---

## 6. Evidence (screenshots in `screenshots/`)

| File | Description |
|---|---|
| `L01-android-buyer-search-pending-no-results.png` | test-buyer search → No Results (item pending) |
| `L01-android-seller-mylistings-pending.png` | test-seller My Listings → PENDING + awaiting-approval |
| `L02-admin-approve-clicked.png` | Admin listing-details Approve step |
| `L02-admin-approve-confirmed.png` | Admin approval confirmed (before native alert) |
| `L02-android-buyer-search-approved-1-result.png` | test-buyer search → "1 result" (approved live) |
| `L03-android-seller-home-bell-badge.png` | Seller Home bell badge 1 + SP 2209 |
| `L03-android-seller-notification-deeplink-itemdetail.png` | Notification tap → Item Detail deep link |
| `L04-android-edit-price25-save-button.png` | Edit Listing price 25 + Save Changes |
| `L04-android-seller-mylistings-pending-25.png` | Seller My Listings → PENDING $25 |
| `L04-android-buyer-search-pending-again-no-results.png` | test-buyer search → No Results again |
| `J10-android-gate-modal-prefill-correct-number.png` | Phone-gate modal prefilled `+15551234004` |
| `J10-android-typed-otp-success-submitted.png` | Typed-OTP verify → "Thanks for submitting!" |

---

## 7. Tooling / session notes

- **Gboard "Try out your stylus" handwriting tutorial** recurred on every field focus (43g/43h-known) and **swallowed/intercepted typed text** — this round eliminated it by setting `adb shell settings put secure stylus_handwriting_enabled 0` (reversible emulator setting). After that, all text entry was clean. Recommend recording this as a standing Android emulator fix for future rounds.
- **uiautomator "no XML content"** transient after the OTP-step transition (R77 #3) — recovered on the 3rd list attempt; not a hang.
- Admin portal was down at recon; restarted fresh on `:3001` (Next.js). Used the documented staging admin login.
- Android AX reports physical px 1:1 with screenshots; all coordinate taps used current-tree bounding-box centers (R78-6).

---

## 8. State left behind / residue (for cleanup)

- **test-seller:** item `73670a8f` left **pending at $25.00** (correct L04 end-state — awaiting re-approval; will show in any future admin pending review + needs re-approval to relist). 2 pre-existing drafts (`0b0063e2`, `dd3dbdde`). test-seller's SP 2199→2209 (+10 starter pack from the L02 approval) — expected side effect.
- **test-free:** 1 NEW pending item `356c46b5` (this round's typed-OTP J10 leg, single) + 4 pre-existing F1-duplicate pending items (43h: 672de115/6ccd02ce/d53c99a9/eb818d86). test-free **restored to baseline** (phone_verified=true, phone_verified_at=NULL, method=NULL).
- **Admin :3001** still running (shared-session pattern). **Mobile app** left logged out (Landing).
- No config writes/toggles this round. No code modified.

---

## 9. Friction & follow-ups (dev, execution-only recommendations)

1. **FIX-Task-5 F1 residual (already filed via 43h):** the `__DEV__`-only "Dev: Autofill & Verify (123456)" button double-fires verify → duplicate items. Typed path confirmed clean; recommend guarding the dev button (`isVerifying` dedupe) so future QA runs stop producing duplicates.
2. **S08/S11-Case2 Android closure** — dedicated session: verify the harness mint live, prove Android fragment-deep-link delivery (warm), then drive the reset with a shared-persona reset-back plan (or a disposable password-mutable persona). Correct the stale "harness absent" reason in any future deferral.
3. **H06 Skip leg (Android)** — the onboarding-carousel Skip leg was never Android-run (43b PARTIAL). Cheap to close in a future session with a fresh signup.
4. **E04/F02–F04/P01–P03/P05–P19 Android** — decide whether these need Android re-verification (all iOS-PASS) or are accepted as iOS-verified + admin-surface; if owed, they form the real remaining Android backlog (28 mobile-executable rows + G06 admin + S08).

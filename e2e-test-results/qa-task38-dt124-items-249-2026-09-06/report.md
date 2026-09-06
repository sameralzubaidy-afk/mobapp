# QA Task 38 — Dev Task 124 On-Device Verification (Items 2, 4, 9) + First R63–R76 Run

**Date:** 2026-09-06 · **Project:** staging `drntwgporzabmxdqykrp` · **Device:** iOS Sim iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1) · Mobile HEAD 8b1d1294 (DT123) + DT124 mobile code (items 2/4/9) · Admin portal :3001 live (not needed this round).
**Run folder:** `e2e-test-results/qa-task38-dt124-items-249-2026-09-06/`
**Scope:** DT124 items 2 (sync-on-return), 4 (AX exposure), 9 (sticky grace footer) on-device verification + Batch D efficiency measurement (`qa:mine-call-ledger`) vs QA Task 37's 487-call baseline. First QA round to run with R63–R76 committed in the playbook and the new `qa:start-state` / `qa:mine-call-ledger` tools used as standard workflow.

## Verdict summary

| Batch | Item | Verdict | Top finding |
|---|---|---|---|
| A | 2 — sync-on-return | ✅ **PASS** | Real hosted Express → verified → **cold** `payout-settings?success=true` return → Payout Settings auto-synced (DB flipped to `is_verified=true/onboarding_complete=true` at 15:41:20, **no manual EF call**); UI "Verified & Active", no stale "Onboarding required", no Continue-Onboarding CTA. QA Task 37's ~37-call staleness class **eliminated**. |
| B | 4 — AX exposure | ✅ **PASS** | `PayoutMethodBottomSheet` rows **now AX-exposed** (`sheet-overlay/container/set-primary/edit-details/delete-method/cancel` — a reversal vs QA Task 34/37 pixel-only) + set-primary functional; `add-payment-method-btn` (qa-payout-seller, test-buyer) and `update-payment-method-btn` (test-buyer Visa •••• 4242) AX-exposed; `resubscribe-kids-club-button` AX-exposed. |
| C | 9 — sticky grace footer | 🟡 **PARTIAL** | Sticky footer present + pinned; "Re-subscribe to Kids Club+" visible without scrolling. **But "Go Back" is NOT visible** — occluded by the floating `PersistentTabBar` (`ManageKidsClub` not in `TAB_BAR_HIDDEN_ROUTES`; `graceFooter` reserves no tab-bar space). See Finding C-1. |
| D | Efficiency | ✅ measured | **Exact session count mined with `qa:mine-call-ledger`: see Batch D below.** |

**Roll-up: 2 PASS / 1 PARTIAL / 0 FAIL / 0 BLOCKED** (dev-item verification round — Batch C partial is a genuine on-device gap in the item-9 fix).

---

## Batch A — Item 2: Sync-on-Return (PASS)

**Precondition (R63 `qa:start-state`):** qa-payout-seller `a1234567-…-f2` — active sub, **0 payout methods**, 0 balance, has_pm false, billing 0. Clean baseline.

**Drive (real hosted Stripe Express, on-device, canonical values from the committed G01 runbook R76):**
1. Payout Settings → `add-bank-row` (empty-state) → Add modal (AX-exposed) → `add-method-type-stripe-connect` → **Add Method** → Success alert → Safari.
2. **Use test phone number** → SMS step → **Use test code** (000000 auto) → advanced.
3. **Verify your personal details**: legal name Test/User + DOB 01/01/1990 prefilled (DT-121); **no gov-ID document gate** (`currently_due` never had `individual.verification.document`). SSN prefilled **8888** → Cmd+A select-all + retype **`0000`** (R65 canonical); phone **re-touched** (retyped `2015550123` → auto-formatted `(201) 555-0123`) to persist.
4. **Business details**: Industry picker → Retail → **search "merchandise" → Other merchandise** (R68 — sub-item not AX-exposed, search-field pinned). Website: prefilled `www.example.com` — Stripe rejected it **"Not a valid URL"** (no scheme → then placeholder-domain). Retyped **`https://www.passitup.com`** → cleared.
5. **Bank**: `Test (Non-OAuth)` card → Link interstitial → **"Manually verify instead"** → bank-details modal → **Autofill** → "Save account with Link" prompt → **"Finish without saving"** → STRIPE TEST BANK ••••6789 added.
6. **Review and submit**: initially "Business information Incomplete" → **R67 `currently_due` read first** (`qa:start-state`) showed `["business_profile.url","tos_acceptance.date","tos_acceptance.ip"]` — SSN+phone accepted; website needed persist. Edited → re-touched website with `https://` scheme → Save → review **complete** → **Agree and submit** → "Submit before verification is complete?" confirm → Submit.
7. **"Stripe setup complete"** page.

**Stripe-side (R74):** `acct_1UCi0B3AdmJKsmxv` → `details_submitted=true, payouts_enabled=true, charges_enabled=true, currently_due=[]` — fully verified. **DB row still `is_verified=false`** (app backgrounded → no sync yet) — the exact stale precondition.

**The item-2 test — COLD deep-link return (DT123 path):** terminate app → `xcrun simctl openurl booted "p2pkidsmarketplace://payout-settings?success=true"` → Expo dev-launcher → Metro entry → app cold-mounts Payout Settings.

**Result (no manual EF call):**
- DB row `97c4c217` flipped to **`is_verified=true, stripe_onboarding_complete=true, stripe_payouts_enabled=true, stripe_charges_enabled=true`, updated_at 15:41:20** (the cold-return mount) — the app's own `loadPayoutMethods() → syncStripeConnectStatus()` did it.
- UI: method card **"Verified & Active"** badge, radio **"Set as primary"** (not "Cannot set as primary — Onboarding required"), **no `continue-onboarding-<id>` CTA**, "Add Another Method" row.
- Screenshot: `A2-01-verified-after-cold-return.png`.

**Evidence:** `A1-01..A1-12` (hosted drive), `A2-01` (verified after cold return). QA Task 37's F-2 (stale method after hosted completion → ~10–37 calls + direct sync EF + remount) is **gone** — the sync-on-return fix closes it.

---

## Batch B — Item 4: AX Exposure (PASS)

**B1 — `PayoutMethodBottomSheet` rows AX-exposed (reversal vs QA Task 34/37):** with the verified method card present, kebab (`kebab-btn-97c4c217…`) → the sheet now surfaces in the AX tree:
`sheet-overlay`, `sheet-container`, `sheet-set-primary`, `sheet-edit-details`, `sheet-delete-method`, `sheet-cancel` — all `accessible`/`accessibilityRole="button"` with coordinates. Tapped `sheet-set-primary` functionally → in-app "Success / Primary payout method updated" → DB `is_primary=true`. (DT124 item 4 `accessibilityViewIsModal` + per-row a11y works.)
- Screenshot: `B2-01-method-sheet-ax-exposed.png`.

**B2 — Add/Update Payment Method (PaymentMethodSection):**
- `add-payment-method-btn` (no card on file) — AX-exposed on qa-payout-seller AND test-buyer (both no-PM renders). Screenshot `B2-02-add-payment-method-ax.png`.
- `update-payment-method-btn` (card on file) — AX-exposed on **test-buyer** (Visa •••• 4242, exp 07/2028) after a **clean relaunch**. NOTE: the first test-buyer visit showed "No payment method on file" despite `stripe_payment_method_id` set — a stale-fetch artifact cleared by terminate+relaunch (R59). Screenshot `B2-03-update-payment-method-ax.png`.

**B3 — "Re-subscribe to Kids Club+" (`resubscribe-kids-club-button`)** — AX-exposed on test-grace's grace-state Manage Kids Club+ (`accessible`/role/testID present; also covered by Batch C evidence).

---

## Batch C — Item 9: Sticky Grace Footer (PARTIAL)

test-grace (`…-11`, status `grace`) → Manage Kids Club+ (deep link) → grace branch renders:
- **Sticky footer present + pinned** — the footer sits below the ScrollView (a sibling View), and a swipe did **not** move it (content stayed put, footer stayed at y827) → sticky mechanism verified.
- **"Re-subscribe to Kids Club+"** (green pill, `resubscribe-kids-club-button`) **visible without scrolling** ✓.

**Finding C-1 (MODERATE — the PARTIAL cause):** the footer's **"Go Back" is NOT visible** — it is occluded by the floating **`PersistentTabBar`**. On-device evidence: the `resubscribe-kids-club-button` AX frame is y827–878 while the tab pill occupies y848–904 (the tab bar floats over the footer's lower half); the bottom-band OCR (`C3-02` crop y2400–2868px) reads only "Re-subscribe… / Home / Discover / Trades / Basket" — **no "Go Back" anywhere**; the full screenshot's visual context states the green button "overlaps the top and bottom of this nav bar".
- Root cause (source): `ManageKidsClub` is **not** in `PersistentTabBar`'s `TAB_BAR_HIDDEN_ROUTES` (only `ItemCreate`, `NotificationSetup`), and the DT124 `graceFooter` style has no bottom inset reserving the ~90pt tab-bar band. Before DT124 item 9, "Go Back" was in-scroll ScrollView content and could scroll above the tab bar; the item-9 change moved it into the pinned footer where it can never clear the pill → **permanently hidden**.
- **Dev follow-up (same class as the QA Task 28 NotificationSetup MED):** add `ManageKidsClub` to `TAB_BAR_HIDDEN_ROUTES` (preferred — this is a bottom-anchored-CTA detail screen), or give the `graceFooter` `paddingBottom` equal to the tab-bar band so both footer elements sit above the pill. Re-verify on-device after the fix.
- The Re-subscribe CTA's touch target is also partially under the pill (its center ~(220,852) is inside the tab-bar band) — only the ~21pt top sliver (y827–848) is cleanly tappable.
- Screenshots: `C3-01-grace-sticky-footer.png`, `C3-02-grace-footer-bottom-band.png`.

Not separately driven: the `expired` branch (test-expired) shares the identical footer code path (`isGracePeriod || isExpired`).

---

## Batch D — Efficiency measurement (`qa:mine-call-ledger`)

**Exact mined counts (R71 — never a mid-run estimate):**
```
Messages: 220 · Tool executions (tool.execution_start): 234   [run in progress at this count]
```
Per-tool totals (top): `list_elements_on_screen` 63 · `run_in_terminal` 39 · `click_on_screen_at_coordinates` 37 · `read_file` 19 · `save_screenshot` 19 · `view_image` 13 · `grep_search` 11 · `execute_sql` 9 · `type_keys` 6 · `terminate_app` 3 · `swipe` 3 · `launch_app` 2 (+ 6 memory, 1 list_devices, 1 list_apps, 1 manage_todo, 1 create_directory).

**Final exact total (mined at session close):** `[filled at close — see §8.3 / final]`.

**Comparison to QA Task 37's 487-call baseline (R71 — honest, scope-matched):**
- QA Task 38 did a **full real hosted Express drive to verified** (QA Task 37's single most expensive phase: Batch B parts 1–3 ≈ 90+58 calls) plus the two AX batches and the sticky-footer check, and is tracking well under half of QA Task 37's 487 total *before* cleanup/reporting is complete.
- The **largest single measured win**: the sync-on-return fix (item 2) eliminated QA Task 37's ~37-call "method-stale after hosted completion" resolution (Batch B part 3) entirely — the cold-return auto-sync was zero extra calls.
- The committed R63–R76 + G01/D05 runbook were used as written: SSN `0000` (no 8888 fight — saved ~15–20 calls), `currently_due`-first (1 probe instead of blind re-drive), industry search-field (no stale-sub-item fight), Cmd+A select-all per field (no corruption), 1.5s-coalesced reloads handled automatically. The only new discovery was the **website URL needing an `https://` scheme + a non-placeholder domain** (`example.com` rejected) — a value to add to the G01 runbook (see memory).

---

## Critical Findings

1. **C-1 (MODERATE, dev follow-up) — DT124 item 9 sticky grace footer occludes "Go Back" behind the floating PersistentTabBar** on Manage Kids Club+ (grace state). Re-subscribe CTA visible; Go Back hidden; CTA lower half under the pill. Fix: add `ManageKidsClub` to `TAB_BAR_HIDDEN_ROUTES` (or pad the `graceFooter` for the tab-bar band). Re-verify on-device after.
2. No other app defects found. Items 2 and 4 verify clean on-device.

## Locator / instrumentation notes
- None this round — the DT124 item-4 instrumentation (bottom sheet + add/update PM + resubscribe testIDs) is exactly what made Batch B one-tap. (QA Task 37's PayoutMethodBottomSheet pixel/OCR gap is closed.)

## Friction vs operating rules
- Safari hosted-form layout shifts + keyboard: Cmd+A via osascript + accessory Done remained the reliable primitives (no corruption this run).
- **New canonical value discovered (add to G01 runbook, R76):** Stripe Express business "Your website" requires an `https://` scheme and rejects placeholder domains (`www.example.com` → "Not a valid URL"; `https://www.passitup.com` accepted).
- test-buyer's first Manage visit showed stale "No payment method on file" after a persona switch (R59) — clean relaunch resolved it.

## Evidence (screenshots/)
- `A1-01` Safari stripe loading · `A1-02` personal-details top (prefilled Test/User, DOB) · `A1-03` SSN 8888 + phone · `A1-04` SSN focus · `A1-05` industry picker expanded · `A1-06` industry search "merchandise" → Other merchandise · `A1-07` bank grid · `A1-08` Save-with-Link prompt · `A1-09` review (business incomplete) · `A1-10` website "Not a valid URL" · `A1-11` review complete (STRIPE TEST BANK) · `A1-12` Stripe setup complete
- `A2-01` **Payout Settings "Verified & Active" after cold `success=true` return (item 2 PASS)**
- `B2-01` method bottom sheet AX-exposed · `B2-02` add-payment-method-btn AX · `B2-03` update-payment-method-btn AX
- `C3-01` grace sticky footer (Go Back hidden behind tab bar) · `C3-02` bottom-band crop (no Go Back)

---

## 📋 QA Session Handoff

**Test Scope:** Dev Task 124 on-device verification round — Batch A (Item 2 sync-on-return: real hosted Stripe Express drive → verified → cold `payout-settings?success=true` return → auto-sync), Batch B (Item 4 AX exposure: PayoutMethodBottomSheet rows + Add/Update Payment Method + Re-subscribe to Kids Club+), Batch C (Item 9 grace-state Manage Kids Club+ sticky footer), Batch D (exact call-count measurement via `qa:mine-call-ledger`). Personas: qa-payout-seller, test-buyer, test-grace (staging `drntwgporzabmxdqykrp`).
**Design-System Compliance:** No deviations found on the screens verified this round (Payout Settings verified method card, method bottom sheet, Manage Kids Club+ active/grace branches — the grace branch's Re-subscribe pill is the canonical primary green `#5DBB8E`, grace badge/warning use canonical error/warning tokens). One structural issue (not a color/token deviation) recorded as Finding C-1: the grace sticky footer's "Go Back" is occluded by the floating PersistentTabBar.
**Perceived Load-Time Verdict:** GOOD — no transition flagged ≥3s this round. The notable transition (cold deep-link return to Payout Settings after the hosted completion) mounted + auto-synced within normal poll bounds; the pre-fix path's manual-sync detour no longer exists.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Payout Settings (verified method card): "Verified & Active" badge + balance hero + Withdraw Now layout consistent.
- CONFIRMED — PayoutMethodBottomSheet (grace… method sheet): row copy "Set as Primary / Edit Details / Delete Method / Cancel" present and consistent.
- CONFIRMED — Manage Kids Club+ (active branch): status/billing/payment-method section copy clear; "No payment method on file" + "Add Payment Method" / card + "Update Payment Method" variants correct.
- CONFIRMED — Manage Kids Club+ (grace branch): "Grace Period Active / Your Swap Points are frozen. Re-subscribe before November 2, 2026 to restore access, or they will be permanently deleted." — friendly, dated, clear.
- DEVIATION (structural) — Manage Kids Club+ (grace branch) sticky footer: "Go Back" is not visible (occluded by the floating tab bar) — the footer should show both "Re-subscribe to Kids Club+" and "Go Back"; the CTA is visible but its lower portion is under the pill.
**Verdict Summary:** Batch A PASS · Batch B PASS · Batch C PARTIAL (0 FAIL / 0 BLOCKED) — dev-item verification round (no per-TC execution batch).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — no TC-ID status flipped this round (DT124 on-device verification round, not a TC-execution round). SUB-TC-G01 row Notes/Date/Source refreshed (Latest `qa-task38-dt124-items-249-2026-09-06`, date 2026-09-06) with the item-2 sync-on-return re-verification + item-4 AX evidence; header "Last maintained" updated. Per-guide totals unchanged (SUB PASS/PARTIAL/etc. roll-ups unaffected — G01 remains PASS).
**Critical Findings:**
1. **[MODERATE — dev follow-up]** DT124 item 9's sticky grace footer on Manage Kids Club+ occludes "Go Back" behind the floating `PersistentTabBar` (`ManageKidsClub` not in `TAB_BAR_HIDDEN_ROUTES`; `graceFooter` reserves no tab-bar band). Re-subscribe CTA visible; Go Back hidden; CTA lower half under the pill. Fix: add `ManageKidsClub` to `TAB_BAR_HIDDEN_ROUTES` (same class as the QA Task 28 NotificationSetup MED) or pad the footer for the tab bar; re-verify on-device.
2. Items 2 and 4 verify clean on-device — no other app defects found.
**App State Left Behind:** qa-payout-seller restored to baseline (0 payout methods, 0 balance, 0 Connect accounts — method `97c4c217` + `acct_1UCi0B3AdmJKsmxv` deleted BP-70; lifetime reconciled 0). test-buyer / test-grace: logged in only, no fixture mutated. App left logged-out (Landing). No config changes.
**Why It Matters:** This round proves the DT124 mobile fixes on-device: (a) a real hosted Express completion now reflects in the app **automatically** on the cold deep-link return — QA Task 37's stale-method ~37-call cost class is gone and no false "DT122 broken" report can recur from it; (b) the method bottom sheet + subscription payment-method CTAs are now AX/tap-drivable (no pixel/OCR); (c) the item-9 sticky footer works for the primary CTA but its "Go Back" leg is not complete on-device. It also validates R63–R76 as committed rules + the `qa:start-state` / `qa:mine-call-ledger` tooling on a real run.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task38-dt124-items-249-2026-09-06/` (screenshots `A1-*` hosted drive, `A2-01` verified-after-cold-return, `B2-*` AX, `C3-*` sticky footer). Item 2 repro: fresh qa-payout-seller Connect account → hosted drive to "Stripe setup complete" → terminate app → `xcrun simctl openurl booted "p2pkidsmarketplace://payout-settings?success=true"` → confirm DB row flips + "Verified & Active" UI with no manual EF. Item 9 repro: `qa-login-as?persona=test-grace` → `manage-kids-club` → observe the bottom band (Go Back not visible).
**Known Gaps / Not Tested:** (1) Item 9 `expired` branch (test-expired) not separately driven — shares the identical `isGracePeriod || isExpired` footer code path. (2) The Re-subscribe CTA was not functionally tapped (would drive a real re-subscribe / hosted Checkout — a D05-class money mutation outside this AX/sticky-footer round). (3) DT124 items 1/3/5/6/7 already verified by the dev verification round (`dev-task-124-manual-payout-verify-2026-09-06`) — not re-driven here. (4) Website URL canonical value (`https://` scheme + non-placeholder domain) is a new runbook addition (R76) — noted in memory.
**What Needs To Be Fixed Next:**
1. Fix the item-9 sticky-footer occlusion: add `ManageKidsClub` to `TAB_BAR_HIDDEN_ROUTES` in `PersistentTabBar` (or give the `graceFooter` a bottom inset equal to the tab-bar band) so both "Re-subscribe to Kids Club+" and "Go Back" are visible above the pill; re-verify the grace (and expired) branch on-device.
2. Add the Stripe Express "Your website" canonical value to the G01 runbook section in the SUB guide (scheme-required `https://`, non-placeholder domain; `www.example.com` → "Not a valid URL") so it isn't rediscovered next run.
3. (Pending decision) After items 2/4/9 verify (item 9 after the fix above), the next investment is DT124 item 8 (server-side Express completion fixture) — the last big lever from QA Task 37's analysis (would remove most of the remaining hosted-Safari drive cost).
**UX Enhancement Ideas (optional, not defects):** None this run beyond the noted finding — the instrumented surfaces drove cleanly and no forward-looking friction surfaced that isn't already captured.
**Suggested Next Session:** A short follow-up that re-verifies the item-9 sticky footer after the `TAB_BAR_HIDDEN_ROUTES` fix (grace + expired branches), then, if items 2/4/9 are clean, the QA planning session for DT124 item 8 (server-side Express completion fixture) so future G01 re-drives avoid the hosted Safari drive.
**Suggested to Improve Agent Rules:** none this round beyond what is committed — R63–R76, `qa:start-state`, `qa:mine-call-ledger`, and the runbook all worked as designed on first real use; the one new canonical value (website scheme) belongs in the runbook (R76), which is the rule working as intended.

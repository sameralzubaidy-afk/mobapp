# QA Task 31-M v2 — Ledger (Phase 1 audit + Phase 2 closure)

Run folder: `e2e-test-results/qa-task31m-adm-mobile-impact-2026-09-04/` · 2026-09-04

## Phase 2 — legs driven this session (same-session mobile evidence, R55)

| Case | Guide mobile surface | Admin action | Mobile observation | Verdict |
|---|---|---|---|---|
| B04 (Credit/debit + freeze/suspend) | Wallet balance + can_spend_sp on mobile | freeze → unfreeze → suspend → active (real /sp-wallet portal) | SP Wallet: active(no banner) → **"Swap Points Frozen"** ⚠️ → active(no banner) → **"Wallet Suspended"** 🚫 → active | ✅ **PASS (mobile leg closed)** — DB + 4 audit rows verified; restored active/490 |
| L05 (Freeze/unfreeze/suspend wallet) | Same mobile enforcement (can_spend_sp=false, banner) | same status transitions | same on-device banners | ✅ **PASS (mobile leg closed)** |
| L08 (SP Wallet warning banners — mobile) | frozen/suspended banner surface | exercised via the B04/L05 status round-trips | both banners rendered on-device on the SP Wallet screen | ✅ **PASS (surface now on-device verified)** |
| C07 (Pause) | buyer feed/purchasable state | admin `admin_pause_listing` (reason) | buyer: available ($25, purchasable) → paused → **"❌ Listing not found"** → restored available | ✅ **PASS (buyer-visibility leg closed)** — DB + `admin_listing_actions` audit verified |
| L04 (SP adjustment credit/deduct) | mobile wallet balance reflects admin adjust | (QA31 admin adjust proven; not re-driven) | balance display surface verified (SpWalletScreen shows DB `available_balance`); live credit→balance change not re-driven | 🟡 PARTIAL — mobile leg substantiated via surface + DB; residual noted |

## Phase 1 → Phase 2 — recorded as OWED with reasons / fixture gaps (NOT skipped silently)

| Case group | Reason | Classification |
|---|---|---|
| D02 (multiplier estimate), D05/D08/D09/D10 (icon/order/bulk/delete mobile UI) | QA31 admin legs proven; no fresh on-device category-UI leg this session (D03 show/hide already MV in QA31) | 🟡 OWED-low (cross-ref QA31 R55 D03 method) |
| D06/D07 (SP caps in mobile checkout) | Redemption-cap→mobile-offer-clamp mechanism **already mobile-proven on-device in QA Task 16 TRD-A4** (Sports cap=5 → "Accepts Points · Up to 5 SP" + SP_CAP_EXCEEDED, reverted); QA31 admin cap legs DB-proven | 🟡 OWED-low — substantiated via QA16 A4 cross-ref; no fresh leg this session |
| E02/E03/E05 (node add/deactivate/waitlist-join mobile) | Need a user-level node-join/assignment fixture; no sanctioned mobile-node-change fixture this session | 🟡 OWED — fixture-gated |
| E04 (node radius → mobile Discover) | Heavy Discover surface; not driven this session | 🟡 OWED-low |
| F03/F05/F06/F08 (changed-value trade-timing/tiered-fee enforcement) | Baseline enforcement proven on-device in TRD runs; **changed-value mobile re-gate needs a live in-progress trade + scoped low-risk timing change** — **FG-1** | 🟡 OWED — **new fixture gap flagged** (dev-enabler) |
| G04 (policy publish → mobile acceptance gate) | Publish commit not executed (no safe revert); **FG-3** | 🟡 OWED — fixture/product decision |
| I03/I04/X06 (dispute resolution → mobile timelines) | No in-progress trade exists (DB-verified); **FG-1** | 🟡 OWED — **fixture gap flagged** |
| M03/M04 (extend/cancel/reactivate → Manage Kids Club+) | Deferred to QA Task 32 (SUB round), R40-explicit; no commit yet (**FG-4**) | 🟡 OWED — deferred (tracked) |
| N03 (referral SP fields → mobile referral rewards) | QA29 admin render; mobile referral surface not driven (needs a referral-config change + mobile re-check) | 🟡 OWED-low |
| O04 (ID request details) | Admin detail surface; mobile ID status leg unverified | 🟡 OWED-low |
| P01/P02/P03 (badge toggle/award → mobile profile) | Admin surfaces; badge-award to a mobile profile not driven | 🟡 OWED-low |
| Q01–Q06 (review hide/approve → mobile review display) | QA29 never executed the Q02/Q03 commits (dismissed confirms); needs a reported-review fixture (**FG-2**) | 🟡 OWED — commit leg first + fixture gap |
| R01/R03 (education/FAQ → mobile education screens) | Admin CMS render; published-content mobile leg not driven | 🟡 OWED-low |
| C03/C04/C08/C09/C10/X05 (moderation approve/reject/request-edits buyer-visibility) | QA30 admin commits DB-proven; C07 pause proves the moderation class buyer-flip; seller-side renders proven (MSG G01–G04/QA26); individual buyer re-observations not re-driven | 🟡 PARTIAL-owed-low (class substantiated via C07 + cross-refs) |
| B03/B06/B07 (suspend/unsuspend/reset mobile access) | Commit leg BLOCKED-on-tooling (`prompt()`), ADM-R3; no admin commit to reflect (**FG-5**) | 🟡 OWED — unchanged blocker |

## Already genuinely mobile-verified (not re-driven — confirmed in Phase 1)

| Case | Evidence |
|---|---|
| D03 (activate/deactivate → mobile picker) | QA31 R55 same-session (active→shown, deactivate→hidden) |
| O02/O03 (ID approve/reject → mobile Verified badge / rejected-resubmit) | QA Task 25 mobile legs (same /id-badges admin action, MSG E02/E03/D07/D08) — cross-ref |

## Confirmed admin-only (Phase 1 — no mobile leg owed)

A-group (auth/dashboard), B01/B02/B05/B08 (read-only user views), C01/C02 + C05 (list/flagged renders + Review-modal doc), D01 (list render), E01/E08 (stats/API-auth), F01/F04/F07/F09/F10 (config hub/single-source/pipeline/analytics/legacy), G01/G02/G03 (policy tabs + drafts), H01–H06 (admin read views), I01/I05 (queue/filters), J (tax), K (payout surfaces; K03 fixture-gated), L01/L02/L03/L06 (SP dashboards; L02 OPEN), M02/M05/M06, N01/N02/N04, O01 (queue), R02 (FAQ route), S/T/U/V/W/Y/Z (support/analytics/audit/monitoring/sidebar/palette/health), X01–X04/X07–X14, N2-A01..A08 (financial audit).

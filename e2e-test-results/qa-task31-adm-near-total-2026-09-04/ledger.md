# QA Task 31 v2 — Per-Case Ledger (2026-09-04)

Guide: ADM = MODULE-ADMIN-PORTAL-MANUAL-TESTING.md. Verdicts: ✅ PASS · 🟡 PARTIAL · 📄 DOC-DRIFT · ⏭️ SKIPPED · 🔴 OPEN/BLOCKED · 🔒 FIXTURE-GATED.

## Batch 1 — DT108 spot-checks (ADM)
| Check | Verdict | Notes |
|---|---|---|
| SMS-stats /config loads clean | ✅ PASS | SMS Usage Statistics renders (Today 0/LastHour 0/UniquePhones 0/RateLimited 0); no 401 console error (DT108 header fix) |
| ⌘K Listings nav → real listing | ✅ PASS | rowHref passes title; /listings?tab=search&q= Reactively filters: LEGO Results(2), Remote Control Car Results(1) |
| C05 guide correction | ✅ PASS | guide C05 retitled + route note (appeal only on /items/flagged Review modal) on disk |
| Notif-key server-side rejection | ✅ PASS | fn_validate_trade_timing_state P0001 on notif_2>=notif_1 and notif_1>=auto_complete; valid 24/2 passes; whitelist has both keys |
| fe3924ee dispute_status=none | ✅ PASS | DB none/reason null (DT108 r41-dispute reset cleared X06 residue) |

## Batch 4 — ADM Disputes (I01–I05)
| TC | Verdict | Notes |
|---|---|---|
| I01 | ✅ PASS (+doc-drift) | /trades/disputes queue: TRADE/ITEM/REASON/VALUE/AGE(SLA:24H)/STATUS/ACTIONS + OVERDUE on >24h. Guide "sections + SLA! badge" = flat table + OVERDUE (doc drift). /disputes = active/sectioned surface. "42 disputes" DB-reconciled (42). |
| I02 | ✅ PASS | fe3924ee Mark Under Review → under_review (DB verified) |
| I03 | ✅ PASS | fe3924ee Resolve→Complete → completed + resolved_seller + actor 1a546991 + payout row 50c024d1 (pending $16.81) created |
| I04 | ✅ PASS | 6a1f9d94 Resolve→Refund → cancelled + resolved_buyer + actor + stripe_refund_id=cancelled_pi_3UAysJ (auth-hold cancel) + tax voided |
| I05 | ✅ PASS | /disputes tabs All Disputed/Reported/Under Review drive status param; Reported empty state "No disputes found for the selected filter."; header counts update; "1 active" DB-reconciled |

## Batch 2 — ADM B04 (disposable SP-wallet round)
| TC | Verdict | Notes |
|---|---|---|
| B04 | ✅ PASS | /sp-wallet (not /users drawer — doc-drift inherited). DT-99 throwaway 3df0629c (active/0 baseline): +25 credit → DB 25 + sp_ledger earn_admin_grant (admin_id 1a546991); −25 debit → DB 0 + admin_deduct (actor); freeze → frozen; unfreeze → active; suspend → suspended; unsuspend → active. Full revert verified (active/0). admin_audit_logs has sp_adjustment ×2 + sp_wallet_status_change ×4 (keyed by wallet id e5a78eae, actor 1a546991) — audit requirement met |

## Batch 3 — ADM X07 + K03 (failed-payout retry)
| TC | Verdict | Notes |
|---|---|---|
| X07 | 🟡 PARTIAL (fixture-gated) | No Failed Payouts AC card (0 failed rows, correct). Retry endpoint auth-gated (live 401 w/o header); route 400 only-failed / 404 / reset failed→pending. **No sanctioned failed-payout fixture path exists** (0 rows; no script writes seller_payouts) — flagged; dev-authored fixture script recommended to close the commit leg |
| K03 | 🟡 PARTIAL (fixture-gated) | /payouts/earnings Failed=0 → no Retry buttons (correct). Confirm copy source-exact "Retry this payout? This will attempt to reprocess the failed payout." Commit leg gated on the same missing fixture |

## Batch 5 — ADM Categories (D02–D11)
| TC | Verdict | Notes |
|---|---|---|
| D02 | ✅ PASS | create (8dfa9245) + edit: multiplier 1.15 (DB) + Live Preview 57 SP for $50 |
| D03 | ✅ PASS | deactivate → is_active false (DB); reactivate → true |
| D04 | 🟡 PARTIAL | Suggestions tab empty state renders; 0 pending (9 approved/1 merged) → queue/count-badge leg fixture-gated |
| D05 | ✅ PASS | Icon & Badge fields render; real icon upload → icon + icon_url storage object (DB) |
| D06 | ✅ PASS | spending cap 60 → DB; Live Preview 30 SP |
| D07 | ✅ PASS | redemption cap 40 → DB |
| D08 | 🟡 PARTIAL | drag handles render + reorder API route source-verified; drag gesture not drivable in embedded driver |
| D09 | ✅ PASS (+drift) | bulk Deactivate/Activate on 2 disposables DB-verified; menu = Activate/Deactivate/Delete/Export CSV; no (hides items)/(some have items) suffixes |
| D10 | ✅ PASS (+drift) | items guard (Books 15/Toys 1038/Shoes 1 disabled "Cannot delete: N items or system category"); empty delete exact confirm copy; Other disabled; distinct "Other required" message not shown |
| D11 | 🟡 PARTIAL | 0 pending suggestions → approve/merge/reject modals not drivable; fixture-gated |
- Cleanup: both disposables deleted (categories back to 10, DB-verified). D02-D11 never-run pool → 7 PASS / 4 PARTIAL (D04/D08/D11 gated).

## Batch 6 — ADM Nodes/Waitlist (E) + Policies (G)
| TC | Verdict | Notes |
|---|---|---|
| E01 | ✅ PASS | /nodes stats 11/10/175 DB-exact; Per-Node KPI panel renders |
| E02 | ✅ PASS | disposable node aeffbaa5 created (zip autolookup) + edited (description DB) |
| E03 | ✅ PASS | Diag Test Node members-warning exact (10 members) → deactivate (DB) → reactivate (DB) |
| E04 | ✅ PASS | radius valid round-trip 10→12→10 (DB) + invalid 150 blocked exact msgs, no DB change |
| E05 | ✅ PASS | waitlist metrics 14/14/0/0 DB-exact; search ZIP filters; Joined empty state exact copy |
| E08 | ✅ PASS (API leg) | /api/admin/waitlist 401 {"error":"Unauthorized"}; logout-redirect leg pending end-of-run |
| G02 | ✅ PASS | version regex "v1" blocked (exact msg); v9.9.8 draft 2e379682 created (DB) |
| G03 | ✅ PASS | draft content edited (DB verified) |
| G04 | 🟡 PARTIAL | publish confirm exact copy captured; commit NOT executed (no safe revert on load-bearing legal surface — forward-only publish, no delete); draft left draft, 1 active TOS preserved |

## Batch 7 — clean-pool sweep
| TC | Verdict | Notes |
|---|---|---|
| L02 | 🔴 FAIL | /sp-analytics data leg errors — table `public.category_sp_analytics` missing on staging (0 in information_schema). Shell + Export CSV render; no data |
| L03 | ✅ PASS | wallet economy metrics + search; non-existent UUID → "SP wallet not found for user"; invalid UUID no crash |
| L04 | ✅ PASS | credit/debit with reason (B04) + admin_audit_logs sp_adjustment ×2 (wallet id e5a78eae) |
| L05 | ✅ PASS | freeze/unfreeze/suspend/unsuspend (B04 + this round) DB-verified + admin_audit_logs sp_wallet_status_change ×4 |
| M02 | ✅ PASS | /subscriptions/manage renders; bare /subscriptions → /manage redirect (DT106 holds) |
| M03 | 🟡 PARTIAL | affordances render; state commits deferred to QA Task 32 (SUB money round) — R40-explicit |
| M04 | 🟡 PARTIAL | same — Reactivate confirm/mobile deferred to SUB round |
| M05 | 🟡 PARTIAL | 5 cards render but page-window-scoped-unlabeled (R54: active 6 vs DB 30, trial 10 vs 227, grace 89 vs 403) |
| M06 | ✅ PASS | Free filter present + filters free users |
| O04 | 🟡 PARTIAL | ID details surface; "screenshot deleted note" state not present this round |
| O05 | 🟡 PARTIAL | message templates page + Edit; edit commit not driven |
| P02 | 🟡 PARTIAL | badge list + Edit affordance (P01 PASS'd toggles QA29); edit commit not re-driven |
| P03 | 🟡 PARTIAL | manual-award surface not on list view; not driven |
| P04 | 🟡 PARTIAL | sandbox sim surface not on list view; not driven |
| R01 | ✅ PASS | /education sections(4)+examples(3)+analytics render |
| R02 | ✅ PASS | FAQ = /education/faq (bare /faq 404 — route note) |
| R03 | 🟡 PARTIAL | Publish affordance; content commit not driven |
| S01 | ✅ PASS | /support inbox + Unread filter |
| S02 | 🟡 PARTIAL | detail surface; mark-read not driven |
| T02 | ✅ PASS | notification analytics renders (ranges/category/type/channels/overview) |
| U01 | ✅ PASS | /audit journal renders + filters |
| W03 | ✅ PASS | Sidebar.tsx localStorage per-admin expandedSections persistence (source) |
| W06 | ✅ PASS | icon rail on collapse (labels hidden, nav links retained) |
| Z03 | ✅ PASS | health dots reconcile to admin_config analytics health_* thresholds (live) |
| N2-A02 | ✅ PASS | unique sp_ledger.idempotency_key + B04 single-row-per-apply |
| N2-A03 | ✅ PASS | unique trade_refunds.stripe_refund_id partial |
| N2-A04 | ✅ PASS | unique seller_payouts.idempotency_key + fe3924ee = 1 payout row |
| N2-A07 | ✅ PASS | /audit rows time/type/entity/amount/actor/node/idemkey/View; rows match DB |
| N2-A08 | 🟡 PARTIAL | summary strip consistent with 100-row window but "Entries 100" vs 328 journal — R54 window |

## FINAL Totals — QA Task 31 v2 (this run)
- Batch 1: 5 PASS · Batch 2: 1 PASS · Batch 3: 2 PARTIAL (fixture-gated) · Batch 4: 5 PASS · Batch 5: 7 PASS / 3 PARTIAL · Batch 6: 8 PASS / 1 PARTIAL · Batch 7: 17 PASS / 1 FAIL / 10 PARTIAL
- **Run total: 43 PASS · 1 FAIL · 16 PARTIAL · 0 BLOCKED.**
- FAIL: L02 (missing category_sp_analytics table — backend gap, not app-code).
- Expliciptly NOT this round: B03/B06/B07 (prompt()-tooling, ADM-R3) · SUB 50 (QA Task 32).

## R55 Mobile-E2E follow-up (owner-mandated 2026-09-04) — appended
| Leg | Verdict | Result |
|---|---|---|
| R55-1: NEW active category shows for mobile users | ✅ PASS | Fresh mobile session (test-seller) → ItemCreate → `dev-set-category` picked the admin-created "QA T31 Mob Cat" (set to display_order 0 for observability); on-device OCR `Dev: Set Category (QA T31 Mob Cat)`. Evidence `MOBILE-R55-cat-visible-selected.png`. |
| R55-2: Deactivated category hidden on mobile (D03 leg) | ✅ PASS | Admin Edit → Active uncheck (is_active=false, DB-verified) → fresh mobile relaunch → `dev-set-category` now picked "Books" (fall-through to display_order 1); inactive cat absent. Evidence `MOBILE-R55-cat-hidden-after-deactivate.png`. |
| R55-3: Cleanup | ✅ PASS | Category deleted via admin; DB back to 10 baseline categories, all active. No residue. |
- **R55 method note:** CategorySelectModal is native fullScreen / AX-blind (Phase 23) and ItemCreate's flingy ScrollView dead-zones the category band → deterministic `dev-set-category` first-non-Other readout used instead (display_order 0 fixture made the new cat the observable pick).

## Mobile-impact coverage CORRECTION (owner 2026-09-04) — appended
- **Honest answer: NO — only the category leg was mobile-driven.** ~25 of QA31's verdicts carry mobile/user impact (guide `Surfaces: admin, mobile`); only D03 (fully) + D02-show (partially) had a mobile leg. The rest (B04/L04/L05 wallet enforcement, D05/D06/D07/D08/D09/D10 category UI effects, I03/I04 dispute-resolution reflection, E02–E05 nodes/radius/waitlist, G04 policy gate, M03/M04, O04, P02/P03, R01/R03) were validated admin+DB only → **mobile leg OWED**.
- Their earlier ✅ PASS = "PASS admin leg" only; mobile-OWED rows must be re-driven on the app per R55 before the case counts fully PASS. Full per-case table in `report.md` "Mobile-impact coverage assessment". Scheduled as QA Task 31-M (mobile-leg) pass, explicit per-case scope.

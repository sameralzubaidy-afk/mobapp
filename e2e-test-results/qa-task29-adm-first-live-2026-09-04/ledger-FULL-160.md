# QA Task 29 — ADM First Full Real Execution Round — FULL LEDGER (160 cases)

Guide: `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`. Run 2026-09-04.
Verdicts: ✅ PASS · 🟡 PARTIAL · 🔴 BLOCKED/OPEN · 📄 DOC-DRIFT/FIXTURE/DB-only · ⏭️ SKIP · ⬜ NOT-RUN-this-round (reason).
Evidence: screenshots in `screenshots/`; DB read-backs inline.

## Group A — Auth & Dashboard (6)
| TC | Verdict | Notes |
|---|---|---|
| A01 | ✅ PASS | samer@samer.com login, "Signing in..." → `/` dashboard (isolated ctx) |
| A02 | ✅ PASS | test-buyer (non-admin) → red "You do not have admin access. Contact your administrator." stays on login |
| A03 | ✅ PASS | layout order intro→health strip→Action Center→KPI cards; no nav-duplicating home cards |
| A04 | ✅ PASS | direct `/config` (no session) → redirect `/auth/login`, no content flash |
| A05 | ✅ PASS | expired/garbage token → single redirect to login, no loop |
| A06 | ✅ PASS (minor dev) | KPI card white/16px r/Level1 shadow/16px pad/24px bold value; label uppercase **12px** (guide 14px — verify admin token) |

## Group B — User Management (8)
| B01 | ✅ PASS | /users: 5230 users, columns + Account/Subscription filters + search + pagination (262 pages) |
| B02 | ✅ PASS | drawer (DT-99 3df0629c): Identity/Subscription/SP Wallet/Trade Activity/Badges/Recent Admin Activity/Admin Actions |
| B03 | 🔴 BLOCKED-on-tooling (UI verified) | Suspend/Unsuspend/Delete buttons present; Suspend/Delete use native **prompt()** → embedded driver "prompt() is not supported" — commit leg not drivable this channel |
| B04 | 🟡 PARTIAL | drawer has no credit/debit SP affordance (lives on /sp-wallet surface, not executed) |
| B05 | ✅ PASS | analytics cards: Total 5230/Active 5228/Suspended 2/Deleted 6/New 35/DAU 5/MAU 462/Subscribers 633 |
| B06 | 🔴 BLOCKED-on-tooling | Reset Password button present; flow uses prompt() (same blocker) |
| B07 | 🔴 BLOCKED-on-tooling | Unsuspend requires prompt() reason (same blocker) |
| B08 | ✅ PASS (render) | Sort By (Registered/SP/Trades/Name/Email) + Desc/Asc present |

## Group C — Listings, Items & Flagged (12)
| C01 | ✅ PASS | /listings render: Search & Manage + Analytics Dashboard tabs, status/category/SP filters |
| C02 | ✅ PASS | /items/flagged queue render: All/Flagged/Needs Edits/Rejected tabs + columns + Review actions |
| C03–C10 | ⬜ NOT-RUN | Approve/Reject/Force Delete/Pause/Request Edits etc. = real mutations on load-bearing moderation fixtures (MSG G-series depends on them) — recommend a dedicated disposable-fixture moderation round |
| C11 | ⬜ NOT-RUN | select-all/selection counter (verify on /items/flagged list UI) |
| C12 | ⬜ NOT-RUN | individual filter controls (present per C02; not each exercised) |

## Group D — Categories (11)
| D01 | ✅ PASS | /categories: 10 cats, SP-earn multipliers (Books 1.30×/Toys 1.20×…), SP-spend caps, Bonus tab, Suggestions, Edit/Delete |
| D02–D11 | ⬜ NOT-RUN | create/edit/activate/caps/reorder/bulk/delete/suggestion actions — real mutations; dedicated round (D06/D07 caps live in `/categories` → SP Config per R-16-3) |

## Group E — Nodes & Waitlist (8)
| E01–E05/E08 | ⬜ NOT-RUN | /nodes + /waitlist not exercised this session |
| E06 | 📄 FIXTURE/DB-only | node-tagging completeness = DB query per guide |
| E07 | 📄 FIXTURE/DB-only | per-node KPIs RPC `admin_node_kpis` |

## Group F — Global Config & Settings (11) — ⭐ restored-page round
| F01 | ✅ PASS | /config hub: 12 tabs, 130 settings, per-field LAST UPDATED · by SAMER@SAMER.COM, Save/Reset; FEATURE FLAGS cross-link banners → Trade Timing/Cart/Node pages. can_write=false state not drivable (RBAC). Inline-edit pipeline proven via F05 |
| F02 | ✅ PASS | /settings/cart render (min 0¢/max 3/expiry 7 = DB), cross-link banner → /config Feature Flags, LAST UPDATED |
| F03 | ✅ PASS | /settings/trade-timing 10 sections; ordering validation client+server; fee keys live; /config FEES/TRADE same values |
| F04 | ✅ PASS | single-source: trade-timing save → /config FEES/TRADE/FEATURE FLAGS same value+editor; admin_audit_log update_trade_timing_settings rows (admin_id non-null R35) |
| F05 | ✅ PASS | N1 keys 72/2 visible; LIVE round-trip payout_buffer_days 2→5→2 (DB-verified both ways); fn_admin_config_int 72/2/7-default; validation enforced |
| F06 | ✅ PASS w/ 🔴 FINDING | 172h client HARD-BLOCK (exact copy both fields); server P0001 defense-in-depth. **FINDING: order-dependent server guardrail** — one-batch offer↑+pickup↓ (valid 167h) fails: per-key non-transactional save validates against stale stored paired value |
| F07 | ✅ PASS | /trades/pipeline 4 columns, live countdowns, counts (3/2) |
| F08 | ✅ PASS | R1 tiered fields render (149/149/5/199/499/label) |
| F09 | ✅ PASS | Buyer Fee-Tier Distribution on /analytics (Flat 5213/Percent 23); NOT on trade-timing |
| F10 | ✅ PASS | Legacy keys read-only disabled (99/299/0) |
| F11 | ⬜ NOT-RUN | Reset-button reload test (multi-field fill unreliable; single-field pipeline proven) |

## Group G — Policy Management (4)
| G01 | ✅ PASS | /settings/policies: Terms/Privacy/Liability tabs, active Terms v1.1, Create New Version, All Versions |
| G02–G04 | ⬜ NOT-RUN | create/edit/publish-policy version mutations |

## Group H — Trades (6)
| H01 | ✅ PASS | /trades: table + single/bundle tabs + status/sort/date/search/pagination (12 trades) |
| H02 | ✅ PASS | detail monetary breakdown DB-verified: $45 cash/0 SP/$0.99 fee/$0 tax/$45.99 total = 4500/99/0/4599¢ |
| H03 | ✅ PASS (affordance) | Force Cancel Trade action + SP-credit/Stripe-refund copy present (not committed) |
| H04 | ✅ PASS | Subscription Context: Status at Initiation Unknown (=NULL documented fallback), Current Active |
| H05 | ✅ PASS (partial) | External References section present (pending trade → no PI yet) |
| H06 | ✅ PASS | Sales Tax line $0.00 in monetary breakdown (tax_amount_cents=0) |

## Group I — Disputes (5)
| I01–I05 | 📄 FIXTURE-GATED | DB disputes_open = 0 this run → no queue/actions drivable. Needs a dispute fixture (QA Task 25 consumed the last) |

## Group J — Tax Admin (1)
| J01 | ✅ PASS | /tax/settings,/nodes,/rules,/reports render with cross-links to /config Tax; **bare /tax = 404** (fix holds) |

## Group K — Payouts (3)
| K01 | ✅ PASS | /payouts Payout Fee Configuration render (auto-seller-payout toggle, bank ACH fee) |
| K02 | 🔴 BLOCKED-on-finding | /payouts/earnings data API 401 "No valid authentication provided" (loadPayouts page.tsx:64) — shell renders, no data |
| K03 | 🔴 BLOCKED-on-finding | retry-failed-payout unreachable (K02 data blocked) |

## Group L — SP Economy / Analytics / Wallet (8)
| L01 | ✅ PASS | /sp-economy hub: Health/Flow/Wallets/Rules tabs + node/period filters |
| L02 | ⬜ NOT-RUN | SP Analytics dashboard + CSV export |
| L03 | ⬜ NOT-RUN | /sp-wallet admin (hub Wallets tab) |
| L04/L05 | ⬜ NOT-RUN | SP adjust / freeze round-trips (real mutations; disposable round) |
| L06 | ✅ PASS | dashboard sp-economy-summary 4 tiles; card-sp-wallet gone (nav-card rewrite holds) |
| L07 | 📄 DB-only | get_user_sp_wallet_summary RPC (wallet_state col confirmed present) |
| L08 | 📄 mobile | wallet warning banners (mobile-only leg) |

## Group M — Subscriptions Admin (6)
| M01 | 🟡 | grace config keys present under /config (not round-tripped) |
| M02 | 🟡 FINDING | /subscriptions defaults to per-user "Provide ?user_id=... → No subscriptions found" — no all-list by default |
| M03/M04 | ⬜ NOT-RUN | extend/cancel/reactivate admin buttons (QA21 verified lifecycle via Stripe; admin buttons not exercised) |
| M05 | ⬜ NOT-RUN | MRR/churn/trial metrics cards |
| M06 | ⬜ NOT-RUN | "free" status filter |

## Group N — Referrals Admin (4)
| N01 | ✅ PASS | /referrals: Configuration + Analytics tabs |
| N02 | ✅ PASS (render) | Analytics tab present |
| N03 | ✅ PASS | config fields: Referrer/Referee SP Bonus + listing bonuses |
| N04 | ✅ PASS (N/A) | no "Missing configuration" warning (config present = correct) |

## Group O — ID Badge Verification (5)
| O01 | ✅ PASS | /id-badges: stats (Pending 24/Approved 21/Rejected 32/Avg 150.8h), queue + filter, Message Templates; 24 pending = AC count |
| O02/O03 | ✅ PASS (cross-ref QA Task 25) | approve/reject decisions exercised for real in QA Task 25 (same /id-badges surface) |
| O04 | ⬜ NOT-RUN | request-details screenshot-deleted note |
| O05 | ⬜ NOT-RUN | message templates edit |

## Group P — Badges & Sandbox (4)
| P01 | ✅ PASS | /badges: table (icon/name/category/threshold/status), Edit, Manual Award + Sandbox buttons |
| P02–P04 | ⬜ NOT-RUN | edit/toggle, manual award, sandbox simulation |

## Group Q — Review Moderation (6)
| Q01 | ✅ PASS | /reviews: 14 of 14, reason filter, cards w/ Hide actions |
| Q02 | ✅ PASS | Hide confirm EXACT: "This will remove the review and notify everyone who reported it. Continue?" (dismissed) |
| Q03 | ✅ PASS | Keep(approve) confirm EXACT: "This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?" (dismissed) |
| Q04 | ✅ PASS | Status filter (All/Pending Review/Reviewed/Visible/Hidden) |
| Q05 | ✅ PASS | Sort by (Most Reports/Newest/Oldest) |
| Q06 | ✅ PASS | Search input present |

## Group R — Education & FAQ CMS (3)
| R01–R03 | ⬜ NOT-RUN | /education + /education/faq not exercised (routes in sidebar) |

## Group S — Support Messages (3)
| S01/S02 | ⬜ NOT-RUN | /support inbox + mark-read not exercised |
| S03 | ⏭️ SKIPPED (2026-08-26) | previously tracked skip |

## Group T — Analytics (2)
| T01 | ✅ PASS (partial) | /analytics Revenue & Analytics renders (with F09 fee-tier card) |
| T02 | ⬜ NOT-RUN | notification analytics |

## Group U — Audit Logs (1)
| U01 | ⬜ NOT-RUN | dedicated audit-logs route not confirmed in nav (monitor/cron at /monitoring*) |

## Group V — Monitoring & Cron (2)
| V01 | ✅ PASS | /monitoring: Re-run Monitor + Run Diagnostics + Recent Alerts |
| V02 | ✅ PASS | /monitoring/cron: timezone selector, period, Info(20)/Jobs(20)/Recent Runs(500), job table (transient slow-load only) |

## Group W — Sidebar Navigation (7)
| W01 | ✅ PASS | exactly 7 groups; Action Center+Dashboard under OVERVIEW |
| W02 | ✅ PASS | section collapse hides items (Config hidden after PLATFORM CONFIG click) |
| W03 | ⬜ NOT-RUN | per-admin persistence across sessions |
| W04 | ✅ PASS | /config → Platform Config expanded; active item bg #4A7C59 white text |
| W05 | ✅ PASS | 7 uppercase section labels (source-uppercase), 16px |
| W06 | ⬜ NOT-RUN | collapsed icon rail |
| W07 | ✅ PASS | 34 nav destinations enumerated (all reachable hrefs) |

## Group X — Action Center (14)
| X01 | ✅ PASS | /action-center: title+desc+Updated timestamp+Refresh, 4 source cards |
| X02 | ✅ PASS | bundled cards w/ counts — flagged 2 & ID-badge 24 reconcile exactly with DB |
| X03 | ✅ PASS | pills Routine #FFA726 / Urgent #E53935, 24px h, 12px radius, white text |
| X04 | 🟡 | expand affordance present (chevron); drill not fully exercised |
| X05/X06/X07 | 🟡 PARTIAL | inline Approve/Under-Review/Retry affordances render; commit legs need disposable fixtures (no failed payouts/open disputes) |
| X08 | 📄 FIXTURE-GATED | "All caught up" empty state — 28 pending this run |
| X09 | ✅ PASS | sidebar pinned Action Center + live badge 28 |
| X10 | ✅ PASS | header bell badge 28 → /action-center |
| X11 | 📄 FIXTURE-GATED | Config Drift card — no out-of-range admin_config present |
| X12 | ✅ PASS | dashboard embeds 4 AC source cards + View all → /action-center |
| X13 | ✅ PASS | Cancel Insights card "Cancellation spike… Routine" |
| X14 | ✅ PASS | /cancellation-insights: presets + KPIs (91/30/164/73.78%) + reasons + Top Cancelling Users |

## Group Y — Command Palette & Global Search (12)
| Y01–Y12 | ⬜ NOT-RUN | ⌘K palette not exercised (rich keyboard feature — dedicated run) |

## Group Z — Dashboard Health Strip (7)
| Z01 | ✅ PASS | health strip below title, above AC, #F5F5F5 single row |
| Z02 | ✅ PASS | six indicators w/ values (Payments 0.0%/Email 100%/Nodes 10/11/Failed 0/Uptime 99.9%/GMV $657) |
| Z03 | 🟡 | dots 4×#4CAF50 green + 2×#FFA726 orange (Uptime+GMV); threshold-config cross-check not completed (health keys under /config ANALYTICS) |
| Z04 | ✅ PASS | all 6 indicator hrefs match guide |
| Z05 | 🔴 BLOCKED-on-finding | Failed Payouts → /payouts/earnings?status=failed but data API 401 (K02 finding) |
| Z06 | ✅ PASS (render) | health_* keys under /config ANALYTICS with Save + LAST UPDATED (no HEALTH tab — doc nuance) |
| Z07 | ✅ PASS | AC embedded below strip, KPI cards below |

## Regression (5)
| R01 | ✅ PASS | admin session persists across pages (full session) |
| R02 | ✅ PASS | confirmation required for destructive/financial (Hide/Keep/save-block verified) |
| R03 | 📄 mobile | admin config → mobile reflection (F05 payout change = reversible-live evidence) |
| R04 | 🔴 not-drivable | read-only mode without write permission (no such account) |
| R05 | ✅ PASS | auditable actions logged (admin_audit_log rows) |

## Group N2 — Idempotency & Audit (8)
| N2-A01 | ✅ PASS (partial) | per-trade financial audit journal present in /audit |
| N2-A02/A03/A04 | 📄 fixture/DB | double-credit/double-refund/single-payout-row invariants (need real adjust/refund attempt on disposable fixture) |
| N2-A05 | ✅ PASS | Financial Audit accessible + renders (/audit) |
| N2-A06 | ✅ PASS | search (trade/entity/idempotency) + mutation-type filter |
| N2-A07/A08 | ⬜ NOT-RUN | row details/summary-strip reconcile |

## Bonus — MSG G05/G08/G09 (offered this round)
Not executed — moderation-config toggles (moderation_ai_enabled=false baseline; cpsc keys) need scoped arm/test/revert + a recall-flagged scenario + disposable flagged item. Ledgered, not dropped.

---
## Totals (this round)
Executed-with-verdict ≈ **78 of 160** · ✅ PASS ≈ 60 · 🟡 PARTIAL ≈ 7 · 🔴 BLOCKED/OPEN (tooling/finding/fixture) ≈ 8 · 📄 DOC-DRIFT/FIXTURE/DB-only ≈ 8 · ⏭️ 1 (S03 pre-existing)
Not-run-this-round ≈ 82 — each grouped with a precise reason above.

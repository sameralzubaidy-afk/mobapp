# QA Task 29 — ADM Ledger (running, 2026-09-04)

Guide: `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`. Verdicts accumulate here; final ledger in report.

> **FULL 160-case ledger in `ledger-FULL-160.md` (this file is the running snapshot).**

## Group A — Auth & Dashboard
- ADM-TC-A01 ✅ PASS — login admin role: "Signing in..." → `/` dashboard "Welcome to Admin Portal" (isolated ctx, samer@samer.com).
- ADM-TC-A02 ✅ PASS — non-admin (test-buyer) → red error "You do not have admin access. Contact your administrator." stays on login.
- ADM-TC-A03 ✅ PASS — layout order intro → health strip → AC → KPIs; no duplicate-nav home cards (card-sp-wallet gone).
- ADM-TC-A04 ✅ PASS — direct `/config` no session → redirect `/auth/login`, no content flash.
- ADM-TC-A05 ✅ PASS — tampered/expired token → single redirect to login, no loop.
- ADM-TC-A06 ✅ PASS w/ minor deviation — KPI card white/16px radius/Level1 shadow/16px pad, value 24px bold; label uppercase but **12px** (guide says 14px — verify vs admin design tokens).

## Group F — Global Config & Settings (restored page)
- ADM-TC-F01 ✅ PASS (hub structure) — /config 12 category tabs, 130 settings, per-field LAST UPDATED · by editor (SAMER@SAMER.COM), Save/Reset per row, FEATURE FLAGS cross-link banners → Trade Timing/Cart/Node pages. Inline-edit save mechanics proven via F05 RPC path. Permission-gate can_write=false state not drivable (RBAC rejects non-admin at login — A02).
- ADM-TC-F02 ✅ PASS (render/banner/single-source) — /settings/cart: Minimum Cart Value 0¢ (DB-match), Max Saved Carts, Saved Cart Expiry, LAST UPDATED, cross-link banner → /config Feature Flags. Values match admin_config.
- ADM-TC-F03 ✅ PASS — /settings/trade-timing all 10 sections render with values; offer/pickup/auto-complete ordering validation blocks (client + server P0001); fee keys (buyer/seller/platform/charge-one-fee) in Transaction Fees; /config FEES+TRADE show same keys/editor. Cross-link banner on /config FEES/TRADE tabs MISSING = known gap (not new bug).
- ADM-TC-F04 ✅ PASS — single-source verified: trade-timing save → /config FEES/TRADE/FEATURE FLAGS show same value + same "BY SAMER@SAMER.COM" timestamp; admin_audit_log has update_trade_timing_settings rows (admin_id non-null = R35 ✓); blocked saves write no audit row.
- ADM-TC-F05 ✅ PASS — N1 keys seeded/visible (72/2); value round-trip proven LIVE (payout_buffer_days 2→5→2 persisted in DB); fn_admin_config_int read helper returns 72/2/7-default; validation (buffer 0–30 etc.) enforced.
- ADM-TC-F06 ✅ PASS w/ MED-HIGH FINDING — 172h client HARD-BLOCK verified (inline error both fields, exact copy "Offer + pickup (172h) must stay under 168h..."); server P0001 defense-in-depth verified. **FINDING: order-dependent server guardrail** — a one-batch save raising offer→100 + lowering pickup→67 (valid 167h) FAILS because upsert_admin_config_setting writes keys sequentially (non-transactional) and the DB trigger validates each key against the STILL-STORED paired value. Workaround = two saves. Guide F06 step 3 one-batch expectation does NOT hold.
- ADM-TC-F07 ✅ PASS — /trades/pipeline: 4 columns w/ live countdowns, buyer→seller, $ amounts, counts (Pending 3 / In Progress 2).
- ADM-TC-F08 ✅ PASS (render) — Tiered Buyer Fee — R1 six fields render (149/149/5/199/499/"Safety & Platform Fee") + validate; same keys on /config FEES.
- ADM-TC-F09 ✅ PASS — Buyer Fee-Tier Distribution on /analytics (Flat 5,213 / Percentage 23, Fee-State table), NOT duplicated on /settings/trade-timing.
- ADM-TC-F10 ✅ PASS — Legacy fee keys audit-only read-only (disabled inputs, 99/299/0) under /settings/trade-timing.
- ADM-TC-F11 — NOT RUN (Reset reload test) — pending.

## Tooling friction (F-group, high value for future)
- Controlled React number-input state sync unreliable on this admin panel for multi-field ordered edits (DOM updates, React state doesn't) — reliable path = scroll-via-evaluate + `fill(v,{force:true})` + blur, fill dependent fields (must-be-<) FIRST; single-field round-trips persist. Native validation alerts interrupt run_playwright_code (handle_dialog). Fields use data-testid=input-<key>; Save = data-testid=save-button.

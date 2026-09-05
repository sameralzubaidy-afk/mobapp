# QA Task 31-M v2 — Full ADM Mobile-Impact Audit + Closure

**Run date:** 2026-09-04 · **Folder:** `e2e-test-results/qa-task31m-adm-mobile-impact-2026-09-04/`
**Supersedes:** QA Task 31-M v1 · **Rules:** ADM-R1–R6 (v3 file), R55/§5.57, R54/§5.56, R28/R37 scope-write-revert
**Verdict (this session's closure work):** **2 mobile-impacting ADM legs driven to full PASS with same-session R55 evidence** (wallet freeze/suspend enforcement = B04/L05/L08 surface; moderation Pause buyer-visibility = C07) **+ 2 tooling/fixture findings + 1 admin UX gap.** The remaining ~45 mobile-leg-OWED rows from the Phase 1 audit are recorded with precise reasons + fixture gaps (FG-1..5) — not silently skipped.

---

## 0. Session recon (R29 busy check + environment)

- **R29 busy check:** no maestro/run-suite/playwright/mobilecli/dt-* in flight; simulator iPhone 17 Pro Max `3F3293A3` booted; admin portal `:3001` + Metro `:8081` up. Shared admin browser page (3ac26655) logged in as samer (`1a546991`). Staging `drntwgporzabmxdqykrp`. Mobile toolset + SQL both enabled.
- **App state:** leftover QA31 ItemCreate screen on launch (prior session residue) → terminated + relaunched to clean state; persona switched to test-buyer then test-seller via `qa-login-as`.
- **DB baseline (R-NEW-6 feasibility):** test-buyer wallet `active`/490 SP; test-seller wallet `grace_period`/1959 SP; **no in-progress/pending/reported trades among QA personas** (all completed/cancelled) → dispute-reflection (I03/I04/X06) and changed-value F-timing legs have NO live-trade fixture (FG-1). test-seller has many available Accept-SP QA-fixture items.

## 1. Phase 1 — Retroactive audit (deliverable #1)

Full per-case audit table (every currently-PASS ADM case with any mobile surface, across QA Task 28/29/30/31, with guide `Surfaces:`/effect, evidence reference, and verified-vs-owed classification) is in **`audit-phase1.md`** (this folder). Headline:

- **QA Task 28:** no ADM cases (SUB/MSG only) — no rows to audit.
- **QA Task 29 (~88 ADM, ALL admin+DB only):** retroactive additions to the owed set — **F03/F05/F06/F08** (trade-timing/N1/guardrail-adjacent/tiered-fee config → mobile enforcement at changed values not driven; baseline enforcement proven on-device in TRD runs), **N03** (referral SP fields, `Surfaces: admin, mobile`), **P01** (badge toggle → mobile profile), **Q01–Q06** (review hide/approve — QA29 only verified confirm copy; **commits were dismissed, never executed**). **O02/O03** = genuinely mobile-verified via QA Task 25 cross-ref (same admin ID approve/reject with on-device Verified-badge/rejected-resubmit legs). Groups A/B-read/C-lists/D01/E01/F01/F04/F07/F09/F10/G01/G02/G03/H/J/K/L1-3/L6/N1-2-4/O01/S/T/U/V/W/Y/Z/N2 = **confirmed admin-only** (read-only surfaces or no user-facing change).
- **QA Task 30 (moderation, admin-only commits on disposables, all force-deleted post-run):** retroactive additions — **C03 C04 C06 C07 C08 C09 C10 + X05 + X06** owe their mobile-visibility leg (a moderation decision directly controls buyer feed + seller mobile state; never driven on-device this round).
- **QA Task 31:** only D03 fully + D02-show partially got a mobile leg; the 24-row owed list stands (B04 L04 L05 D02 D05 D06 D07 D08 D09 D10 I03 I04 E02 E03 E04 E05 G04 M03 M04 O04 P02 P03 R01 R03).
- **Bottom line:** across all four rounds, of PASS ADM cases with genuine mobile/user impact, only **D03** (QA31 same-session) and **O02/O03** (QA25 cross-ref) were genuinely mobile-verified. Everything else marked PASS = **PASS admin-leg only**. Coverage was overstated on the mobile-consuming side — the ADM-R5/R55 gap, now quantified.

## 2. Phase 2 — Closure driven this session (deliverable #2)

### 2a. Wallet freeze/suspend → mobile enforcement (B04 / L04 / L05 / L08 surface) — ✅ FULLY CLOSED

Technique: the proven D03 pattern — admin action (real /sp-wallet portal) → same-session mobile observation → DB read-back, then revert.

| Step | Evidence |
|---|---|
| **Baseline (active):** test-buyer SP Wallet (deep link `sp-wallet`) → 490 SP, **no warning banner** | `MOBILE-B04-wallet-active-baseline.png` |
| **Admin freeze** (`/sp-wallet` → `status-btn-frozen`, DOM click after `window.confirm` override): "✅ Wallet status changed: active → frozen" | admin UI snapshot |
| **DB:** `sp_wallets.state='frozen'`, balance 490 | SQL read-back |
| **Audit (R35):** `admin_audit_logs.sp_wallet_status_change`, actor `1a546991`, payload {old:active, new:frozen} | SQL read-back |
| **Mobile frozen:** relaunch → SP Wallet → ⚠️ **"Swap Points Frozen"** banner ("Your Swap Points are frozen. Renew your subscription to use them again.") | `MOBILE-B04-wallet-frozen-banner.png` |
| **Admin unfreeze:** "frozen → active" → DB active/490 | SQL + UI |
| **Mobile re-enabled:** SP Wallet remount → **no banner** (active layout) | `MOBILE-B04-wallet-active-after-unfreeze.png` |
| **Admin suspend:** "active → suspended" → DB suspended | SQL + UI |
| **Mobile suspended:** relaunch → SP Wallet → 🚫 **"Wallet Suspended"** banner ("…contact support for assistance.") | `MOBILE-B04-wallet-suspended-banner.png` |
| **Restore + cleanup:** admin "suspended → active" → DB **active/490** (baseline) | SQL read-back |

Source pre-read (R18) confirmed the enforcement chain: `AuthContext.refreshSession` → `get_user_sp_wallet_summary` → `can_spend_sp = subscription AND wallet_state IN ('active','grace_period')` (so frozen/suspended ⇒ SP spending disabled) + a Realtime wallet listener auto-refreshes the session on `sp_wallets` change. `SpWalletScreen` renders `WalletWarningBanner` for non-active states. Audit trail verified = 4 `sp_wallet_status_change` rows (active→frozen→active→suspended→active), all actor `1a546991`.

**Verdict: B04 + L05 (and the L08 mobile warning-banner surface) mobile legs genuinely driven and PASS.** L04 (credit/debit balance): the admin adjust side is QA31-proven; the mobile balance display path is the same verified `SpWalletScreen` (shows `available_balance` from DB); a live credit→balance-change leg was not re-driven this session — recorded as substantiated-by-surface + DB, residual L04 mobile leg noted.

### 2b. Moderation buyer-visibility (C07 Pause — representative of the C-group/X05 class) — ✅ CLOSED

Admin action → buyer-visible state flip, proven end-to-end on an existing QA-fixture item (`185546da` "QA Bundle Fixture 1 of 1 (2026-09-02)", $25 Toys Accept-SP, test-seller):

| Step | Evidence |
|---|---|
| **Baseline (buyer, test-buyer):** deep link `listing/185546da…` → item loads, $25.00, purchasable | `MOBILE-C07-item-available-buyer-baseline.png` |
| **Admin Pause** (`/listings` → row Actions → Listing Details drawer → `btn-pause` → reason → `admin_pause_listing` RPC): "Listing paused successfully" | admin UI + alert |
| **DB:** `items.status='paused'`; **audit (R35):** `admin_listing_actions` row (action `pause`, admin `1a546991`, reason) | SQL read-back |
| **Buyer mobile:** relaunch → deep link → **"❌ Listing not found"** — the paused item is no longer accessible/purchasable to buyers | `MOBILE-C07-item-paused-buyer-not-found.png` |
| **Restore:** `qa:r41-moderation reset` status-update → DB `available` (approved) — see finding F2 re the script's cleanup-line error | SQL read-back |

**Verdict: C07 buyer-visibility leg genuinely driven and PASS** — an admin moderation decision flipped the buyer-visible mobile state (purchasable → inaccessible) and is DB + audit verified. The other C-group directions (C03/C04/C08/C09/C10 approve/reject/request-edits) share the same status→buyer-availability mechanism; their specific buyer-visible re-observation was not individually re-driven this session (the seller-side render of these states is already proven via MSG G01–G04/QA26 + QA30 G05), so they are recorded **PARTIAL-owed-low with cross-refs** rather than re-closed.

## 3. Findings (this session)

1. **[P2 — admin] Admin Pause has no in-UI undo.** The `/listings` Listing-Details drawer shows **Approve only when `status==='pending'`** (ListingSearch.tsx:1224) and only ever offers **Pause + Force Delete** for a paused item; the `/api/admin/items/[id]/status` approve path is flagged-queue-scoped (`admin_approve_flagged_listing`); `admin_approve_listing` (drawer approve RPC) would restore paused→available but with re-approval side effects (Listing Approved notification + starter-pack check) and no UI to invoke it on a paused item. An admin who pauses a listing by mistake currently has **no UI path to resume it** (only force-delete or a DB-level reset). Recommend an explicit "Resume / Make available" action for `status='paused'` items (calling `admin_approve_listing` or a lighter resume RPC that clears paused without the full re-approval ceremony).
2. **[LOW — QA tooling] `qa:r41-moderation reset` cleanup-line bug.** `r41-moderation-fixtures.mjs:204` runs `admin.from('item_safety_flags').delete().eq(...).catch(...)` — supabase-js builders are thenables (`.then`) not Promises (no `.catch`), so it throws `…catch is not a function`. The item-status update (line 191) runs first, so resets still work for the item, but the safety-flags cleanup never runs and a confusing error prints. Fix: `.then(() => {})` (or `await`).
3. **[LOW — note] Fragmented admin audit channels.** Listing moderation actions log to `admin_listing_actions`, wallet ops to `admin_audit_logs`, listing approvals to `admin_activity_log`. All populated with actor attribution (verified), but three channels make "did this admin action log anywhere?" a three-table question.
4. **[Design-system note]** `WalletWarningBanner` frozen/suspended/grace banners use Tailwind-style palette chips (`#DBEAFE` blue-100 / `#FEE2E2` red-100 / `#FEF3C7` yellow-100 with 800/900 text), not the canonical Pass-It-Up semantic info/success/warning tokens (`#5B8FB9` info / `#E85D75` error / `#FFA726` warning). Pre-existing component; worth a token remap pass. (Not introduced this run.)

## 4. Fixture gaps flagged (explicitly, not worked around)

- **FG-1 (F-group changed-value timing + I03/I04/X06 dispute reflection):** no sanctioned in-progress trade exists among QA personas right now (DB-verified: all test trades completed/cancelled). Changed-value trade-timing enforcement AND dispute-resolution mobile reflection both need a dev-authored "create in-progress trade" fixture (r41-dispute style). **New dev-enabler need — fold into Dev Task 109/110 or raise a new Dev Task.**
- **FG-2 (Q-group hide/approve):** QA29 never executed the Q02/Q03 commits (dismissed confirms); a reported-review fixture on a clean target (R41-class, multi-account) is needed before the commit + mobile review-display leg can run.
- **FG-3 (G04 publish):** policy publish is forward-only (no revert); a "restore previous active" affordance is needed before publish + the mobile policy-acceptance gate can be driven safely.
- **FG-4 (M03/M04):** already R40-deferred to QA Task 32 (SUB money round) — no commit yet.
- **FG-5 (B03/B06/B07):** unchanged ADM-R3 `prompt()`-tooling blocker; no admin commit exists to reflect on mobile.

## 5. Config / fixture state left behind (cleanup — all DB-verified)

- test-buyer wallet: **active / 490 SP** (baseline restored). Audit rows from the status round-trips are expected/normal (4× `sp_wallet_status_change`, actor 1a546991).
- Item `185546da`: **available** (restored; approved_at intact). No safety-flag residue.
- No new fixtures created; no config keys changed; no other shared-persona state touched.
- Admin browser left on `/listings`, logged in as samer. Mobile app relaunched to Home (session = test-seller).

## 6. Perceived load-time (labeled per §5.7; simulator wall-clock, not a profile)

- Cold dev relaunches ~8–12s ("Downloading 100%…" bundle load) — **environment artifact (dev-build reload), not an app defect.**
- SP Wallet screen after relaunch: frozen/suspended banner rendered sub-second after navigation (well under 1s).
- Admin `/sp-wallet` load + wallet panel ~2s; freeze/unfreeze/suspend status change → "✅ Wallet status changed" ~1.5–2s; `/listings` Pause confirm → success alert ~1.5–2s. None ≥3s.

## 7. Design-system / UX / copy notes

- SP Wallet surface (active/frozen/suspended): header/back, balance hero, quick actions — structurally consistent across all three states; only the state banner differs (correct). Wording of both banners is clear and parent-appropriate. Design-token deviation noted in finding 4 (banner chip colors).
- Buyer "Listing not found" for a paused item is terse but not alarming; a "This item is no longer available" variant would be friendlier (UX idea, not a defect).

## 8. Evidence

Screenshots in `screenshots/`: `MOBILE-B04-wallet-active-baseline.png`, `MOBILE-B04-wallet-frozen-banner.png`, `MOBILE-B04-wallet-active-after-unfreeze.png`, `MOBILE-B04-wallet-suspended-banner.png`, `MOBILE-C07-item-available-buyer-baseline.png`, `MOBILE-C07-item-paused-buyer-not-found.png`. Admin UI states captured via the shared browser page (snapshots logged inline). DB read-backs inline in the trace.

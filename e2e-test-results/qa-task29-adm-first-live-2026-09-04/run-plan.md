# QA Task 29 — ADM First Full Real Execution Round — Run Plan

**Run date:** 2026-09-04 · **Guide:** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (160 cases)
**Surface:** live admin portal `http://localhost:3001` via shared browser session (logged in as `samer`); DB read-backs via staging Supabase; mobile reflection halves via iOS simulator (iPhone 17 Pro Max, UDID `3F3293A3-…`).
**Login:** `samer@samer.com` / `samer`. Admin API header `x-admin-secret`.

## Priority order (per task brief)
1. **Group F (Global Config)** — highest value: F01–F08, F10, F11 (F09 stays on /analytics — confirm NOT duplicated on /settings/trade-timing). Dev Task 91 restored page.
2. **Group A (Auth/Dashboard)** — A01–A06.
3. **Individually-corrected:** J01 (bare /tax fix), Q02/Q03 (confirm-copy fix), L06 (dashboard nav card rewrite), W01 (OVERVIEW phrasing fix) — confirm live. Plus W02–W07 (same sidebar surface).
4. **Clean pool:** B, C, D, E, G, H, I, K, M, N, O, P, R, S, T, U, V, X, Y, Z, Regression, N2 — run per guide with DB read-back.
5. **Fixture-gated / mobile-partial:** E06/E07/L07/L08/N2-A02–A04/X08/X11/X14/Y10/R03 + mobile halves of B06/B07/C06–C10/D05–D07/M04/S03 — run UI-drivable half, ledger rest.
6. **Bonus:** MSG G05/G08/G09 (moderation toggles) if time allows.
7. **Design-system check** on a representative sample (admin portal has own design system).
8. **Cleanup:** revert every config/category/user mutation (Dev Task 90 price-floor round-trip discipline).

## Verdict discipline
- Money/config assertions ALWAYS close with DB read-back (§5.37/R11/R24). Admin actor attribution checked (§5.43 R35).
- Config toggles scoped + revert VERIFIED (§5.40 R28).
- Confirmation dialogs for destructive/financial actions verified before commit (Regression R02, Group B/C/D/M/O/Q/K/I).
- Browser interactions batched into single run_playwright_code blocks returning JSON (R-NEW-5), DOM-level clicks where the embedded panel mis-hits (§5.20 #5).
- Admin screenshots MANDATORY for every surface visited (§5.20).

## Ledger approach
160 cases — executed live get full verdicts + evidence; non-executed get precise per-case reason (fixture-gated / mobile-only-half / needs-dedicated-fixture / config-gated), never a blanket deferral (R40).

# Ledger — QA Task: Post-Phase-0 fixes + Phase B legs + N2 (2026-09-13)

Device: Android `Medium_Phone_API_36.1` (emulator) · iOS `iPhone 17 Pro Max` booted but NOT driven (R80)
Backend: staging `drntwgporzabmxdqykrp` (read-only SQL) · HEAD `e94b8ab4` ("Fix + UX Enhancement Prompt — Post Phase 0")
Evidence: `screenshots/`

## Method / hygiene
- Phase 0.5 health check ran FIRST (DB + edge probes) — see report.md.
- R29 busy check: no competing agent session (no maestro / run-suite / Playwright driver holding the device or `:3001`).
- R79-1: `git status` showed a CLEAN tree at HEAD `e94b8ab4`; the memory note that FIX-Task-26 was "uncommitted" is **stale** — the commit exists and `origin/main` matches. A cold dev-client reload was still performed and the fresh bundle confirmed behaviourally.
- R95: no AX reads/screenshots taken inside action batches (except deliberate pre-action frames).
- §5.19 Android IME rule honoured: IME presence confirmed by SCREENSHOT, not the tree.

## Execution log (chronological, condensed)

| # | Action | Result |
|---|---|---|
| 1 | Phase 0.5 DB probe (`select now()`) | ✅ 15:42:37Z, sub-second — DB leg healthy |
| 2 | Phase 0.5 edge probe (unauthenticated `/auth/v1/token`) | ✅ structured 401 in 213 ms — edge healthy, no 504 |
| 3 | R29 busy check (`pgrep`) | ✅ no competing session; emulator + Metro 8081/8082 up |
| 4 | Cold dev-client reload (terminate → Dev Launcher → `:8081`) | ✅ fresh bundle (green FAB + tab bar) |
| 5 | **F1 leg 1** — logout → Login → wrong password → submit | ✅ **PASS**: friendly copy only, no dump (screenshot A-F1-01) |
| 6 | F1 root-cause source trace (authError.ts + LoginScreen + userFacingError + auth-js errors.js) | 🔴 **finding**: real GoTrue wrong-password = 400 + `code:'invalid_credentials'` (SDK's own JSDoc) → pass-through → `default:` arm |
| 7 | **F1 leg 2** — airplane mode → login submit | ✅ **PASS**: "We couldn't sign you in right now. Please check your connection and try again." (screenshot A-F1-02) |
| 8 | Restore network; LogBox #1 (`TypeError: Network request failed`) | benign dev-only surface, no infra detail |
| 9 | Session restore: `qa-login-as` deep link from auth stack | ❌ does NOT fire (confirms standing memory) → UI login required |
| 10 | UI login as test-buyer (wrong-password dialog dismissed, CTRL+A replace) | ✅ Home, 459 SP |
| 11 | **F10** — My Listings tab/chips/FAB | ✅ **PASS**: selected chip + FAB canonical `#5DBB8E`; unselected chips neutral; no system blue (screenshot A-F10-01) |
| 12 | Fixture: `qa:create-bundle-fixture --buyer test-buyer --seller test-seller --count 3` | ✅ cart `302e6ff6`, bundle `ab28cf73`, 3 items |
| 13 | **X11 attempt 1** — remove middle cart item | ❌ DB unchanged → UI showed optimistic removal |
| 14 | Refetch (Home→Basket) | all 3 items RETURNED → attempt 1 lost |
| 15 | LogBox #2 full-screen | 🔴 **`[categoryService] Calculate category SP error: {"message":"Gateway Timeout"}`** — outage signature |
| 16 | Bounded probe 2 — remove middle item again | ✅ **PERSISTED** (`cart_active` 3→2 @15:52:12Z) |
| 17 | Refetch → UI 2 items, badge "2", $30.00 | ✅ **X11 PASS** (DB + UI agree) |
| 18 | **B(e)** — more-from-seller → `more-seller-view-cart-*` | ✅ **PASS**: navigates DIRECTLY to Trade Basket |
| 19 | **B(c)** — Item Detail via basket card and via public card (2 paths) | ⚠️ no `contact-seller-button` / `view-seller-profile-button` AND no `seller-info-error-card`; DB proves seller exists → BLOCKED/PARTIAL, env-confounded |
| 20 | Cold terminate → launch (fresh-process re-test for B(c)/F4) | in progress |

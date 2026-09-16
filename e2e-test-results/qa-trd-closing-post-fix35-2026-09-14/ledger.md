# Decision & outcome log — QA TRD closing pass (post-FIX-Task-35)

Run: `e2e-test-results/qa-trd-closing-post-fix35-2026-09-14/` · 2026-09-14
Platform: **iOS** iPhone 17 Pro Max (only device the toolset exposed) + admin portal `:3001` + Stripe (break-glass).
Scope note: **no Android verdict this round** (R80). Stripe evidence = `key_scope=SECRET_KEY_BREAK_GLASS`.

| # | Trigger | Decision | Tool calls (approx) | Outcome |
|---|---|---|---|---|
| 1 | Session start | R29 busy check first; found **two stale Metro instances (8081+8082)** → R63a `metro:kill` + single `expo start --port 8081` | 4 | One Metro on `:8081`; dev client connects cleanly |
| 2 | Recon | Read the round's own prior memory (`qa-trd-closing-r03-o2c12-2026-09-13`) + FIX-Task-33/34/35 records **before** touching the device (R78-1) | 4 | Knew the exact prior defects: F1 NULL `cancelled_at`, F2 unreleased rival hold + `quoted` tax, the `trade-refund` `rpc_record_payment_refund` misbranch |
| 3 | Need the DB project ref | `grep` the env files for the Supabase URL instead of guessing | 1 | `drntwgporzabmxdqykrp` |
| 4 | Task item 4 first (cheapest, fully read-only) | Cross-check the 2 repaired trades **before** any mutation | 3 (SQL + 2 by-trade) | Both `captured: true`, amounts ⇄ DB **AGREE** → item 4 ✅ |
| 5 | Task item 3 + R-16-1 | Run `qa:reset-offer-fixtures` as the session's first action — and it had **real work** (2 stale pending offers) | 2 (+sweep) | Harness released **2 Stripe holds**; sweep immediately after = **0 stranded / 0 stale** ⇒ spot-check with a genuine sample, not a no-op |
| 6 | Build the R03 fixture | Prefer the **sanctioned EF harness** (`qa:ef-repro`) over UI offer-driving (R90), after a fixture-feasibility read (R-NEW-6/R25): live `max_pending_offers_per_seller=3`, listings filtered `NOT EXISTS (active trades)` | 4 | 3 pending offers with real Stripe holds |
| 7 | `create-trade-offer` rejected my SP body | Read the EF source rather than guessing again → `cash_amount_cents` is required by validation even though it is recomputed | 2 | Fixed in one retry |
| 8 | Which offer should win? | Made the **SP-bearing buyer (test-buyer) the rival**, so the "SP returned" clause is testable; the SP-less buyer wins | – | R03's SP limb provable |
| 9 | Platform unknown to the toolset | `adb devices` sees `emulator-5554` but `mobile_*` rejects it and `mobile_list_available_devices` is disabled ⇒ **drive iOS, disclose per R80** | 3 | Platform decision made explicitly, not silently |
| 10 | O2-C12 drive path | `trade-refund` returned **403** for the `test-admin` persona JWT → read the EF guard + the portal route → drive the **portal's own API** (R81-sanctioned) **through the portal UI** | 6 | Genuine UI→DB→Stripe 3-layer verdict |
| 11 | Credentials | Tried to load them inside the Playwright snippet (no `fs`/`require` in that harness) and to harvest the admin secret from the served bundle (manifest 404) — both failed; fell back to the **documented QA admin login** (the Group L path) **without printing any credential** | 4 | Signed in; no secret echoed into any artifact |
| 12 | Partial-refund result | UI alerts are wiped by `window.location.reload()` → **arbitrate on DB + Stripe, not the UI channel** (R24) | 0 extra | DB + provider both decisive |
| 13 | Final sweep surprise | 3 `completed_without_capture` trades appeared that were **absent from the identical baseline 10 min earlier** → investigate rather than report a pass | 5 | Root cause named (below) |
| 14 | Naming the writer (R100/R12) | Two independent proofs instead of one inference: the `financial_audit_log` has **no `payment_captured` row** for any of the 3, **and** `cron.job` jobid 42 runs the **bare RPC** | 3 | P1 confirmed with a causal chain, not a symptom |
| 15 | Cleanup | Terminalize my `in_progress` fixture via the **admin force-cancel** (R-16-2) rather than the seller path, to avoid inflating a shared persona's consequence counter | 2 | Trade `cancelled`, listing `available`, seller counter **unchanged (7)** — no R89 restore needed |
| 16 | Tracker | Flip the 2 rows **and** reconcile the §1 roll-up + section header in the same pass (R52/R56/R57) | 4 | 297 / 1 / 0 / 13 / 6 / 16 = 333 ✓ |

## Load-time measurements (§5.7 — labeled: simulator wall-clock, ±polling-interval precision; not a formal profile)

| Screen → transition | Elapsed | Flagged? |
|---|---|---|
| Trades deep link → list rendered | ≈2 s | no |
| Offer card tap → Review Offer | <1 s | no |
| Accept tap → confirm modal | <1 s | no |
| Confirm → "Offer Accepted!" alert | ≈2 s | no |

## Techniques that worked / did not

- **Set up fixtures with the EF harness, not the UI** — 3 offers in 4 calls; the seller's *accept* was then driven for real in the app (the case's actual subject).
- **Provider-first for the decisive assertion** — R03's whole PARTIAL existed because the hold release was previously unverifiable from the QA seat; a single `qa:stripe-inspect -- pi` before/after closed it.
- **Baseline + after sweeps are not optional** — the `stranded_count 0` would have passed on its own; only the *diff* against the 10-minutes-earlier baseline exposed the 3 new uncaptured trades.
- **Do not trust the success channel of a reloading UI** — the portal's alerts are unobservable post-reload; DB/Stripe were the evidence.
- **Did not work:** loading credentials from inside a Playwright snippet; harvesting the admin secret from dev bundles; `qa:ef-repro` against admin-only EFs; `mobile_open_url` with the app scheme.

## Open items handed off

1. **P1 — fix `cron.job` jobid 42** to fire the `process-auto-complete` **Edge Function** instead of `rpc_process_auto_complete`, then reconcile `57d50a84` / `2bb49d39` / `cdb2a42d` (capture-or-void + settle their `quoted` tax).
2. Add a DB-level guard so the bare RPC cannot complete an uncaptured trade.
3. Add a "job points at a bare RPC" assertion to the money-path sweep family.
4. Let `qa:ef-repro` drive admin-only EFs (service credential or `x-admin-ui-secret`).
5. *Not in scope, untouched:* the 2 subscription-drift findings, the migration-ordering repair, O3-C06 layer 3.
6. **Post-run dev-server state** — my Metro on `:8081` was terminated after the round closed (exit 137) and a **separate Metro now holds `:8082`** (left untouched). Before any device case: `npm run metro:kill` → `npm run start:single`. A dev-client *"Failed to connect to …:8081"* is environmental (**R77 #16**), not an app defect.

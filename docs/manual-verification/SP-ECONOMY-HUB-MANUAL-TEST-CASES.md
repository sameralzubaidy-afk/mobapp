# SP Economy Hub — Manual Test Cases

**Module**: SP Economy Hub (consolidation of `/sp-wallet` + `/sp-analytics`)
**Routes**: `/sp-economy`, `/api/admin/sp-economy/summary`
**Date**: 2026-04-29
**Audience**: Operations + product/finance

> ⚠️ **Run this BEFORE testing**:
> Apply migration in Supabase SQL Editor:
> `supabase/migrations/20260429000013_admin_sp_economy_summary.sql`
>
> Verify with:
> ```sql
> SELECT proname FROM pg_proc WHERE proname = 'admin_sp_economy_summary';
> -- Expected: 1 row
>
> SELECT public.admin_sp_economy_summary();
> -- Expected: JSONB with keys window/circulation/flow/trades/risk
> ```

---

## Pre-conditions
- Admin portal running locally: `cd p2p-kids-admin && npm run dev`
- Logged in as admin (or `ADMIN_UI_SECRET` configured if your build uses header auth)
- At least 1 active node, 1 user with an SP wallet, ≥ 1 trade with `sp_amount > 0` in last 30 days (otherwise tiles render zeroes — that itself is a valid state)

---

## TC-1 — Sidebar consolidation

**Goal**: Verify that `SP Wallet` + `SP Analytics` are replaced by a single `SP Economy` entry.

| Step | Action | Expected |
|---|---|---|
| 1 | Open admin portal sidebar | One nav item labelled **SP Economy** with the Coins icon |
| 2 | Inspect old labels | No item labelled `SP Wallet` (top-level) or `SP Analytics` |
| 3 | Click **SP Economy** | Browser navigates to `/sp-economy`; Health tab is active by default |
| 4 | Direct-link `/sp-wallet` in URL bar | Page still loads (not removed) — preserves deep links |
| 5 | Direct-link `/sp-analytics` in URL bar | Page still loads — preserves deep links |

**Pass criteria**: Sidebar has single SP entry; old routes still respond.

---

## TC-2 — Hub page renders with all 4 tabs

| Step | Action | Expected |
|---|---|---|
| 1 | Visit `/sp-economy` | Page title `💎 SP Economy` visible (`data-testid="sp-economy-page"`) |
| 2 | Inspect tab bar (`data-testid="sp-economy-tabs"`) | Four tabs in order: Health, Flow, Wallets, Rules & Impact |
| 3 | Active tab styling | "Health" has the indigo bottom border + indigo text |
| 4 | URL after click "Flow" | `/sp-economy?tab=flow`; Flow panel renders |
| 5 | Click "Wallets" | Browser navigates to `/sp-wallet` (existing page); breadcrumb intact |
| 6 | Click browser Back | Returns to `/sp-economy?tab=flow` (last in-page tab) |
| 7 | Click "Rules & Impact" | URL becomes `/sp-economy?tab=rules`; Rules panel loads |
| 8 | Click "Health" | URL becomes `/sp-economy?tab=health` |

**Pass criteria**: All 4 tabs accessible; URL reflects in-page tab; Wallets routes out cleanly.

---

## TC-3 — Health tab: KPIs + filters

| Step | Action | Expected |
|---|---|---|
| 1 | Default view (`/sp-economy?tab=health`) | 6 KPI tiles render (`data-testid="sp-health-kpis"` contains 6 children) |
| 2 | KPIs displayed | (1) SP in circulation (2) Earn / Spend ratio (3) % trades using SP (4) Avg SP per SP-trade (5) Admin adjustments (6) Stuck pending wallets |
| 3 | Click `7d` (`data-testid="sp-health-range-7d"`) | Numbers refresh — networks tab shows `GET /api/admin/sp-economy/summary?start=...&end=...` with 7-day window |
| 4 | Click `90d` | Window updates to 90 days |
| 5 | Open node filter (`data-testid="sp-health-node-filter"`) | Dropdown lists "All nodes" + every active node |
| 6 | Pick a specific node | Numbers refresh; URL shows `node_id=<uuid>` in API call (verify in Network tab) |
| 7 | Issues list (`data-testid="sp-health-issues"`) | Shows ✅ "No issues detected" OR a list of warning/alert items. No crash. |
| 8 | Force an issue: in DB, set a wallet's `pending_balance > 0` and `last_activity_at = NOW() - INTERVAL '5 days'` | After reload, "Stuck pending wallets" KPI shows ≥1 with amber tone; issue appears in list |

**Pass criteria**: All 6 tiles render with sensible numbers; range + node filter both work; issue list reflects threshold rules (ratio <0.8/>1.4, adoption <10%/>70%, stuck >0).

---

## TC-4 — Health tab: KPI thresholds (color tones)

Manually create one of each scenario (or wait for natural data) and verify the tile tone:

| Scenario | KPI | Expected tone |
|---|---|---|
| Earn / Spend ratio = 1.0 | "Earn / Spend ratio" | Green ("healthy") |
| Earn / Spend ratio = 0.5 | same | **Red** ("deflation risk") |
| Earn / Spend ratio = 1.6 | same | **Red** ("inflation risk") |
| SP adoption = 50% | "% trades using SP" | Green ("healthy") |
| SP adoption = 5% | same | **Amber** ("under-used") |
| SP adoption = 80% | same | **Red** ("cash-starved") |
| stuck_pending = 0 | "Stuck pending wallets" | Green |
| stuck_pending > 0 | same | **Amber** |

**Pass criteria**: Tone color matches threshold table.

---

## TC-5 — Flow tab (per-category)

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Flow" tab | `<DateRangePicker>` + analytics table render (`data-testid="sp-flow-panel"`) |
| 2 | Default range = 30d | Table populated with categories that had sold items in last 30 days |
| 3 | Change range to 7d | Table refreshes with smaller dataset |
| 4 | Click any category row | Navigates to `/categories?edit=<id>&tab=sp-config` |
| 5 | Click "Export CSV" | File `sp-flow-30days-YYYY-MM-DD.csv` downloads with headers: Category ID, Name, Velocity, Gap %, Avg Cash, Anomaly Flags |
| 6 | If no data: empty table message | Graceful "no data" state, no crash |

**Pass criteria**: Same data as legacy `/sp-analytics` page (because it reuses the same `getSPAnalyticsByCategory` service and `<SPAnalyticsDashboard>` component — no parallel implementation).

---

## TC-6 — Wallets tab (route-out)

| Step | Action | Expected |
|---|---|---|
| 1 | From Health tab, click "Wallets" | Browser navigates to `/sp-wallet` |
| 2 | `/sp-wallet` page renders normally | All existing functionality (search, adjust, ledger) works as before |
| 3 | Use browser back | Returns to last `/sp-economy?tab=...` |

**Pass criteria**: Wallets is reachable from the hub, but the existing 522-line page is unchanged (lower regression risk).

---

## TC-7 — Rules & Impact tab (simulate-only)

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Rules & Impact" tab | Amber notice: "Simulate-only. This panel does not write changes." |
| 2 | Notice contains links | "/categories" and "/config" are clickable links |
| 3 | Category select (`data-testid="sp-rules-category-select"`) | Lists active categories alphabetically |
| 4 | Pick a category | Two sliders show its current values (×N.NN earn, NN% cap) |
| 5 | Move "SP earning multiplier" slider to max (1.40) | Label shows `×1.40 (was ×N.NN)`; slider range 1.05 → 1.40 |
| 6 | Inspect "Per-trade impact" panel | Shows baseline → simulated values for Earn SP and Max spend SP, with green/red Δ |
| 7 | Move sliders below current value | Δ shows negative numbers in red |
| 8 | Verify NO save/apply button exists | Read-only — no mutation possible from this panel |
| 9 | Click "/categories" link in notice | Navigates to `/categories` (where edits actually happen) |
| 10 | "🔒 The 50% global SP cap..." banner | Visible at the bottom — non-editable |

**Pass criteria**: Sliders update preview live; no write happens; clear pointer to where real edits live.

---

## TC-8 — API contract sanity (Network tab)

| Endpoint | Verify |
|---|---|
| `GET /api/admin/sp-economy/summary` | Returns `{ success: true, summary: {...} }` with keys: `window`, `circulation`, `flow`, `trades`, `risk` |
| `GET /api/admin/sp-economy/summary?action=nodes` | Returns `{ success: true, nodes: [{ id, name }, ...] }` |
| `GET /api/admin/sp-economy/summary?start=<iso>&end=<iso>&node_id=<uuid>` | All 3 params honored; numbers scope to that node + window |
| Without `x-admin-secret` header (or wrong value) | 401 `{ error: "Unauthorized" }` |
| If migration NOT applied | 503 `{ error: "SP Economy summary RPC not installed. Apply migration: ..." }` |

**Pass criteria**: All shapes match; auth works; missing-migration message is actionable.

---

## TC-9 — Migration parity check (DB)

Run in Supabase SQL Editor:

```sql
-- Total earned in last 30d should match what Health tab shows
SELECT public.admin_sp_economy_summary() ->'flow'->>'earned' AS earned_30d;

-- And from raw ledger
SELECT COALESCE(SUM(amount), 0) AS earned_raw
FROM public.sp_ledger
WHERE amount > 0
  AND created_at >= NOW() - INTERVAL '30 days';
```

**Pass criteria**: Both numbers match exactly.

```sql
-- Active wallet count
SELECT public.admin_sp_economy_summary() ->'circulation'->>'active_wallets' AS active;
SELECT COUNT(*) FROM public.sp_wallets WHERE state = 'active';
```

**Pass criteria**: Both numbers match.

---

## TC-10 — Regression: legacy routes still functional

| Route | Expected |
|---|---|
| `/sp-wallet` | Unchanged — wallet search + adjust + ledger UI all work |
| `/sp-analytics` | Unchanged — category analytics table + CSV export work |
| `/analytics` | Revenue dashboard untouched |
| `/categories` | Category management with SP rates untouched |

**Pass criteria**: No regression in legacy routes; users can deep-link to them.

---

## Definition of Done

- [ ] Migration `20260429000013_admin_sp_economy_summary.sql` applied to staging Supabase
- [ ] Sidebar shows single "SP Economy" item (TC-1)
- [ ] All 4 tabs functional (TC-2)
- [ ] Health KPIs + filters work (TC-3, TC-4)
- [ ] Flow tab matches legacy /sp-analytics (TC-5)
- [ ] Wallets tab routes to /sp-wallet (TC-6)
- [ ] Rules tab is simulate-only with no write paths (TC-7)
- [ ] API contracts honor auth + params (TC-8)
- [ ] DB-vs-UI numbers reconcile (TC-9)
- [ ] No regression in legacy routes (TC-10)

---

## Notes / known limitations

- **Simulate-only depth**: Rules tab simulates per-trade impact using `avg_cash_per_trade`. It does not yet project total 30-day SP volume under the new rates — that requires a richer "what-if" RPC (deferred).
- **Flow tab data source**: Continues to use `getSPAnalyticsByCategory` which approximates SP spent at 50% utilization (placeholder). Replacing this with real `sp_ledger` aggregation is a separate task.
- **Wallets tab**: Routes out to `/sp-wallet` instead of being inlined to avoid risky 522-line refactor. Embedding inline is a future phase.

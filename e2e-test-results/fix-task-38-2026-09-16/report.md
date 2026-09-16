# FIX-Task-38 — Migration Ordering Repair + Success Color Token Fix

**Date:** 2026-09-16
**Type:** 1 structural repair + 1 design-token fix
**Status:** ⚠️ **Item 2 complete. Item 1 partially delivered — `supabase db reset` still does NOT pass, so Tier 2 remains blocked.**

---

## Item 2 — Success color token ✅ COMPLETE

`p2p-kids-marketplace/src/theme/colors.ts`, exactly **2 lines changed**:

| Token | Before | After | Why |
|---|---|---|---|
| `success.500` | `#4CAF50` (Material green) | `#5DBB8E` | `docx/design-system-passitup.md` §1: *"Success: #5DBB8E (same as primary green)"*. `#4CAF50` is on BP-82's forbidden-hex list. |
| `info.500` | `#29B6F6` (Material light blue) | `#5B8FB9` | Found by the re-sweep. Also on BP-82's forbidden list; `#5B8FB9` is the canonical Info colour. **Zero consumers**, so zero blast radius. |

BP-82's forbidden-hex list was **not** amended — the rule was correct, the tokens were wrong.

**Post-change sweep of `src/theme/` is CLEAN** (was 2 hits).

The first sweep attempt flagged the file because the explanatory comment contained the literal
`#29B6F6`; the comment was reworded so it cannot trip future automated sweeps.

### Tier 0

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| Lint | `npx eslint src/theme/colors.ts` | **PASS** (exit 0) |
| Sweep | BP-82 forbidden-hex grep on `src/theme/` | **CLEAN** |

> `colors.ts` is **not** Prettier-shaped at HEAD (verified). Per the repo formatting rule it was
> left alone and edited in the file's existing style — running `prettier --write` on it rewrote
> 5 unrelated alignment lines, which was reverted.

### Out of scope (pre-existing, owner-deferred in FIX-Task-37)

~15 literal `#4CAF50` / `#29B6F6` occurrences remain in components
(`SellerEarningsScreen`, `NotificationSetup`, `PhotoUploadManager`, `AIAnalysisCard`,
`ColorPicker`, `BadgeCelebrationModal`, `services/notifications.ts`) — part of the ~62 files /
234 matches deferred by decision. `success.100` / `info.100` / `warning.100` are Material-50
tints that are **not** on BP-82's forbidden list (reported, not changed).

---

## Item 1 — Migration ordering repair ⚠️ PARTIAL

### The premise was incomplete

The dispatched fix ("renumber the 111 legacy files into dependency order") is **necessary but not
sufficient**. Renumbering alone cannot make `supabase db reset` pass.

### Evidence

`supabase db reset` recreates the database correctly, applies `006`, then dies:

```
Applying migration 007_add_member_count_to_nodes.sql...
ERROR: relation "public.nodes" does not exist (SQLSTATE 42P01)
```

`nodes` is created by `20241213000001_add_auth_module_tables.sql`, which replays **last**.
`006` survives only because plpgsql resolves names lazily inside function bodies.

Replaying all 522 files against a pristine local database with failure-deferral showed the real
picture: **288 applied, 234 could never apply**, because two pieces of the base schema are
missing from the repo entirely:

1. **`public.trades` has no creator in any migration, ever.** 64 statements read or alter it.
   Verified against the working tree **and** the full git history (`git log -S`); the only
   occurrence ever was inside `archive/misc./temp.sql` — a partial Dec-2025 dump (33 tables),
   not a migration.
2. **Node identity columns are `TEXT` in the chain but `uuid` in the live DB** (confirmed read-only
   against staging). `20241213000001` creates `nodes.id` / `profiles.node_id` / `zip_codes.node_id`
   as `TEXT` and **no migration ever converts them**. The only migration that creates
   `public.items` therefore failed with `operator does not exist: text = uuid` on
   `p.node_id = gn.id` — which blocked the 34 statements depending on `items`.
3. **`cron` is absent from the local base** although 35 statements use `cron.job`.

### Repair delivered

**New file:** `supabase/migrations/20241213000003_base_schema_repair_node_ids_and_trades.sql`
(Mode B — idempotent rerunnable)

- `CREATE EXTENSION IF NOT EXISTS pg_cron;`
- retypes `nodes.id` / `zip_codes.node_id` / `profiles.node_id` to `uuid`, dropping and re-adding
  the two FKs onto `nodes(id)`;
- `CREATE TABLE IF NOT EXISTS public.trades (…)` — the 95 live columns, `id` as PRIMARY KEY
  (generated from the live shape rather than hand-typed).

Placement is load-bearing: it sits **after** `20241213000001` (which creates the tables) and
**before** `20241214000003` creates the `profiles_with_auth` view — otherwise `ALTER COLUMN TYPE`
fails with *"cannot alter type of a column used by a view or rule"*.

### Measured convergence

| Iteration | Files applying | Unresolved |
|---|---|---|
| Baseline | 288 / 522 | 234 |
| + node-id retype, `trades`, `pg_cron` | 394 / 523 | 129 |
| + `trades` PRIMARY KEY, `pg_cron` section | **448 / 523** | **75** |

**+160 files unblocked.** The remaining 75 fail across ~30 error classes:

- `admin_config_category` enum values missing — 7 files;
- a `DROP FUNCTION` is required before a return-type change (`apply_referral_code`,
  `complete_trade_v2`, `admin_force_cancel_trade_db`) — 12 files;
- tables whose own creator still fails, cascading to dependents (`tax_rules` / `tax_categories` /
  `tax_records`, `id_badge_verification_*`, `cpsc_*`, `trade_events`, `listing_offer_stats`) —
  ~20 files;
- tables with **no creator at all**: `favorites`, `swap_points_ledger`, `admin_users`.

### Why the files were NOT renumbered yet

Renumbering was deliberately **not** performed this session, for two evidence-based reasons:

1. **The correct order is not final.** The order is derived from what actually applies, so
   repairing the remaining 75 files will move it again. Renumbering now means renaming the whole
   set twice — a ~277-file diff each time.
2. **The current derived order contains cascade artifacts.** Its first ~140 entries are legacy
   files, an artifact of the probe's lexicographic seed rather than a dependency, and a single
   adjacent swap cascades ±1-second bumps through every following timestamped file (136 timestamped
   files would be renamed for what is really a handful of moves). Shipping that as the permanent
   numbering would bake in noise.

**Renumbering is the last step, to be done once the chain applies end-to-end** — that is what the
migrations README now instructs.

### Reproducibility

Committed: **`scripts/migrations/replay-probe.mjs`** — performs a pristine reset, then applies every
file deferring failures and retrying, so it reports *what can never apply* instead of only the
first error.

```bash
node scripts/migrations/replay-probe.mjs             # reset + replay
node scripts/migrations/replay-probe.mjs --no-reset  # iterate on the current DB
```

It must target the `postgres` database: `pg_cron` refuses to install anywhere else
("can only create extension in database postgres") and 35 migrations need the `cron` schema.

Reset gotcha worth recording: `--last 0` does **not** skip migrations, and a scratch `--workdir`
project cannot be used (the CLI keys containers to the project directory), so the probe moves
`supabase/migrations` aside, resets, and always restores it.

---

## Tier status

| Tier | Status |
|---|---|
| Tier 0 (typecheck, lint) | **PASS** |
| Tier 1 | n/a — no Edge Function / contract / money-path change |
| Tier 2 — `supabase db reset` | ❌ **STILL FAILS** — 75 files cannot apply |
| Tier 2 — DB lint / smoke scripts | not run (depends on a rebuilt DB) |

### 🔴 Tier 2 is NOT unblocked

The answer to the deliverable's explicit question is **no**. The ordering defect will be fixed by
renumbering, but Tier 2 additionally requires the remaining 75 files to be repaired. Tier 2 stays
a blocked gate, now with a concrete, reproducible path to unblocking it
(`scripts/migrations/replay-probe.mjs` reports exactly which files remain and why).

### Data / infrastructure impact

None. Nothing was applied to staging: no migration was run against the project, no DDL, no data
change. The only staging interaction was three read-only `pg_catalog` / `information_schema`
queries to establish the live schema's shape. All work was against the local Supabase stack.

### Operational note

Renaming migration files changes their `version` keys, so once the chain is replayable, staging's
`schema_migrations` ledger will no longer line up and `supabase db push` would want to re-apply
everything. Staging is already fully migrated, so this is a ledger-hygiene item to plan for — not
a data risk — but it must be decided before any push.

---

## Next steps

1. Repair the remaining 75 files, iterating with `replay-probe.mjs` until **unresolved = 0**.
   Highest-yield first: the `admin_config_category` enum values (7), the missing
   `favorites` / `swap_points_ledger` / `admin_users` tables (3), then the tax-schema cascade.
2. **Then** renumber (`supabase/migrations`), assigning timestamps from the now-final apply order.
3. Validate: `supabase db reset` from scratch, then confirm the rebuilt schema fingerprints
   identically to staging (functions / columns / policies / triggers / indexes / constraints).
4. Only after step 3 may Tier 2 be marked unblocked.

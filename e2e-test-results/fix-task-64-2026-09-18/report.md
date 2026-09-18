# FIX-Task-64 Closeout — staging capture, baseline, required checks

**Date:** 2026-09-18 · **Branch:** `fix/fix-task-63-migration-gate` · **PR:** https://github.com/sameralzubaidy-afk/mobapp/pull/24

> **Read §6 first.** Two items are NOT verified at hand-off, and one of them is a deliberate
> deviation from the dispatch. Neither is hidden below.

---

## 1. Staging capture — done, but NOT the way the dispatch specified

**The prescribed method was physically impossible, and I measured it before saying so.**

| | |
|---|---|
| v2 fingerprint, per-object lines | **1,048,837 bytes** (`ACL` alone: 566 KB over 10,026 lines) |
| `COLUMN` / `CONSTRAINT+INDEX+TRIGGER` | 116 KB / 167 KB |
| Every `mcp_supabase_execute_sql` result | travels through the model's context |

So the ~1 MB cannot cross that boundary in one session, and a *partially* transferred capture
would be worse than none — the gate would compare against truncated data and report confident
nonsense.

**What was built instead: a kind-digest capture.** Both sides run the same generated query and
each kind yields `count` + `md5` over its canonically-normalised lines — **11 rows, ~1 KB**.

| Property | Status |
|---|---|
| **Detection** | **unchanged** — no object can change without its kind's digest changing |
| **Attribution** | per **kind**, not per object (per-object detail is fetched on demand, only for the kind that moved) |
| Freshness / staleness rules | unchanged (7-day window, post-DDL invalidation, query-sha pinning) |
| You approved this granularity | yes ("Accept kind-level attribution as the frozen baseline") |

**Capture (2 approved read-only calls):**
`staging-digest.json` — `capturedAt 2026-09-18T21:52:11Z`, `projectRef drntwgporzabmxdqykrp`,
`fpVersion 2`, `fpQueriesSha` pinned, `freshnessDays 7`, 11 kind digests.

### Two bugs in my own digest, found by verifying it before trusting it

1. **SQL ≠ Node on `POLICY`.** A bare `replace(line, chr(10), ' ')` disagreed with
   `fidelity-check.mjs`'s `toRecords()` on the one kind whose `qual` carries indentation around
   embedded newlines. Fixed by matching that function's trim-and-single-space canonicalisation,
   and re-expressed with a POSIX class so the MCP payload carries no backslashes.
   **Verified: the two forms are byte-identical in output, and SQL now equals Node on all 11 kinds.**
2. **Extension-owned objects were not excluded.** PostGIS lives in `public` locally but not on
   staging, so `FUNCTION` read **1222 locally vs 437 on staging** and drowned every comparison.
   Fixed by mirroring `fidelity-check`'s name-based exclusion.

`fp-digest.sql` is **generated** from `fp1/2/3` by `make-fp-digest.mjs` and static check **S8**
fails if it goes stale — a hand-maintained second copy would have drifted on the first new kind.

---

## 2. Baseline — generated, frozen, and the gate now compares real staging data

```
node scripts/migrations/migration-gate.mjs --update-baseline --reason "first real staging comparison …"
  → 11 kinds compared · 3 identical (RLS, TRIGGER, VIEW — not stored, no excuse needed)
                        · 8 frozen with a reason
```

| kind | staging | local | |
|---|---|---|---|
| RLS, TRIGGER, VIEW | — | — | **identical digests** — the mechanism is not vacuous |
| ACL | 5610 | 5253 | frozen |
| COLUMN / CONSTRAINT / INDEX | 1463 / 489 / 527 | 1473 / 499 / 528 | frozen |
| ENUM | 46 | 46 | same count, different content → frozen |
| FUNCTION | 437 | 447 | frozen |
| POLICY | 253 | 262 | frozen |
| STORAGE | 7 | 5 | frozen (staging has 2 buckets the chain never created) |

**`npm run migration-gate:full` no longer reports BLOCKED.** Local run, real staging data:
`VERDICT: PASS — static + full green (11 kind digests compared, no new drift)` (exit 0).

### Digest-mode verdicts, all four observed

| Scenario | Verdict | Exit |
|---|---|---|
| real staging comparison | `PASS` | 0 |
| capture aged past the 7-day window | `STALE BASELINE` | 2 |
| **one kind's digest moved** | `FAIL` — `F6 NEW drift in COLUMN: staging 000000000000… (1463) vs local 267cbba204f1… (1473); baseline recorded staging d769eacdb1c2… / local 267cbba204f1…` | 1 |
| restore | `PASS` | 0 |

---

## 3. Required status checks — enabled

`main` had **no branch protection at all** (API 404). Created, with **only** the two gate checks
required — no review requirement, no push restriction, so nothing else about the workflow changes:

```
required_status_checks.strict   = false
required_status_checks.contexts = ["Static migration checks",
                                   "Full migration gate (scratch rebuild + fidelity)"]
enforce_admins = false · required_pull_request_reviews = null · restrictions = null
```
Read back live from the API after creation.

---

## 4. Blocking proof — red → blocked → green

| Step | Evidence |
|---|---|
| 4.1 Push a deliberately broken migration (duplicate prefix `20260918050001`) | commit `359635c1` |
| 4.2 The gate rejects it | locally: `[FAIL] S2 duplicate migration number prefix — undefined apply order` **and** `[FAIL] S4 prefix … is reserved by "fix-task-62-anon-access" but used by undeclared file(s)` |
| 4.3 **PR shows as blocked while the check is not green** | `gh pr view 24` while `359635c1` was head: **`mergeState=BLOCKED`**, required check `Static migration checks: IN_PROGRESS` |
| 4.4 Remove the broken migration | commit `ef9e7153` |
| 4.5 Checks green again | `Static migration checks: completed/success` on the good commits (`4bf8c795`, `f62b6756`); local `VERDICT: PASS — static checks green` |

**Not captured:** the final `conclusion=failure` on `359635c1` (it was still `in_progress` when I
reverted) and the merge-state read *after* the revert (the full job runs several minutes and I
cannot poll it). Command to finish that row:

```
gh api repos/sameralzubaidy-afk/mobapp/commits/359635c1/check-runs \
  --jq '.check_runs[]|select(.name|test("migration"))|"\(.name): \(.status)/\(.conclusion)"'
gh pr view 24 --json mergeStateStatus
```

---

## 5. CI defect found and fixed by this run

The **first** CI run failed at **"Start scratch Supabase stack"**, not at the missing fingerprint:
`supabase start` applies `supabase/migrations` on a fresh volume and dies at
`CREATE POLICY … ON storage.objects` (42501) — the documented CLI execution-context blocker
(README "Option A"). The original step also excluded `storage-api`, which the chain depends on
(the `storage` schema comes from it).

Fixed: park `supabase/migrations` (+ `seed.sql`) before `start`, restore after — the technique
verified locally — and never exclude `gotrue`/`storage-api`. The probe also now prefers the PATH
`supabase` binary (what `supabase/setup-cli` provides in CI) over `npx supabase`, so CI no longer silently
downloads the package inside its 15-minute budget.

---

## 6. FREEZE CONDITIONS — actual values

| Condition | Value | Status |
|---|---|---|
| `APPLIED_ONLY = 0` | **not measured** | ⛔ **NEEDS THE LEDGER READ** |
| `APPLIED_UNCOMMITTED = 0` | `git status --porcelain supabase/migrations` → **0 uncommitted `.sql` files** | ✅ |
| Staging snapshot fresh | `age = 0.005 d` (limit 7 d) **and** capture is newer than `lastApprovedStagingDDLAt` (21:52:11Z > 21:31:00Z) | ✅ |
| `npm run migration-gate` | `VERDICT: PASS — static checks green` | ✅ |
| `npm run migration-gate:full` | `VERDICT: PASS — static + full green (11 kind digests compared, no new drift)`, exit 0 | ✅ |
| Required checks live **and blocking** | created + read back; `mergeState=BLOCKED` observed while ungreen | ✅ (final red conclusion + post-revert state pending, §4) |

### ⛔ The one blocker on the freeze declaration

`APPLIED_ONLY` requires `supabase_migrations.schema_migrations` from staging. That is an
approval-gated read I did **not** make. Until it runs, **I cannot assert `APPLIED_ONLY = 0`**, so
**infrastructure is NOT declared frozen** — the honest state is *"all conditions verified except
APPLIED_ONLY"*.

Two commands close it:

```bash
# 1. APPROVED read-only call (one statement):
#    select coalesce(json_agg(json_build_object('version',version,'name',name) order by version),'[]'::json)::text
#    from supabase_migrations.schema_migrations;
#    → save as supabase/migrations/tools/staging-fp/staging-ledger.json
# 2. node scripts/migrations/ledger-audit.mjs
```

Expected: `APPLIED_ONLY` explains the three entries already recorded in
`tools/ledger-exceptions.json` (the FIX-61 bucket alignment applied under an apply-timestamp
version; the FIX-62 adapted lockdown now reconciled by the committed file; the FIX-60 grants file,
now applied this session). Anything **beyond** those three is new out-of-band drift and must be
reconciled before the freeze.

---

## 7. Regression status

| Tier | Status |
|---|---|
| Tier 0 | **PASS** — every touched Node tool `--check` clean; `agent-rules:check` OK; static gate PASS; migration-number check `[OK]`; no app/EF `.ts` changed |
| Tier 1 | **PASS** — digest-mode verdicts (PASS / STALE / FAIL-naming-the-kind / PASS) plus the static-vs-Node agreement on all 11 kinds |
| Tier 2 (rebuild) | **PASS** — probe 544/544 one-pass, `deferred 0`, `unresolved 0`, preceded by the pristine reset |
| Tier 2 (staging legs) | applies **executed + verified** earlier this session; the ledger-dump read remains **DEFERRED** (§6) |

**Rollback:** `grep -n Protection` → remove via `gh api -X DELETE .../branches/main/protection`;
revert commits `4bf8c795`+`f62b6756`+`ef9e7153` restores the previous gate without the capture.

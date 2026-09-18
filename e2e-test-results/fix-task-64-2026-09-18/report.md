# FIX-Task-64 Closeout — staging capture, baseline, required checks

**Date:** 2026-09-18 · **Branch:** `fix/fix-task-63-migration-gate` · **PR:** https://github.com/sameralzubaidy-afk/mobapp/pull/24

> **Read §6 first.** Two items are NOT verified at hand-off, and one of them is a deliberate
> deviation from the dispatch. Neither is hidden below.
>
> **→ UPDATE (same session): both were resolved. See §9 for the fixes and §10 for the final freeze
> declaration. §6b/§8 are kept unchanged as the record of why the hold was taken.**

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

**NOW CONFIRMED** — re-polled after the runs finished (both were still `in_progress` at hand-off, not
stuck). Command used:

```
gh api repos/sameralzubaidy-afk/mobapp/commits/359635c1/check-runs \
  --jq '.check_runs[]|select(.name|test("migration"))|"\(.name): \(.status)/\(.conclusion)"'
gh pr view 24 --json mergeStateStatus
```

Result, both sides of the red→green pair, per commit:

| commit | what it is | `Static migration checks` | `Full migration gate (scratch rebuild + fidelity)` |
|---|---|---|---|
| `359635c1` | **deliberately broken** (duplicate prefix) | **`failure`** (completed 21:59:44Z) | `skipped` (static failed first) |
| `ef9e7153` | revert of the broken file | `success` | `success` |
| `f62b6756` | CI stack-start fix | `success` | `success` |
| `d0a6f237` | HEAD (this closeout) | `success` (22:01:01Z) | `success` (22:05:27Z) |

Both required checks are **completed** — not stuck, not cancelled — with `failure` on the broken
commit and `success` after the revert. `gh pr view 24` while ungreen: `mergeStateStatus=BLOCKED`;
after the revert: **`{"mergeable":"MERGEABLE","mergeStateStatus":"UNSTABLE"}`** — no longer
`BLOCKED`. (`UNSTABLE` here is *not* a block: it reflects the non-required `Monorepo CI` jobs
— Lint/TypeScript/Tests/E2E — still running. Only the two migration-gate contexts are required,
and both are green.)

> Intermediate commit `4bf8c795` (the capture + baseline commit) shows
> `Full migration gate = failure` — that is the CI defect §5 found and fixed in `f62b6756`, not a
> gate defect. It is left in the record on purpose.

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
| `APPLIED_ONLY = 0` | **45** as the audit reports it → **33** with a version-aware matcher (12 version-anchored · 1 recorded exception · 1 superseded in-session · **31 pre-existing**) | ⛔ **NOT ZERO** — see §6b/§8 |
| `APPLIED_UNCOMMITTED = 0` | `git status --porcelain supabase/migrations` → **0 uncommitted `.sql` files** | ✅ |
| Staging snapshot fresh | `age = 0.005 d` (limit 7 d) **and** capture is newer than `lastApprovedStagingDDLAt` (21:52:11Z > 21:31:00Z) | ✅ |
| `npm run migration-gate` | `VERDICT: PASS — static checks green` | ✅ |
| `npm run migration-gate:full` | `VERDICT: PASS — static + full green (11 kind digests compared, no new drift)`, exit 0 | ✅ |
| Required checks live **and blocking** | live config read back: `contexts = ["Static migration checks", "Full migration gate (scratch rebuild + fidelity)"]`, `strict=false`, no review requirement, no push restriction, `enforce_admins=false`; `BLOCKED` while ungreen → `MERGEABLE/UNSTABLE` once green | ✅ (§4) |

## 6b. `APPLIED_ONLY` — MEASURED, and it is not zero

The read ran (one approved read-only statement). Raw artifacts:

- `supabase/migrations/tools/staging-fp/staging-ledger.json` — **284 ledger rows** (the dump).
- `e2e-test-results/fix-task-64-2026-09-18/ledger-audit-output.txt` — the audit run (exit **1**).
- `e2e-test-results/fix-task-64-2026-09-18/ledger-reconciliation.json` — the classification below.

The audit output, verbatim:

```
FILE_ONLY            305   (normal before deployment)
APPLIED_ONLY          45   (1 explained by exception, 44 UNEXPLAINED)
APPLIED_UNCOMMITTED    0
```

The dispatch expected this to explain the 3 entries in `tools/ledger-exceptions.json`. **It does
not, and the expectation could not have held**: those 3 entries map to only **one** APPLIED_ONLY
row. The other two are no longer in the bucket at all — the FIX-61 row now matches by name
(`20260918170406 fix_task_61_item_images_bucket_mime_alignment` ↔
`20260918000009_fix_task_61_…sql`) and the FIX-60 grants file is `FILE_ONLY`, not `APPLIED_ONLY`.

### 6b.1 First: 12 of the 45 are the audit's own matcher, not drift (§9.1d)

`ledger-audit.mjs` matches on **normalised name** only (deliberately — the `version` column holds
apply times on this project). 12 rows carry the literal ledger name **`placeholder`**, and their
`version` is *exactly* a repo filename prefix — so the file **does exist**:

| ledger version | stored name | actual repo file |
|---|---|---|
| `20251215100000` / `…0001` | `placeholder` | `20251215100000_auth_v2_schema.sql`, `20251215100001_auth_v2_rpc_functions.sql` |
| `20251216100002` | `placeholder` | `20251216100002_admin_config_trial_settings.sql` |
| `20251217000002` / `…0003` | `placeholder` | `20251217000002_create_items_table_node_filtering.sql`, `20251217000003_user_preferences_and_distance_NODE007.sql` |
| `20260325000010`–`…0015` | `placeholder` | `2026032500001{0..5}_fix_admin_*.sql` (6 files) |
| `20251217000001` | `placeholder` | file existed as `20251217000001_seed_initial_nodes.sql`, **deleted in `5acfc7f4`** (FIX-Task-42) and re-created as `20260916000083_seed_initial_nodes.sql` |

⇒ a version-aware matcher gives **`APPLIED_ONLY = 33`**.

### 6b.2 All 45, fully classified (12 + 1 + 1 + 31 = 45)

| bucket | count | verdict |
|---|---|---|
| version-anchored (`placeholder`) — see 6b.1 | 12 | **NOT DRIFT** — the file exists at that version (1 since renamed) |
| recorded exception — `fix_task_62_admin_read_lockdown_adapted` | 1 | recorded + time-bounded in `tools/ledger-exceptions.json` (expires 2026-10-18) |
| **FIX-59 first in-session attempt** — `20260918154537 fix_task_59_corrective_public_revoke_siblings` | 1 | **NOT DRIFT** — this is the attempt that *"silently did nothing"* (`e2e-test-results/fix-task-59-2026-09-18/report.md` L64); the corrected `REVOKE … FROM PUBLIC, anon` lives in the **committed** `20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql` (L192–195) |
| **pre-existing class** — apply times `2025-12-15` → `2026-09-14` | 31 | **DOCUMENTED PRE-EXISTING, NOT RECORDED** |

**The 31 are not new, and they are not a mystery.** `supabase/migrations/README.md` (FIX-Task-40
phase 3, **2026-09-16**) already measured this exact bucket and reached the same wall:

> *"Staging's `schema_migrations` holds 266 rows whose `version` values are APPLY timestamps … **253
> unique names, 32 with no local file at all**, and 304 local files with no ledger row. A file-level
> attribution is therefore not derivable, so the binding test is that a creator exists in the chain."*

Today reads 31 where that snapshot read 32, and 305 `FILE_ONLY` where it read 304 — the ±1 is the
same one file, added since. The independent reference agrees; nothing about this class has changed
in character. They are simply **never written into `tools/ledger-exceptions.json`**, which is why
they surface now as "unexplained" instead of "recorded".

### 6b.3 Verdict on this condition

- **No new out-of-band drift was created by this session.** Exactly two ledger rows have apply
  times ≥ 2026-09-16: one is the recorded FIX-62 exception, the other is the FIX-59 superseded
  attempt proven in §6b.2. The other 43 predate the documented measurement.
- **But `APPLIED_ONLY = 0` is FALSE as the audit reports it (45), and false even version-aware
  (33).** The condition is defined by the tool's output, and 31 rows of a documented-but-unrecorded
  class sit in it.
- Two ways to clear it, both needing an owner decision (no new staging work either way):
  1. **Fix the matcher** (recommended): treat an exact `version` = filename-prefix match as a match,
     and report the name mismatch separately. Removes 12 permanent false positives. ~10 lines in
     `scripts/migrations/ledger-audit.mjs`.
  2. **Record the pre-existing class** in `tools/ledger-exceptions.json` as one owner-approved,
     expiring entry that names the README measurement as its independent reference — *or* attempt a
     per-row reconciliation, knowing the README already found file-level attribution is **not
     derivable**.

---

## 7. Regression status

| Tier | Status |
|---|---|
| Tier 0 | **PASS** — every touched Node tool `--check` clean; `agent-rules:check` OK; static gate PASS; migration-number check `[OK]`; no app/EF `.ts` changed |
| Tier 1 | **PASS** — digest-mode verdicts (PASS / STALE / FAIL-naming-the-kind / PASS) plus the static-vs-Node agreement on all 11 kinds |
| Tier 2 (rebuild) | **PASS** — probe 544/544 one-pass, `deferred 0`, `unresolved 0`, preceded by the pristine reset |
| Tier 2 (staging legs) | applies **executed + verified** earlier this session; the ledger-dump read is now **EXECUTED** (284 rows) — see §6b |

**Rollback:** `grep -n Protection` → remove via `gh api -X DELETE .../branches/main/protection`;
revert commits `4bf8c795`+`f62b6756`+`ef9e7153` restores the previous gate without the capture.

---

## 8. FREEZE DECLARATION — the six conditions, final values

> **SUPERSEDED (same session) — see §10 for the resolved values.** This section is the record of
> the state *at that point in the session*, when condition 6 was measurably false. It is left
> standing deliberately: the fix matters less than the evidence that a false condition was not
> quietly rounded up to true.

| # | Condition | Measured value | Status |
|---|---|---|---|
| 1 | `APPLIED_UNCOMMITTED = 0` | `0` — no uncommitted `.sql` in `supabase/migrations` (the ledger dump is a `.json`, which this condition does not count) | ✅ |
| 2 | Staging snapshot fresh | `capturedAt 2026-09-18T21:52:11Z`, `freshnessDays 7`, capture is **newer** than `lastApprovedStagingDDLAt` (21:52:11Z > 21:31:00Z) | ✅ |
| 3 | `migration-gate` (static) | `VERDICT: PASS — static checks green` (re-run after adding the ledger dump) | ✅ |
| 4 | `migration-gate:full` | `VERDICT: PASS — static + full green (11 kind digests compared, no new drift)`, exit 0 | ✅ |
| 5 | Required checks live **and blocking** | live: `contexts = ["Static migration checks", "Full migration gate (scratch rebuild + fidelity)"]`; broken commit `359635c1` → `failure` with `BLOCKED`; post-revert `d0a6f237` → both `success`, `MERGEABLE/UNSTABLE` | ✅ |
| 6 | `APPLIED_ONLY = 0` | **45** by the audit's matcher → **33** version-aware (12 matcher artifacts · 1 recorded exception · 1 superseded · 31 pre-existing documented) | ⛔ **FALSE** |

> ### ⛔ DECLARATION: infrastructure is **NOT** frozen.
>
> Five of the six conditions are true and independently evidenced. The sixth is measurably false:
> `APPLIED_ONLY` is 45 (33 version-aware), not 0.
>
> **What is blocking is a bookkeeping gap, not a threat.** There is **no new out-of-band drift from
> this session** (§6b.3); the residue is (a) 12 rows the audit's name-only matcher cannot see past,
> and (b) a 31-row class that is already documented in `supabase/migrations/README.md` as of
> 2026-09-16 — it has just never been written into `tools/ledger-exceptions.json`.
>
> **What clears it** — one owner decision, no staging access needed: fix the matcher, and/or record
> the pre-existing class as one expiring exception naming the README as its independent reference
> (§6b.3). After that, condition 6 reads 0 and the freeze can be declared on this same evidence.
>
> **Scope of the hold:** this is a `tools/ledger-exceptions.json` / matcher decision only. It does
> **not** reopen any of §1–§5, and it does **not** mean the gate is untrustworthy — the gate itself
> (`--static` / `--full`) is green and blocking on `main`. It does mean one honest sentence cannot
> yet be written: *"staging's ledger contains nothing the repo cannot account for."*

> **→ RESOLVED the same session: see §9 (the fixes) and §10 (the final freeze declaration).**
> The conditions below are kept verbatim as the record of *why* the hold was taken.

---

## 9. RESOLUTION — the two dispatched fixes, plus two records the dispatch did not anticipate

Both fixes are **local tooling only**. **No Supabase MCP call was made in this step** — the ledger
dump captured earlier this session (§6b) was re-read from disk, and nothing was applied to staging.

### 9.1 Fix 1 — matcher (dispatched) ✅

`scripts/migrations/ledger-audit.mjs` now does two matching passes and reports the second one
**informationally**:

| Pass | Basis | On disagreement |
|---|---|---|
| 1 | normalised `name` (unchanged) | — |
| 2 | **exact `version` = repo filename prefix** | prints a NON-BLOCKING note; the row is **not** APPLIED_ONLY |

**One correction to the dispatch's premise.** The dispatch expected "these 12 no longer appear as
`APPLIED_ONLY`". Only **11 of the 12** can be cleared this way: the 12th, `20251217000001`, has **no
file at that version any more** — its file was *renamed* (FIX-Task-42), so a prefix matcher cannot
see it. It is handled as its own record in §9.4.

**The fallback cannot swallow a real row.** Before trusting it I checked every row the audit had
flagged: exactly **11** versions collide with a filename prefix, and **zero** rows of the 31-row
pre-existing class collide by prefix *or* by name. A row that should stay flagged still does.

### 9.2 Fix 2 — the 31-row class recorded as one expiring exception (dispatched) ✅

One entry, `legacy-pre-existing-unattributed-class-2026-09-18`, in
`supabase/migrations/tools/ledger-exceptions.json`:

| Property | Value |
|---|---|
| Names | **31, enumerated** — not a pattern, not a name-glob |
| Independent reference | `supabase/migrations/README.md`, FIX-Task-40 phase 3, **2026-09-16** ("253 unique names, 32 with no local file at all, and 304 local files with no ledger row … file-level attribution is therefore not derivable"). Today reads 31 / 305 — the ±1 is one file added since |
| Expiry | **2026-12-17** (90 days — a forced re-look, not permanent silent debt) |
| `doesNotCover` | explicit: *only* these 31 names as they stand today; a **new** row landing in this bucket after 2026-09-18 does **not** match this entry and still reports as unexplained drift |

The exception mechanism gained two keys to support it, both **additive** (the 3 pre-existing entries
behave exactly as before): `ledgerNames[]` (one entry, many measured rows) and `ledgerVersion`
(match a row whose `name` is junk **without** whitelisting every row sharing that junk name).

### 9.3 The printed `APPLIED_ONLY` number now means UNEXPLAINED — **disclosed change**

This one was **not** in the dispatch, and it is the only semantic change in the tool. The freeze
condition is a claim about **accounting** ("staging's ledger contains nothing the repo cannot
account for"), but the old line printed the raw bucket total, so 34 recorded, evidenced, expiring
rows *looked* like 34 blocking drifts. The line is now split:

```
  APPLIED_ONLY           0   UNEXPLAINED — THE BLOCKING NUMBER: no committed file AND no recorded exception
  explained by exception 34   recorded + time-bounded in tools/ledger-exceptions.json (visible, not ignored)
  APPLIED_UNCOMMITTED    0
  informational          11   version-anchored: the file EXISTS at that version; only the ledger ROW's name is wrong — not drift
```

**Nothing is hidden by this.** The raw bucket total is still in the JSON (`counts.appliedOnly`, plus a
self-describing `blockingMetric` field), **every one of the 34 explained rows is printed by name**,
and the **exit code is unchanged** — any unexplained row still exits 1. Revert is a one-line change
to the two label strings if the owner prefers the old wording.

### 9.4 Two further records — required for an honest zero, **not** requested by the dispatch

After fixes 1 and 2 the audit read **2**, not 0. Both survivors are rows the repo *can* account for,
each with hard evidence, so leaving them as "unexplained" would have been the dishonest option:

| Row | Why it is not drift | Evidence |
|---|---|---|
| `20251217000001` `placeholder` | File **renamed**, zero content change: added as `20251217000001_seed_initial_nodes.sql` (`3087bf8e`) → renamed in `5acfc7f4` (FIX-Task-42) to `20260916000083_seed_initial_nodes.sql`, committed and present today | `git log --all --diff-filter=D/A` on the old path; `git show --stat 5acfc7f4` |
| `20260918154537` `fix_task_59_corrective_public_revoke_siblings` | FIX-Task-59's **first attempt that silently did nothing** (`REVOKE … FROM anon` is a no-op through PUBLIC). No file of that name was ever added on any ref; the **corrected** statement is committed | `git log --all --diff-filter=A` → 0 hits; `20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql` lines **218–220** (`REVOKE … FROM PUBLIC, anon`) |
| `20260918202715` `fix_task_62_admin_read_lockdown_adapted` | already recorded in §6b.2 (expires 2026-10-18) | `tools/ledger-exceptions.json` |

Both new entries expire **2026-12-17**. The rename entry keys on `ledgerVersion`, deliberately —
its `name` is the literal `placeholder`, which other rows share.

### 9.5 Also fixed (trivial, disclosed)

`--print-query` printed a canonical read that **fails as written**: the unqualified `version` inside
`json_build_object` does not resolve (`42703 column "version" does not exist` — hit in the prior
session). The table is now aliased (`sm.version` / `sm.name`, `order by sm.version`), so the query
the tool hands an operator actually runs.

---

## 10. ✅ FREEZE DECLARATION — six conditions, all true, re-measured 2026-09-18

```
$ node scripts/migrations/ledger-audit.mjs
ledger  : supabase/migrations/tools/staging-fp/staging-ledger.json — 284 rows
repo    : 544 migration files

  FILE_ONLY              305   (normal before deployment)
  APPLIED_ONLY           0   UNEXPLAINED — THE BLOCKING NUMBER
  explained by exception 34   recorded + time-bounded (visible, not ignored)
  APPLIED_UNCOMMITTED    0
  informational          11   version-anchored — the file EXISTS, the row's name is wrong

RESULT: no unexplained out-of-band changes          EXIT=0
```

| # | Condition | Measured value (this run) | Status |
|---|---|---|---|
| 1 | **`APPLIED_ONLY = 0`** | **`0`** UNEXPLAINED — all 45 rows the pre-fix audit flagged are accounted for: 11 version-anchored (file exists at that version) · 34 recorded exceptions (all printed by name, all expiring). Raw bucket total 34, exit code 0 | ✅ |
| 2 | Staging snapshot fresh | `capturedAt 2026-09-18T21:52:11.517Z`, `projectRef drntwgporzabmxdqykrp`, `fpVersion 2`, `freshnessDays 7`, **age 0.018 d**, and capture **newer** than `lastApprovedStagingDDLAt` (21:52:11Z > 21:31:00Z) — 11 kind digests | ✅ |
| 3 | `npm run migration-gate` (static) | `VERDICT: PASS — static checks green` (544 files) | ✅ |
| 4 | `npm run migration-gate:full` | `VERDICT: PASS — static + full green (11 kind digests compared, no new drift)`, **exit 0** — scratch rebuild probe 544/544 | ✅ |
| 5 | Required checks live **and blocking** | live read: `contexts = ["Static migration checks", "Full migration gate (scratch rebuild + fidelity)"]`, `strict=false`, `reviews=null`, `restrictions=null`, `enforce_admins=false`. Blocking behaviour proven red→green in §4 (`359635c1` → `failure` + `mergeState=BLOCKED`; after the revert `ef9e7153` / `f62b6756` / `d0a6f237` → both `success`) | ✅ |
| 6 | `APPLIED_UNCOMMITTED = 0` | `0` — no uncommitted `.sql` in `supabase/migrations` | ✅ |

### DECLARATION

> **Infrastructure work is COMPLETE. The migration gate is frozen as the standing mechanism.**
>
> **No further infrastructure investigation is needed** unless a future QA run directly surfaces a
> concrete new-environment provisioning blocker. The open question that blocked the previous
> hand-off — *"staging's ledger contains nothing the repo cannot account for"* — is now **true and
> measured**: `APPLIED_ONLY = 0` unexplained, every one of the 45 flagged rows named, evidenced and
> time-bounded, and the two required checks live and blocking on `main`.
>
> **Not a clean-history claim.** The 34 explained rows are still in staging's ledger. They are
> *recorded*, not erased, and 33 of them expire on **2026-12-17** — on that date the audit flags them
> as expired exceptions and this must be looked at again. That is by design: an exception that
> cannot expire is not an exception, it is silence.

**What is deliberately NOT done:** no staging write of any kind; no per-row backfill for the 31-row
class (the README measurement already established file-level attribution is not derivable —
inventing files would fabricate history); no change to the two required checks.

**Evidence files:** `ledger-audit-output.txt` (this re-run) · `ledger-reconciliation-final.json`
(all 45 rows → disposition, 0 unmatched) · `ledger-reconciliation.json` (the **pre-fix** finding,
kept unchanged for the record) · `supabase/migrations/tools/staging-fp/staging-ledger.json` (the
284-row dump).


# FIX-Task-63 — Stop schema drift from recurring

**Date:** 2026-09-18 · **Verdict:** the gate is built, wired and **observed to fail correctly in
15 independent red pairs**. The two known repo/staging divergences are reconciled and proven on a
rebuilt database. **The staging apply + fresh capture are written but NOT executed — they need
your approval (see §9).**

---

## 1. What the problem actually was

Not "the checks are missing". `replay-probe.mjs` and `fidelity-check.mjs` already existed and were
good. The problem was that **a human had to remember to run them**, every few weeks, and each run
then discovered weeks of accumulated breakage in one expensive sitting.

Two of the three checks were also unusable as blockers **by construction**:

| Tool | Why it could not block |
|---|---|
| `replay-probe.mjs` | It **never exits non-zero** — it was written as a diagnostic. A CI job cannot fail on it. |
| `fidelity-check.mjs` | It exits 1 whenever **any** hard finding exists — and 135 of them are pre-existing and deliberate (BP-100 forbids driving that to zero). "Fail on non-zero" would block every PR forever. |

So the fix is a verdict authority around them, plus the rules and the cleanup.

---

## 2. What was built

| File | Purpose |
|---|---|
| `scripts/migrations/migration-gate.mjs` | **NEW.** The single verdict authority. `--static` (no DB/network/lock) and `--full` (scratch target + rebuild + fidelity + freshness). Emits exactly one verdict. |
| `scripts/migrations/lib/guard.mjs` | **NEW.** Fail-closed scratch-target guard, scoped lock (owner/branch/pid/heartbeat/TTL), `GATE_LOCK_HELD` nesting, `FP_VERSION`. |
| `scripts/migrations/reserve-number.mjs` | **NEW.** `--next`/`--next --block`/`--claim`/`--check`/`--list`/`--release`. Formalises the reserved-block convention that previously existed only in a file comment. |
| `scripts/migrations/ledger-audit.mjs` | **NEW.** Three-state ledger audit + time-bounded exception record. |
| `scripts/migrations/replay-probe.mjs` | **EDIT.** Committed outputs, `PROBE_DSN`, per-pass ladder in the JSON, scoped lock, crash-safe hold. |
| `scripts/migrations/fidelity-check.mjs` | **EDIT.** Committed paths, ACL/STORAGE key handling, provenance exemption for seeded rows, `fpVersion` + `fpQueriesSha` in the report. |
| `scripts/migrations/{renumber,fidelity-delta}.mjs` | **EDIT.** Derived artifacts moved out of `$TMPDIR` into the committed `tools/reports/`. |
| `supabase/migrations/tools/fp3-objects.sql` | **EDIT (v2).** + `md5(prosrc)` function bodies, + ACLs, + storage bucket properties. |
| `supabase/migrations/tools/{non-scratch-targets,reservations,ledger-exceptions}.json` | **NEW.** Deny-list, number reservations, time-bounded historical exceptions. |
| `supabase/migrations/tools/reports/` | **NEW.** Committed derived artifacts (order, renumber map, fingerprints) + gitignored local run trails. |
| `supabase/migrations/tools/staging-fp/README.md` | **NEW.** The approval-gated capture procedure and the freshness policy. |
| `.githooks/pre-commit` + `hooks:install` | **NEW.** Fast local preview; labelled as a preview, never as enforcement. |
| `.github/workflows/migrations-gate.yml` | **NEW.** Path-filtered, `static` (5 min) + `full` (15 min), no staging secrets, artifacts on failure. |
| `.github/instructions/supabase-sql.instructions.md` | **EDIT.** **BP-101** + index line + detection checklist. |
| `supabase/migrations/README.md` | **EDIT.** Operating contract: verdicts, runtime/failure policy, lock scoping, reports contract, freshness policy, reservations, ledger audit, and the **Option A** Tier-2 record (owed since FIX-Task-35). |
| `20260918000005_fix_task_60_user_facing_rpc_grants.sql` | **EDIT.** 20 bare GRANTs → guarded, table-driven block. |
| `20260918050000_fix_task_62_admin_read_and_anon_function_lockdown.sql` | **EDIT.** Literal anchor → whitespace-tolerant regex with an exactly-one-match requirement, + partial-apply guard. |

---

## 3. Gate runtime & failure policy (as implemented)

| Rule | Implementation |
|---|---|
| Static tier fast | 7 checks (S1–S7), no DB, no network, **no lock**. Measured **<1 s** on 544 files. CI `timeout-minutes: 5`. |
| Full tier bounded | `--timeout-minutes 15`, internal deadline passed to every child process. Measured **57 s** end-to-end (well inside budget). |
| Scratch only | `assertScratchTarget()` fails closed: loopback-only, plus a deny-list of refs/hosts (`non-scratch-targets.json`). Verified by pointing it at the staging ref. |
| Never contacts staging | The CI `full` job is given **no staging secrets**; the only credential is the local scratch stack's default key. |
| Timeout / lock | `TIMEOUT` / `BLOCKED`, both failing with diagnostics. No `\|\| true`, no `continue-on-error`, no skip path. |
| Fresh capture | Never a CI step. Approval-gated; required only when stale (>7 days) or after approved staging DDL. |

**Verdict vocabulary** — only `PASS` exits 0:
`PASS`=0 · `FAIL`=1 · `STALE BASELINE`=2 · `BLOCKED`=3 · `TIMEOUT`=4

---

## 4. Non-vacuity: every gate was watched to FAIL before being trusted (§9.1h)

### 4a. Static tier (each injected violation detected, then reverted; control re-run green)

| # | Injection | Observed |
|---|---|---|
| S1 | `099_bad_name.sql` | `[FAIL] S1 non-conforming migration filename(s) — the CLI will silently skip these` |
| S2 | second file at prefix `20260918000010` | `[FAIL] S2 duplicate migration number prefix — undefined apply order` |
| S3 | byte-identical copy of an existing migration | `[FAIL] S3 byte-identical duplicate migration file(s)` |
| S4 | another owner claims a reserved prefix | `[FAIL] S4 prefix … reserved by "a-different-session" but used by undeclared file(s)` |
| S5 | a tool writing to `$TMPDIR` | `[FAIL] S5 tool writes to $TMPDIR instead of the committed reports/ dir` |
| S7 | an orphaned hold present | `[FAIL] S7 ORPHANED HOLD … Recover with: … --recover-hold` |
| — | restore | `VERDICT: PASS` |

### 4b. Guard / policy red pairs

| # | Test | Observed |
|---|---|---|
| G1 | DSN pointing at the staging ref | `BLOCKED — DSN references staging project ref drntwgporzabmxdqykrp` (fail-closed) |
| G2 | lock held by another session | `BLOCKED … held by "another-session#999"`, elapsed **0 s** (no probe run) |
| G2b | **lock scoping** — static tier while locked | `VERDICT: PASS` (untouched) |
| G2c | **lock scoping** — read-only DB query while locked | succeeded (`pg_class rows: 1557`) — QA/read paths unaffected |
| G2d | `replay-probe` invoked **manually** while locked | `BLOCKED — scratch lock held by …`, nothing applied, nothing reset |
| G3 | 15-minute budget exceeded (`--timeout-minutes 0.02`) | `VERDICT: TIMEOUT — replay-probe exceeded the budget (killed after 1s)` |

### 4c. Full-tier verdict matrix

| # | Scenario | Verdict | Exit |
|---|---|---|---|
| G4 | green control (local-vs-local, 0 keys) | `PASS` | 0 |
| G4b | no baseline file | `BLOCKED` | 3 |
| G4c | no staging fingerprint | `BLOCKED` (names the capture procedure) | 3 |
| G5 | one injected finding | `FAIL — F6 1 NEW fidelity finding(s) … COLUMN\|zzz_injected_drift\|id` | 1 |
| G6 | snapshot 8 days old | `STALE BASELINE — snapshot is 8.0 days old (limit 7d)` | 2 |
| G7 | approved staging DDL after capture | `STALE BASELINE — an approved staging DDL was applied … after the snapshot was captured` | 2 |
| G8 | fingerprint queries changed | `STALE BASELINE — captured with DIFFERENT fingerprint queries (snapshot deadbeef…, current 9f14f3a4…)` | 2 |
| G9 | restore | `PASS` | 0 |
| G10 | a migration that can never apply | `FAIL — F3 1 migration(s) can never apply … (ERROR: relation "public.zzz_does_not_exist_fix63" does not exist)` + `544/1 → 0/1` | 1 |
| G11 | pre-commit hook with a colliding migration | hook exit **1**, `S2` + `S4` named, no commit created |
| G12 | `MIGRATIONS_GATE_BYPASS="…"` | hook exit **0**, loud warning, appended to `gate-bypass.log` with timestamp/email/branch/reason |
| G13 | hook on a clean staging area | hook exit 0 |

### 4d. Fingerprint v2 sensitivity — the four blind spots, per dimension

Each mutation was applied to a live rebuilt DB against a **frozen** clean side, so exactly one
delta is attributable:

| Dimension | Mutation | Detected as |
|---|---|---|
| **Body** (v1: invisible) | formatting-only change to a function body, identical signature | `CONFLICT FUNCTION\|fix63_body_probe\|p_n integer` with `add2881c…` vs `fd973ac2…` — exactly 1 delta |
| **ACL** (v1: not fingerprinted) | `REVOKE EXECUTE … FROM authenticated` | `SUBSET-MISS ACL\|public\|_dt61_guard_revoke_fn_public\|FUNCTION\|authenticated\|EXECUTE` |
| **RLS** | `DISABLE ROW LEVEL SECURITY` | `CONFLICT RLS\|items` |
| **Column default** | `DROP DEFAULT` | `CONFLICT COLUMN\|profiles\|created_at` |
| **Storage bucket** (v1: zero storage rows) | `file_size_limit` changed | `CONFLICT STORAGE\|buckets\|badge-icons` |

---

## 5. 🔴 Incidents: five real defects found in the harness BY the testing

This is the honest part of the report. Building a blocker and *testing the blocker* exposed five
bugs that a happy-path demo would have shipped.

**1 — The timeout kill deleted the entire migrations tree. (Severity: highest.)**
`pristineReset()` parked `supabase/migrations` in `os.tmpdir()` to run a migration-free reset. When
the gate's own `TIMEOUT` path SIGTERM'd the probe mid-reset, the `finally` never ran: **all 544
migrations plus the whole `tools/` directory were left in `/var/folders/…/kmp-migrations-hold`**, and
the repo presented an empty `supabase/migrations` — every subsequent run reporting only "no readable
report" while the real cause was invisible.
*Fix:* the hold now lives **inside the repo** (`supabase/.migrations-hold`) so it is visible in
`git status` and greppable; an `'exit'` handler registered *before* the rename restores it on every
termination path including `process.exit()`; an orphan found at startup self-heals loudly; and the
static tier's **S7** fails with the recovery command while one exists. A second timeout kill was then
run deliberately: **migrations intact (544), no orphan**.

**2 — The recovery command itself was a data-loss bug.**
`--recover-hold` called `restoreHold()`, which deleted `supabase/migrations` before renaming the hold
over it. Exercised against a healthy tree it **wiped 544 files** (recovered from git: 547 restored
paths; my new untracked tool files had to be recreated).
*Fix:* `restoreHold()` now **refuses** when the migrations directory already holds `.sql` files and
prints where the parked copy is; `--recover-hold` routes through the guarded `recoverOrphanedHold()`.
Verified: `REFUSING — … already contains migrations — refusing to guess`, 544 files intact, exit 1.

**3 — Nested lock acquisition: the gate held the lock, so the probe refused to start.**
The first full run reported only "did not produce a readable report". The real cause: the probe is a
child process with a different pid, so a different lock owner, so it blocked on the gate's own lock.
*Fix:* parents pass `GATE_LOCK_HELD=1`; a **manual** probe run still takes the lock itself (verified
G2d). Child output is also now surfaced on failure instead of being swallowed.

**4 — The lock leaked on exit.**
`process.exit()` in `finish()` skipped the `finally` release, leaving a lock that would have blocked
every run for 30 minutes. Found immediately (the lock file was still there after the run).
*Fix:* `process.on('exit')` + SIGINT/SIGTERM handlers. Verified: lock absent after every subsequent
run, including the timeout path.

**5 — Two verdict-correctness bugs.**
(a) A tier could accumulate `[FAIL]` findings and still fall through to `PASS` — the exact
"green while broken" shape this task exists to prevent; fixed with an explicit `hardFail` flag.
(b) A genuine `FAIL` was **masked by `BLOCKED`**: a broken migration was detected, then the run
returned `BLOCKED — no committed staging fingerprint`, hiding the real defect behind a missing-capture
message. Fixed: a chain that does not apply cleanly returns `FAIL` immediately (verified G10).
Also fixed: **S5 flagged its own documentation** (a comment mentioning `os.tmpdir()`), and
ACL/RLS/storage deltas on known objects were filed as "explained" and therefore **invisible to the
baseline** — the baseline now covers every delta kind, which is what makes grant drift detectable.

---

## 6. Phase 3 — the two known repo/staging divergences, reconciled

**(a) `20260918000005_fix_task_60_user_facing_rpc_grants.sql`** — 20 bare `GRANT` statements are
atomic and all-or-nothing: the first one failed on staging (`search_listings(text,boolean,integer)`
does not exist there) so **none** of the twenty landed, and nothing recorded it. Now a table-driven
guarded block: each target resolves through `to_regprocedure`; absent signatures are skipped and
listed; **`v_granted = 0` raises** (no silent no-op, BP-90). On staging this now grants the 19 present
signatures and names the 1 absent one.

**(b) `20260918050000_fix_task_62_admin_read_and_anon_function_lockdown.sql`** — the single-line
literal anchor did not match staging's **wrapped** predicate, so the guard raised and the whole
atomic block rolled back, leaving all four admin read signatures anon-executable. Now a
whitespace-tolerant regex requiring **exactly one** match (0 → refuse, >1 → refuse), with the
survival guards kept and a **partial-apply guard**: 3 names resolve to **4** signatures, and gating
fewer than 4 is itself a fail-open.

**Local proof (rebuilt database, both files in the same replay):**

```
node scripts/migrations/replay-probe.mjs   →  pass 1: applied 544, deferred 0 · unresolved 0
node scripts/migrations/migration-gate.mjs --full → VERDICT: PASS (exit 0)
```

| Check | Result |
|---|---|
| Client-facing RPCs (sampled 8) | `auth=true` for all, incl. `search_listings(text,boolean,integer)` |
| The 4 admin read signatures | `gated=true  self_declared=false  anon=false  auth=true` — on exactly 4 signatures, matching `v_expected` |

---

## 7. Regression tiers

| Tier | Status | Basis |
|---|---|---|
| Tier 0 | **PASS** | `node --check` clean on all 6 touched/created Node tools; `npm run agent-rules:check` → `OK: 0 fail, 1 warn`; `npm run verify:guides` → advisory only (4 pre-existing payout-guide findings, unrelated); migration-number check `[OK] no collisions`. **No app/EF `.ts`/`.tsx` changed** (`git status` verified), so the mobile typecheck/lint gate is not applicable to this task. |
| Tier 1 | **PASS (tooling)** | 15 red pairs + the green control above, all executed. |
| Tier 2 | **PASS (rebuild leg)** | `replay-probe.mjs` = accepted Tier-2 rebuild evidence per the recorded **Option A** owner decision; 544/544 one-pass, `deferred 0`, `unresolved 0`, run twice. `supabase db reset` remains CLI-blocked (not content) — now documented in `README.md`. |
| Tier 2 (staging legs) | **DEFERRED — approval-gated** | See §9. |

---

## 8. Rollback

Every artifact is additive or self-contained; nothing here changes application behaviour.

| To revert | Action |
|---|---|
| The gate blocking commits | `git config --unset core.hooksPath` (local, instant) |
| The gate blocking merges | remove the required status checks in GitHub → Settings → Branches |
| BP-101 / README policy | revert the two doc commits (no runtime effect) |
| Fingerprint v2 | restore `fp3-objects.sql` to v1 and re-capture; the old snapshot is version-stamped and the gate refuses cross-version comparison by design |
| The hold mechanism | if `supabase/.migrations-hold` exists, `node scripts/migrations/replay-probe.mjs --recover-hold` **before** touching anything else |
| Migration files | `git checkout -- supabase/migrations` (verified: restores all 544 tracked files) |

---

## 9. ⛔ NOT DONE — needs your approval (BP-80 two-phase provisioning)

These are **written and locally proven but NOT executed**, because they touch staging:

1. **Apply** `20260918000005_…_rpc_grants.sql` and `20260918050000_…_lockdown.sql` via MCP —
   one call per migration, sequentially.
2. **Verify live**: the ACL census on the 4 admin read signatures, the `search_listings` signature
   census, and `npm run qa:fix62-anon-lockdown` before/after.
3. **Bump `lastApprovedStagingDDLAt`** in `tools/staging-fp/snapshot.json` in the same session.
4. **Capture** the fresh staging fingerprint (read-only, 3 queries) + the ledger dump, then commit
   them and regenerate the real baseline with `--update-baseline`.
5. **Add the exceptions note**: `fix_task_62_admin_read_lockdown_adapted` in
   `tools/ledger-exceptions.json` is now *reconcilable and expiring* — after step 1 the file exists
   and converges, so that entry can be closed rather than left to expire.
6. **Turn on the CI required checks** (a GitHub setting, not a repo file) — until then CI is
   advisory, and verification G9-style evidence of "cannot merge until green" is not yet real.

**Freeze declaration (conditional):** infrastructure is frozen **once §9.1–§9.4 are done** — the
basis will be `APPLIED_ONLY = 0`, `APPLIED_UNCOMMITTED = 0`, a fresh snapshot, all tiers green, and
the required checks live. Until then, Phase 1–2 are green and the staging state is unchanged.

---

## 10. Part 2 — deferred, deliberately (not started)

1. Automated RPC contract extraction from every call site.
2. Edge Function deployment-state auditing (`verify_jwt` repo-vs-deployed).
3. Full ledger repair keyed by filename prefix, making `db push` safe.
4. Nightly / scheduled per-environment drift capture.
5. Migration-history squash / baseline migration.
6. Documentation-precedence rewrite (one "current state" page; dated history exiled).
7. Also deferred: committed apply-order drift check; Edge Function source-vs-deployed coverage;
   column-level profile hardening and the `admin_has_role` anon-executable review (FIX-62 residuals).

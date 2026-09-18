# Staging fingerprint capture

This directory holds the **staging side** of the schema-fidelity comparison. It is what
lets the gate say *"the schema the migration chain builds is the schema staging runs"*.

## Two capture modes — read this first

| Mode | Artifact | Granularity | Status |
|---|---|---|---|
| **kind-digest** | `staging-digest.json` | per object KIND (11 rows, ~1 KB) | **the default** — what the gate compares |
| per-object lines | `staging-fp1.txt` … `3.txt` | per object code (14,406 lines, **1,048,837 bytes**) | available; not on the critical path |

**Why the digest is the default (measured 2026-09-18, FIX-Task-64):** every
`mcp_supabase_execute_sql` result travels through the model's context. The v2 fingerprint is
**1,048,837 bytes** — `ACL` alone is 566 KB over 10,026 lines — so a faithful per-object
capture cannot be made in one sitting, and a *partially* transferred capture would be worse
than none. The digest asks the same question in ~1 KB.

**What is and is not preserved:**
- **Detection is identical.** No object can change without its kind's digest changing, so
  any drift at all fails the gate. Both sides' digests are frozen in the baseline, so drift
  on *either* side is caught.
- **Attribution is per-kind, not per-object.** A failure says *"COLUMN moved"* with the
  counts and both hashes, not which column. Per-object detail is fetched on demand — only
  for the kind that moved, in slices — which is exactly when the cost is justified.

## Capturing the digest (approval-gated — never a CI step)

1. **Get approval** for the specific call, per the repo's MCP Usage Protocol.
2. Run `../fp-digest.sql` **verbatim** against staging via `mcp_supabase_execute_sql`
   (read-only; one statement, so the "last result set only" caveat does not bite). It
   returns `kind|object_count|kind_md5` for all 11 kinds.
3. Write the rows into `staging-digest.json` under `digests`, with the metadata below.
4. Freeze the baseline: `node scripts/migrations/migration-gate.mjs --update-baseline --reason "<why>"`.
   Kinds whose digests already agree are **not** stored (they need no excuse); differing
   kinds are frozen with their staging and local digests plus a reason.

### `staging-digest.json`

```json
{
  "capturedAt": "<ISO-8601 UTC of the live read>",
  "capturedBy": "<who/what>",
  "commitHash": "<git rev-parse --short HEAD at capture time>",
  "projectRef": "drntwgporzabmxdqykrp",
  "fpVersion": 2,
  "fpQueriesSha": "<md5 of fp1+fp2+fp3 concatenated — the gate computes and compares this>",
  "freshnessDays": 7,
  "lastApprovedStagingDDLAt": "<set in the SAME session as any approved staging apply>",
  "method": "kind-digest",
  "digests": { "COLUMN": { "count": 1463, "md5": "…" }, "…": {} }
}
```

### The two computations must stay identical

`fp-digest.sql` is **generated** from `fp1-columns.sql` + `fp2-constraints.sql` +
`fp3-objects.sql` by `scripts/migrations/make-fp-digest.mjs`. Do not hand-edit it: the
static tier's **S8** check fails when it is stale. Two properties were verified locally
before the capture was trusted, because a false PASS here would be the worst outcome:

1. the SQL digest equals an independent Node computation over the fingerprint files
   (it did **not** at first — a bare `replace(line, chr(10), ' ')` disagreed on `POLICY`
   only, the one kind whose `qual` carries indentation around embedded newlines; fixed by
   matching `toRecords()`'s trim-and-single-space canonicalisation);
2. extension-owned objects are excluded **by name**, exactly as `fidelity-check.mjs`
   does. Without it, PostGIS (installed in `public` locally but not on staging) made
   `FUNCTION` read 1222 locally vs 437 on staging and drowned every comparison in noise.

---

## 🔴 The rule that matters most

**A committed snapshot is for repeatability, NOT for making claims.** It records what
staging looked like *at a point in time*. Any statement of the form "staging matches the
chain" must rest on a **fresh, approved live capture**, never on this directory alone.

This is not theoretical. The previous snapshot was captured **2026-09-16 13:07** and was
still being read as "the gate is silent, so staging is fine" two days later — while
staging's `nodes.id` default had diverged from the chain (`uuid_generate_v4()` live vs
`gen_random_uuid()` in the repaired chain). Gate silence was read as agreement; it was
actually just an old file.

The gate enforces this: it reports **`STALE BASELINE`** (a distinct, non-green verdict)
whenever

1. the capture is older than `freshnessDays` (default **7**), **or**
2. an approved staging DDL was applied **after** the capture
   (`lastApprovedStagingDDLAt > capturedAt`), **or**
3. `fpVersion` / `fpQueriesSha` no longer match the current `tools/fp*.sql`.

Condition 3 exists because a query change invalidates a capture entirely. Prose asking
for byte-identical queries is not enforcement; the sha is.

---

## Capturing the per-object lines (available, not the default)

```
staging-fp1.txt    COLUMNS
staging-fp2.txt    CONSTRAINTS / INDEXES / TRIGGERS
staging-fp3.txt    FUNCTIONS (incl. body hash) / ACLs / ENUMS / POLICIES / RLS / VIEWS / STORAGE BUCKETS
staging-ledger.json  (optional) dump of supabase_migrations.schema_migrations
snapshot.json      capture metadata — REQUIRED, and the thing the gate ages
```

---

## 🔴 The rule that matters most

**A committed snapshot is for repeatability, NOT for making claims.** It records what
staging looked like *at a point in time*. Any statement of the form "staging matches the
chain" must rest on a **fresh, approved live capture**, never on this directory alone.

This is not theoretical. The previous snapshot was captured **2026-09-16 13:07** and was
still being read as "the gate is silent, so staging is fine" two days later — while
staging's `nodes.id` default had diverged from the chain (`uuid_generate_v4()` live vs
`gen_random_uuid()` in the repaired chain). Gate silence was read as agreement; it was
actually just an old file.

The gate enforces this: it reports **`STALE BASELINE`** (a distinct, non-green verdict)
whenever

1. the snapshot is older than `freshnessDays` (default **7**), **or**
2. an approved staging DDL was applied **after** the capture
   (`lastApprovedStagingDDLAt > capturedAt`), **or**
3. `fpVersion` / `fpQueriesSha` no longer match the current `tools/fp*.sql`.

Condition 3 exists because a query change invalidates a capture entirely. Prose asking
for byte-identical queries is not enforcement; the sha is.

---

## Capturing (approval-gated — never a CI step)

Fresh capture of **staging** is an owner-approved, read-only operation. It is never part
of CI: a CI job that can reach staging is a CI job that can eventually write to it.

1. **Get approval.** Per the repo's MCP Usage Protocol, state exactly what will run and
   get Samer's explicit approval **for that call**, every time. Do not batch.
2. **Run the three queries verbatim** from `../fp1-columns.sql`, `../fp2-constraints.sql`
   and `../fp3-objects.sql` against staging via `mcp_supabase_execute_sql` (read-only).
   Because that tool returns only the **last** statement's result set, these are executed
   one file per call — each file is a single `select`, so this is safe.
3. **Write the results verbatim** into `staging-fp1.txt` / `staging-fp2.txt` /
   `staging-fp3.txt` in this directory. Do not reformat, do not trim, do not flatten
   newlines — policy definitions legitimately span lines and the checker reassembles them.
4. **Write `snapshot.json`:**
   ```json
   {
     "capturedAt": "<ISO-8601 UTC of the live read>",
     "capturedBy": "<who/what>",
     "commitHash": "<git rev-parse --short HEAD at capture time>",
     "projectRef": "drntwgporzabmxdqykrp",
     "fpVersion": 2,
     "fpQueriesSha": "<md5 of fp1+fp2+fp3 concatenated — the fidelity report prints it>",
     "freshnessDays": 7,
     "lastApprovedStagingDDLAt": null,
     "note": "<why this capture was taken>"
   }
   ```
   `fpQueriesSha` is the value the fidelity report prints as `fpQueriesSha`. Compute it as
   `cat ../fp1-columns.sql ../fp2-constraints.sql ../fp3-objects.sql | md5`.
5. **Refresh the local side and the baseline** (these are free and do not need approval):
   ```
   node scripts/migrations/migration-gate.mjs --full
   node scripts/migrations/migration-gate.mjs --update-baseline --reason "<why the residual set moved>"
   ```
   Review the printed NEW / GONE diff before accepting it. A baseline that moves without a
   reason is precisely the drift this gate exists to catch.

### After ANY approved staging DDL

Set `lastApprovedStagingDDLAt` in `snapshot.json` to the apply time **in the same session
as the apply**. The gate will then report `STALE BASELINE` until a fresh capture is taken,
which is the point: a schema change invalidates every prior statement about what staging
contained.

---

## Never hand-edit the `.txt` files

They are evidence. Editing one — even to "fix an obvious typo" — destroys the only thing
that makes the comparison meaningful. If a capture is wrong, re-capture.

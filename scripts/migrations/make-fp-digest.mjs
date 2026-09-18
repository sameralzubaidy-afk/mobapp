#!/usr/bin/env node
/**
 * FIX-Task-64 — generate `tools/fp-digest.sql` FROM the three fingerprint queries.
 *
 * WHY THIS EXISTS
 * ---------------
 * The fidelity gate's staging side has to be captured through `mcp_supabase_execute_sql`,
 * and every MCP result travels through the model's context. Measured 2026-09-18: the v2
 * fingerprint is **1,048,837 bytes** (ACL rows alone are 566 KB / 10,026 lines). That does
 * not transfer usefully, so no faithful per-object baseline could be produced.
 *
 * The digest query answers the same "has anything drifted?" question in ~11 rows: for each
 * object kind it returns the object count and `md5` of every line in that kind, in a
 * canonical (newline-normalised, lexicographically sorted) form. Both sides are computed
 * with the SAME rule, so a digest mismatch means real drift — it just names the KIND rather
 * than each object. Per-object detail is then fetched on demand, only for the kind that
 * moved.
 *
 * WHY GENERATED RATHER THAN HAND-WRITTEN
 * --------------------------------------
 * A hand-maintained second copy of the three queries would drift from the originals the
 * first time somebody adds a kind — which is exactly the failure mode this task exists to
 * end. This script derives the digest query from the fp files, and
 * `migration-gate.mjs --static` (check S8) fails if the committed `fp-digest.sql` is stale.
 *
 * USAGE
 *   node scripts/migrations/make-fp-digest.mjs           # write tools/fp-digest.sql
 *   node scripts/migrations/make-fp-digest.mjs --check    # exit 1 if the committed file is stale
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { MIGRATIONS_DIR } from './lib/guard.mjs';

const TOOLS = path.join(MIGRATIONS_DIR, 'tools');
const SOURCES = ['fp1-columns.sql', 'fp2-constraints.sql', 'fp3-objects.sql'];
const OUT = path.join(TOOLS, 'fp-digest.sql');

/**
 * Pull the SELECT body out of a fingerprint file: drop the leading `--` header and the
 * trailing `order by 1;` (the CTE below supplies its own ordering). Anything else is
 * reproduced verbatim — this file must not "improve" the queries it mirrors.
 */
function selectBody(file) {
  const text = fs.readFileSync(path.join(TOOLS, file), 'utf8');
  const start = text.search(/^select\s/im);
  if (start < 0) throw new Error(`${file}: no top-level select found`);
  let body = text.slice(start).trim();
  const tail = body.match(/order\s+by\s+1\s*;?\s*$/i);
  if (!tail) throw new Error(`${file}: expected a trailing "order by 1;"`);
  body = body.slice(0, tail.index).trim().replace(/;\s*$/, '');
  // Guard the property the digest depends on: each branch's first output column is the
  // `'KIND|...'` literal, so the digest can group by it on both sides.
  const kinds = [...body.matchAll(/select\s+'([A-Z]+)\|/g)].map((m) => m[1]).sort();
  if (!kinds.length) throw new Error(`${file}: no 'KIND|' literals found — digest grouping would be wrong`);
  return { body, kinds };
}

function build() {
  const parts = SOURCES.map((f) => selectBody(f));
  const kinds = [...new Set(parts.flatMap((p) => p.kinds))].sort();
  return [
    '-- ============================================================================',
    '-- GENERATED FILE — do not edit by hand.',
    '-- Produced by: node scripts/migrations/make-fp-digest.mjs',
    '-- Source: tools/fp1-columns.sql + fp2-constraints.sql + fp3-objects.sql',
    '--',
    '-- Returns one row per object kind: the object count and an md5 over all of that',
    "-- kind's lines in a canonical form.",
    '--',
    '-- The canonicalisation is load-bearing and must match `fidelity-check.mjs`\'s',
    '-- `toRecords()` exactly: that function TRIMS each physical line and rejoins the',
    '-- continuations of one logical record with a SINGLE SPACE. So the SQL side collapses',
    '-- newline-plus-surrounding-indentation to one space and trims the ends. Whitespace',
    '-- INSIDE a line is preserved, so a genuine change is never normalised away.',
    '--',
    "-- Measured: the first version used a bare replace(line, chr(10), ' ') and disagreed",
    '-- with the Node computation on POLICY only — the one kind whose `qual` carries',
    '-- indentation around embedded newlines. The self-test caught it before it reached',
    '-- staging, which is the whole reason the digest is verified locally first.',
    '-- ============================================================================',
    'WITH lines AS (',
    parts.map((p) => p.body).join('\nunion all\n'),
    '),',
    'canon AS (',
    "  select trim(regexp_replace(lines.line, '[[:space:]]*' || chr(10) || '[[:space:]]*', ' ', 'g')) as line",
    '  from lines',
    '),',
    '-- Extension-owned objects and the one-off manual snapshot table are excluded BY NAME,',
    "-- exactly as fidelity-check.mjs's loadSide() does. Measured: without this, PostGIS",
    '-- (installed in `public` locally but NOT on staging) made FUNCTION read 1222 locally',
    '-- vs 456 on staging, and every digest comparison was noise.',
    'ext AS (',
    '  select distinct p.proname as name from pg_proc p',
    '   join pg_namespace n on n.oid = p.pronamespace',
    '   where n.nspname = ' + "'public'" + ' and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = ' + "'e'" + ')',
    '  union',
    '  select distinct c.relname from pg_class c',
    '   join pg_namespace n on n.oid = c.relnamespace',
    '   where n.nspname = ' + "'public'" + ' and exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = ' + "'e'" + ')',
    '  union',
    '  select distinct t.typname from pg_type t',
    '   join pg_namespace n on n.oid = t.typnamespace',
    '   where n.nspname = ' + "'public'" + ' and exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = ' + "'e'" + ')',
    '),',
    'kept AS (',
    '  select canon.line',
    '  from canon',
    "  where split_part(canon.line, '|', 3) <> '_orphan_image_snapshot_20260829'",
    "    and not exists (select 1 from ext e where e.name = split_part(canon.line, '|', 3))",
    ')',
    "select split_part(kept.line, '|', 1)  as kind,",
    '       count(*)                       as object_count,',
    "       md5(string_agg(kept.line, E'\\n' order by kept.line)) as kind_md5",
    'from kept',
    'group by 1',
    'order by 1;',
    '',
    `-- kinds covered: ${kinds.join(', ')}`,
    '',
  ].join('\n');
}

const generated = build();
const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

if (process.argv.includes('--check')) {
  if (committed === null) {
    console.error(`[FAIL] S8 ${path.relative(MIGRATIONS_DIR, OUT)} is missing — run: node scripts/migrations/make-fp-digest.mjs`);
    process.exit(1);
  }
  if (committed !== generated) {
    console.error(`[FAIL] S8 ${path.relative(MIGRATIONS_DIR, OUT)} is STALE — the fingerprint queries changed but the digest query was not regenerated. Run: node scripts/migrations/make-fp-digest.mjs`);
    process.exit(1);
  }
  console.log('[OK] S8 fp-digest.sql matches the current fingerprint queries');
  process.exit(0);
}

fs.writeFileSync(OUT, generated);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${generated.length} bytes)`);
console.log(`md5 of the query text: ${crypto.createHash('md5').update(generated).digest('hex')}`);

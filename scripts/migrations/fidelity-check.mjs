#!/usr/bin/env node
/**
 * Schema-fidelity gate for the migration chain - FIX-Task-40 phase 3.
 *
 * WHY THIS EXISTS
 * ---------------
 * `supabase db reset` proves the chain APPLIES. It does not prove the schema it
 * builds is the schema staging actually runs. This harness compares a locally
 * rebuilt database against captured staging fingerprints and applies the three
 * rules agreed for this repo (a byte-exact match to staging is NOT achievable -
 * staging was partly built out-of-band and is behind the repo head):
 *
 *   1. SUBSET      - every object staging has must exist in the replay.
 *   2. EXPLAINED   - every replay-only object must have PROVENANCE: at least one
 *                    migration in the chain that creates it. This is what catches
 *                    the FIX-Task-38/40 failure mode - objects that existed only
 *                    in the live database because no migration ever created them.
 *                    Deliberately weaker than "maps to a migration absent from
 *                    staging's ledger": staging's ledger holds 266 rows whose
 *                    `version` values are APPLY timestamps and whose `name`
 *                    values are inconsistently prefixed (253 unique names, 32 with
 *                    no local file, 304 local files with no ledger row), so a
 *                    precise file-level attribution is not derivable. The ledger
 *                    evidence is still reported alongside for transparency.
 *   3. CONFLICT    - no object present on BOTH sides may have a different
 *                    definition.
 *
 * Every exception is printed by name. A non-zero exit means at least one
 * UNEXPLAINED / CONFLICT / SUBSET-MISS object exists - never "passing silently".
 *
 * USAGE
 *   node scripts/migrations/fidelity-check.mjs                 # regenerate local fp, then compare
 *   node scripts/migrations/fidelity-check.mjs --no-generate   # reuse an existing local fingerprint
 *   node scripts/migrations/fidelity-check.mjs --staging-prefix /tmp/staging-fp
 *
 * The staging side must be captured with the SAME three queries that live in
 * supabase/migrations/tools/fp{1,2,3}-*.sql.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MIG_DIR = path.join(REPO, 'supabase', 'migrations');
const TOOLS = path.join(MIG_DIR, 'tools');
const DSN = process.env.FIDELITY_DSN ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const STAGING_PREFIX = args['staging-prefix'] ?? '/tmp/staging-fp';
const LOCAL_PREFIX = args['local-prefix'] ?? '/tmp/local-fp';
const LEDGER = args.ledger ?? '/tmp/staging-migrations.txt';
const ORDER_FILE = args.order ?? '/tmp/mig-probe-order-p3.txt';
const REPORT = args.out ?? '/tmp/fidelity-report.json';

/**
 * Excluded by name from the comparison (agreed in FIX-Task-40):
 *  - `_orphan_image_snapshot_20260829` is a manual one-off table snapshot, not schema;
 *  - PostGIS-owned objects live in `public` locally but not on staging, and would
 *    otherwise swamp the diff. The exact excluded set is computed from the local
 *    database's pg_depend, never from a hardcoded name list.
 */
const NAMED_EXCLUSIONS = ['_orphan_image_snapshot_20260829'];

const psql = (argv, opts = {}) =>
  spawnSync('psql', [DSN, ...argv], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...opts });

// ------------------------------------------------------------------ fingerprint IO

function generateLocalFingerprints() {
  const files = [
    path.join(TOOLS, 'fp1-columns.sql'),
    path.join(TOOLS, 'fp2-constraints.sql'),
    path.join(TOOLS, 'fp3-objects.sql'),
  ];
  files.forEach((f, i) => {
    if (!fs.existsSync(f)) throw new Error(`missing fingerprint query: ${f}`);
    const r = psql(['-At', '-f', f]);
    if (r.status !== 0) throw new Error(`fingerprint ${f} failed:\n${r.stderr}`);
    fs.writeFileSync(`${LOCAL_PREFIX}${i + 1}.txt`, r.stdout);
    console.log(`  local fingerprint ${i + 1}: ${r.stdout.trim().split('\n').length} lines -> ${LOCAL_PREFIX}${i + 1}.txt`);
  });
}

function extensionOwnedNames() {
  const q = `
    select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    union
    select distinct c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    union
    select distinct t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e')`;
  const r = psql(['-At', '-c', q]);
  if (r.status !== 0) throw new Error(`extension-owned lookup failed:\n${r.stderr}`);
  return new Set(r.stdout.trim().split('\n').filter(Boolean));
}

// ------------------------------------------------------------------ line parsing

/** Object name carried by a fingerprint line (always field 3 for these queries). */
const objectName = (line) => line.split('|')[2];

/**
 * Identity key for the three rules. Field layouts (see tools/fp*.sql):
 *   COLUMN|schema|table|ordinal|column|...      CONSTRAINT|schema|table|conname|...
 *   INDEX|schema|table|indexname|...            TRIGGER|schema|table|tgname|...
 *   FUNCTION|schema|name|identity_args|...      ENUM|schema|typname|label|order
 *   POLICY|schema|table|policyname|...          RLS|schema|table|flag
 *   VIEW|schema|viewname|md5
 */
function keyOf(line) {
  const p = line.split('|');
  switch (p[0]) {
    case 'COLUMN':
      return `${p[0]}|${p[2]}|${p[4]}`;
    case 'CONSTRAINT':
    case 'TRIGGER':
    case 'POLICY':
      return `${p[0]}|${p[2]}|${p[3]}`;
    case 'INDEX':
      return `${p[0]}|${p[2]}|${p[3]}`;
    case 'FUNCTION':
    case 'ENUM':
      return `${p[0]}|${p[2]}|${p[3]}`;
    case 'RLS':
    case 'VIEW':
      return `${p[0]}|${p[2]}`;
    default:
      return line;
  }
}

/**
 * Definition normalisation applied to BOTH sides before the CONFLICT comparison.
 *
 * Two transformations, both of them equivalences already agreed in FIX-Task-40 -
 * normalising them keeps a wall of cosmetic diffs from hiding a real conflict:
 *   - `uuid_generate_v4()` (live) vs `gen_random_uuid()` (replay) are the same
 *     generator on PG13+; the two spellings come from the uuid-ossp vs pgcrypto
 *     extension being installed by different migrations.
 *   - the COLUMN ordinal is positional noise - drop it.
 * Anything else is a real difference and is reported.
 */
const EQUIVALENCES = [
  // BOTH spellings must map to the SAME token - normalising only one side leaves
  // the pair unequal (caught by this file's own dry-run, not in production).
  [/\buuid_generate_v4\(\)/gi, 'GEN_RANDOM_UUID()'],
  [/\bgen_random_uuid\(\)/gi, 'GEN_RANDOM_UUID()'],
];

function normalize(line) {
  let out = line;
  if (out.startsWith('COLUMN|')) {
    const p = out.split('|');
    p[3] = '-';
    out = p.join('|');
  }
  for (const [re, to] of EQUIVALENCES) out = out.replace(re, to);
  return out;
}

/**
 * The fingerprint prefixes, used both for keying and for reassembling records.
 */
const PREFIXES = ['COLUMN', 'CONSTRAINT', 'INDEX', 'TRIGGER', 'FUNCTION', 'ENUM', 'POLICY', 'RLS', 'VIEW'];
const RECORD_START = new RegExp(`^(${PREFIXES.join('|')})\\|`);

/**
 * Reassemble physical lines into logical fingerprint records.
 *
 * `pg_policies.qual` / `with_check` (and some function/trigger definitions) contain
 * NEWLINES, so one logical record spans several physical lines. Reading the file
 * line-by-line therefore invents phantom objects whose "name" is a WHERE-clause
 * fragment - four of them showed up as NO-CREATOR findings on the first run of this
 * harness. Records are rebuilt by treating any line that does not start with a known
 * prefix as a continuation of the previous record.
 *
 * (The captured staging fingerprints were produced without flattening newlines, so
 * this must be handled here rather than by changing the query - changing fp*.sql
 * would invalidate the already-captured staging side.)
 */
function toRecords(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (RECORD_START.test(line)) out.push(line);
    else if (out.length) out[out.length - 1] += ' ' + line;
  }
  return out;
}

function loadSide(prefix, extNames) {
  const map = new Map();
  let excludedExt = 0;
  let excludedNamed = 0;
  for (const n of [1, 2, 3]) {
    const file = `${prefix}${n}.txt`;
    if (!fs.existsSync(file)) throw new Error(`missing fingerprint file: ${file}`);
    for (const line of toRecords(fs.readFileSync(file, 'utf8'))) {
      if (NAMED_EXCLUSIONS.some((x) => line.includes(x))) { excludedNamed++; continue; }
      if (extNames.has(objectName(line))) { excludedExt++; continue; }
      map.set(keyOf(line), normalize(line));
    }
  }
  return { map, excludedExt, excludedNamed };
}

// ------------------------------------------------------------------ provenance index

/**
 * name -> [migration filenames that CREATE it], searched case-insensitively and
 * covering `CREATE [OR REPLACE] FUNCTION` (the naive `CREATE FUNCTION` pattern
 * misses every OR REPLACE - the exact bug that once produced a false "all 82
 * functions have no creator" conclusion).
 */
function buildCreatorIndex() {
  const patterns = [
    /\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+type\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+policy\s+"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:or\s+replace\s+)?trigger\s+"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+sequence\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
  ];
  const index = new Map();
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const txt = fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
    const found = new Set();
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(txt)) !== null) found.add(m[1].toLowerCase());
    }
    for (const name of found) {
      if (!index.has(name)) index.set(name, []);
      index.get(name).push(f);
    }
  }
  return index;
}

function loadLedgerNames() {
  if (!fs.existsSync(LEDGER)) return null;
  const strip = (s) => s.replace(/^\d{3,14}_/, '');
  const rows = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  return new Set(rows.map((r) => strip(r.name)));
}

// ------------------------------------------------------------------ main

console.log('Schema fidelity check');
console.log('=====================');
console.log(`migrations dir : ${path.relative(REPO, MIG_DIR)}`);

const extNames = extensionOwnedNames();
console.log(`extension-owned objects excluded by name: ${extNames.size}`);
console.log(`named exclusions: ${NAMED_EXCLUSIONS.join(', ')}`);

if (args['no-generate']) {
  console.log('local fingerprints: REUSED (--no-generate)');
} else {
  console.log('local fingerprints: regenerating from the rebuilt database...');
  generateLocalFingerprints();
}

const staging = loadSide(STAGING_PREFIX, extNames);
const local = loadSide(LOCAL_PREFIX, extNames);
console.log(`objects: staging=${staging.map.size}  local=${local.map.size}` +
  `  (staging excluded ext=${staging.excludedExt}/named=${staging.excludedNamed};` +
  ` local excluded ext=${local.excludedExt}/named=${local.excludedNamed})`);

const creators = buildCreatorIndex();
const ledgerNames = loadLedgerNames();
console.log(`creator index: ${creators.size} object names across ${fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).length} migration files`);
console.log(`staging ledger: ${ledgerNames ? `${ledgerNames.size} suffix-normalized names` : 'NOT FOUND (ledger evidence unavailable)'}`);

// Rule 1 - SUBSET
const subsetMisses = [];
for (const [key, line] of staging.map) if (!local.map.has(key)) subsetMisses.push({ key, line });

// Rule 2 - EXPLAINED (provenance) + ledger corroboration
const explained = [];
const unexplained = [];
for (const [key, line] of local.map) {
  if (staging.map.has(key)) continue;
  const name = objectName(line);
  const owners = creators.get(String(name).toLowerCase()) ?? [];
  if (owners.length === 0) {
    unexplained.push({ key, line, reason: 'NO CREATOR in any migration' });
  } else {
    const inLedger = ledgerNames ? owners.filter((f) => ledgerNames.has(f.replace(/\.sql$/, ''))) : [];
    explained.push({
      key,
      name,
      creator: owners[0],
      creators: owners.length,
      createdAtLeastOneLedgerFile: inLedger.length > 0,
    });
  }
}

// Rule 3 - CONFLICT
const conflicts = [];
for (const [key, line] of staging.map) {
  const mine = local.map.get(key);
  if (mine !== undefined && mine !== line) conflicts.push({ key, staging: line, local: mine });
}

// ------------------------------------------------------------------ report

const byKind = (arr) => {
  const m = {};
  for (const x of arr) {
    const kind = x.key.split('|')[0];
    m[kind] = (m[kind] ?? 0) + 1;
  }
  return m;
};

console.log('');
console.log(`1) SUBSET        - staging objects MISSING from the replay : ${subsetMisses.length}`);
if (subsetMisses.length) {
  for (const x of subsetMisses.slice(0, 40)) console.log(`     MISSING  ${x.key}`);
  if (subsetMisses.length > 40) console.log(`     ... ${subsetMisses.length - 40} more (see ${REPORT})`);
}
console.log(`2) EXPLAINED     - replay-only objects WITH provenance     : ${explained.length}  ${JSON.stringify(byKind(explained))}`);
console.log(`                 - replay-only objects with NO CREATOR     : ${unexplained.length}`);
for (const x of unexplained.slice(0, 40)) console.log(`     NO-CREATOR  ${x.key}`);
console.log(`3) CONFLICT      - same object, different definition       : ${conflicts.length}`);
for (const x of conflicts.slice(0, 40)) {
  console.log(`     CONFLICT ${x.key}`);
  console.log(`        staging: ${x.staging.slice(0, 220)}`);
  console.log(`        local  : ${x.local.slice(0, 220)}`);
}

if (ledgerNames) {
  const withLedger = explained.filter((e) => e.createdAtLeastOneLedgerFile).length;
  console.log('');
  console.log(`ledger corroboration: ${withLedger}/${explained.length} replay-only objects have a creator file that IS in`);
  console.log(`staging's ledger (i.e. staging records that migration yet lacks the object). Ledger name-matching is`);
  console.log(`suffix-normalized because the ledger's own names are inconsistently prefixed - treat this as supporting`);
  console.log(`evidence, not proof. The binding rule is provenance (rule 2).`);
}

fs.writeFileSync(
  REPORT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      counts: {
        staging: staging.map.size,
        local: local.map.size,
        subsetMisses: subsetMisses.length,
        explained: explained.length,
        unexplained: unexplained.length,
        conflicts: conflicts.length,
      },
      namedExclusions: NAMED_EXCLUSIONS,
      extensionOwnedExcluded: extNames.size,
      subsetMisses,
      unexplained,
      conflicts,
      explained,
    },
    null,
    2
  )
);

const hard = subsetMisses.length + unexplained.length + conflicts.length;
console.log('');
console.log(`RESULT: ${hard === 0 ? 'PASS' : 'FAIL'} - ${hard} hard finding(s). Full report -> ${REPORT}`);
process.exit(hard === 0 ? 0 : 1);

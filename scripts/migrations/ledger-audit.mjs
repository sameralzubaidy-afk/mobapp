#!/usr/bin/env node
/**
 * FIX-Task-63 — STAGING APPLY LEDGER AUDIT.
 *
 * WHY THIS EXISTS
 * ---------------
 * Several of the drift findings that prompted this task existed for exactly one reason:
 * something was applied to staging **outside** the tracked migration set — via MCP,
 * `apply_migration`, a dashboard query, or an in-session adaptation that was never
 * written back to a file. The migration chain and live staging then disagreed
 * permanently, and nothing anywhere said so.
 *
 * This tool reports THREE states, never one blended "diff":
 *
 *   FILE_ONLY            repo file, not yet in staging's ledger
 *                        → NORMAL before a deployment. Exit code unaffected.
 *
 *   APPLIED_ONLY         staging shows a migration with no corresponding committed file
 *                        → BLOCK / reconcile immediately. This is the FIX-Task-61 case:
 *                          ledger row `fix_task_61_item_images_bucket_mime_alignment` at
 *                          version `20260918170406`, a value that exists as NO filename.
 *
 *   APPLIED_UNCOMMITTED  staging's change came from the current working tree and is not
 *                        committed
 *                        → BLOCK closure until committed. This is the FIX-Task-59 case: an
 *                          uncommitted migration moved the fidelity gate 135 → 136 with
 *                          nobody intending it.
 *
 * THE LEDGER IS NOT A TRUSTWORTHY ORDER RECORD ON THIS PROJECT, and this tool does not
 * pretend otherwise: `version` holds the APPLY time and `name` is inconsistently
 * prefixed. So rows are matched to files by NORMALISED NAME, never by version, and the
 * output says which basis was used.
 *
 * The ledger read itself is approval-gated (it touches staging). Get the dump, then run
 * this locally — CI never does this.
 *
 * USAGE
 *   node scripts/migrations/ledger-audit.mjs [--ledger <dump.json>] [--json]
 *   node scripts/migrations/ledger-audit.mjs --print-query      # the canonical read
 *
 * EXIT  0 = no APPLIED_ONLY / APPLIED_UNCOMMITTED · 1 = drift found · 3 = no ledger dump (cannot audit)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { MIGRATIONS_DIR, REPO, STAGING_FP_DIR, TOOLS_DIR } from './lib/guard.mjs';

const DEFAULT_LEDGER = path.join(STAGING_FP_DIR, 'staging-ledger.json');
const EXCEPTIONS = path.join(TOOLS_DIR, 'ledger-exceptions.json');

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  if (a.includes('=')) {
    const [k, v] = a.replace(/^--/, '').split('=');
    args[k] = v;
  } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
    args[a.replace(/^--/, '')] = argv[++i];
  } else {
    args[a.replace(/^--/, '')] = true;
  }
}

const PRINT_QUERY = `-- Canonical read for the ledger audit (run via an APPROVED read-only MCP call).
-- NOTE: this project's \`version\` column holds the APPLY time, not the filename prefix,
-- so the audit matches on \`name\`. Ask for a JSON array of {version, name}.
select coalesce(json_agg(json_build_object('version', version, 'name', name) order by version), '[]'::json)::text as ledger
from supabase_migrations.schema_migrations;`;

if (args['print-query']) {
  console.log(PRINT_QUERY);
  process.exit(0);
}

/** Strip the leading numeric prefix (001_, 20260918000001_) so names match across spellings. */
const normalize = (s) => String(s ?? '').replace(/^\d{3,14}_/, '').replace(/\.sql$/, '').trim();

const ledgerFile = args.ledger ?? DEFAULT_LEDGER;
if (!fs.existsSync(ledgerFile)) {
  console.error(`BLOCKED — no ledger dump at ${path.relative(REPO, ledgerFile)}.`);
  console.error('The audit cannot run without it, and it will NOT report success instead.');
  console.error('Capture it with an APPROVED read-only staging call, then re-run:');
  console.error('');
  console.error(PRINT_QUERY);
  console.error('');
  console.error(`Save the result as ${path.relative(REPO, ledgerFile)} (JSON array of {version,name}).`);
  process.exit(3);
}

let raw = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
// Accept: array of objects, array of strings, {migrations:[...]}, {ledger:"[...]"} (MCP json_agg shape).
if (typeof raw === 'string') raw = JSON.parse(raw);
if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
  if (typeof raw.ledger === 'string') raw = JSON.parse(raw.ledger);
  else if (Array.isArray(raw.migrations)) raw = raw.migrations;
  else raw = Object.entries(raw).map(([version, name]) => ({ version, name }));
}
const rows = (Array.isArray(raw) ? raw : []).map((r) =>
  typeof r === 'string' ? { version: null, name: r } : { version: r.version ?? null, name: r.name ?? r.migration_name ?? '' }
);

const files = fs
  .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.sql'))
  .map((e) => e.name);

const fileByName = new Map(files.map((f) => [normalize(f), f]));
const rowByName = new Map();
for (const r of rows) {
  const n = normalize(r.name);
  if (!n) continue;
  (rowByName.get(n) ?? rowByName.set(n, []).get(n)).push(r);
}

// Uncommitted migration files in the working tree.
const porcelain = spawnSync('git', ['-C', REPO, 'status', '--porcelain', 'supabase/migrations'], { encoding: 'utf8' });
const dirty = new Set(
  (porcelain.stdout ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => path.basename(l.slice(3).trim()))
    .filter((f) => f.endsWith('.sql'))
);

const exceptions = fs.existsSync(EXCEPTIONS) ? JSON.parse(fs.readFileSync(EXCEPTIONS, 'utf8')).exceptions ?? [] : [];
const exceptionNames = new Set(exceptions.map((e) => normalize(e.ledgerName)));
const expired = exceptions.filter((e) => e.expiresAt && Date.parse(e.expiresAt) <= Date.now());

const fileOnly = [];
const appliedOnly = [];
const appliedUncommitted = [];

for (const f of files) {
  const n = normalize(f);
  if (!rowByName.has(n)) {
    fileOnly.push(f);
    // Applied-and-uncommitted: the file's effect is claimed by the ledger, but the file
    // itself is not in the repository's committed state.
    if (dirty.has(f)) appliedUncommitted.push(f);
    continue;
  }
  if (dirty.has(f)) appliedUncommitted.push(f);
}
for (const r of rows) {
  const n = normalize(r.name);
  if (!n || fileByName.has(n)) continue;
  appliedOnly.push(r);
}

const unexplainedAppliedOnly = appliedOnly.filter((r) => !exceptionNames.has(normalize(r.name)));
const explainedAppliedOnly = appliedOnly.filter((r) => exceptionNames.has(normalize(r.name)));

const byName = (a) => a.length;
const out = {
  at: new Date().toISOString(),
  ledgerSource: path.relative(REPO, ledgerFile),
  matchBasis: 'normalised name (the ledger version column holds apply times on this project)',
  counts: {
    repoFiles: byName(files),
    ledgerRows: rows.length,
    fileOnly: fileOnly.length,
    appliedOnly: appliedOnly.length,
    appliedOnlyExplained: explainedAppliedOnly.length,
    appliedOnlyUnexplained: unexplainedAppliedOnly.length,
    appliedUncommitted: appliedUncommitted.length,
    exceptionsExpired: expired.length,
  },
  fileOnly: fileOnly.slice(0, 50),
  appliedOnly: unexplainedAppliedOnly,
  appliedUncommitted,
  explainedByException: explainedAppliedOnly.map((r) => ({ version: r.version, name: r.name })),
  expiredExceptions: expired.map((e) => `${e.ledgerName} (expired ${e.expiresAt})`),
};

if (args.json) console.log(JSON.stringify(out, null, 2));

console.log('Staging ledger audit');
console.log('====================');
console.log(`ledger  : ${out.ledgerSource} — ${rows.length} rows`);
console.log(`repo    : ${files.length} migration files`);
console.log(`matched by: ${out.matchBasis}`);
console.log('');
console.log(`  FILE_ONLY            ${fileOnly.length}   (normal before deployment)`);
console.log(`  APPLIED_ONLY         ${appliedOnly.length}   (${explainedAppliedOnly.length} explained by exception, ${unexplainedAppliedOnly.length} UNEXPLAINED)`);
console.log(`  APPLIED_UNCOMMITTED  ${appliedUncommitted.length}`);
if (unexplainedAppliedOnly.length) {
  console.log('');
  console.log('  ✖ APPLIED_ONLY — staging carries these with NO committed file. Reconcile immediately:');
  for (const r of unexplainedAppliedOnly.slice(0, 20)) console.log(`      ${r.version ?? '(no version)'}  ${r.name}`);
}
if (appliedUncommitted.length) {
  console.log('');
  console.log('  ✖ APPLIED_UNCOMMITTED — applied but not committed. Closure is blocked until committed:');
  for (const f of appliedUncommitted.slice(0, 20)) console.log(`      ${f}`);
}
if (explainedAppliedOnly.length) {
  console.log('');
  console.log('  ℹ explained by tools/ledger-exceptions.json (visible + time-bounded, not ignored):');
  for (const r of explainedAppliedOnly.slice(0, 20)) console.log(`      ${r.version ?? '(no version)'}  ${r.name}`);
}
if (expired.length) {
  console.log('');
  console.log('  ⚠ EXPIRED exception(s) — history must not stay "temporarily" unexplained forever:');
  for (const e of expired) console.log(`      ${e.ledgerName} (expired ${e.expiresAt})`);
}

const hard = unexplainedAppliedOnly.length + appliedUncommitted.length;
console.log('');
console.log(hard ? `RESULT: ${hard} drift item(s) requiring reconciliation` : 'RESULT: no unexplained out-of-band changes');
process.exit(hard ? 1 : 0);

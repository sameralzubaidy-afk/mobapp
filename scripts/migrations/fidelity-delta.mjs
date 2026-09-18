#!/usr/bin/env node
/**
 * FIX-Task-60 - field-level delta analyser for the schema-fidelity gate.
 *
 * WHY THIS EXISTS (and why it is not fidelity-triage.mjs)
 * -------------------------------------------------------
 * `fidelity-check.mjs` reports a CONFLICT as "same object, different definition" and
 * prints the two raw fingerprint lines. `fidelity-triage.mjs` (FIX-Task-43) then
 * buckets those lines by REGEX over the rendered markdown, with a documented
 * limitation: its CONFLICT/COLUMN rule "cannot tell nullability from type/default
 * drift". That is too coarse to act on - the remedy for a nullability delta is
 * different from the remedy for a type delta.
 *
 * This script answers the question the remediation needs: *WHICH FIELD of the
 * fingerprint differs*, per finding, mechanically. It reads the JSON report (the
 * machine source of truth, not the markdown) and diffs each conflicting record
 * field-by-field using the field layout of the fp*.sql queries.
 *
 * IMPORTANT HONESTY NOTE: the fingerprints deliberately do NOT capture a function
 * BODY (`prosrc`). That was TRUE for fingerprint v1 and is NO LONGER TRUE as of
 * v2 (FIX-Task-63), which appends `md5(prosrc)` to the FUNCTION line — so a body-only
 * divergence now surfaces as a CONFLICT on the last field, and this tool's field-level
 * diff attributes it to `body`. Grants (`ACL` rows) and storage bucket properties are
 * likewise in scope now. Everything this tool classifies is therefore exactly what the
 * gate can see; nothing here is inferred.
 *
 * USAGE
 *   node scripts/migrations/fidelity-delta.mjs                       # reads <reports>/fidelity-report.json
 *   node scripts/migrations/fidelity-delta.mjs --report <file> --out <file>
 *   node scripts/migrations/fidelity-delta.mjs --detail FUNCTION     # print every finding of one kind
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORTS_DIR, ensureReportsDir } from './lib/guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** Accepts both `--key=value` and `--key value` (the space form bit this file once). */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    if (a.includes('=')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      out[k] = v;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[a.replace(/^--/, '')] = argv[++i];
    } else {
      out[a.replace(/^--/, '')] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

// FIX-Task-63: derived artifacts are COMMITTED under supabase/migrations/tools/reports/,
// never $TMPDIR. A delta report that dies with the shell cannot be reviewed later.
ensureReportsDir();
const REPORT = args.report ?? path.join(REPORTS_DIR, 'fidelity-report.json');
const OUT = args.out ?? path.join(REPORTS_DIR, 'fidelity-delta.json');

/**
 * Field layout per fingerprint prefix, taken from supabase/migrations/tools/fp*.sql.
 * The LAST name in each list absorbs any residual `|` characters in the record (the
 * definition-ish columns are the ones that could legitimately contain one).
 */
const LAYOUT = {
  COLUMN: ['kind', 'schema', 'table', 'ordinal', 'column', 'data_type', 'udt', 'char_max', 'num_prec', 'num_scale', 'nullable', 'default'],
  CONSTRAINT: ['kind', 'schema', 'table', 'conname', 'contype', 'definition'],
  INDEX: ['kind', 'schema', 'table', 'indexname', 'definition'],
  TRIGGER: ['kind', 'schema', 'table', 'tgname', 'definition'],
  // v2 appends the body hash, so a divergent body attributes to the field `body`
  // rather than showing up as an unattributed "same object, different definition".
  FUNCTION: ['kind', 'schema', 'name', 'identity_args', 'result', 'security', 'proconfig', 'body'],
  ENUM: ['kind', 'schema', 'typname', 'label', 'sortorder'],
  POLICY: ['kind', 'schema', 'table', 'policyname', 'cmd', 'roles', 'qual', 'with_check'],
  RLS: ['kind', 'schema', 'table', 'flag'],
  VIEW: ['kind', 'schema', 'viewname', 'md5'],
  // v2 kinds.
  ACL: ['kind', 'schema', 'name', 'objkind', 'grantee', 'privilege'],
  STORAGE: ['kind', 'schema', 'table', 'bucket_id', 'bucket_name', 'public', 'allowed_mime_types', 'file_size_limit'],
};

function parse(line) {
  const parts = line.split('|');
  const names = LAYOUT[parts[0]];
  if (!names) return { kind: parts[0], fields: { raw: line } };
  const fields = {};
  names.forEach((name, i) => {
    if (i < names.length - 1) fields[name] = parts[i] ?? '';
    else fields[name] = parts.slice(i).join('|');
  });
  return { kind: parts[0], fields };
}

/** Human label used in the delta key, e.g. `FUNCTION|proconfig`. */
function deltaOf(kind, stagingLine, localLine) {
  const a = parse(stagingLine).fields;
  const b = parse(localLine).fields;
  const names = LAYOUT[kind] ?? ['raw'];
  const changed = [];
  for (const n of names) {
    if (n === 'kind' || n === 'schema' || n === 'table') continue;
    if (n === 'ordinal') continue; // normalised away by the gate itself
    if (String(a[n] ?? '') !== String(b[n] ?? '')) {
      changed.push({ field: n, staging: a[n], local: b[n] });
    }
  }
  return changed;
}

/**
 * Impact class for a set of changed fields. Deliberately conservative: anything not
 * provably cosmetic lands in `review`.
 */
function impactClass(kind, changed) {
  const fields = changed.map((c) => c.field);
  if (fields.length === 0) return 'identical-after-normalisation';
  if (kind === 'FUNCTION') {
    if (fields.length === 1 && fields[0] === 'proconfig') return 'search_path-only';
    if (fields.includes('result')) return 'return-type';
    if (fields.includes('identity_args')) return 'signature';
    if (fields.includes('security')) return 'security-mode';
    return 'function-metadata';
  }
  if (kind === 'COLUMN') {
    if (fields.length === 1 && fields[0] === 'nullable') return 'nullability-only';
    if (fields.every((f) => f === 'nullable' || f === 'default')) return 'default-or-nullability';
    if (fields.includes('data_type') || fields.includes('udt') || fields.includes('char_max') || fields.includes('num_prec') || fields.includes('num_scale')) {
      return fields.includes('default') || fields.includes('nullable') ? 'type+extra' : 'type-only';
    }
    return 'column-other';
  }
  if (kind === 'ENUM') return fields.includes('sortorder') && fields.length === 1 ? 'ordinal-only' : 'enum-label';
  if (kind === 'INDEX') return 'index-definition';
  if (kind === 'POLICY') return 'policy-predicate';
  if (kind === 'CONSTRAINT') return 'constraint-definition';
  if (kind === 'RLS') return 'rls-flag';
  if (kind === 'VIEW') return 'view-definition';
  if (kind === 'TRIGGER') return 'trigger-definition';
  return 'review';
}

/**
 * Money-adjacency. Deliberately name-based and broad: FIX-Task-57 found a real
 * regression in `get_subscription_summary`, so anything touching subscriptions,
 * payouts, SP, fees, tax, balances or trades is surfaced first.
 */
const MONEY_RE = /(subscri|payout|seller_balance|sp_|_sp|swap_point|ledger|fee|tax|refund|payment|stripe|wallet|balance|trade|cart|price|pricing|purchase|charge|disburse|earning|trial|grace)/i;

function ownerOf(kind, fields) {
  if (!fields) return '(unknown)';
  if (kind === 'FUNCTION') return fields.name ?? '(fn)';
  return fields.table ?? fields.typname ?? fields.viewname ?? '(unknown)';
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

const findings = [];

for (const s of report.subsetMisses) {
  const p = parse(s.line);
  const owner = ownerOf(p.kind, p.fields);
  const name = s.key;
  findings.push({
    rule: 'SUBSET',
    kind: p.kind,
    key: s.key,
    owner,
    detail: p.fields,
    delta: null,
    impact: 'missing-in-replay',
    money: MONEY_RE.test(name) || MONEY_RE.test(owner),
  });
}

for (const c of report.conflicts) {
  const kind = c.key.split('|')[0];
  const changed = deltaOf(kind, c.staging, c.local);
  const p = parse(c.local);
  const owner = ownerOf(kind, p.fields);
  findings.push({
    rule: 'CONFLICT',
    kind,
    key: c.key,
    owner,
    delta: changed,
    impact: impactClass(kind, changed),
    money: MONEY_RE.test(c.key) || MONEY_RE.test(owner),
  });
}

// ---------------------------------------------------------------- reporting

function tally(list, fn) {
  const m = new Map();
  for (const x of list) {
    const k = fn(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

console.log('Fidelity field-level delta');
console.log('==========================');
console.log(`report: ${REPORT}`);
console.log(`counts: subsetMisses=${report.counts.subsetMisses} conflicts=${report.counts.conflicts}` +
  ` unexplained=${report.counts.unexplained}`);

console.log('\n--- SUBSET by kind ---');
for (const [k, n] of tally(findings.filter((f) => f.rule === 'SUBSET'), (f) => f.kind)) {
  console.log(`${String(n).padStart(4)}  ${k}`);
}

console.log('\n--- CONFLICT by kind|impact ---');
for (const [k, n] of tally(findings.filter((f) => f.rule === 'CONFLICT'), (f) => `${f.kind}|${f.impact}`)) {
  console.log(`${String(n).padStart(4)}  ${k}`);
}

console.log('\n--- MONEY-ADJACENT findings (priority, FIX-Task-60 item 3) ---');
const money = findings.filter((f) => f.money);
for (const [k, n] of tally(money, (f) => `${f.rule}|${f.kind}|${f.impact}`)) {
  console.log(`${String(n).padStart(4)}  ${k}`);
}
console.log(`  TOTAL money-adjacent: ${money.length}`);

console.log('\n--- CONFLICT deltas that are NOT search_path-only (real work) ---');
const real = findings.filter((f) => f.rule === 'CONFLICT' && f.impact !== 'search_path-only' && f.impact !== 'ordinal-only');
for (const f of real.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key))) {
  const d = (f.delta ?? []).map((c) => `${c.field}[${String(c.staging).slice(0, 28)} -> ${String(c.local).slice(0, 28)}]`).join(' ');
  console.log(`${f.money ? '💲' : '  '} ${f.kind.padEnd(10)} ${f.key.padEnd(62)} ${f.impact}`);
  console.log(`        ${d}`);
}
console.log(`  TOTAL non-search_path conflicts: ${real.length}`);

/**
 * CLOBBER SCAN (FIX-Task-60) - the FIX-Task-57 defect class, enumerated.
 *
 * `renumber.mjs` froze the probe's dependency order into the filenames. A file that
 * had to move later got a `20260916…` version. If such a file RE-DEFINES an object
 * that a genuinely newer migration already defines, its (older) definition wins in
 * a from-scratch replay - which is exactly how `get_user_sp_wallet_summary` lost
 * `reserved_points` and `items_status_check` lost `needs_edits`.
 *
 * Detroit: an INVERSION is provable from the renumber map alone, with no guessing:
 *   - original order of a legacy file (short prefix, e.g. `301_`) is BEFORE every
 *     14-digit filename, because `3` < `2` is false ... so legacy files sort FIRST
 *     lexicographically by prefix length-independent digit comparison:
 *     '006' < '20240101000001' as strings is FALSE, but the renumber map records
 *     that these files were moved precisely BECAUSE they were out of order. So:
 *   - for two timestamped files, compare their ORIGINAL 14-digit versions;
 *   - for legacy-vs-timestamped, the legacy file is treated as originally FIRST.
 * A pair is INVERTED when orig(a) < orig(b) but current(a) > current(b).
 */
function clobberScan(dir, mapFile) {
  const creators = new Map(); // object name -> Set(file)
  const PATTERNS = [
    /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi,
    /\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+policy\s+"?([a-z_][a-z0-9_ ]*?)"?\s+on\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:or\s+replace\s+)?trigger\s+"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    /\badd\s+constraint\s+"?([a-z_][a-z0-9_]*)"?/gi,
    /\bcreate\s+type\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
  ];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(txt)) !== null) {
        const name = (m[1] ?? '').toLowerCase();
        if (!name) continue;
        if (!creators.has(name)) creators.set(name, new Set());
        creators.get(name).add(f);
      }
    }
  }

  let map = [];
  if (mapFile && fs.existsSync(mapFile)) map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const origOf = new Map();
  for (const e of map) if (e && e.from && e.to) origOf.set(e.to, e.from);
  const origName = (f) => origOf.get(f) ?? f;
  const digits = (s) => {
    const m = String(s).match(/^([0-9]+)_/);
    return m ? m[1] : '';
  };
  /** -1 for a legacy (non-14-digit) prefix: originally ahead of every timestamp. */
  const rank = (f) => {
    const d = digits(origName(f));
    if (!d) return 0;
    return d.length === 14 ? Number(d) : d.length < 14 ? -1 : Number(d);
  };
  const legacy = (f) => digits(origName(f)).length < 14;

  const inversions = [];
  for (const [name, files] of creators) {
    const arr = [...files];
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const a = arr[i];
        const b = arr[j];
        if (rank(a) >= rank(b)) continue; // a was not originally earlier
        if (a <= b) continue; // and it still sorts first: fine
        inversions.push({ object: name, earlierFile: a, laterFile: b, earlierOrig: origName(a), laterOrig: origName(b) });
      }
    }
  }

  console.log('\n=== CLOBBER SCAN - a file that was ORIGINALLY EARLIER now sorts LATER ===');
  console.log(`renumber map: ${map.length ? `${map.length} entries (${mapFile})` : `NOT FOUND (${mapFile}) - rank() degenerates to current names`}`);
  console.log(`objects defined by >1 file: ${[...creators.values()].filter((s) => s.size > 1).length}`);
  console.log(`inversions (later-applying OLDER definition can win): ${inversions.length}`);
  const byObject = new Map();
  for (const x of inversions) {
    if (!byObject.has(x.object)) byObject.set(x.object, []);
    byObject.get(x.object).push(x);
  }
  for (const [obj, list] of [...byObject.entries()].sort()) {
    console.log(`  ${obj}`);
    for (const x of list) {
      // `earlierFile` was ORIGINALLY earlier but now applies LATER -> its definition wins.
      console.log(`      WINS  (applies later, orig earlier): ${x.earlierFile}   (orig ${x.earlierOrig})`);
      console.log(`      LOSES (applies earlier, orig later): ${x.laterFile}   (orig ${x.laterOrig})`);
    }
  }
  return inversions;
}

if (args.detail) {
  const kind = String(args.detail).toUpperCase();
  console.log(`\n--- EVERY ${kind} finding ---`);
  for (const f of findings.filter((x) => x.kind === kind)) {
    console.log(`${f.money ? '💲' : '  '} ${f.rule.padEnd(8)} ${f.key}`);
    for (const c of f.delta ?? []) {
      console.log(`        ${c.field}: staging="${c.staging}"  local="${c.local}"`);
    }
    if (f.rule === 'SUBSET') console.log(`        ${JSON.stringify(f.detail)}`);
  }
}

let clobbers = [];
if (args['clobber-scan']) {
  const MIG_DIR = path.join(REPO, 'supabase', 'migrations');
  clobbers = clobberScan(MIG_DIR, args.map ?? path.join(REPORTS_DIR, 'renumber-map.json'));

  // Cross-reference: which fidelity findings does an inversion actually explain?
  const clobbered = new Set(clobbers.map((c) => c.object));
  const hit = findings.filter((f) => {
    const cands = new Set();
    if (f.kind === 'FUNCTION') cands.add(String(f.owner).toLowerCase());
    else {
      cands.add(String(f.owner).toLowerCase());
      cands.add(String(f.key.split('|').pop() ?? '').toLowerCase());
    }
    return [...cands].some((c) => c && clobbered.has(c));
  });
  console.log('\n=== findings explained by a PROVABLE order inversion ===');
  for (const f of hit) console.log(`  ${f.money ? '💲' : '  '} ${f.rule.padEnd(8)} ${f.kind.padEnd(10)} ${f.key}`);
  console.log(`  TOTAL: ${hit.length} of ${findings.length} findings`);
  const un = findings.filter((f) => !hit.includes(f) && f.rule === 'CONFLICT' && f.impact !== 'search_path-only' && f.impact !== 'ordinal-only');
  console.log('\n=== real CONFLICTs NOT explained by an inversion (other root causes) ===');
  for (const f of un) console.log(`  ${f.money ? '💲' : '  '} ${f.kind.padEnd(10)} ${f.key}`);
  console.log(`  TOTAL: ${un.length}`);
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), report: REPORT, counts: report.counts, findings, clobbers }, null, 2));
console.log(`\nfull per-finding record -> ${OUT}`);

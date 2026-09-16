#!/usr/bin/env node
/**
 * Renumber supabase/migrations so that lexicographic filename order IS the
 * dependency-valid apply order discovered by `scripts/migrations/replay-probe.mjs`.
 *
 * WHY THIS IS THE LAST STEP
 * -------------------------
 * `supabase db reset` applies migrations in strict filename order with NO
 * deferral, so the ~141 legacy-numbered files (`006_…`, `315_…`) sort before the
 * timestamped base schema and die immediately. The probe derives an order in which
 * every file applies on its FIRST attempt; this script freezes that order into the
 * filenames. Repairing a migration can move the derived order, so renumber only
 * once the probe reports `unresolved: 0` — otherwise the set gets renamed twice.
 *
 * ALGORITHM
 * ---------
 * Walk the derived order and give each file a 14-digit `YYYYMMDDHHMMSS` version,
 * keeping the file's OWN original timestamp wherever there is room and nudging
 * forward only when a file must move later. Because the original set is roughly
 * chronological this leaves most names untouched and renames only what genuinely
 * has to move. Files the probe could never apply are appended at the END so they
 * still hold a place in the chain.
 *
 * USAGE
 *   node scripts/migrations/renumber.mjs                       # dry run (default)
 *   node scripts/migrations/renumber.mjs --order /tmp/order.txt
 *   node scripts/migrations/renumber.mjs --apply                # perform the rename
 *
 * The dry run prints the count and the first renames and writes nothing; ALWAYS
 * review it before passing --apply. `--apply` writes the full from→to map to
 * /tmp/renumber-map.json so a rename can be reversed or reviewed afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DIR = path.join(REPO, 'supabase', 'migrations');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const APPLY = args.apply === true || args.apply === 'true';

/** The probe writes its order to os.tmpdir(); fall back to the copied artifact. */
const DEFAULT_ORDER = fs.existsSync(path.join(os.tmpdir(), 'mig-probe-order.txt'))
  ? path.join(os.tmpdir(), 'mig-probe-order.txt')
  : '/tmp/mig-probe-order-p3.txt';
const ORDER_FILE = args.order ?? DEFAULT_ORDER;
const MAP_FILE = args.map ?? '/tmp/renumber-map.json';

if (!fs.existsSync(ORDER_FILE)) {
  console.error(`order file not found: ${ORDER_FILE}`);
  console.error('Run the probe first: node scripts/migrations/replay-probe.mjs');
  process.exit(1);
}

const split = (f) => {
  const m = f.match(/^([0-9]+)_(.*)\.sql$/);
  return m ? { version: m[1], suffix: m[2] } : { version: null, suffix: f.replace(/\.sql$/, '') };
};
const tsOf = (version) => (version && version.length === 14 ? Number(version) : 0);

const all = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql'));
const order = fs.readFileSync(ORDER_FILE, 'utf8').split('\n').filter(Boolean);

// Anything the probe could not apply still has to keep a place in the chain.
const leftover = all.filter((f) => !order.includes(f)).sort();
const full = [...order, ...leftover];

if (full.length !== all.length) {
  console.error(`count mismatch: ${full.length} ordered vs ${all.length} files on disk`);
  process.exit(1);
}

const used = new Set();
const plan = [];
let prev = 20240101000000; // floor: earlier than the earliest real migration

for (const f of full) {
  const { version, suffix } = split(f);
  let t = Math.max(tsOf(version), prev + 1);
  while (used.has(t)) t += 1;
  used.add(t);
  prev = t;
  const newName = `${String(t).padStart(14, '0')}_${suffix}.sql`;
  plan.push({ from: f, to: newName, changed: newName !== f, applied: order.includes(f) });
}

const changed = plan.filter((p) => p.changed);

console.log(`migrations dir   : ${path.relative(REPO, DIR)}`);
console.log(`order file       : ${ORDER_FILE}`);
console.log(`files            : ${all.length}`);
console.log(`applied by probe : ${order.length}`);
console.log(`leftover         : ${leftover.length}  (could not be applied - placed at the end)`);
console.log(`renamed          : ${changed.length}`);
console.log('');

if (leftover.length) {
  console.log('--- NOT applied by the probe (placed at the end) ---');
  for (const f of leftover.slice(0, 25)) console.log('  ' + f);
  if (leftover.length > 25) console.log(`  ... ${leftover.length - 25} more`);
  console.log('');
}

if (!APPLY) {
  console.log('(dry run - pass --apply to rename)');
  console.log('');
  console.log('--- first 25 renames ---');
  for (const p of changed.slice(0, 25)) console.log(`  ${p.from}\n    -> ${p.to}`);
  process.exit(0);
}

// Two-phase rename to stay collision-free.
for (const p of changed) fs.renameSync(path.join(DIR, p.from), path.join(DIR, `__tmp__${p.to}`));
for (const p of changed) fs.renameSync(path.join(DIR, `__tmp__${p.to}`), path.join(DIR, p.to));

fs.writeFileSync(
  MAP_FILE,
  JSON.stringify(plan.map(({ from, to, applied }) => ({ from, to, applied })), null, 2)
);
console.log(`renamed ${changed.length} files; map -> ${MAP_FILE}`);

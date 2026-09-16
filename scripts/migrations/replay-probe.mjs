#!/usr/bin/env node
/**
 * Migration replay probe — FIX-Task-38.
 *
 * `supabase db reset` applies supabase/migrations in lexicographic filename order and
 * aborts on the first failure, so it cannot tell you which of the 500+ files are
 * genuinely broken versus merely out of order.  This probe instead:
 *
 *   1. resets the local database to a pristine base (no migrations applied), and
 *   2. applies every .sql file in turn, DEFERRING any file that fails and retrying it
 *      on the next pass until no more progress is possible.
 *
 * The result is (a) a dependency-valid apply order and (b) the set of files that can
 * never apply on a fresh database — which is the list that actually needs repairing.
 *
 * Usage:
 *   node scripts/migrations/replay-probe.mjs                 # reset + replay
 *   node scripts/migrations/replay-probe.mjs --no-reset      # replay onto the current DB
 *   node scripts/migrations/replay-probe.mjs --max-passes=10
 *
 * Outputs (in $TMPDIR):
 *   mig-probe-order.txt      dependency-valid apply order
 *   mig-probe-failures.json  every file that never applied, with its error
 *
 * NOTE: the probe targets the `postgres` database on purpose.  pg_cron refuses to
 * install anywhere else ("can only create extension in database postgres") and 35
 * migrations use the `cron` schema.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SUPA = path.join(REPO, 'supabase');
const MIG_DIR = path.join(SUPA, 'migrations');
const HOLD = path.join(os.tmpdir(), 'kmp-migrations-hold');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const MAX_PASSES = Number(args['max-passes'] ?? 8);
const OUT_ORDER = path.join(os.tmpdir(), 'mig-probe-order.txt');
const OUT_FAIL = path.join(os.tmpdir(), 'mig-probe-failures.json');

const psql = (argv, input) => {
  const r = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', ...argv], {
    input: input ?? '',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const firstError = (t) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(ERROR|FATAL|DETAIL|HINT|CONTEXT):/.test(l))
    .slice(0, 2)
    .join(' | ')
    .slice(0, 300) || '(no output captured)';

/**
 * `supabase db reset` always applies supabase/migrations, and neither `--last 0` nor a
 * scratch `--workdir` yields a migration-free base (the CLI keys containers to the
 * project directory).  So: move the directory aside, reset, and always move it back.
 */
function pristineReset() {
  if (fs.existsSync(HOLD)) throw new Error(`${HOLD} already exists — refusing to clobber`);
  fs.renameSync(MIG_DIR, HOLD);
  try {
    fs.mkdirSync(MIG_DIR);
    const r = spawnSync('npx', ['supabase', 'db', 'reset', '--no-seed', '--yes'], {
      cwd: SUPA,
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`db reset failed:\n${r.stdout}\n${r.stderr}`);
  } finally {
    fs.rmdirSync(MIG_DIR);
    fs.renameSync(HOLD, MIG_DIR);
  }
}

// ------------------------------------------------------------------ main
const all = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
console.log(`migrations : ${all.length} files in ${path.relative(REPO, MIG_DIR)}`);

if (args['no-reset']) {
  console.log('resetting   : SKIPPED (--no-reset)');
} else {
  console.log('resetting   : pristine base...');
  pristineReset();
}

let pending = [...all];
const applied = [];
const failures = new Map();

for (let pass = 1; pass <= MAX_PASSES && pending.length; pass++) {
  const still = [];
  let progressed = 0;
  for (const f of pending) {
    const r = psql(
      ['--single-transaction', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
      fs.readFileSync(path.join(MIG_DIR, f), 'utf8')
    );
    if (r.ok) {
      applied.push(f);
      failures.delete(f);
      progressed++;
    } else {
      failures.set(f, firstError(r.out));
      still.push(f);
    }
  }
  console.log(`pass ${pass}: applied ${progressed}, deferred ${still.length}`);
  pending = still;
  if (progressed === 0) break;
}

fs.writeFileSync(OUT_ORDER, applied.join('\n') + '\n');
fs.writeFileSync(
  OUT_FAIL,
  JSON.stringify(
    { appliedCount: applied.length, unresolvedCount: pending.length, unresolved: pending.map((f) => ({ file: f, error: failures.get(f) })) },
    null,
    2
  )
);

console.log('');
console.log(`applied    : ${applied.length}/${all.length}`);
console.log(`unresolved : ${pending.length}`);
console.log(`order      -> ${OUT_ORDER}`);
console.log(`failures   -> ${OUT_FAIL}`);

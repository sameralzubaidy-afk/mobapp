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
 *   PROBE_DSN=postgresql://... node scripts/migrations/replay-probe.mjs   # scratch target override
 *
 * Outputs (COMMITTED, under supabase/migrations/tools/reports/):
 *   migration-order.txt      dependency-valid apply order
 *   mig-probe-failures.json  every file that never applied, with its error, plus the
 *                            per-pass ladder the gate reads (`pass1Deferred` is the canary)
 *
 * SAFETY (FIX-Task-63): this script MUTATES the local stack (it resets the database),
 * so it takes the scoped scratch lock and fails closed on a non-loopback target. Run it
 * while any other session is mid-verification and you destroy their run — which is
 * exactly what happened on 2026-09-18.
 *
 * NOTE: the probe targets the `postgres` database on purpose.  pg_cron refuses to
 * install anywhere else ("can only create extension in database postgres") and 35
 * migrations use the `cron` schema.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SCRATCH_DSN,
  REPORTS_DIR,
  acquireLock,
  assertScratchTarget,
  ensureReportsDir,
} from './lib/guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SUPA = path.join(REPO, 'supabase');
const MIG_DIR = path.join(SUPA, 'migrations');
// Where the migrations directory is parked while the pristine reset runs.
//
// CRASH SAFETY (FIX-Task-63). This used to be `os.tmpdir()`, and killing the probe
// mid-reset — which the gate's own 15-minute TIMEOUT path does, and which Ctrl-C or a
// SIGKILL also do — left the ENTIRE migrations tree (544 files plus tools/) parked in a
// hidden temporary directory. The repo then presented an empty `supabase/migrations`:
// every migration "deleted", the probe unable to write its report, and nothing in the
// output saying why. Measured for real during this task's own timeout test.
//
// Now: (1) the hold lives INSIDE the repo, so it is visible in `git status` and
// greppable (the CLI still ignores it — it only reads `supabase/migrations/`);
// (2) an 'exit' handler restores it on every termination path, including
// `process.exit()`; (3) any hold left over from a crash is healed at startup with a
// loud message before anything else happens; (4) the gate's static check S7 fails when
// an orphaned hold exists, so the recovery instruction reaches the next person
// automatically.
const HOLD = path.join(SUPA, '.migrations-hold');

let holdActive = false;

function restoreHold() {
  if (!holdActive) return;
  try {
    const target = fs.existsSync(MIG_DIR) ? fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')) : [];
    if (target.length > 0) {
      // NEVER delete real migrations to make room for a hold. That turns a "recovery"
      // into the worst data loss in the tool's history — measured during FIX-Task-63
      // when `--recover-hold` was exercised against a healthy tree and wiped 544 files.
      // A hold and a populated migrations dir BOTH existing is an ambiguous state that
      // needs a human, not a guess.
      console.error(`\n!! REFUSING to restore — ${path.relative(REPO, MIG_DIR)} already holds ${target.length} migration file(s).`);
      console.error(`   The parked copy is intact at ${HOLD}. Nothing was deleted. Resolve by hand.`);
      holdActive = false;
      return;
    }
    if (fs.existsSync(MIG_DIR)) fs.rmSync(MIG_DIR, { recursive: true, force: true });
    fs.renameSync(HOLD, MIG_DIR);
    holdActive = false;
    const n = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).length;
    console.log(`restored   : supabase/migrations (${n} files)`);
  } catch (e) {
    console.error(`\n!! MANUAL RECOVERY NEEDED — move ${HOLD} back to ${MIG_DIR} (${e.message})`);
  }
}

/** Startup self-heal: a hold that exists NOW is by definition left over from a crash. */
function recoverOrphanedHold() {
  if (!fs.existsSync(HOLD)) return;
  const stranded = fs.readdirSync(HOLD).filter((f) => f.endsWith('.sql')).length;
  const hasMigrations = fs.existsSync(MIG_DIR) && fs.readdirSync(MIG_DIR).some((f) => f.endsWith('.sql'));
  if (hasMigrations) {
    throw new Error(
      `${HOLD} exists AND ${path.relative(REPO, MIG_DIR)} already contains migrations — refusing to guess which is authoritative. Resolve by hand.`
    );
  }
  console.log(`\n⚠️  ORPHANED HOLD from an interrupted run — ${stranded} migration file(s) parked in`);
  console.log(`   ${HOLD}`);
  console.log('   Restoring them before continuing (this is the crash-safety net).');
  holdActive = true;
  restoreHold();
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const MAX_PASSES = Number(args['max-passes'] ?? 8);
const DSN = args.dsn ?? process.env.PROBE_DSN ?? DEFAULT_SCRATCH_DSN;

// `--recover-hold` is the documented one-liner the gate's S7 check prints. It only
// restores files — it never touches the database — so it is safe to run at any time.
// It goes through the GUARDED path: a recovery command that deletes before it verifies
// is itself a data-loss bug.
if (args['recover-hold']) {
  if (!fs.existsSync(HOLD)) {
    console.log(`nothing to recover: ${HOLD} does not exist`);
    process.exit(0);
  }
  try {
    recoverOrphanedHold();
  } catch (e) {
    console.error(`REFUSING — ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

ensureReportsDir();
const OUT_ORDER = path.join(REPORTS_DIR, 'migration-order.txt');
const OUT_FAIL = path.join(REPORTS_DIR, 'mig-probe-failures.json');

const psql = (argv, input) => {
  const r = spawnSync('psql', [DSN, ...argv], {
    input: input ?? '',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

/**
 * psql prefixes the primary failure line with `psql:<stdin>:<line>: `, so an
 * anchored /^(ERROR|FATAL):/ test silently misses every real error and reports
 * "(no output captured)" while only the bare HINT/CONTEXT lines survive.
 * Strip the prefix first, and keep the primary ERROR line (plus its HINT/DETAIL,
 * which the caller may find useful) rather than whichever line happened to match.
 */
const firstError = (t) => {
  const lines = t
    .split('\n')
    .map((l) => l.replace(/^psql:<stdin>:\d+:\s*/, '').trim());
  const primary = lines.filter((l) => /^(ERROR|FATAL):/.test(l)).slice(0, 1);
  const hint = lines.filter((l) => /^(DETAIL|HINT|CONTEXT):/.test(l)).slice(0, 1);
  return [...primary, ...hint].join(' | ').slice(0, 300) || '(no output captured)';
};

/**
 * `supabase db reset` always applies supabase/migrations, and neither `--last 0` nor a
 * scratch `--workdir` yields a migration-free base (the CLI keys containers to the
 * project directory).  So: move the directory aside, reset, and always move it back.
 */
function pristineReset() {
  recoverOrphanedHold();
  if (fs.existsSync(HOLD)) throw new Error(`${HOLD} already exists — refusing to clobber`);

  fs.renameSync(MIG_DIR, HOLD);
  holdActive = true;
  // 'exit' runs on EVERY termination path that lets Node unwind, including
  // process.exit() from a signal handler. It is registered BEFORE the reset so it covers
  // the whole vulnerable window.
  process.on('exit', restoreHold);

  try {
    fs.mkdirSync(MIG_DIR);
    const r = spawnSync('npx', ['supabase', 'db', 'reset', '--no-seed', '--yes'], {
      cwd: SUPA,
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`db reset failed:\n${r.stdout}\n${r.stderr}`);
  } finally {
    restoreHold();
  }
}

// ------------------------------------------------------------------ main
// Fail closed on a non-loopback target, then take the scoped scratch lock. Both
// happen BEFORE any mutation, so a refusal costs nothing and destroys nothing.
// Refusals exit 3 (BLOCKED) with a one-line reason — never a raw stack trace, which
// reads as "the tool is broken" rather than "the tool is protecting you".
try {
  assertScratchTarget(DSN);
} catch (e) {
  console.error(`BLOCKED — ${e.message}`);
  process.exit(3);
}

let held;
try {
  held = acquireLock({ command: 'replay-probe', reason: 'pristine reset + replay (mutates the local stack)' });
} catch (e) {
  console.error(`BLOCKED — ${e.message}`);
  console.error('Nothing was applied and nothing was reset.');
  process.exit(3);
}

const all = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
console.log(`migrations : ${all.length} files in ${path.relative(REPO, MIG_DIR)}`);
console.log(`target     : ${DSN.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@')}`);

if (args['no-reset']) {
  console.log('resetting   : SKIPPED (--no-reset)');
} else {
  console.log('resetting   : pristine base...');
  pristineReset();
}

let pending = [...all];
const applied = [];
const failures = new Map();
const passes = [];

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
  passes.push({ pass, applied: progressed, deferred: still.length });
  pending = still;
  if (progressed === 0) break;
}

fs.writeFileSync(OUT_ORDER, applied.join('\n') + '\n');
fs.writeFileSync(
  OUT_FAIL,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      // The per-pass ladder is what the gate reads: comparing the WHOLE ladder, not
      // just pass 1, is what caught a hoist that left pass 1 flat while pass 2 moved
      // (BP-96 rule 6). `pass1Deferred > 0` means the apply ORDER is wrong.
      passes,
      pass1Applied: passes[0]?.applied ?? 0,
      pass1Deferred: passes[0]?.deferred ?? 0,
      appliedCount: applied.length,
      unresolvedCount: pending.length,
      unresolved: pending.map((f) => ({ file: f, error: failures.get(f) })),
    },
    null,
    2
  )
);

console.log('');
console.log(`applied    : ${applied.length}/${all.length}`);
console.log(`unresolved : ${pending.length}`);
console.log(`order      -> ${OUT_ORDER}`);
console.log(`failures   -> ${OUT_FAIL}`);
held.release();

// A diagnostic tool historically exited 0 no matter what. The VERDICT lives in the
// report above and is interpreted by migration-gate.mjs; exiting non-zero here would
// break the human iterate-with---no-reset loop, so the exit code stays 0 on purpose.

#!/usr/bin/env node
/**
 * FIX-Task-63 — the migration gate: ONE verdict authority for schema-drift
 * prevention. Replaces "someone remembers to run a full audit every few weeks"
 * with "this class of bug cannot be introduced without same-day detection".
 *
 * WHY A WRAPPER AND NOT TWO CHECKS
 * --------------------------------
 *   * `replay-probe.mjs` reports what can never apply, but it NEVER EXITS NON-ZERO
 *     (it was written as a diagnostic). A CI job cannot block on it as-is.
 *   * `fidelity-check.mjs` exits 1 whenever ANY hard finding exists — and 135 of
 *     them are pre-existing and deliberate (BP-100 forbids driving that to zero).
 *     So a naive "fail on non-zero" gate would block every PR forever.
 *   => this wrapper owns the verdict: it parses the tools' REPORTS (never their
 *      exit codes), applies the freshness + baseline rules, and prints exactly one
 *      of PASS / FAIL / STALE BASELINE / BLOCKED / TIMEOUT.
 *
 * TARGETS: `--static` is DB-free, lock-free and network-free (fast, runs
 * everywhere). `--full` is loopback-only by construction (`assertScratchTarget`
 * fails closed) and takes the scoped scratch lock. Fresh live staging capture is
 * NEVER a step here — see supabase/migrations/README.md.
 *
 * USAGE
 *   node scripts/migrations/migration-gate.mjs --static
 *   node scripts/migrations/migration-gate.mjs --full
 *   node scripts/migrations/migration-gate.mjs --full --scratch-dsn <dsn> --timeout-minutes 15
 *   node scripts/migrations/migration-gate.mjs --update-baseline --reason "<why it changed>"
 *   node scripts/migrations/migration-gate.mjs --lock-status
 *   node scripts/migrations/migration-gate.mjs --force-unlock --reason "<why>"
 *
 * EXIT CODES  PASS=0 · FAIL=1 · STALE BASELINE=2 · BLOCKED=3 · TIMEOUT=4
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_SCRATCH_DSN,
  FP_VERSION,
  GateBlocked,
  MIGRATIONS_DIR,
  REPORTS_DIR,
  STAGING_FP_DIR,
  TOOLS_DIR,
  VERDICT,
  acquireLock,
  assertScratchTarget,
  ensureReportsDir,
  forceUnlock,
  gateDenyListNote,
  gitBranch,
  readLock,
  redact,
  sessionId,
} from './lib/guard.mjs';

/** Bumped whenever the fp*.sql queries change — a mismatched snapshot is unusable. */
const CURRENT_FP_VERSION = FP_VERSION;
const BASELINE_PATH = path.join(TOOLS_DIR, 'fidelity-baseline.json');
const SNAPSHOT_PATH = path.join(STAGING_FP_DIR, 'snapshot.json');
const PROBE_FAILURES = path.join(REPORTS_DIR, 'mig-probe-failures.json');
const PROBE_ORDER = path.join(REPORTS_DIR, 'migration-order.txt');
const FIDELITY_REPORT = path.join(REPORTS_DIR, 'fidelity-report.json');
const LOCAL_FP_PREFIX = path.join(REPORTS_DIR, 'local-fp');
const RUN_REPORT = path.join(REPORTS_DIR, 'gate-last-run.json');

const EXIT = { [VERDICT.PASS]: 0, [VERDICT.FAIL]: 1, [VERDICT.STALE_BASELINE]: 2, [VERDICT.BLOCKED]: 3, [VERDICT.TIMEOUT]: 4 };

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

const TIMEOUT_MINUTES = Number(args['timeout-minutes'] ?? 15);
const DEADLINE = Date.now() + TIMEOUT_MINUTES * 60_000;
const remainingMs = () => Math.max(0, DEADLINE - Date.now());

const findings = [];
const notes = [];
const timings = [];
let verdict = VERDICT.PASS;
// Separate from `verdict` on purpose: `verdict` is only written by finish(), whereas
// findings accumulate during a tier. Without this flag a tier could record [FAIL]
// lines and still fall through to a PASS verdict — the exact "green while broken"
// failure mode this gate exists to prevent.
let hardFail = false;

const log = (s = '') => console.log(s);
const ok = (s) => findings.push({ level: 'ok', message: s });
const warn = (s) => { findings.push({ level: 'warn', message: s }); notes.push(s); };
const bad = (s) => { hardFail = true; findings.push({ level: 'fail', message: s }); };
const blocked = (s) => { hardFail = true; findings.push({ level: 'blocked', message: s }); };

function finish(code, message) {
  verdict = code;
  const report = {
    at: new Date().toISOString(),
    mode: args.full ? 'full' : 'static',
    verdict,
    branch: gitBranch(),
    fpVersionExpected: CURRENT_FP_VERSION,
    timings,
    notes,
    findings,
    message,
  };
  try {
    ensureReportsDir();
    fs.writeFileSync(RUN_REPORT, JSON.stringify(report, null, 2) + '\n');
  } catch {
    /* a run report is an artifact, not a gate condition */
  }
  if (args.json) console.log(JSON.stringify(report));
  log('');
  for (const f of findings) {
    if (f.level === 'ok') continue;
    log(`[${f.level.toUpperCase()}] ${f.message}`);
  }
  log(`VERDICT: ${verdict} — ${message}`);
  process.exit(EXIT[verdict]);
}

// ===========================================================================
// STATIC TIER — no database, no network, no lock. Must stay in the seconds.
// ===========================================================================

function listMigrationFiles() {
  // Top level ONLY: supabase/migrations/tools/*.sql are diagnostic queries
  // (fp1-columns.sql etc.), not migrations, and never matched <digits>_ anyway.
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();
}

function staticTier() {
  const files = listMigrationFiles();
  log(`Static tier — ${files.length} migration files in supabase/migrations/`);

  // S1 — a filename is an ORDER KEY and the CLI silently skips non-conforming names (BP-99).
  const nonConforming = files.filter((f) => !/^\d{14}_.+\.sql$/.test(f));
  if (nonConforming.length) bad(`S1 non-conforming migration filename(s) — the CLI will silently skip these: ${nonConforming.join(', ')}`);
  else ok('S1 all filenames match <14 digits>_<name>.sql');

  // S2 — two files sharing a number prefix have an UNDEFINED apply order.
  const byPrefix = new Map();
  for (const f of files) {
    const p = f.slice(0, 14);
    (byPrefix.get(p) ?? byPrefix.set(p, []).get(p)).push(f);
  }
  const collisions = [...byPrefix].filter(([, v]) => v.length > 1);
  if (collisions.length) bad(`S2 duplicate migration number prefix — undefined apply order: ${collisions.map(([p, v]) => `${p} → ${v.join(' + ')}`).join('; ')}`);
  else ok('S2 no duplicate migration number prefixes');

  // S3 — byte-identical duplicates (FIX-Task-43: seven renumbered leftovers were
  // re-introduced after the renumber, and the earlier copy replayed first).
  const byHash = new Map();
  for (const f of files) {
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(MIGRATIONS_DIR, f))).digest('hex');
    (byHash.get(h) ?? byHash.set(h, []).get(h)).push(f);
  }
  const dupes = [...byHash.values()].filter((v) => v.length > 1);
  if (dupes.length) bad(`S3 byte-identical duplicate migration file(s): ${dupes.map((v) => v.join(' == ')).join('; ')}`);
  else ok('S3 no byte-identical duplicate migration files');

  // S4 — reservation consistency. A reservation CLAIMS a prefix for a named file, so
  // "the reserved file exists" is the normal end state, not a violation. What IS a
  // violation: two sessions claiming one prefix, or a file appearing under a prefix
  // that a different owner reserved (today that collision silently shares an order key).
  try {
    const res = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, 'reservations.json'), 'utf8'));
    const all = res.reservations ?? [];
    const active = all.filter((r) => !r.expiresAt || Date.parse(r.expiresAt) > Date.now());

    const claims = new Map();
    for (const r of active) {
      const prev = claims.get(r.prefix);
      if (prev && prev.owner !== r.owner) bad(`S4 prefix ${r.prefix} reserved by two owners: ${prev.owner} and ${r.owner}`);
      else claims.set(r.prefix, r);
    }

    for (const [prefix, r] of claims) {
      const live = byPrefix.get(prefix) ?? [];
      const declared = new Set(r.files ?? []);
      const undeclared = live.filter((f) => !declared.has(f));
      if (undeclared.length) {
        bad(`S4 prefix ${prefix} is reserved by "${r.owner}" but used by undeclared file(s): ${undeclared.join(', ')} — another session took the number`);
      }
      const absent = [...declared].filter((f) => !live.includes(f));
      if (absent.length && r.requireFiles !== false) warn(`S4 reservation ${prefix} declares file(s) that do not exist yet: ${absent.join(', ')}`);
    }

    const expired = all.filter((r) => r.expiresAt && Date.parse(r.expiresAt) <= Date.now());
    if (expired.length) warn(`S4 ${expired.length} expired reservation(s) still listed: ${expired.map((r) => r.prefix).join(', ')}`);
    if (!hardFail && !expired.length) ok(`S4 reservations consistent (${active.length} active)`);
  } catch (e) {
    if (e instanceof SyntaxError) bad(`S4 supabase/migrations/tools/reservations.json is not valid JSON (${e.message})`);
    else warn('S4 no supabase/migrations/tools/reservations.json — run: node scripts/migrations/reserve-number.mjs --next');
  }

  // S5 — derived artifacts must be COMMITTED, never written to $TMPDIR where they
  // rot and silently go stale (the staging fingerprint did exactly that).
  // A genuine one-off need must declare itself with an ALLOW_TMPDIR comment.
  const toolFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.mjs')) toolFiles.push(p);
    }
  };
  walk(path.join(REPO_ROOT(), 'scripts', 'migrations'));
  const tmpdirUsers = [];
  for (const f of toolFiles) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // A COMMENT cannot write to $TMPDIR. Prose explaining this very ban must not trip
      // the check — the first version of S5 flagged its own documentation.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (!/os\.tmpdir\(|\/tmp\//.test(line)) return;
      const allowed = /ALLOW_TMPDIR/.test(line) || /ALLOW_TMPDIR/.test(lines[i - 1] ?? '');
      if (!allowed) tmpdirUsers.push(`${path.relative(REPO_ROOT(), f)}:${i + 1}`);
    });
  }
  if (tmpdirUsers.length) bad(`S5 tool writes to $TMPDIR instead of the committed reports/ dir (add an ALLOW_TMPDIR comment only for a genuine one-off): ${tmpdirUsers.join(', ')}`);
  else ok(`S5 no un-annotated $TMPDIR writes across ${toolFiles.length} migration-tool files`);

  // S6 — a stale renumber map silently mis-attributes the inversion scan.
  try {
    const map = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'renumber-map.json'), 'utf8'));
    const missing = Object.values(map).filter((v) => typeof v === 'string' && v.endsWith('.sql') && !fs.existsSync(path.join(MIGRATIONS_DIR, path.basename(v))));
    if (missing.length) bad(`S6 renumber-map references ${missing.length} file(s) that no longer exist — regenerate it (see README)`);
    else ok('S6 committed renumber-map references only files that exist');
  } catch {
    warn('S6 no committed supabase/migrations/tools/reports/renumber-map.json (regenerate with renumber.mjs)');
  }

  // S7 — an ORPHANED HOLD means a replay was killed mid-reset (a 15-minute gate timeout,
  // Ctrl-C, a SIGKILL). `replay-probe.mjs` now heals this itself at startup, but if the
  // tree is in that state and nobody runs the probe, the repo looks like it has lost
  // every migration. Fail loudly with the exact recovery command instead.
  const hold = path.join(MIGRATIONS_DIR, '..', '.migrations-hold');
  if (fs.existsSync(hold)) {
    const stranded = fs.readdirSync(hold).filter((f) => f.endsWith('.sql')).length;
    bad(
      `S7 ORPHANED HOLD at supabase/.migrations-hold (${stranded} migration file(s) parked there by an interrupted replay). ` +
        `Recover with: node scripts/migrations/replay-probe.mjs --recover-hold`
    );
  } else {
    ok('S7 no orphaned migrations hold from an interrupted replay');
  }

  return hardFail ? VERDICT.FAIL : VERDICT.PASS;
}

function REPO_ROOT() {
  return path.resolve(MIGRATIONS_DIR, '..', '..');
}

// ===========================================================================
// FULL TIER — loopback scratch target only, lock-protected, deadline-bounded.
// ===========================================================================

function runChild(label, file, extraArgs, env = {}) {
  const budget = remainingMs();
  if (budget <= 0) {
    timings.push({ label, verdict: VERDICT.TIMEOUT, ms: 0 });
    throw { kind: VERDICT.TIMEOUT, message: `${label} never started: the ${TIMEOUT_MINUTES}-minute budget was exhausted` };
  }
  const started = Date.now();
  const r = spawnSync('node', [file, ...extraArgs], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    timeout: budget,
    // GATE_LOCK_HELD tells the child this process already holds the scratch lock (a child
    // has a different pid, so without it the child would refuse to start — see guard.mjs).
    env: { ...process.env, GATE_LOCK_HELD: '1', GATE_SESSION_ID: sessionId(), ...env },
  });
  const ms = Date.now() - started;
  const timedOut = r.error && (r.error.code === 'ETIMEDOUT' || r.signal);
  timings.push({ label, ms, verdict: timedOut ? VERDICT.TIMEOUT : 'ran', exit: r.status ?? null });
  if (timedOut) {
    throw { kind: VERDICT.TIMEOUT, message: `${label} exceeded the ${TIMEOUT_MINUTES}-minute budget (killed after ${(ms / 1000).toFixed(0)}s)` };
  }
  lastChildOutput = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { status: r.status, out: lastChildOutput };
}

/** Tail of the most recent child's output — surfaced when a child fails to produce its report. */
let lastChildOutput = '';

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    // Swallowing the child's output here would turn "the tool crashed" into an opaque
    // "missing report". Print why it failed — the gate must never be the reason nobody
    // can tell what happened.
    const tail = lastChildOutput.split('\n').filter(Boolean).slice(-25).join('\n  ');
    throw {
      kind: VERDICT.BLOCKED,
      message:
        `${label} did not produce a readable report at ${path.relative(REPO_ROOT(), file)} (${e.message})` +
        (tail ? `\n  last output from ${label}:\n  ${tail}` : ''),
    };
  }
}

function fullTier() {
  const dsn = args['scratch-dsn'] ?? process.env.SCRATCH_DSN ?? DEFAULT_SCRATCH_DSN;

  // F0 — fail closed: never staging, only loopback.
  try {
    const url = assertScratchTarget(dsn);
    log(`Full tier — scratch target ${redact(dsn)} (host ${url.hostname})`);
    log(`             ${gateDenyListNote()}`);
  } catch (e) {
    return finish(VERDICT.BLOCKED, e.message);
  }

  // F1 — scoped lock. Protects ONLY this mutating work.
  let held;
  try {
    held = acquireLock({ command: 'migration-gate --full', reason: args.reason ?? 'full gate run' });
    log(`             lock acquired by ${held.lock.ownerSessionId} (pid ${held.lock.pid}, ttl ${held.lock.ttlMinutes}m)`);
  } catch (e) {
    return finish(VERDICT.BLOCKED, e.message);
  }

  const gitHash = currentGitHash();
  try {
    // F2 — psql must exist; a missing tool is BLOCKED, never a silent skip.
    const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' });
    if (psql.status !== 0) throw { kind: VERDICT.BLOCKED, message: 'psql is not available on PATH — cannot rebuild or fingerprint the schema' };

    // F3 — wipe-and-replay. The probe writes its own report; we read the REPORT.
    log('  → replay-probe (pristine reset + full replay)');
    runChild('replay-probe', path.join(REPO_ROOT(), 'scripts', 'migrations', 'replay-probe.mjs'), [], { PROBE_DSN: dsn });
    const probe = readJson(PROBE_FAILURES, 'replay-probe');
    if (probe.unresolvedCount !== 0) bad(`F3 ${probe.unresolvedCount} migration(s) can never apply on a fresh database: ${probe.unresolved.map((u) => `${u.file} (${u.error})`).slice(0, 5).join(' | ')}`);
    else ok('F3 replay: unresolved 0 — every migration applies');

    // "pass 1: applied N, deferred 0" is the property `supabase db reset` needs:
    // a single-pass, zero-deferral replay means the ORDER is right, not merely
    // "everything fits somewhere" (BP-96).
    if (probe.pass1Deferred !== 0) {
      // Deferred>0 has two causes and this line must not assert the wrong one: either
      // the ORDER is wrong, or a file is simply broken and can never apply. F3 above
      // names the file; this only reports the shape of the ladder.
      bad(
        `F3 pass 1 deferred ${probe.pass1Deferred} file(s) — the chain is not applying in one pass ` +
          `(an order problem, or a file that can never apply — see the unresolved list above). ` +
          `Pass ladder: ${(probe.passes ?? []).map((p) => `${p.applied}/${p.deferred}`).join(' → ')}`
      );
    } else {
      ok(`F3 pass 1 applied ${probe.pass1Applied}, deferred 0 (single pass)`);
    }

    // A chain that does not apply cleanly is DEFINITIVE and needs no snapshot to act on.
    // Reporting BLOCKED here would hide a real defect behind a missing-capture message.
    if (hardFail) {
      return finish(VERDICT.FAIL, 'the migration chain does not apply cleanly — fix the [FAIL] item(s) above (the fidelity comparison was NOT run)');
    }

    // F4 — fidelity against the committed capture.
    const stagingPrefix = args['staging-prefix'] ?? path.join(STAGING_FP_DIR, 'staging-fp');
    if (!fs.existsSync(`${stagingPrefix}1.txt`)) {
      throw {
        kind: VERDICT.BLOCKED,
        message:
          `no committed staging fingerprint at ${path.relative(REPO_ROOT(), stagingPrefix)}1.txt. ` +
          'Capture it with an APPROVED read-only staging query (see supabase/migrations/tools/staging-fp/README.md). ' +
          'Fresh capture is never a CI step.',
      };
    }

    log('  → fidelity-check (rebuilt schema vs committed snapshot)');
    runChild(
      'fidelity-check',
      path.join(REPO_ROOT(), 'scripts', 'migrations', 'fidelity-check.mjs'),
      [
        `--staging-prefix=${stagingPrefix}`,
        `--local-prefix=${LOCAL_FP_PREFIX}`,
        `--out=${FIDELITY_REPORT}`,
        `--order=${PROBE_ORDER}`,
      ],
      { FIDELITY_DSN: dsn }
    );

    // F5 — freshness. A comparison of two old things is not evidence: the corner
    // that hid a REAL `nodes.id` default divergence was a 2-day-old capture that
    // only ever got read as "silence".
    const freshness = checkFreshness(gitHash);
    if (freshness.state === 'stale') return finish(VERDICT.STALE_BASELINE, freshness.message);
    ok(`F5 snapshot fresh (${freshness.message})`);

    // F6 — baseline diff. The ONLY regression signal is a NEW finding: the 100+
    // pre-existing residuals are classified, deliberate, and must not be "fixed"
    // to zero (BP-100).
    const report = readJson(FIDELITY_REPORT, 'fidelity-check');
    const currentKeys = findingKeys(report);
    const baselineFile = args.baseline ?? BASELINE_PATH;
    if (!fs.existsSync(baselineFile)) {
      throw {
        kind: VERDICT.BLOCKED,
        message: `no fidelity baseline at ${path.relative(REPO_ROOT(), baselineFile)} — create it deliberately with --update-baseline --reason "<why>"`,
      };
    }
    const baseline = readJson(baselineFile, 'baseline');
    const baselineKeys = new Set((baseline.keys ?? []).map((k) => (typeof k === 'string' ? k : k.key)));
    const added = [...currentKeys].filter((k) => !baselineKeys.has(k)).sort();
    const removed = [...baselineKeys].filter((k) => !currentKeys.has(k)).sort();
    const unlabelled = (baseline.keys ?? []).filter((k) => typeof k === 'object' && (!k.direction || !k.reason || !k.owningTask));

    if (report.counts?.unexplained > 0) {
      bad(`F6 ${report.counts.unexplained} replay-only object(s) with NO CREATOR — an invention of the rebuild, not the chain`);
    }
    if (unlabelled.length) bad(`F6 ${unlabelled.length} baseline entr(ies) lack direction/reason/owningTask: ${unlabelled.slice(0, 5).map((k) => k.key).join(', ')}`);
    if (added.length) {
      bad(
        `F6 ${added.length} NEW fidelity finding(s) — attribute each with the discriminating re-run before reporting it as a regression (BP-100 rule 7): ${added.slice(0, 10).join(', ')}`
      );
    }
    if (removed.length) warn(`F6 ${removed.length} baseline finding(s) no longer present — refresh the baseline deliberately (a finding that GONE without a reason is itself drift): ${removed.slice(0, 5).join(', ')}`);
    if (!added.length && !unlabelled.length && !report.counts?.unexplained) ok(`F6 no NEW findings vs baseline (${currentKeys.size} current, ${baselineKeys.size} baselined)`);

    if (hardFail) return finish(VERDICT.FAIL, 'at least one blocking finding — see [FAIL] lines above');
    return finish(VERDICT.PASS, `static + full green (${probe.pass1Applied}/${probe.pass1Applied} one-pass, no new drift)`);
  } catch (e) {
    if (e instanceof GateBlocked) return finish(VERDICT.BLOCKED, e.message);
    if (e?.kind) return finish(e.kind, e.message);
    throw e;
  } finally {
    held.release();
  }
}

/**
 * Every delta key the comparison produced, INCLUDING `explained`.
 *
 * Rule 2's "explained" bucket means "present in the rebuild, absent from staging, with
 * a creator in the chain" — the normal shape of a repo that is AHEAD of staging. Its
 * keys used to be ignored by the baseline, which made a whole class of change invisible:
 * a NEW grant, a changed RLS flag or a changed bucket property on an object that already
 * exists is "explained" by provenance the instant the object exists, so the gate stayed
 * green while a permission drifted.
 *
 * Including them here keeps the gate quiet about the pre-existing, classified residual
 * set (it is in the baseline) while failing loudly on ANY change to it — which is the
 * property the whole task is about.
 */
function findingKeys(report) {
  const keys = [];
  for (const group of ['subsetMisses', 'unexplained', 'conflicts', 'explained']) {
    for (const item of report[group] ?? []) keys.push(item.key);
  }
  return new Set(keys);
}

/** Group counts for the human-readable summary, so a PASS never hides what was compared. */
function kindSummary(report) {
  const byKind = (arr) => {
    const m = {};
    for (const x of arr ?? []) {
      const k = String(x.key).split('|')[0];
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  };
  return {
    subsetMisses: byKind(report.subsetMisses),
    unexplained: byKind(report.unexplained),
    conflicts: byKind(report.conflicts),
    explained: byKind(report.explained),
  };
}

function checkFreshness() {
  const snapshotPath = args.snapshot ?? SNAPSHOT_PATH;
  if (!fs.existsSync(snapshotPath)) {
    return {
      state: 'stale',
      message: `no snapshot metadata at ${path.relative(REPO_ROOT(), snapshotPath)} — a fingerprint with no capture time cannot support any "staging matches" claim`,
    };
  }
  let snap;
  try {
    snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  } catch (e) {
    return { state: 'stale', message: `snapshot.json is unreadable (${e.message})` };
  }
  if (Number(snap.fpVersion) !== CURRENT_FP_VERSION) {
    return {
      state: 'stale',
      message: `snapshot was captured with fingerprint v${snap.fpVersion}, this gate speaks v${CURRENT_FP_VERSION} — recapture (never compare across query versions)`,
    };
  }
  // The query-set sha is the binding check, not the version integer: editing fp*.sql
  // without bumping the version would otherwise slip through silently.
  const report = fs.existsSync(FIDELITY_REPORT) ? JSON.parse(fs.readFileSync(FIDELITY_REPORT, 'utf8')) : null;
  if (snap.fpQueriesSha && report?.fpQueriesSha && snap.fpQueriesSha !== report.fpQueriesSha) {
    return {
      state: 'stale',
      message: `snapshot was captured with DIFFERENT fingerprint queries (snapshot ${snap.fpQueriesSha.slice(0, 12)}…, current ${report.fpQueriesSha.slice(0, 12)}…) — a capture taken with other queries is not evidence about this schema`,
    };
  }
  const capturedAt = Date.parse(snap.capturedAt ?? 0);
  if (!Number.isFinite(capturedAt)) return { state: 'stale', message: 'snapshot.capturedAt is missing or unparseable' };

  const ageDays = (Date.now() - capturedAt) / 86_400_000;
  const limit = Number(snap.freshnessDays ?? 7);
  if (ageDays > limit) {
    return {
      state: 'stale',
      message: `STALE BASELINE: snapshot is ${ageDays.toFixed(1)} days old (limit ${limit}d, captured ${new Date(capturedAt).toISOString()}). Re-capture with an approved read-only staging query, then commit — do NOT read this as green.`,
    };
  }
  const ddlAt = Date.parse(snap.lastApprovedStagingDDLAt ?? 0);
  if (Number.isFinite(ddlAt) && ddlAt > capturedAt) {
    return {
      state: 'stale',
      message: `STALE BASELINE: an approved staging DDL was applied at ${new Date(ddlAt).toISOString()}, after the snapshot was captured at ${new Date(capturedAt).toISOString()}. Re-capture before claiming staging matches.`,
    };
  }
  return { state: 'fresh', message: `captured ${new Date(capturedAt).toISOString()} (${ageDays.toFixed(1)}d old, limit ${limit}d)` };
}

function currentGitHash() {
  const r = spawnSync('git', ['-C', REPO_ROOT(), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

// ===========================================================================
// --update-baseline — a deliberate act: prints the diff BEFORE writing.
// ===========================================================================

function updateBaseline() {
  const report = readJson(FIDELITY_REPORT, 'fidelity-check');
  const baselineFile = args.baseline ?? BASELINE_PATH;
  const keys = [...findingKeys(report)].sort();
  const prev = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : { keys: [] };
  const prevKeys = new Set((prev.keys ?? []).map((k) => (typeof k === 'string' ? k : k.key)));
  const added = keys.filter((k) => !prevKeys.has(k));
  const removed = [...prevKeys].filter((k) => !keys.includes(k));
  const direction = directionOf(report);

  log(`Baseline update — ${keys.length} keys (was ${prevKeys.size})`);
  log(`  NEW (${added.length}):`);
  for (const k of added) log(`    + ${k}`);
  log(`  GONE (${removed.length}):`);
  for (const k of removed) log(`    - ${k}`);

  const reason = args.reason;
  if (!reason) return finish(VERDICT.BLOCKED, '--update-baseline requires --reason "<why this changed>" — an unexplained baseline move is exactly the drift this gate exists to catch');

  const snap = fs.existsSync(SNAPSHOT_PATH) ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) : {};
  const out = {
    fpVersion: CURRENT_FP_VERSION,
    generatedAt: new Date().toISOString(),
    gitHash: currentGitHash(),
    snapshotCapturedAt: snap.capturedAt ?? null,
    reason,
    counts: report.counts ?? {},
    keys: keys.map((key) => {
      const prior = (prev.keys ?? []).find((k) => (typeof k === 'string' ? k : k.key) === key);
      const label = typeof prior === 'object' ? prior : null;
      return {
        key,
        direction: label?.direction ?? direction.get(key) ?? 'unclassified',
        reason: label?.reason ?? (added.includes(key) ? 'NEW in this update — describe the mechanism' : 'carried forward'),
        owningTask: label?.owningTask ?? 'FIX-Task-63',
      };
    }),
  };
  ensureReportsDir();
  fs.writeFileSync(baselineFile, JSON.stringify(out, null, 2) + '\n');
  return finish(VERDICT.PASS, `baseline rewritten at ${path.relative(REPO_ROOT(), baselineFile)} (${keys.length} keys, reason recorded)`);
}

/** BP-100 vocabulary, derived mechanically from which rule produced the finding. */
function directionOf(report) {
  const m = new Map();
  for (const x of report.subsetMisses ?? []) m.set(x.key, 'staging-ahead-or-removed-in-chain');
  for (const x of report.unexplained ?? []) m.set(x.key, 'chain-invention');
  for (const x of report.conflicts ?? []) m.set(x.key, compareDirection(x));
  return m;
}

function compareDirection(x) {
  const s = String(x.staging ?? '');
  const l = String(x.local ?? '');
  if (/_anon_|anon/.test(s) && !/anon/.test(l)) return 'staging-looser-unsafe-owner-decision';
  if (/\brelrowsecurity\b/.test(x.key)) return 'rls-state-delta';
  return 'same-object-different-definition-review';
}

// ===========================================================================

const mode = args.full ? 'full' : args.static ? 'static' : null;

if (args['lock-status']) {
  const l = readLock();
  log(l ? JSON.stringify(l, null, 2) : 'no lock held');
  process.exit(0);
}
if (args['force-unlock']) {
  try {
    const prev = forceUnlock(args.reason);
    log(`lock force-released (was ${prev ? `held by ${prev.ownerSessionId} since ${prev.acquiredAt}` : 'not held'}); logged to tools/reports/lock-events.log`);
    process.exit(0);
  } catch (e) {
    log(e.message);
    process.exit(EXIT[VERDICT.BLOCKED]);
  }
}
if (args['update-baseline']) updateBaseline();

if (!mode) {
  log('Usage: migration-gate.mjs --static | --full | --update-baseline --reason "<why>" | --lock-status | --force-unlock --reason "<why>"');
  process.exit(EXIT[VERDICT.BLOCKED]);
}

log('Migration gate');
log('==============');
ensureReportsDir();

if (mode === 'static') {
  const v = staticTier();
  finish(v, v === VERDICT.PASS ? 'static checks green' : 'static checks failed — fix before committing');
}
fullTier();

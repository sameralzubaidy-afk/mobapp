// FIX-Task-63 — shared safety primitives for the migration tooling.
//
// WHY THIS FILE EXISTS
// --------------------
// Two failures this repo has actually paid for, both addressed here:
//
//   1. `replay-probe.mjs` calls `supabase db reset` after moving the migrations
//      directory aside. That is a destructive, machine-global action against the
//      shared local stack — the FIX-Task-62 report records it destroying a
//      sibling session's verification run ("the database volume was re-created by
//      another process ... `public.role_based_access_control` no longer exists").
//      => a scoped advisory lock, acquired BY THE MUTATING COMMAND ITSELF, not
//         only by the gate that wraps it. A manual `node replay-probe.mjs` must be
//         just as safe as a gated run.
//
//   2. The gate must never touch shared staging. A gate that can silently point at
//      production is worse than no gate, so the target check FAILS CLOSED.
//
// The lock deliberately protects ONLY local-stack mutating work. It is never
// consulted by mobile QA, emulator work, app tests, read-only staging checks or
// doc edits — the cure must not become the next interruption to testing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const MIGRATIONS_DIR = path.join(REPO, 'supabase', 'migrations');
export const TOOLS_DIR = path.join(MIGRATIONS_DIR, 'tools');
export const REPORTS_DIR = path.join(TOOLS_DIR, 'reports');
export const STAGING_FP_DIR = path.join(TOOLS_DIR, 'staging-fp');
export const LOCK_PATH = path.join(TOOLS_DIR, '.lock');
export const NON_SCRATCH_TARGETS = path.join(TOOLS_DIR, 'non-scratch-targets.json');

export const DEFAULT_SCRATCH_DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Verdict vocabulary — only PASS is success. Nothing may ever "downgrade" to it. */
export const VERDICT = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  STALE_BASELINE: 'STALE BASELINE',
  BLOCKED: 'BLOCKED',
  TIMEOUT: 'TIMEOUT',
});

/**
 * Fingerprint query version — the single source of truth for it.
 *
 * v1 (FIX-Task-40): columns / constraints+indexes+triggers / functions+enums+policies+RLS+views.
 * v2 (FIX-Task-63): + function body hash (md5(prosrc)), + ACLs (functions and relations),
 *                   + storage bucket properties. See the header of fp3-objects.sql for the
 *                   three defects v1 was structurally blind to.
 *
 * BUMP THIS whenever fp*.sql changes. A captured snapshot records the version AND the
 * sha of the three query files; the gate refuses to compare across either difference, so
 * a silent query edit cannot masquerade as "no drift".
 */
export const FP_VERSION = 2;

export class GateBlocked extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateBlocked';
  }
}

export function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ------------------------------------------------------------------ scratch target

/**
 * Fail-closed target guard. The full tier may ONLY talk to a loopback scratch
 * database. Anything else — including any host that merely *looks* remote, or any
 * DSN carrying a known non-scratch project ref — is BLOCKED, never "warned about".
 */
export function assertScratchTarget(dsn) {
  if (!dsn) throw new GateBlocked('no scratch DSN resolved (set SCRATCH_DSN or --scratch-dsn)');
  let url;
  try {
    url = new URL(dsn);
  } catch {
    throw new GateBlocked(`scratch DSN is not a parseable URL: ${redact(dsn)}`);
  }

  const deny = readNonScratchTargets();
  const haystack = dsn.toLowerCase();

  for (const t of deny.targets ?? []) {
    if (t.ref && haystack.includes(String(t.ref).toLowerCase())) {
      throw new GateBlocked(`DSN references ${t.kind} project ref ${t.ref} (${t.note ?? 'denied'})`);
    }
  }
  for (const suffix of deny.denyHostSuffixes ?? []) {
    if (url.hostname.toLowerCase().endsWith(String(suffix).toLowerCase())) {
      throw new GateBlocked(`DSN host ${url.hostname} matches denied suffix ${suffix}`);
    }
  }

  const loopback = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  if (!loopback.has(url.hostname)) {
    throw new GateBlocked(
      `DSN host ${url.hostname} is not loopback — the full gate must run against a dedicated scratch target only`
    );
  }
  return url;
}

function readNonScratchTargets() {
  try {
    return JSON.parse(fs.readFileSync(NON_SCRATCH_TARGETS, 'utf8'));
  } catch {
    return { targets: [], denyHostSuffixes: ['.supabase.co', '.supabase.com', 'pooler.supabase.com'] };
  }
}

export const redact = (dsn) => String(dsn).replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');

// ------------------------------------------------------------------ scoped lock

const ownerId = () =>
  process.env.GATE_SESSION_ID ||
  `${os.hostname()}#${process.ppid}`;

/** The resolved session id — a parent passes this down so a child's lock write agrees. */
export const sessionId = ownerId;

function processStartTime(pid) {
  try {
    return fs.statSync(`/proc/${pid}`).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function readLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function staleReason(lock, ttlMinutes) {
  if (!lock) return 'missing';
  const hb = Date.parse(lock.heartbeatAt ?? lock.acquiredAt ?? 0);
  if (!Number.isFinite(hb)) return 'unparseable heartbeat';
  const ageMin = (Date.now() - hb) / 60000;
  const ttl = Number(lock.ttlMinutes ?? ttlMinutes);
  return ageMin > ttl ? `heartbeat ${ageMin.toFixed(1)} min old (ttl ${ttl} min)` : null;
}

/**
 * Acquire the lock, or throw GateBlocked. Takes over an EXPIRED lock (logged),
 * never a live one held by a different owner.
 *
 * NESTED USE: when the gate runs the probe it already holds the lock, and the child
 * process has a different pid (so a different owner id) — it would refuse to start and
 * the gate would see a "missing report" instead of the real reason. A parent therefore
 * sets GATE_LOCK_HELD=1, and the child treats the lock as already held. A MANUAL probe
 * run has no such variable and still takes the lock itself, which is the property that
 * matters: the destructive command is safe however it is invoked.
 */
export function acquireLock({ command, reason = '', ttlMinutes = 30 }) {
  ensureReportsDir();
  if (process.env.GATE_LOCK_HELD === '1') {
    return { lock: readLock() ?? { heldByParent: true }, release: () => {} };
  }
  const existing = readLock();
  if (existing && existing.ownerSessionId !== ownerId()) {
    const stale = staleReason(existing, ttlMinutes);
    if (!stale) {
      throw new GateBlocked(
        `scratch lock held by "${existing.ownerSessionId}" (branch ${existing.branch}, pid ${existing.pid}, ` +
          `command ${existing.command}) since ${existing.acquiredAt}. ` +
          `Wait for it to finish, or release deliberately with: node scripts/migrations/migration-gate.mjs --force-unlock --reason "<why>"`
      );
    }
    appendUnlockLog({ kind: 'auto-takeover', previous: existing, reason: `stale: ${stale}` });
  }

  const lock = {
    ownerSessionId: ownerId(),
    branch: gitBranch(),
    pid: process.pid,
    processStartTime: processStartTime(process.pid),
    command,
    reason,
    acquiredAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    ttlMinutes,
  };
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');

  const timer = setInterval(() => {
    const cur = readLock();
    if (cur && cur.ownerSessionId === lock.ownerSessionId) {
      cur.heartbeatAt = new Date().toISOString();
      fs.writeFileSync(LOCK_PATH, JSON.stringify(cur, null, 2) + '\n');
    }
  }, 60_000);
  timer.unref?.();

  const releaseSync = () => {
    try {
      const cur = readLock();
      if (cur && cur.ownerSessionId === lock.ownerSessionId) fs.rmSync(LOCK_PATH, { force: true });
    } catch {
      /* best effort on the way out */
    }
  };
  // A gate that throws or calls process.exit() must NOT leave the lock behind: a stale
  // lock would block every later run for the whole TTL, which is a worse outcome than
  // the concurrency it prevents. `process.on('exit')` runs on both paths, including
  // process.exit().
  process.on('exit', releaseSync);
  process.on('SIGINT', () => { releaseSync(); process.exit(130); });
  process.on('SIGTERM', () => { releaseSync(); process.exit(143); });

  return {
    lock,
    release: () => {
      clearInterval(timer);
      releaseSync();
    },
  };
}

export function forceUnlock(reason) {
  if (!reason || !String(reason).trim()) throw new GateBlocked('--force-unlock requires --reason "<why>"');
  const previous = readLock();
  fs.rmSync(LOCK_PATH, { force: true });
  appendUnlockLog({ kind: 'force-unlock', previous, reason: String(reason).trim(), by: ownerId() });
  return previous;
}

function appendUnlockLog(entry) {
  ensureReportsDir();
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(path.join(REPORTS_DIR, 'lock-events.log'), line);
}

export function gitBranch() {
  try {
    const head = fs.readFileSync(path.join(REPO, '.git', 'HEAD'), 'utf8').trim();
    return head.startsWith('ref: ') ? head.slice(5).replace('refs/heads/', '') : '(detached)';
  } catch {
    return '(unknown)';
  }
}

export const gateDenyListNote = () => {
  const deny = readNonScratchTargets();
  const refs = (deny.targets ?? []).map((t) => `${t.ref} (${t.kind})`).join(', ');
  const hosts = (deny.denyHostSuffixes ?? []).join(', ');
  return `denied refs: ${refs || 'none'}; denied host suffixes: ${hosts || 'none'}`;
};

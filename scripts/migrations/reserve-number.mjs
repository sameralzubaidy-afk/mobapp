#!/usr/bin/env node
/**
 * FIX-Task-63 — MIGRATION NUMBER RESERVATION.
 *
 * WHY THIS IS A HARD RULE AND NOT A SUGGESTION
 * -------------------------------------------
 * A migration filename is an ORDER KEY (BP-99): the CLI applies files in lexicographic
 * order and silently skips anything that does not match `<digits>_<name>.sql`. Two files
 * sharing a 14-digit prefix therefore have an UNDEFINED apply order — the earlier-applying
 * one wins, quietly, and the fingerprint (which records identity, not bodies) stays green.
 *
 * That is not hypothetical. On 2026-09-18 two concurrent sessions wrote
 * `20260918000010_*` / `20260918000011_*` into the same working tree and one task had to
 * be moved into a reserved block mid-flight, after its report was already written.
 * Checking by eye ("ls | cut | uniq -d") only works if you remember to do it.
 *
 * THE CONVENTION THIS FORMALISES
 * ------------------------------
 *   * Ask for the next free number:   `--next`
 *   * Working in PARALLEL with another session? Do not race for the natural number —
 *     claim a RESERVED BLOCK instead (`--next --block`). The observed convention is a
 *     `+50000` offset in the seconds band, e.g. `2026091805000x` while a sibling holds
 *     `2026091800001x`. It is deliberately far from any natural number, so the two
 *     cannot drift into each other.
 *   * Record the claim (`--claim`) so `migration-gate.mjs --static` check S4 can prove
 *     nobody else took it.
 *
 * USAGE
 *   node scripts/migrations/reserve-number.mjs --next [--block] [--name my_change]
 *   node scripts/migrations/reserve-number.mjs --claim --owner <session> --reason "<why>" [--prefix 20260918050000] [--files a.sql,b.sql] [--expires 2026-10-18]
 *   node scripts/migrations/reserve-number.mjs --check
 *   node scripts/migrations/reserve-number.mjs --list
 *   node scripts/migrations/reserve-number.mjs --release --prefix 20260918050000 --reason "<why>"
 */
import fs from 'node:fs';
import path from 'node:path';

import { MIGRATIONS_DIR, TOOLS_DIR } from './lib/guard.mjs';

const RESERVATIONS = path.join(TOOLS_DIR, 'reservations.json');

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

const migrationFiles = () =>
  fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();

function loadReservations() {
  if (!fs.existsSync(RESERVATIONS)) return { _comment: 'FIX-Task-63 migration number reservations.', reservations: [] };
  const j = JSON.parse(fs.readFileSync(RESERVATIONS, 'utf8'));
  j.reservations ??= [];
  return j;
}

const saveReservations = (j) => fs.writeFileSync(RESERVATIONS, JSON.stringify(j, null, 2) + '\n');

const pad14 = (n) => String(n).padStart(14, '0');

function maxPrefix(files) {
  return files.reduce((m, f) => Math.max(m, Number(f.slice(0, 14)) || 0), 0);
}

/** Today's date prefix, so the number still reads like a timestamp to a human. */
function todayBase() {
  const d = new Date();
  const s = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return Number(`${s}000000`);
}

function nextFree() {
  const files = migrationFiles();
  const res = loadReservations();
  const taken = new Set(files.map((f) => f.slice(0, 14)));
  for (const r of res.reservations) if (!r.expiresAt || Date.parse(r.expiresAt) > Date.now()) taken.add(r.prefix);

  // Must sort AFTER every existing file (the order is the contract) AND after today's
  // base, so the number never reads as older than it is.
  let candidate = Math.max(maxPrefix(files) + 1, todayBase());
  while (taken.has(pad14(candidate))) candidate++;
  return pad14(candidate);
}

/** The reserved-block convention: today at 05:00:00 (+50000 s), then walk up. */
function nextFreeBlock() {
  const files = migrationFiles();
  const res = loadReservations();
  const taken = new Set(files.map((f) => f.slice(0, 14)));
  for (const r of res.reservations) if (!r.expiresAt || Date.parse(r.expiresAt) > Date.now()) taken.add(r.prefix);

  const day = pad14(todayBase()).slice(0, 8);
  let candidate = Number(`${day}050000`);
  while (taken.has(pad14(candidate))) candidate++;
  return pad14(candidate);
}

function check() {
  const files = migrationFiles();
  const res = loadReservations();
  const problems = [];
  const warnings = [];

  const byPrefix = new Map();
  for (const f of files) {
    const p = f.slice(0, 14);
    (byPrefix.get(p) ?? byPrefix.set(p, []).get(p)).push(f);
  }
  for (const [p, v] of byPrefix) if (v.length > 1) problems.push(`duplicate prefix ${p}: ${v.join(' + ')}`);

  const active = res.reservations.filter((r) => !r.expiresAt || Date.parse(r.expiresAt) > Date.now());
  const claims = new Map();
  for (const r of active) {
    const prev = claims.get(r.prefix);
    if (prev && prev.owner !== r.owner) problems.push(`prefix ${r.prefix} claimed by two owners: ${prev.owner}, ${r.owner}`);
    else claims.set(r.prefix, r);
  }
  for (const [p, r] of claims) {
    const live = byPrefix.get(p) ?? [];
    const declared = new Set(r.files ?? []);
    for (const f of live) if (!declared.has(f)) problems.push(`prefix ${p} reserved by "${r.owner}" but used by undeclared file ${f}`);
    for (const f of declared) if (!live.includes(f)) warnings.push(`reservation ${p} declares ${f}, which does not exist yet`);
  }
  for (const r of res.reservations) if (r.expiresAt && Date.parse(r.expiresAt) <= Date.now()) warnings.push(`expired reservation ${r.prefix} (owner ${r.owner}) still listed — release it`);

  console.log(`Migration number check — ${files.length} files, ${active.length} active reservation(s)`);
  for (const p of problems) console.log(`  [FAIL] ${p}`);
  for (const w of warnings) console.log(`  [WARN] ${w}`);
  if (!problems.length) console.log(`  [OK] no collisions, no foreign claims`);
  return problems.length ? 1 : 0;
}

function claim() {
  const owner = args.owner;
  if (!owner) {
    console.error('--claim requires --owner "<session/task id>" (an unattributed reservation cannot be resolved later)');
    return 2;
  }
  const reason = args.reason;
  if (!reason) {
    console.error('--claim requires --reason "<why this number is reserved>" — a bare prefix tells the next person nothing');
    return 2;
  }
  const prefix = args.prefix ?? (args.block ? nextFreeBlock() : nextFree());
  const j = loadReservations();
  const existing = j.reservations.find((r) => r.prefix === prefix);
  if (existing && existing.owner !== owner) {
    console.error(`prefix ${prefix} is already reserved by "${existing.owner}" — use --next to get a free one`);
    return 1;
  }
  const files = args.files ? String(args.files).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const entry = { prefix, owner, reason, claimedAt: new Date().toISOString(), expiresAt: args.expires || null, files };
  if (existing) Object.assign(existing, entry);
  else j.reservations.push(entry);
  saveReservations(j);

  console.log(`reserved ${prefix} for "${owner}"`);
  if (files.length) for (const f of files) console.log(`  file: ${f}`);
  console.log(`\nCreate the migration as:  supabase/migrations/${prefix}_<snake_case_name>.sql`);
  console.log(`Then: node scripts/migrations/migration-gate.mjs --static`);
  return 0;
}

function release() {
  const prefix = args.prefix;
  if (!prefix) {
    console.error('--release requires --prefix <14 digits>');
    return 2;
  }
  const j = loadReservations();
  const before = j.reservations.length;
  j.reservations = j.reservations.filter((r) => r.prefix !== prefix);
  if (j.reservations.length === before) {
    console.error(`no reservation for prefix ${prefix}`);
    return 1;
  }
  saveReservations(j);
  console.log(`released ${prefix}${args.reason ? ` (reason: ${args.reason})` : ''}`);
  return 0;
}

if (args.check) process.exit(check());
if (args.list) {
  const j = loadReservations();
  console.log(`${j.reservations.length} reservation(s):`);
  for (const r of j.reservations) {
    const state = r.expiresAt && Date.parse(r.expiresAt) <= Date.now() ? 'EXPIRED' : 'active';
    console.log(`  ${r.prefix}  ${state.padEnd(7)} ${r.owner}${r.files?.length ? `  [${r.files.join(', ')}]` : ''}`);
  }
  process.exit(0);
}
if (args.claim) process.exit(claim());
if (args.release) process.exit(release());

// default action: --next
const prefix = args.block ? nextFreeBlock() : nextFree();
const name = args.name ?? 'my_change';
console.log(args.block ? 'Next free RESERVED-BLOCK prefix (parallel work):' : 'Next free migration prefix:');
console.log(`  ${prefix}`);
console.log(`  supabase/migrations/${prefix}_${name}.sql`);
console.log('');
console.log('Claim it so the static gate can prove nobody else took it:');
console.log(`  node scripts/migrations/reserve-number.mjs --claim --owner "<task/session>" --reason "<why>" --prefix ${prefix} --files ${prefix}_${name}.sql`);

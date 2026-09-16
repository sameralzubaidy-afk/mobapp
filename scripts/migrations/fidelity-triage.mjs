#!/usr/bin/env node
/**
 * FIX-Task-43 — triage classifier for the fidelity gate's named exceptions.
 *
 * Reads e2e-test-results/fix-task-40-phase3-2026-09-16/fidelity-exceptions.md and buckets
 * every SUBSET miss and every CONFLICT by likely impact, printing counts per
 * (section | class | category). Output feeds
 * e2e-test-results/fix-task-43-2026-09-16/fidelity-triage.md.
 *
 *   node scripts/migrations/fidelity-triage.mjs
 *
 * KNOWN LIMITATION: the CONFLICT/COLUMN rule cannot tell nullability from type/default
 * drift (both sides' fingerprint lines contain the NOT NULL position), so it labels all
 * of them "nullability". The triage document therefore uses the fidelity report's own
 * authoritative split for that one class (10 nullability / 6 type / 2 default).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FILE = path.join(
  REPO,
  'e2e-test-results/fix-task-40-phase3-2026-09-16/fidelity-exceptions.md'
);

const lines = fs.readFileSync(FILE, 'utf8').split('\n');

let section = null;
let klass = null;
const records = []; // { section, klass, name, detail }

for (const line of lines) {
  const h2 = line.match(/^## \d+ · ([A-Z]+)/);
  if (h2) {
    section = h2[1];
    klass = null;
    continue;
  }
  const h3 = line.match(/^### ([A-Za-z ]+) \(/);
  if (h3) {
    klass = h3[1].trim().toUpperCase();
    continue;
  }
  if (!section || !klass) continue;

  const bullet = line.match(/^- `([^`]+)`/);
  if (bullet) {
    records.push({ section, klass, name: bullet[1], detail: '' });
    continue;
  }
  if (records.length && /^\s{2,}- /.test(line)) {
    records[records.length - 1].detail += ' ' + line.trim();
  }
}

const PGN_EXTENSION = /^(bytea_to_text|text_to_bytea|urlencode|http_|http\.)/;

function classify(rec) {
  const { section, klass, name, detail } = rec;

  if (section === 'SUBSET') {
    switch (klass) {
      case 'FUNCTION':
        if (PGN_EXTENSION.test(name))
          return ['BENIGN · extension artifact', 'pg_net extension function, not an app object'];
        if (/^resolve_active_node_for_signup/.test(name))
          return [
            'BENIGN · duplicate overload',
            'same function exists in the replay with the other lat/lng type',
          ];
        return ['RISK · missing function', 'a function staging has that a rebuilt DB lacks'];
      case 'INDEX':
        return ['BENIGN · performance only', 'indexes do not affect correctness'];
      case 'COLUMN':
        if (/^trade_events\.(event_type|actor_id)$/.test(name))
          return ['BENIGN · superseded shape', 'replay carries the newer event_name/user_id instead'];
        return ['RISK · missing column', 'code that SELECTs/INSERTs it breaks on a rebuilt DB'];
      case 'CONSTRAINT':
        return ['RISK · unenforced rule', 'FK/CHECK/UNIQUE absent on a rebuilt DB'];
      case 'TRIGGER':
        return ['RISK · missing behaviour', 'updated_at stamping / referral-code creation absent'];
      case 'POLICY':
        if (/_anon_(select|insert|update)$/.test(name))
          return [
            'SECURITY · staging-only permissive',
            'staging keeps permissive anon policies a rebuilt DB lacks',
          ];
        if (/^Service role bypass/.test(name))
          return ['BENIGN-LITE · service-role bypass', 'service_role already bypasses RLS'];
        return ['RISK · RLS drift', 'a rebuilt DB has different access than staging'];
      default:
        return ['UNCLASSIFIED', ''];
    }
  }

  if (section === 'CONFLICT') {
    switch (klass) {
      case 'FUNCTION':
        if (/search_path/.test(detail))
          return [
            'BENIGN · hardening',
            'replay pins search_path, staging does not (replay is stricter)',
          ];
        return ['RISK · behaviour drift', 'same signature, different body/security/settings'];
      case 'COLUMN':
        // Coarse — see KNOWN LIMITATION in the header comment.
        return ['RISK-LITE · nullability', 'one side permits NULL where the other does not'];
      case 'INDEX':
        if (/event_type|event_name/.test(detail))
          return ['RISK · shape drift', 'index built on the drifted event_type/event_name column'];
        return ['BENIGN · performance only', 'partial vs full index'];
      case 'CONSTRAINT':
        return ['RISK · rule drift', 'CHECK/FK differs between staging and the replay'];
      case 'POLICY':
        return ['RISK · RLS drift', 'same policy name, different predicate'];
      case 'ENUM':
        return ['BENIGN · ordinal only', 'same label set, different sort position'];
      case 'RLS':
        return ['RISK · RLS on/off', 'table has RLS enabled on one side only'];
      case 'VIEW':
        return ['RISK · view drift', 'view definition differs'];
      default:
        return ['UNCLASSIFIED', ''];
    }
  }

  return ['BENIGN · explained by design', 'replay-only object with a creator in the chain'];
}

const buckets = new Map();
for (const rec of records) {
  const [cat, why] = classify(rec);
  const key = `${rec.section} | ${rec.klass} | ${cat}`;
  if (!buckets.has(key)) buckets.set(key, { cat, why, count: 0, samples: [] });
  const b = buckets.get(key);
  b.count += 1;
  if (b.samples.length < 4) b.samples.push(rec.name);
}

const rows = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
let total = 0;
console.log('SECTION | CLASS | CATEGORY | COUNT');
for (const [key, b] of rows) {
  total += b.count;
  console.log(`${key} | ${b.count}`);
  console.log(`      why: ${b.why}`);
  console.log(`      e.g.: ${b.samples.join(' ~ ')}`);
}
console.log(`\nrecords classified: ${total} (file declares 119 + 114 = 233)`);

const roll = new Map();
for (const [, b] of rows) roll.set(b.cat, (roll.get(b.cat) || 0) + b.count);
console.log('\n--- ROLL-UP BY CATEGORY ---');
for (const [cat, n] of [...roll.entries()].sort((a, b) => b[1] - a[1])) console.log(`${n}\t${cat}`);

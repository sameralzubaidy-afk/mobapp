#!/usr/bin/env node
// Prints the next free rule id so nobody has to grep for it by hand.
// Usage: node scripts/agent-rules/next-id.mjs BP|R|S [--verbose]
//   BP  next Bug-Prevention rule id   (global namespace, includes retired/unassigned numbers)
//   R   next QA playbook rule id
//   S   next QA playbook section number (### 5.N)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const kind = (process.argv[2] || '').toUpperCase();
const verbose = process.argv.includes('--verbose');
if (!['BP', 'R', 'S'].includes(kind)) {
  console.error('Usage: node scripts/agent-rules/next-id.mjs BP|R|S [--verbose]');
  process.exit(2);
}

const walk = (dir) => fs.existsSync(path.join(ROOT, dir))
  ? fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.md') ? [`${dir}/${e.name}`] : []) : [];
const files = [...walk('.github'), ...walk('docs/agent-memory')];

const patterns = {
  BP: /\bBP-(\d+)\b/g,
  R: /(?<![A-Za-z-])R(\d{1,3})(?![\d-])/g,
  S: /^#{2,4} 5\.(\d+)[a-z]?\b/gm,
};
const scope = kind === 'BP' ? files : files.filter((f) => /QA|qa-/.test(f));
let max = 0, where = '';
for (const f of scope) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of text.matchAll(patterns[kind])) if (+m[1] > max) { max = +m[1]; where = f; }
}
const next = kind === 'S' ? `5.${max + 1}` : `${kind}-${max + 1}`;
console.log(next);
if (verbose) console.error(`highest seen: ${max} in ${where} (${scope.length} files scanned)`);

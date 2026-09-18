#!/usr/bin/env node
// Validates the agent rule library (.github/agents, .github/instructions, copilot-instructions.md).
// Usage: node scripts/agent-rules/check.mjs [--init] [--ratchet]
//   (default)  run all checks; exit 1 on any FAIL
//   --init     record current sizes / known issues as baselines (only fills missing entries)
//   --ratchet  lower size baselines to current size where a file has shrunk (never raises)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CFG_PATH = path.join(ROOT, 'scripts/agent-rules/budgets.json');
const args = new Set(process.argv.slice(2));
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
cfg.files ??= {};
cfg.knownDeadPaths ??= [];
cfg.knownUnresolvedSections ??= [];
cfg.datedBulletBaseline ??= {};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const listMd = (dir) => fs.existsSync(path.join(ROOT, dir))
  ? fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`) : [];

const agentFiles = listMd('.github/agents');
const instructionFiles = listMd('.github/instructions');
const ruleFiles = [...agentFiles, ...instructionFiles, '.github/copilot-instructions.md'];
const results = [];
const add = (level, msg) => results.push({ level, msg });
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// 1. Size budgets (ratchet: a file may never exceed its baseline)
for (const f of ruleFiles) {
  const size = fs.statSync(path.join(ROOT, f)).size;
  const entry = (cfg.files[f] ??= {});
  if (entry.baselineBytes === undefined && args.has('--init')) entry.baselineBytes = size;
  if (args.has('--ratchet') && entry.baselineBytes !== undefined && size < entry.baselineBytes) entry.baselineBytes = size;
  if (entry.baselineBytes === undefined) { add('WARN', `${f}: no baseline yet (run --init)`); continue; }
  const gap = entry.targetBytes ? ` | target ${kb(entry.targetBytes)}${size > entry.targetBytes ? ` (${kb(size - entry.targetBytes)} over)` : ' (met)'}` : '';
  if (size > entry.baselineBytes) add('FAIL', `${f}: ${kb(size)} exceeds baseline ${kb(entry.baselineBytes)}. Do not grow this file: merge/shorten/move a rule to make room.`);
  else add('PASS', `${f}: ${kb(size)} <= baseline ${kb(entry.baselineBytes)}${gap}`);
}

// 2. Dated changelog bullets inside .agent.md files (history belongs in docs/agent-memory)
for (const f of agentFiles) {
  const n = read(f).split('\n').filter((l) => /^- \*\*20\d\d-\d\d-\d\d/.test(l)).length;
  if (args.has('--init') && cfg.datedBulletBaseline[f] === undefined) cfg.datedBulletBaseline[f] = n;
  if (args.has('--ratchet') && cfg.datedBulletBaseline[f] !== undefined && n < cfg.datedBulletBaseline[f]) cfg.datedBulletBaseline[f] = n;
  const base = cfg.datedBulletBaseline[f] ?? 0;
  add(n > base ? 'FAIL' : n === 0 ? 'PASS' : 'WARN', `${f}: ${n} dated changelog bullet(s) (allowed <= ${base}; target 0)`);
}

// 3. Referenced repo paths exist
const ROOTS = 'docx|docs|Prompts|misc|cross-checked-and-consolidated|supabase|p2p-kids-marketplace|p2p-kids-admin|test-automation|scripts|e2e-test-results|\\.github';
const pathRe = new RegExp('`((?:' + ROOTS + ')/[A-Za-z0-9._ &()-]+(?:/[A-Za-z0-9._ &()-]+)*\\.(?:md|sql|ts|tsx|mjs|sh|json|js|yml))`', 'g');
const missing = new Map();
for (const f of ruleFiles) {
  for (const m of read(f).matchAll(pathRe)) {
    const p = m[1];
    if (/[*<>{}$]|\.\.\./.test(p)) continue;
    if (!fs.existsSync(path.join(ROOT, p)) && !(/^(scripts|src)\//.test(p) && fs.existsSync(path.join(ROOT, 'p2p-kids-marketplace', p)))) (missing.get(p) ?? missing.set(p, new Set()).get(p)).add(path.basename(f));
  }
}
if (args.has('--init')) cfg.knownDeadPaths = [...new Set([...cfg.knownDeadPaths, ...missing.keys()])].sort();
let newDead = 0;
for (const [p, fs_] of missing) {
  if (cfg.knownDeadPaths.includes(p)) add('WARN', `known dead path: ${p} (cited in ${[...fs_].join(', ')}) - fix or remove citation`);
  else { newDead++; add('FAIL', `dead path: ${p} (cited in ${[...fs_].join(', ')})`); }
}
for (const p of cfg.knownDeadPaths) if (!missing.has(p)) add('PASS', `previously dead path now resolved or uncited: ${p} (remove from knownDeadPaths)`);
if (!missing.size) add('PASS', 'all cited repo paths exist');

// 4. BP ids: each id has at most one full-text body definition
const bodyDefs = new Map();
for (const f of ruleFiles) {
  for (const m of read(f).matchAll(/^#{2,4} BP-(\d+)\b/gm)) (bodyDefs.get(+m[1]) ?? bodyDefs.set(+m[1], []).get(+m[1])).push(path.basename(f));
}
const dups = [...bodyDefs].filter(([, v]) => v.length > 1);
for (const [id, v] of dups) add('FAIL', `BP-${id} has ${v.length} body definitions (${v.join(', ')})`);
if (!dups.length) add('PASS', `BP ids: ${bodyDefs.size} full-text rules, no duplicate definitions`);

// 5. §5.x citations resolve to a heading (capture trailing letter: 5.47b is not 5.47)
const playbook = read('.github/instructions/QA-Test-Agent.instructions.md');
const headings = new Set([...playbook.matchAll(/^#{2,4} (5\.\d+[a-z]?)\b/gm)].map((m) => m[1]));
const cited = new Map();
for (const f of ruleFiles) {
  for (const m of read(f).matchAll(/§(5\.\d+[a-z]?)(?![a-z0-9])/g)) (cited.get(m[1]) ?? cited.set(m[1], new Set()).get(m[1])).add(path.basename(f));
}
const unresolved = [...cited.keys()].filter((s) => !headings.has(s)).sort();
if (args.has('--init')) cfg.knownUnresolvedSections = [...new Set([...cfg.knownUnresolvedSections, ...unresolved])].sort();
for (const s of unresolved) {
  add(cfg.knownUnresolvedSections.includes(s) ? 'WARN' : 'FAIL', `§${s} is cited (${[...cited.get(s)].join(', ')}) but no "### ${s}" heading exists${cfg.knownUnresolvedSections.includes(s) ? ' (known)' : ''}`);
}
if (!unresolved.length) add('PASS', `all §5.x citations resolve (${headings.size} sections)`);

// 6. Emphasis inflation (info only)
for (const f of [...agentFiles, ...instructionFiles]) {
  const t = read(f);
  add('INFO', `${path.basename(f)}: MANDATORY x${(t.match(/MANDATORY/g) || []).length}, MUST x${(t.match(/\bMUST\b/g) || []).length}`);
}

if (args.has('--init') || args.has('--ratchet')) fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2) + '\n');
const order = { FAIL: 0, WARN: 1, PASS: 2, INFO: 3 };
results.sort((a, b) => order[a.level] - order[b.level]);
for (const r of results) console.log(`[${r.level}] ${r.msg}`);
const fails = results.filter((r) => r.level === 'FAIL').length;
console.log(`\n${fails ? 'FAILED' : 'OK'}: ${fails} fail, ${results.filter((r) => r.level === 'WARN').length} warn`);
process.exit(fails ? 1 : 0);

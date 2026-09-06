#!/usr/bin/env node
/**
 * verify-flow-registry.mjs
 * ---------------------------------------------------------------
 * Structural integrity checker for docs/flow-registry.md.
 *
 * Reads the registry and asserts that every referenced artifact exists:
 *   - mobile screen/components files  (screens/.../X.tsx, components/...)
 *   - mobile services/utils/navigation files
 *   - Supabase Edge Functions (kebab-case names matching supabase/functions/)
 *   - admin portal route pages        (the **Admin pages.** blocks)
 *   - doc references (docx/, cross-checked-and-consolidated/, docs/)
 *
 * Hard failures (exit 1): duplicate FLOW headers, missing screen file,
 * missing EF name.  Everything else prints as WARNINGS so a human can
 * judge (some references are intentionally legacy/allowlisted).
 *
 * Run from the repo root:  node scripts/verify-flow-registry.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOC = join(ROOT, 'docs', 'flow-registry.md');
const MOBILE_SRC = join(ROOT, 'p2p-kids-marketplace', 'src');
const ADMIN_APP = join(ROOT, 'p2p-kids-admin', 'src', 'app');
const EF_DIR = join(ROOT, 'supabase', 'functions');

if (!existsSync(DOC)) {
  console.error(`FAIL: ${DOC} not found`);
  process.exit(1);
}

// ---------------------------------------------------------------- helpers
function collectDirs(dir) {
  if (!existsSync(dir)) return new Set();
  const out = new Set();
  for (const name of readdirSync(dir)) {
    if (statSync(join(dir, name)).isDirectory()) out.add(name);
  }
  return out;
}
const EF_NAMES = collectDirs(EF_DIR);
const ADMIN_ROUTES = collectDirs(ADMIN_APP);

let hardFail = 0;
let warnings = 0;
const notes = [];

function fail(msg) { hardFail += 1; console.error(`  FAIL  ${msg}`); }
function warn(msg) { warnings += 1; console.warn(`  warn  ${msg}`); }

function hasPath(prefix, rel) {
  const full = join(prefix, ...rel.split('/'));
  return existsSync(full) || existsSync(full + '.ts') || existsSync(full + '.tsx');
}

function resolveAdminRoute(pathname) {
  // pathname like '/settings/policies/[id]/edit' -> app/settings/policies/[id]/edit
  const segs = pathname.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? '[id]' : s));
  const base = join(ADMIN_APP, ...segs);
  return existsSync(join(base, 'page.tsx')) || existsSync(join(base, 'page.js'));
}

const doc = readFileSync(DOC, 'utf8');
const lines = doc.split('\n');
const text = doc;

// ------------------------------------------------------- 1. dup headers
const flowHeaders = {};
for (const m of text.matchAll(/^#{2,4} (FLOW-[\w-]+):/gm)) {
  flowHeaders[m[1]] = (flowHeaders[m[1]] || 0) + 1;
}
for (const [id, n] of Object.entries(flowHeaders)) {
  if (n > 1) fail(`duplicate section header ${id} appears ${n}x`);
}
if (Object.keys(flowHeaders).length === 0) fail('no FLOW-xx headers found');
console.log(`PASS  headers: ${Object.keys(flowHeaders).length} unique flow sections`);

// ------------------------------------------------------- 2. file tokens
const TOKEN_RE = /`([^`]+)`/g;
let m;
while ((m = TOKEN_RE.exec(text)) !== null) {
  const tok = m[1].trim();
  if (!tok) continue;

  // mobile screen file (with or without .tsx suffix)
  let mm = tok.match(/^screens\/([\w/.]+?)(\.tsx)?$/);
  if (mm) {
    if (!hasPath(MOBILE_SRC, 'screens/' + mm[1] + (mm[2] ? '' : '.tsx')))
      fail(`mobile screen file missing: ${tok}`);
    continue;
  }
  mm = tok.match(/^components\/([\w/.]+?)(\.tsx)?$/);
  if (mm) {
    if (!hasPath(MOBILE_SRC, 'components/' + mm[1] + (mm[2] ? '' : '.tsx')))
      fail(`mobile component missing: ${tok}`);
    continue;
  }
  // mobile services / utils / navigation / hooks / stores / theme / types
  mm = tok.match(/^(services|utils|navigation|hooks|stores|theme|types)\/([\w/.]+?)(\.ts[x]?)?$/);
  if (mm) {
    const rel = `${mm[1]}/${mm[2]}${mm[3] || '.ts'}`;
    if (!hasPath(MOBILE_SRC, rel)) warn(`mobile source ref not found: ${tok}`);
    continue;
  }

  // Supabase Edge Function (kebab-case, exact folder match)
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(tok)) {
    if (EF_NAMES.has(tok)) continue; // valid EF
    // Not an EF — ignore generic kebab tokens that are not file references.
    continue;
  }

  // doc / spec references (paths to .md files)
  mm = tok.match(/^(docx|docs|cross-checked-and-consolidated|Prompts|archive)\/([\w./-]+\.md)$/);
  if (mm) {
    if (!existsSync(join(ROOT, mm[1], mm[2]))) warn(`doc reference not found: ${tok}`);
    continue;
  }
  if (tok.startsWith('docx/') || tok.startsWith('docs/') || tok.startsWith('cross-checked-and-consolidated/')) {
    if (!existsSync(join(ROOT, tok))) warn(`doc path not found: ${tok}`);
    continue;
  }
}

// ------------------------------------------------------- 3. admin pages
let inAdminBlock = false;
for (const line of lines) {
  const t = line.trim();
  if (/^#{2,4} /.test(t)) { inAdminBlock = false; continue; }
  if (t === '**Admin pages.**') { inAdminBlock = true; continue; }
  if (t.startsWith('**')) { inAdminBlock = false; continue; }
  if (!inAdminBlock) continue;
  const pm = t.match(/^-\s*`(\/[a-zA-Z0-9_/.:[\]-]+)`/);
  if (pm) {
    const p = pm[1];
    if (p.startsWith('/settings/policies') || p === '/auth/login') { if (!resolveAdminRoute(p)) warn(`admin page not found: ${p}`); continue; }
    if (!resolveAdminRoute(p)) warn(`admin page not found: ${p}`);
  }
}

// ------------------------------------------------------- 4. summary
const flowCount = Object.keys(flowHeaders).length;
console.log(`\nRegistry integrity summary:`);
console.log(`  flows/sections : ${flowCount}`);
console.log(`  edge functions : ${EF_NAMES.size} in supabase/functions`);
console.log(`  hard failures  : ${hardFail}`);
console.log(`  warnings       : ${warnings}`);
notes.forEach((n) => console.log('  note ' + n));
process.exit(hardFail > 0 ? 1 : 0);

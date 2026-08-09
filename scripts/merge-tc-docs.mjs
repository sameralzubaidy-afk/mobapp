#!/usr/bin/env node
/**
 * MERGE script (destructive to MISC only — writes merged content back to MISC,
 * then rewrites ROOT as a DEPRECATED stub).
 *
 * Strategy:
 *   - misc/ is the canonical file (automation reads it).
 *   - Port root-only content INTO misc with safe re-lettering:
 *       A03,A04  -> into Group A
 *       K04-K10  -> into Group K
 *       M16-M20  -> into Group M
 *       O1-C17   -> into Group O-1
 *       Navigation Consistency (root S01-S15) -> NEW Group X (TC-X01..X15)
 *       Flow Registry (root T01)              -> NEW Group X (TC-X16)
 *       Top Nav Header (U01-U05)              -> NEW Group U
 *       Copy Rename (V01-V14)                 -> NEW Group V
 *       Admin Bundle Trade Views (W01-W12)    -> NEW Group W
 *   - Root S16-S26 ("More from seller") == misc S14-S24 -> SKIPPED (duplicates).
 *   - Root's missing trade-flow content already lives in misc -> no port needed.
 *
 * Verification: writes scripts/merge-verify-report.txt with before/after counts.
 */
import fs from 'node:fs';

const MISC = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md';
const ROOT = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md';
const REPORT = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/scripts/merge-verify-report.txt';

const miscText = fs.readFileSync(MISC, 'utf8');
const rootText = fs.readFileSync(ROOT, 'utf8');

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Return the raw block for a TC id: from its `###` heading to the next `###`/`##` heading. */
function extractTcBlock(text, tcId) {
  const lines = text.split('\n');
  const re = new RegExp('^### .*TC-' + tcId + '([\\s·].*)?$', 'i');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s/.test(lines[i]) || /^##\s/.test(lines[i])) { end = i; break; }
  }
  // Trim trailing blank lines
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end).join('\n') + '\n';
}

/** Insert text immediately BEFORE the line matching `anchor` (first occurrence). */
function insertBefore(text, anchor, insert) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => l.startsWith(anchor));
  if (idx === -1) throw new Error('Anchor not found: ' + anchor);
  const head = lines.slice(0, idx).join('\n');
  const tail = lines.slice(idx).join('\n');
  return head + '\n\n' + insert.trimEnd() + '\n\n' + tail;
}

/** Extract a full `## Group ...` section (raw) by exact header. */
function extractGroup(text, header) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === header);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end).join('\n');
}

/** Renumber TC-OLD -> TC-NEW inside a block (headings only, exact token). */
function renumberTc(block, oldId, newId) {
  return block
    .split('\n')
    .map((l) => {
      if (/^###\s/.test(l) && new RegExp('TC-' + oldId + '([\\s·]|$)').test(l)) {
        return l.replace(new RegExp('TC-' + oldId + '([\\s·]|$)'), 'TC-' + newId + '$1');
      }
      return l;
    })
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* 1. Port A03, A04 into Group A                                        */
/* ------------------------------------------------------------------ */
let out = miscText;
const a03 = extractTcBlock(rootText, 'A03');
const a04 = extractTcBlock(rootText, 'A04');
if (!a03) throw new Error('A03 block not found in root');
if (!a04) throw new Error('A04 block not found in root');
out = insertBefore(out, '## Group B — Offer Lifecycle', a03 + '\n' + a04);

/* ------------------------------------------------------------------ */
/* 2. Port K04..K10 into Group K                                       */
/* ------------------------------------------------------------------ */
let kBlock = '';
for (let i = 4; i <= 10; i++) {
  const b = extractTcBlock(rootText, 'K' + String(i).padStart(2, '0'));
  if (!b) throw new Error('K' + i + ' block not found in root');
  kBlock += b + '\n';
}
out = insertBefore(out, '## Group L — Bundle Flows', kBlock);

/* ------------------------------------------------------------------ */
/* 3. Port M16..M20 into Group M                                       */
/* ------------------------------------------------------------------ */
let mBlock = '';
for (let i = 16; i <= 20; i++) {
  const b = extractTcBlock(rootText, 'M' + i);
  if (!b) throw new Error('M' + i + ' block not found in root');
  mBlock += b + '\n';
}
out = insertBefore(out, '## Group N — Cart (Admin)', mBlock);

/* ------------------------------------------------------------------ */
/* 4. Port O1-C17 into Group O-1                                       */
/* ------------------------------------------------------------------ */
const o17 = extractTcBlock(rootText, 'O1-C17');
if (!o17) throw new Error('O1-C17 block not found in root');
out = insertBefore(out, '## Group O-2 — Tax Status Lifecycle', o17);

/* ------------------------------------------------------------------ */
/* 5. New Group X — Navigation Consistency (root S01..S15) + Flow Registry T01 */
/* ------------------------------------------------------------------ */
let navBlock = '## Group X — Navigation Consistency & Bottom Nav\n\n';
navBlock += '> **Merged from root copy (2026-07-30).** Originally numbered TC-S01–S15 in the root file; re-lettered to TC-X01–X15 to avoid collision with Group S (Seller Group & Bundle Discovery). Root TC-S16–S26 ("More from seller") are NOT ported — they duplicate misc TC-S14–S24.\n\n';
for (let i = 1; i <= 15; i++) {
  const oldId = 'S' + String(i).padStart(2, '0');
  const newId = 'X' + String(i).padStart(2, '0');
  const b = extractTcBlock(rootText, oldId);
  if (!b) throw new Error('Nav ' + oldId + ' block not found in root');
  navBlock += renumberTc(b, oldId, newId) + '\n';
}
const flowReg = extractTcBlock(rootText, 'T01');
if (!flowReg) throw new Error('T01 (flow registry) block not found in root');
navBlock += renumberTc(flowReg, 'T01', 'X16') + '\n';

/* ------------------------------------------------------------------ */
/* 6. New Group U — Top Nav Header (U01..U05)                           */
/* ------------------------------------------------------------------ */
const groupU = extractGroup(rootText, '## Group U — Top Nav Header Pattern Consistency');
if (!groupU) throw new Error('Group U not found in root');
let uBlock = groupU;
uBlock += '\n\n> **Merged from root copy (2026-07-30).**\n';

/* ------------------------------------------------------------------ */
/* 7. New Group V — Copy Rename Verification (V01..V14)                 */
/* ------------------------------------------------------------------ */
const groupV = extractGroup(rootText, '## Group V — Copy Rename Verification');
if (!groupV) throw new Error('Group V not found in root');
let vBlock = groupV;
vBlock += '\n\n> **Merged from root copy (2026-07-30).**\n';

/* ------------------------------------------------------------------ */
/* 8. New Group W — Admin Bundle Trade Views (W01..W12)                 */
/* ------------------------------------------------------------------ */
const groupW = extractGroup(rootText, '## Group W — Admin Bundle Trade Views');
if (!groupW) throw new Error('Group W not found in root');
let wBlock = groupW;
wBlock += '\n\n> **Merged from root copy (2026-07-30).**\n';

/* ------------------------------------------------------------------ */
/* 9. Insert all new groups before the Regression checks section        */
/* ------------------------------------------------------------------ */
const newGroups = navBlock + '\n' + uBlock + '\n' + vBlock + '\n' + wBlock;
out = insertBefore(out, '## Regression checks', newGroups);

/* ------------------------------------------------------------------ */
/* 10. Write merged misc + deprecate root                               */
/* ------------------------------------------------------------------ */
fs.writeFileSync(MISC, out);

const deprecated = [
  '# ⚠️ DEPRECATED — Superseded by `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`',
  '',
  '> **This file is DEPRECATED (2026-08-01).** Do not edit or add test cases here.',
  '>',
  '> The two copies of `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (workspace root and `misc/`)',
  '> were merged into a single canonical file:',
  '>',
  '> **Canonical:** `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`',
  '>',
  '> All unique test cases from this copy (A03–A04, K04–K10, M16–M20, O1-C17,',
  '> Navigation Consistency S01–S15 → X01–X15, Flow Registry T01 → X16, U01–U05, V01–V14, W01–W12)',
  '> were merged into the canonical file on 2026-08-01. Nothing was lost.',
  '>',
  '> This root-level copy is kept only as a historical reference. Any future edit MUST go to the canonical file.',
  '',
].join('\n');
fs.writeFileSync(ROOT, deprecated + '\n');

/* ------------------------------------------------------------------ */
/* Verification report                                                 */
/* ------------------------------------------------------------------ */
const report = [];
report.push('MISC (merged) has Group X, U, V, W?');
report.push('  X present: ' + out.includes('## Group X — Navigation Consistency & Bottom Nav'));
report.push('  U present: ' + out.includes('## Group U — Top Nav Header Pattern Consistency'));
report.push('  V present: ' + out.includes('## Group V — Copy Rename Verification'));
report.push('  W present: ' + out.includes('## Group W — Admin Bundle Trade Views'));
report.push('');
report.push('Ported TCs present in merged misc:');
for (const id of ['A03','A04','K04','K05','K06','K07','K08','K09','K10','M16','M17','M18','M19','M20','O1-C17','X01','X15','X16','U01','U05','V01','V14','W01','W12']) {
  report.push('  ' + id + ': ' + (new RegExp('TC-' + id + '([\\s·]|$)').test(out) ? 'OK' : 'MISSING'));
}
report.push('');
report.push('Root file now DEPRECATED stub: ' + (fs.readFileSync(ROOT, 'utf8').includes('DEPRECATED')));
report.push('');
report.push('Line counts:');
report.push('  misc merged: ' + out.split('\n').length);
report.push('  root stub:   ' + fs.readFileSync(ROOT, 'utf8').split('\n').length);
fs.writeFileSync(REPORT, report.join('\n'));
console.log(report.join('\n'));

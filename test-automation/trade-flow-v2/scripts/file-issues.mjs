#!/usr/bin/env node
/**
 * file-issues.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Parse results.json and file GitHub Issues for every failed execution unit.
 *
 * Features:
 *   - Deduplication: checks for an existing OPEN issue with the same title
 *     before creating; never creates duplicates across runs
 *   - Label management: auto-creates the 'e2e-failure' label if it does not exist
 *   - Writes issues-filed.md into the same out-dir so QA can see all links
 *
 * Usage:
 *   node file-issues.mjs <out-dir>
 *
 * Requirements:
 *   - gh CLI installed and authenticated  →  gh auth status
 *   - OR GH_TOKEN env var set             →  export GH_TOKEN=ghp_...
 *
 * Target repo: sameralzubaidy-afk/mobapp  (all test failures go here)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const REPO   = 'sameralzubaidy-afk/mobapp';
const LABEL  = 'e2e-failure';
const outDir = process.argv[2];

// ── helpers ──────────────────────────────────────────────────────────────────
function gh(...args) {
  return execSync(`gh ${args.join(' ')}`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
}
function ghSafe(...args) {
  try { return { ok: true, out: gh(...args) }; }
  catch (e) { return { ok: false, out: e.message }; }
}
const dim  = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const red  = (s) => `\x1b[31m${s}\x1b[0m`;
const grn  = (s) => `\x1b[32m${s}\x1b[0m`;
const log  = (...a) => console.log(cyan(`[file-issues]`), ...a);
const warn = (...a) => console.warn(`\x1b[33m[file-issues WARN]\x1b[0m`, ...a);

// ── validate environment ──────────────────────────────────────────────────────
if (!outDir) {
  console.error('Usage: node file-issues.mjs <out-dir>');
  process.exit(1);
}

const resultsPath = join(outDir, 'results.json');
let results;
try {
  results = JSON.parse(readFileSync(resultsPath, 'utf8'));
} catch {
  console.error(`Cannot read ${resultsPath}`);
  process.exit(1);
}

// Check gh CLI availability
const ghCheck = ghSafe('--version');
if (!ghCheck.ok) {
  warn('gh CLI not found or not authenticated. Skipping GitHub Issue filing.');
  warn('Install: https://cli.github.com/  then run: gh auth login');
  process.exit(0);
}
const authCheck = ghSafe('auth', 'status');
if (!authCheck.ok) {
  warn('gh CLI is not authenticated. Run: gh auth login  (or set GH_TOKEN)');
  process.exit(0);
}

// ── ensure label exists ───────────────────────────────────────────────────────
const labelCheck = ghSafe('label', 'list', '--repo', REPO, '--search', LABEL, '--json', 'name');
if (labelCheck.ok) {
  const labels = JSON.parse(labelCheck.out || '[]');
  if (!labels.some((l) => l.name === LABEL)) {
    log(`Creating label '${LABEL}' in ${REPO}...`);
    ghSafe('label', 'create', LABEL, '--repo', REPO, '--color', 'D73A4A', '--description', 'Automated E2E test failure');
  }
}

// ── collect failures ──────────────────────────────────────────────────────────
const failures = results.units.filter((u) => !u.passed);
log(`Found ${failures.length} failed unit(s) out of ${results.units.length} executed.`);

if (failures.length === 0) {
  log(grn('No failures — no issues to file.'));
  writeFileSync(join(outDir, 'issues-filed.md'), `# GitHub Issues Filed\n\nNo failures detected in this run. ✅\n`);
  process.exit(0);
}

// ── per-failure: deduplicate + create issue ───────────────────────────────────
const issueLines = [
  `# GitHub Issues Filed`,
  ``,
  `**Run:** ${results.generatedAt}`,
  `**Module:** ${results.module}`,
  ``,
  `| Case(s) | Runner | Status | GitHub Issue |`,
  `|---|---|---|---|`,
];

let filed = 0;
let skipped = 0;

for (const unit of failures) {
  const caseList = unit.cases.join(', ');
  const platform = unit.platform ? `/${unit.platform}` : '';
  const title = `[E2E Failure] ${caseList} — ${unit.runner}${platform} (${results.generatedAt.split('T')[0]})`;

  // Check for existing open issue with same title (deduplication)
  const searchResult = ghSafe(
    'issue', 'list',
    '--repo', REPO,
    '--state', 'open',
    '--label', LABEL,
    '--search', JSON.stringify(caseList),
    '--json', 'number,title,url'
  );

  let existingIssue = null;
  if (searchResult.ok) {
    const existing = JSON.parse(searchResult.out || '[]');
    // Match on case IDs in the title to handle date-stamped variations
    existingIssue = existing.find((i) => unit.cases.some((c) => i.title.includes(c)));
  }

  if (existingIssue) {
    log(dim(`  SKIP (duplicate) #${existingIssue.number}: ${existingIssue.title}`));
    issueLines.push(`| ${caseList} | ${unit.runner}${platform} | ⏭ Existing #${existingIssue.number} | [#${existingIssue.number}](${existingIssue.url}) |`);
    skipped++;
    continue;
  }

  // Build issue body
  const body = [
    `## Automated E2E Test Failure`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Cases** | ${caseList} |`,
    `| **Runner** | ${unit.runner}${platform} |`,
    `| **Asset** | \`${unit.asset}\` |`,
    `| **Platform** | ${unit.platform || 'web (Playwright)'} |`,
    `| **Timed out** | ${unit.timedOut} |`,
    `| **Duration** | ${(unit.durationMs / 1000).toFixed(1)}s |`,
    `| **Run timestamp** | ${results.generatedAt} |`,
    ``,
    `## Command`,
    ``,
    `\`\`\``,
    unit.command,
    `\`\`\``,
    ``,
    `## Failure Output (last 20 lines)`,
    ``,
    `\`\`\``,
    (unit.stderrTail || '(no stderr captured — check stdout in the run report)').trim(),
    `\`\`\``,
    ``,
    `## Report`,
    ``,
    `Results archived in the repository at:`,
    `\`e2e-test-results/${outDir.split('/e2e-test-results/')[1] || 'latest'}/\``,
    ``,
    `---`,
    `*Filed automatically by the TradeFlowV2 test orchestrator.*`,
    `*To reproduce: see [RUNBOOK.md](https://github.com/${REPO}/blob/main/test-automation/trade-flow-v2/RUNBOOK.md)*`,
  ].join('\n');

  log(`  Filing issue: ${title}`);
  const createResult = ghSafe(
    'issue', 'create',
    '--repo', REPO,
    '--title', JSON.stringify(title),
    '--body', JSON.stringify(body),
    '--label', LABEL
  );

  if (createResult.ok) {
    const issueUrl = createResult.out.trim();
    const issueNum = issueUrl.split('/').pop();
    log(grn(`  Filed #${issueNum}: ${issueUrl}`));
    issueLines.push(`| ${caseList} | ${unit.runner}${platform} | ❌ New | [#${issueNum}](${issueUrl}) |`);
    filed++;
  } else {
    warn(`  Failed to file issue for ${caseList}: ${createResult.out}`);
    issueLines.push(`| ${caseList} | ${unit.runner}${platform} | ⚠ Filing failed | — |`);
  }
}

issueLines.push(``);
issueLines.push(`---`);
issueLines.push(`**Filed:** ${filed} new | **Deduplicated (skipped):** ${skipped}`);

writeFileSync(join(outDir, 'issues-filed.md'), issueLines.join('\n'));
log(`issues-filed.md written to ${outDir}`);
log(`Done: ${filed} issued filed, ${skipped} deduplicated.`);

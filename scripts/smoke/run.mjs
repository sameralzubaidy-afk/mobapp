#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const smokeDir = path.join(root, 'scripts', 'smoke');

function usage() {
  console.log('Usage: node scripts/smoke/run.mjs --all | --flows <comma-separated>');
  console.log('Examples:');
  console.log('  node scripts/smoke/run.mjs --flows transactions');
  console.log('  node scripts/smoke/run.mjs --all');
}

function runScript(scriptName) {
  const scriptPath = path.join(smokeDir, `${scriptName}.mjs`);
  if (!existsSync(scriptPath)) {
    console.error(`[SMOKE] Missing script: ${scriptPath}`);
    process.exitCode = 1;
    return;
  }

  const res = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
  if (res.status !== 0) {
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
  process.exit(1);
}

if (args.includes('--all')) {
  // Minimal default set; expand as automation is added.
  runScript('transactions');
  runScript('payouts');
  process.exit(process.exitCode ?? 0);
}

const flowsIndex = args.indexOf('--flows');
if (flowsIndex === -1 || !args[flowsIndex + 1]) {
  usage();
  process.exit(1);
}

const flows = args[flowsIndex + 1]
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (flows.length === 0) {
  usage();
  process.exit(1);
}

for (const flow of flows) {
  runScript(flow);
}

process.exit(process.exitCode ?? 0);

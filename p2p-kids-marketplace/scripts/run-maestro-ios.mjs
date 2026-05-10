#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const args = process.argv.slice(2);

const resolveFlowArg = (arg) => {
  const direct = resolve(cwd, arg);
  if (existsSync(direct)) {
    return arg;
  }

  if (arg.startsWith('.maestro/')) {
    const fromWorkspaceRoot = resolve(cwd, '..', arg);
    if (existsSync(fromWorkspaceRoot)) {
      return `../${arg}`;
    }
  }

  const fromWorkspaceRootByName = resolve(cwd, '..', '.maestro', basename(arg));
  if (existsSync(fromWorkspaceRootByName)) {
    return `../.maestro/${basename(arg)}`;
  }

  return arg;
};

const flowArgs = args.map(resolveFlowArg);

const commandArgs = ['test', '--platform', 'ios'];
if (flowArgs.length > 0) {
  commandArgs.push(...flowArgs);
} else if (existsSync(resolve(cwd, '.maestro'))) {
  commandArgs.push('.maestro/');
} else if (existsSync(resolve(cwd, '..', '.maestro'))) {
  commandArgs.push('../.maestro/');
}

const result = spawnSync('maestro', commandArgs, {
  stdio: 'inherit',
  cwd,
  env: {
    ...process.env,
    APP_ID: process.env.APP_ID || 'host.exp.Exponent',
  },
});

if (result.error) {
  console.error('[run-maestro-ios] Failed to start maestro:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

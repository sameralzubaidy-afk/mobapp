#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const args = process.argv.slice(2);

const resolveFlowArg = (arg) => {
  const direct = resolve(cwd, arg);
  if (existsSync(direct)) {
    return arg;
  }

  const fromLocalMaestroByName = resolve(cwd, '.maestro', basename(arg));
  if (existsSync(fromLocalMaestroByName)) {
    return `.maestro/${basename(arg)}`;
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

const driverCacheDir = resolve(cwd, '.maestro-driver-cache');
const driverAppApk = resolve(driverCacheDir, 'maestro-app.apk');
const driverServerApk = resolve(driverCacheDir, 'maestro-server.apk');
const maestroClientJar = resolve(process.env.HOME || '', '.maestro/lib/maestro-client.jar');

const commandArgs = ['test', '--platform', 'android', '--reinstall-driver'];
if (flowArgs.length > 0) {
  commandArgs.push(...flowArgs);
} else if (existsSync(resolve(cwd, '.maestro'))) {
  commandArgs.push('.maestro/');
} else if (existsSync(resolve(cwd, '..', '.maestro'))) {
  commandArgs.push('../.maestro/');
}

const maxAttempts = Number(process.env.MAESTRO_ANDROID_RETRIES || '3');

const runAdb = (args) => {
  spawnSync('adb', args, { stdio: 'ignore', cwd });
};

const runAdbWithOutput = (args) =>
  spawnSync('adb', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const ensureDriverApks = () => {
  if (existsSync(driverAppApk) && existsSync(driverServerApk)) {
    return true;
  }

  if (!existsSync(maestroClientJar)) {
    console.warn('[run-maestro-android] Missing Maestro client jar, skipping manual driver extraction.');
    return false;
  }

  mkdirSync(driverCacheDir, { recursive: true });
  const extract = spawnSync('jar', ['xf', maestroClientJar, 'maestro-app.apk', 'maestro-server.apk'], {
    cwd: driverCacheDir,
    stdio: 'ignore',
  });

  if (extract.status !== 0) {
    console.warn('[run-maestro-android] Failed to extract driver APKs from Maestro client jar.');
    return false;
  }

  return existsSync(driverAppApk) && existsSync(driverServerApk);
};

const ensureDriverInstalled = () => {
  const packages = runAdbWithOutput(['shell', 'pm', 'list', 'packages']);
  const output = `${packages.stdout || ''}\n${packages.stderr || ''}`;
  const hasDriverApp = output.includes('package:dev.mobile.maestro');
  const hasDriverTest = output.includes('package:dev.mobile.maestro.test');

  if (hasDriverApp && hasDriverTest) {
    return true;
  }

  if (!ensureDriverApks()) {
    return false;
  }

  const installApp = runAdbWithOutput(['install', '-r', '-t', driverAppApk]);
  const installServer = runAdbWithOutput(['install', '-r', '-t', driverServerApk]);

  if (installApp.status !== 0 || installServer.status !== 0) {
    console.warn('[run-maestro-android] Manual driver install failed.');
    return false;
  }

  return true;
};

const bootstrapDriverService = () => {
  // Bootstraps the gRPC service that listens on tcp:7001 on flaky Android emulator images.
  spawnSync(
    'sh',
    [
      '-c',
      'adb shell am instrument -w -e class dev.mobile.maestro.MaestroDriverService dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner >/dev/null 2>&1 &',
    ],
    { cwd, stdio: 'ignore' },
  );
};

let lastStatus = 1;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  if (attempt > 1) {
    console.log(`[run-maestro-android] Retry attempt ${attempt}/${maxAttempts}...`);
  }

  // Ensure Expo dev server ports are reachable from Android emulator.
  runAdb(['start-server']);
  runAdb(['reverse', 'tcp:8081', 'tcp:8081']);
  // NOTE: YAML bootstraps call stopApp themselves when a clean start is needed.
  // We intentionally do NOT force-stop here so that flows like FLOW-06 can
  // reuse the already-loaded Metro bundle from a prior flow and avoid the
  // multi-minute cold-rebundle that produces a blank white screen.
  runAdb(['reverse', 'tcp:19000', 'tcp:19000']);
  runAdb(['reverse', 'tcp:19001', 'tcp:19001']);

  if (!ensureDriverInstalled()) {
    console.warn('[run-maestro-android] Continuing without confirmed driver install.');
  }
  bootstrapDriverService();
  // Give the gRPC driver service time to bind port 7001 before Maestro connects.
  spawnSync('sleep', ['5'], { cwd, stdio: 'ignore' });

  const result = spawnSync('maestro', commandArgs, {
    stdio: 'inherit',
    cwd,
    env: {
      ...process.env,
      APP_ID: process.env.APP_ID || 'host.exp.exponent',
    },
  });

  if (result.error) {
    console.error('[run-maestro-android] Failed to start maestro:', result.error.message);
    lastStatus = 1;
    continue;
  }

  lastStatus = result.status ?? 1;
  if (lastStatus === 0) {
    process.exit(0);
  }
}

process.exit(lastStatus);

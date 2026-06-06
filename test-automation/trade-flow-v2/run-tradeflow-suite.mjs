#!/usr/bin/env node
/**
 * ============================================================================
 *  TradeFlowV2 Automated Test Orchestrator
 *  File: test-automation/trade-flow-v2/run-tradeflow-suite.mjs
 * ----------------------------------------------------------------------------
 *  Self-contained runner that executes every test case in
 *  `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` by reading `manifest.json`
 *  and dispatching each case to the correct engine:
 *
 *    - MOBILE cases  -> Maestro on the iOS Simulator AND the Android Emulator
 *    - ADMIN  cases  -> Playwright against the admin portal (localhost:3001)
 *
 *  Designed to be driven by an AI agent or CI: deterministic ordering, a
 *  preflight environment gate, structured JSON + human-readable Markdown
 *  reports, per-unit timeouts/retries, clear PASS/FAIL/SKIP/ERROR markers,
 *  and meaningful process exit codes.
 *
 *  Goal: surface defects BEFORE manual QA starts.
 * ----------------------------------------------------------------------------
 *  QUICK START (run from anywhere):
 *    node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --list
 *    node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --dry-run
 *    node test-automation/trade-flow-v2/run-tradeflow-suite.mjs              # full run
 *    node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --group A,M --platform ios
 *    node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --runner playwright
 *    node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --case TC-A01,TC-M11
 *
 *  See --help for all flags. No external npm dependencies required.
 * ============================================================================
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = __dirname;
// Workspace root is two levels up: <root>/test-automation/trade-flow-v2/
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..', '..');

// ───────────────────────────── ANSI / logging ──────────────────────────────
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const red = (s) => c('31', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const blue = (s) => c('36', s);
const ts = () => new Date().toISOString();

function log(level, msg) {
  const tag =
    level === 'error' ? red('ERROR') :
    level === 'warn' ? yellow('WARN ') :
    level === 'ok' ? green('OK   ') :
    level === 'step' ? blue('STEP ') : dim('INFO ');
  process.stdout.write(`${dim(ts())} ${tag} ${msg}\n`);
}

// ───────────────────────────── CLI parsing ─────────────────────────────────
function parseArgs(argv) {
  const opts = {
    list: false,
    dryRun: false,
    help: false,
    noPreflight: false,
    bail: false,
    json: false,
    includePending: false,
    includeManual: false,
    platform: 'both', // ios | android | both
    runner: null, // maestro | playwright | null(=both)
    groups: null, // ['A','M']
    cases: null, // ['TC-A01']
    statuses: null, // ['automated','partial']
    retries: Number(process.env.TFV2_RETRIES ?? 1),
    timeoutMs: Number(process.env.TFV2_TIMEOUT_MS ?? 10 * 60 * 1000),
    outDir: null,
  };
  const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--list': opts.list = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '-h': case '--help': opts.help = true; break;
      case '--no-preflight': opts.noPreflight = true; break;
      case '--bail': opts.bail = true; break;
      case '--json': opts.json = true; break;
      case '--include-pending': opts.includePending = true; break;
      case '--include-manual': opts.includeManual = true; break;
      case '--platform': opts.platform = next(); break;
      case '--runner': opts.runner = next(); break;
      case '--group': case '--groups': opts.groups = list(next()); break;
      case '--case': case '--cases': opts.cases = list(next()).map((s) => s.toUpperCase()); break;
      case '--status': case '--statuses': opts.statuses = list(next()); break;
      case '--retries': opts.retries = Number(next()); break;
      case '--timeout': opts.timeoutMs = Number(next()); break;
      case '--out': opts.outDir = next(); break;
      default:
        if (a.startsWith('--')) { log('warn', `Unknown flag ignored: ${a}`); }
    }
  }
  return opts;
}

function printHelp() {
  process.stdout.write(`
${bold('TradeFlowV2 Automated Test Orchestrator')}

Usage: node test-automation/trade-flow-v2/run-tradeflow-suite.mjs [options]

Selection:
  --group <A,M,...>       Only run these manifest groups (A..R, REG).
  --case  <TC-A01,...>    Only run these case ids (comma separated).
  --runner <maestro|playwright>  Only run one engine.
  --platform <ios|android|both>  Maestro target(s). Default: both.
  --status <automated,partial,...>  Filter by automation status.
  --include-pending       Also attempt cases marked 'pending' (no asset yet -> will error).
  --include-manual        Also attempt cases marked 'manual' (best-effort, may be flaky).

Execution:
  --retries <n>           Retries per execution unit on failure. Default: 1.
  --timeout <ms>          Per-unit hard timeout. Default: 600000 (10m).
  --bail                  Stop on the first failing unit.
  --no-preflight          Skip environment checks (not recommended).

Output:
  --list                  Print the resolved case/unit plan and exit.
  --dry-run               Run preflight + print the exact commands, but execute nothing.
  --json                  Emit the machine-readable results JSON to stdout at the end.
  --out <dir>             Artifact/report directory. Default: ./reports/<timestamp>.

  -h, --help              Show this help.

Environment (optional, read from process env or a .env file alongside this script):
  APP_ID                  Mobile bundle id. Default from manifest (com.p2pkidsmarketplace).
  IOS_SIMULATOR_UDID      Target a specific booted iOS simulator.
  ANDROID_EMULATOR_SERIAL Target a specific adb device serial.
  PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD  Admin login for web cases.
  ADMIN_BASE_URL          Override admin portal URL (default http://localhost:3001).

Exit codes:
  0  all executed units passed (pending/manual skips do not fail the run)
  1  one or more executed units failed
  2  preflight failed / misconfiguration
`);
}

// ───────────────────────────── .env loader (no deps) ───────────────────────
function loadDotEnv() {
  const envPath = join(SCRIPT_DIR, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ───────────────────────────── helpers ─────────────────────────────────────
function loadManifest() {
  const p = join(SCRIPT_DIR, 'manifest.json');
  if (!existsSync(p)) {
    log('error', `manifest.json not found at ${p}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

function which(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim().split('\n')[0] : null;
}

function bootedIosSimulators() {
  const r = spawnSync('xcrun', ['simctl', 'list', 'devices', 'booted'], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  return (r.stdout || '')
    .split('\n')
    .filter((l) => l.includes('(Booted)'))
    .map((l) => l.trim());
}

function availableIosSimulators() {
  const r = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { encoding: 'utf8' });
  if (r.status !== 0) return [];

  try {
    const parsed = JSON.parse(r.stdout || '{}');
    const devicesByRuntime = parsed.devices || {};
    const allDevices = Object.values(devicesByRuntime).flat();
    return allDevices
      .filter((d) => d && d.udid && d.name && d.isAvailable !== false)
      .map((d) => ({ udid: d.udid, name: d.name, state: d.state || 'Shutdown' }));
  } catch {
    return [];
  }
}

function pickIosSimulator(candidates, preferredUdid) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  if (preferredUdid) {
    const exact = candidates.find((d) => d.udid === preferredUdid);
    if (exact) return exact;
  }

  const iphoneCandidates = candidates.filter((d) => /iPhone/i.test(d.name));
  if (iphoneCandidates.length > 0) return iphoneCandidates[0];

  return candidates[0];
}

function autoBootIosSimulator(preferredUdid) {
  const candidates = availableIosSimulators();
  const selected = pickIosSimulator(candidates, preferredUdid);
  if (!selected) {
    return { ok: false, reason: 'No available iOS simulator devices found in xcrun simctl list.' };
  }

  log('step', `No booted iOS simulator detected. Attempting to boot ${selected.name} (${selected.udid}).`);

  const bootResult = spawnSync('xcrun', ['simctl', 'boot', selected.udid], { encoding: 'utf8' });
  if (bootResult.status !== 0) {
    const stderr = (bootResult.stderr || '').trim();
    if (!/Unable to boot device in current state: Booted/i.test(stderr)) {
      return { ok: false, reason: `Failed to boot simulator ${selected.name} (${selected.udid}): ${stderr || 'unknown error'}` };
    }
  }

  // Ensure the Simulator UI is open for Maestro interactions.
  spawnSync('open', ['-a', 'Simulator'], { stdio: 'ignore' });

  const bootStatus = spawnSync('xcrun', ['simctl', 'bootstatus', selected.udid, '-b'], {
    encoding: 'utf8',
    timeout: 120000,
  });
  if (bootStatus.status !== 0) {
    const stderr = (bootStatus.stderr || '').trim();
    return { ok: false, reason: `Simulator boot did not become ready for ${selected.name} (${selected.udid}): ${stderr || 'unknown error'}` };
  }

  const booted = bootedIosSimulators();
  if (booted.length === 0) {
    return { ok: false, reason: 'Simulator boot command completed, but no booted device was detected.' };
  }

  if (!process.env.IOS_SIMULATOR_UDID) {
    process.env.IOS_SIMULATOR_UDID = selected.udid;
  }

  return { ok: true, selected };
}

function androidDevices() {
  const r = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  return (r.stdout || '')
    .split('\n')
    .slice(1)
    .filter((l) => /\sdevice$/.test(l))
    .map((l) => l.split('\t')[0].trim());
}

function httpReachable(url) {
  // Lightweight reachability check using curl (present on macOS/Linux CI).
  const r = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '3', url], { encoding: 'utf8' });
  if (r.status !== 0) return false;
  const code = Number((r.stdout || '0').trim());
  return code >= 200 && code < 500; // any HTTP response means the server is up
}

function runProcess(cmd, args, { cwd, env, timeoutMs }) {
  return new Promise((resolveP) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; process.stdout.write(dim(s)); });
    child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; process.stderr.write(dim(s)); });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolveP({ ok: false, code: -1, durationMs: Date.now() - started, stdout, stderr: stderr + `\nspawn error: ${err.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveP({ ok: code === 0 && !timedOut, code, durationMs: Date.now() - started, stdout, stderr, timedOut });
    });
  });
}

// ───────────────────── execution-unit grouping (de-dup) ─────────────────────
// Many TCs share one Maestro flow or Playwright spec. We run each distinct
// (engine, asset, platform, grep) combination ONCE and attribute its result to
// every case that maps to it. This is the standard "execution unit" pattern and
// avoids re-launching the same flow dozens of times.
function buildExecutionUnits(cases, manifest, opts) {
  const units = new Map();
  for (const tc of cases) {
    const platforms = tc.runner === 'maestro'
      ? (tc.platforms || manifest.config.platforms).filter((p) => opts.platform === 'both' || p === opts.platform)
      : [null];
    for (const platform of platforms) {
      const key = [tc.runner, tc.asset, platform || '-', tc.grep || '-'].join('::');
      if (!units.has(key)) {
        units.set(key, { runner: tc.runner, asset: tc.asset, platform, grep: tc.grep || null, cases: [] });
      }
      units.get(key).cases.push(tc.id);
    }
  }
  return [...units.values()];
}

// ───────────────────────────── filtering ───────────────────────────────────
function selectCases(manifest, opts) {
  let cases = manifest.cases.slice();
  // default statuses: executable ones only
  const defaultStatuses = ['automated', 'partial'];
  if (opts.includePending) defaultStatuses.push('pending');
  if (opts.includeManual) defaultStatuses.push('manual');
  const statuses = opts.statuses && opts.statuses.length ? opts.statuses : defaultStatuses;

  cases = cases.filter((tc) => statuses.includes(tc.status));
  if (opts.runner) cases = cases.filter((tc) => tc.runner === opts.runner);
  if (opts.groups) cases = cases.filter((tc) => opts.groups.includes(tc.group));
  if (opts.cases) cases = cases.filter((tc) => opts.cases.includes(tc.id.toUpperCase()));
  // deterministic order
  cases.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  return cases;
}

// ───────────────────────────── command builders ────────────────────────────
function maestroCommand(unit, manifest, opts) {
  const mobileDir = resolve(WORKSPACE_ROOT, manifest.config.mobileAppDir);
  const flowPath = resolve(WORKSPACE_ROOT, manifest.config.maestroDir, unit.asset);
  const args = ['test', '--platform', unit.platform, '--format', 'junit'];
  if (unit.platform === 'ios' && process.env.IOS_SIMULATOR_UDID) {
    args.push('--device', process.env.IOS_SIMULATOR_UDID);
  }
  if (unit.platform === 'android' && process.env.ANDROID_EMULATOR_SERIAL) {
    args.push('--device', process.env.ANDROID_EMULATOR_SERIAL);
  }
  args.push(flowPath);
  const env = {
    ...process.env,
    APP_ID: process.env.APP_ID || manifest.config.appId,
  };
  return { cmd: 'maestro', args, cwd: mobileDir, env, flowPath };
}

function playwrightCommand(unit, manifest) {
  const adminDir = resolve(WORKSPACE_ROOT, manifest.config.adminDir);
  const specPath = unit.asset; // relative to admin dir, matches playwright testDir/testMatch
  const args = ['playwright', 'test', specPath];
  if (unit.grep) args.push('-g', unit.grep);
  const env = {
    ...process.env,
    PLAYWRIGHT_ADMIN_E2E: process.env.PLAYWRIGHT_ADMIN_E2E || 'true',
    ADMIN_E2E_EMAIL: process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL || '',
    ADMIN_E2E_PASSWORD: process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD || '',
  };
  return { cmd: 'npx', args, cwd: adminDir, env, specPath: resolve(adminDir, specPath) };
}

// ───────────────────────────── preflight ───────────────────────────────────
function preflight(manifest, units, opts) {
  log('step', 'Running preflight environment checks…');
  const problems = [];
  const warnings = [];

  const needsMaestro = units.some((u) => u.runner === 'maestro');
  const needsPlaywright = units.some((u) => u.runner === 'playwright');
  const needsIos = units.some((u) => u.runner === 'maestro' && u.platform === 'ios');
  const needsAndroid = units.some((u) => u.runner === 'maestro' && u.platform === 'android');
  const autoBootIosEnabled = String(process.env.TFV2_AUTO_BOOT_IOS ?? 'true').toLowerCase() !== 'false';

  if (needsMaestro) {
    if (!which('maestro')) problems.push('maestro CLI not found on PATH. Install: curl -Ls "https://get.maestro.mobile.dev" | bash');
    if (needsIos) {
      if (!which('xcrun')) problems.push('xcrun not found — Xcode command line tools required for the iOS simulator.');
      else if (bootedIosSimulators().length === 0) {
        if (!opts.dryRun && autoBootIosEnabled) {
          const autoBoot = autoBootIosSimulator(process.env.IOS_SIMULATOR_UDID);
          if (autoBoot.ok) {
            log('ok', `Booted iOS simulator automatically: ${autoBoot.selected.name} (${autoBoot.selected.udid}).`);
          } else {
            problems.push(`No booted iOS simulator. Auto-boot failed: ${autoBoot.reason}`);
          }
        } else {
          const hint = autoBootIosEnabled
            ? 'No booted iOS simulator. Boot one: open -a Simulator (or xcrun simctl boot <udid>).'
            : 'No booted iOS simulator and TFV2_AUTO_BOOT_IOS=false. Boot one: open -a Simulator (or xcrun simctl boot <udid>).';
          problems.push(hint);
        }
      }
    }
    if (needsAndroid) {
      if (!which('adb')) problems.push('adb not found — Android platform-tools required for the emulator.');
      else if (androidDevices().length === 0) problems.push('No running Android emulator/device (adb devices empty). Start one: emulator -avd <name>.');
    }
  }

  if (needsPlaywright) {
    const adminDir = resolve(WORKSPACE_ROOT, manifest.config.adminDir);
    if (!existsSync(join(adminDir, 'node_modules'))) warnings.push(`Admin deps not installed at ${adminDir} (run: npm install). Playwright will fail until installed.`);
    const baseUrl = process.env.ADMIN_BASE_URL || manifest.config.adminBaseUrl;
    if (!httpReachable(baseUrl)) warnings.push(`Admin portal not reachable at ${baseUrl}. Playwright config auto-starts 'npm run dev' (reuseExistingServer), so this can self-heal — first run will be slower.`);
    if (!(process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL)) warnings.push('No admin credentials set (PLAYWRIGHT_ADMIN_EMAIL/PASSWORD). Authenticated admin specs will self-skip.');
  }

  for (const w of warnings) log('warn', w);
  for (const p of problems) log('error', p);

  if (problems.length && !opts.dryRun) {
    log('error', `Preflight failed with ${problems.length} blocking issue(s). Fix them or pass --no-preflight to bypass.`);
    return false;
  }
  log('ok', `Preflight ${problems.length ? 'bypassed' : 'passed'} (${warnings.length} warning(s)).`);
  return true;
}

// ───────────────────────────── reporting ───────────────────────────────────
function writeReports(outDir, manifest, opts, selected, unitResults, skipped) {
  mkdirSync(outDir, { recursive: true });

  // attribute unit results back to cases
  const caseStatus = new Map();
  for (const ur of unitResults) {
    for (const id of ur.unit.cases) {
      const prev = caseStatus.get(id);
      const outcome = ur.passed ? 'pass' : 'fail';
      // a case fails if ANY of its platform units fails
      if (!prev || outcome === 'fail') caseStatus.set(id, outcome === 'fail' ? 'fail' : (prev || 'pass'));
      if (!prev) caseStatus.set(id, outcome);
      else if (outcome === 'fail') caseStatus.set(id, 'fail');
    }
  }
  for (const s of skipped) caseStatus.set(s.id, 'skip');

  const summary = {
    module: manifest.module,
    generatedAt: ts(),
    options: opts,
    totals: {
      casesSelected: selected.length,
      casesPassed: [...caseStatus.values()].filter((v) => v === 'pass').length,
      casesFailed: [...caseStatus.values()].filter((v) => v === 'fail').length,
      casesSkipped: skipped.length,
      unitsExecuted: unitResults.length,
      unitsPassed: unitResults.filter((u) => u.passed).length,
      unitsFailed: unitResults.filter((u) => !u.passed).length,
    },
    units: unitResults.map((u) => ({
      runner: u.unit.runner,
      asset: u.unit.asset,
      platform: u.unit.platform,
      grep: u.unit.grep,
      cases: u.unit.cases,
      passed: u.passed,
      attempts: u.attempts,
      durationMs: u.durationMs,
      timedOut: u.timedOut,
      command: u.command,
      stderrTail: (u.stderr || '').split('\n').slice(-20).join('\n'),
    })),
    skipped: skipped.map((s) => ({ id: s.id, status: s.status, reason: s.reason })),
  };

  const jsonPath = join(outDir, 'results.json');
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  // Markdown defect-triage report
  const md = [];
  md.push(`# TradeFlowV2 Automated Run — ${summary.generatedAt}`);
  md.push('');
  md.push(`**Module:** ${manifest.module}`);
  md.push(`**Source:** ${manifest.source}`);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Metric | Count |');
  md.push('|---|---|');
  md.push(`| Cases selected | ${summary.totals.casesSelected} |`);
  md.push(`| ✅ Passed | ${summary.totals.casesPassed} |`);
  md.push(`| ❌ Failed | ${summary.totals.casesFailed} |`);
  md.push(`| ⏭️ Skipped (pending/manual) | ${summary.totals.casesSkipped} |`);
  md.push(`| Execution units run | ${summary.totals.unitsExecuted} |`);
  md.push('');
  const failedUnits = unitResults.filter((u) => !u.passed);
  if (failedUnits.length) {
    md.push('## ❌ Failures (investigate before manual QA)');
    md.push('');
    for (const u of failedUnits) {
      md.push(`### ${u.unit.cases.join(', ')} — ${u.unit.runner}${u.unit.platform ? ` (${u.unit.platform})` : ''}`);
      md.push(`- Asset: \`${u.unit.asset}\`${u.unit.grep ? ` (grep: \`${u.unit.grep}\`)` : ''}`);
      md.push(`- Command: \`${u.command}\``);
      md.push(`- Duration: ${(u.durationMs / 1000).toFixed(1)}s · Attempts: ${u.attempts}${u.timedOut ? ' · ⏱️ TIMED OUT' : ''}`);
      md.push('```');
      md.push((u.stderr || u.stdout || '(no output captured)').split('\n').slice(-25).join('\n'));
      md.push('```');
      md.push('');
    }
  } else {
    md.push('## ✅ No failures in executed units.');
    md.push('');
  }
  if (skipped.length) {
    md.push('## ⏭️ Coverage gaps (not executed)');
    md.push('');
    md.push('| Case | Status | Reason |');
    md.push('|---|---|---|');
    for (const s of skipped) md.push(`| ${s.id} | ${s.status} | ${s.reason || ''} |`);
    md.push('');
  }
  const mdPath = join(outDir, 'report.md');
  writeFileSync(mdPath, md.join('\n'));

  return { jsonPath, mdPath, summary, caseStatus };
}

// ───────────────────────────── main ────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); process.exit(0); }
  loadDotEnv();
  const manifest = loadManifest();

  const selected = selectCases(manifest, opts);

  // cases excluded because they're pending/manual and not opted-in -> reported as skipped
  const selectedIds = new Set(selected.map((c) => c.id));
  const skipped = manifest.cases.filter((tc) => {
    if (selectedIds.has(tc.id)) return false;
    if (opts.groups && !opts.groups.includes(tc.group)) return false;
    if (opts.cases && !opts.cases.includes(tc.id.toUpperCase())) return false;
    if (opts.runner && tc.runner !== opts.runner) return false;
    return tc.status === 'pending' || tc.status === 'manual';
  });

  const units = buildExecutionUnits(selected, manifest, opts);

  if (opts.list) {
    log('step', `Plan: ${selected.length} case(s) → ${units.length} execution unit(s); ${skipped.length} skipped (pending/manual).`);
    for (const u of units) {
      const builder = u.runner === 'maestro' ? maestroCommand(u, manifest, opts) : playwrightCommand(u, manifest);
      log('info', `${bold(u.runner)}${u.platform ? `/${u.platform}` : ''}  ${u.asset}${u.grep ? `  (grep: ${u.grep})` : ''}  → [${u.cases.join(', ')}]`);
      log('info', dim(`    $ ${builder.cmd} ${builder.args.join(' ')}  (cwd: ${builder.cwd})`));
    }
    if (skipped.length) {
      log('warn', `Skipped (no reliable automation asset):`);
      for (const s of skipped) log('warn', dim(`    ${s.id} [${s.status}] ${s.reason || ''}`));
    }
    process.exit(0);
  }

  const ok = opts.noPreflight ? true : preflight(manifest, units, opts);
  if (!ok) process.exit(2);

  const outDir = resolve(WORKSPACE_ROOT, opts.outDir || join('test-automation', 'trade-flow-v2', 'reports', ts().replace(/[:.]/g, '-')));
  log('step', `Executing ${units.length} unit(s) for ${selected.length} case(s). Reports → ${outDir}`);

  const unitResults = [];
  for (const unit of units) {
    const builder = unit.runner === 'maestro' ? maestroCommand(unit, manifest, opts) : playwrightCommand(unit, manifest);
    const commandStr = `${builder.cmd} ${builder.args.join(' ')}`;

    // guard: asset must exist for maestro; playwright spec may be pending
    if (unit.runner === 'maestro' && !existsSync(builder.flowPath)) {
      log('error', `Flow asset missing: ${builder.flowPath} (cases ${unit.cases.join(', ')})`);
      unitResults.push({ unit, passed: false, attempts: 0, durationMs: 0, timedOut: false, command: commandStr, stderr: `Missing flow asset: ${builder.flowPath}`, stdout: '' });
      if (opts.bail) break;
      continue;
    }
    if (unit.runner === 'playwright' && !existsSync(builder.specPath)) {
      log('warn', `Playwright spec not authored yet: ${unit.asset} (cases ${unit.cases.join(', ')}) — marking as failed coverage gap.`);
      unitResults.push({ unit, passed: false, attempts: 0, durationMs: 0, timedOut: false, command: commandStr, stderr: `Missing spec: ${builder.specPath}. This case is 'pending' — author the spec and re-point the manifest.`, stdout: '' });
      if (opts.bail) break;
      continue;
    }

    log('step', `${blue(unit.runner)}${unit.platform ? `/${unit.platform}` : ''} ${unit.asset}${unit.grep ? ` (${unit.grep})` : ''} → [${unit.cases.join(', ')}]`);

    if (opts.dryRun) {
      log('info', dim(`    DRY-RUN $ ${commandStr}  (cwd: ${builder.cwd})`));
      unitResults.push({ unit, passed: true, attempts: 0, durationMs: 0, timedOut: false, command: commandStr, stderr: '', stdout: '(dry-run)' });
      continue;
    }

    let result;
    let attempts = 0;
    do {
      attempts++;
      if (attempts > 1) log('warn', `Retry ${attempts - 1}/${opts.retries} for ${unit.cases.join(', ')}`);
      result = await runProcess(builder.cmd, builder.args, { cwd: builder.cwd, env: builder.env, timeoutMs: opts.timeoutMs });
    } while (!result.ok && attempts <= opts.retries);

    unitResults.push({ unit, passed: result.ok, attempts, durationMs: result.durationMs, timedOut: result.timedOut, command: commandStr, stderr: result.stderr, stdout: result.stdout });
    if (result.ok) log('ok', `PASS [${unit.cases.join(', ')}] in ${(result.durationMs / 1000).toFixed(1)}s`);
    else log('error', `FAIL [${unit.cases.join(', ')}]${result.timedOut ? ' (timed out)' : ` (exit ${result.code})`}`);

    if (!result.ok && opts.bail) { log('warn', 'Bailing on first failure (--bail).'); break; }
  }

  const { jsonPath, mdPath, summary } = writeReports(outDir, manifest, opts, selected, unitResults, skipped);

  // ── final summary ──
  process.stdout.write('\n' + bold('──────── TradeFlowV2 Run Summary ────────') + '\n');
  process.stdout.write(`Cases:  ${green(summary.totals.casesPassed + ' pass')}  ${red(summary.totals.casesFailed + ' fail')}  ${yellow(summary.totals.casesSkipped + ' skip')}  / ${summary.totals.casesSelected} selected\n`);
  process.stdout.write(`Units:  ${summary.totals.unitsPassed} pass / ${summary.totals.unitsFailed} fail / ${summary.totals.unitsExecuted} run\n`);
  process.stdout.write(`Report: ${blue(mdPath)}\n`);
  process.stdout.write(`JSON:   ${blue(jsonPath)}\n`);

  if (opts.json) process.stdout.write('\n' + JSON.stringify(summary, null, 2) + '\n');

  const anyFail = unitResults.some((u) => !u.passed);
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  log('error', `Fatal: ${err.stack || err.message}`);
  process.exit(2);
});

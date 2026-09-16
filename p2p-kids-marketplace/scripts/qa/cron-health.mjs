#!/usr/bin/env node
/**
 * FIX-Task-36 (2026-09-14) — `qa:cron-health`: assert that every SCHEDULED caller
 * invokes the Edge Function path, not a bare RPC.
 *
 * WHY THIS EXISTS
 *   FIX-Task-35 fixed the auto-complete capture bug **in the Edge Function** and
 *   the QA playbook codified R14 ("drive the EF, not the bare RPC") — but nothing
 *   checked what the *cron* invoked. `cron.job` jobid 42
 *   (`process-auto-complete`, every 15 min, active) kept running
 *       SELECT public.rpc_process_auto_complete(100);
 *   which flips `in_progress -> completed` on the clock with NO Stripe capture.
 *   On 2026-09-14 at 21:45:00 one tick completed 3 trades with uncaptured
 *   authorizations — $53.87 never collected. The rows *looked* collected because
 *   `payments.derived_state` / `captured_at` are trigger MIRRORS of
 *   `trades.status` (R100), not capture evidence.
 *
 *   THE STANDING RULE THIS ENFORCES — "name the cron/caller, not just the function":
 *   R14 covers the tester (drive the EF), R100 covers the reader (name the writer),
 *   but neither obliged anyone to ask WHO the scheduled caller invokes.
 *
 * WHAT IT ASSERTS (rules live in ./lib/cron-health-rules.mjs — one implementation,
 * shared with `--self-test`)
 *   FAIL  a routine that structurally REQUIRES its Edge Function (a Stripe step, an
 *         audit/ledger write) is invoked bare — e.g. rpc_process_auto_complete.
 *   WARN  the EF is a pure pass-through today, so the bare call is equivalent *now*
 *         but will silently miss future EF-side logic (the exact FIX-Task-36 shape).
 *   PASS  the job reaches an EF (`rpc_fire_edge_function(...)` / `net.http_post(...)`
 *         / a named EF wrapper), or invokes an allowlisted non-money routine.
 *
 * WHY IT DOES NOT READ THE `cron` SCHEMA DIRECTLY
 *   `cron` is not exposed through PostgREST. `public.get_cron_jobs_with_last_run(
 *   p_include_inactive, p_timezone)` already returns `jobname`, `schedule`, `active`
 *   AND `command` text (SECURITY DEFINER, granted to service_role) — so this sweep
 *   needs no new RPC and no raw SQL.
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:cron-health                       # live sweep — all active jobs
 *   npm run qa:cron-health -- --json             # machine-readable
 *   npm run qa:cron-health -- --strict           # WARN also counts as a violation
 *   npm run qa:cron-health -- --self-test        # offline; asserts the rules vs fixtures
 *   npm run qa:cron-health -- --command "SELECT public.rpc_process_auto_complete(100);"
 *                                                # classify ONE command offline (pre/post-fix proof)
 *   npm run qa:cron-health -- --include-inactive # also check paused jobs
 *
 * EXIT CODES
 *   0 = clean (warnings allowed unless --strict) | 1 = violation found | 2 = setup/read failure.
 */
import { getClients } from './lib/r41-common.mjs';
import { classifyCronCommand, runSelfTest } from './lib/cron-health-rules.mjs';

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const AS_JSON = hasFlag('json');
const STRICT = hasFlag('strict');
const SELF_TEST = hasFlag('self-test');
const INCLUDE_INACTIVE = hasFlag('include-inactive');
const ONLY_COMMAND = flagValue('command');

const ICON = { PASS: '✅', WARN: '🟡', FAIL: '❌' };

function log(...args) {
  if (!AS_JSON) console.log(...args);
}

/** Offline single-command classification — how the pre/post-fix proof is produced. */
function reportSingleCommand(command) {
  const result = classifyCronCommand({ command });
  if (AS_JSON) {
    console.log(JSON.stringify({ command, ...result }, null, 2));
  } else {
    log(`${ICON[result.verdict]} ${result.verdict}  ${result.reason}`);
    log(`   command: ${command.trim()}`);
    log(`   routines: ${result.routines.join(', ') || '(none)'}`);
  }
  process.exit(result.verdict === 'FAIL' || (STRICT && result.verdict === 'WARN') ? 1 : 0);
}

function reportSelfTest() {
  const { passed, results } = runSelfTest();
  if (AS_JSON) {
    console.log(JSON.stringify({ passed, fixtures: results.length, results }, null, 2));
  } else {
    log(`[cron-health] self-test — ${results.length} fixture(s)`);
    for (const { fixture, actual, ok } of results) {
      log(`  ${ok ? '✅' : '❌'} expected ${fixture.expect.padEnd(4)} got ${actual.padEnd(4)} — ${fixture.jobname}`);
      if (fixture.note) log(`       note: ${fixture.note}`);
      if (!ok) log(`       command: ${String(fixture.command).trim()}`);
    }
    log(`\n${passed ? '✅ ALL FIXTURES PASSED' : '❌ FIXTURE MISMATCH — the classifier no longer catches a known case'}`);
  }
  process.exit(passed ? 0 : 1);
}

async function main() {
  if (SELF_TEST) return reportSelfTest();
  if (ONLY_COMMAND !== undefined) return reportSingleCommand(ONLY_COMMAND);

  const { admin } = getClients();
  const { data, error } = await admin.rpc('get_cron_jobs_with_last_run', {
    p_include_inactive: INCLUDE_INACTIVE,
    p_timezone: 'UTC',
  });

  if (error) {
    console.error(`[cron-health] cron read failed: ${error.message}`);
    process.exit(2);
  }

  const jobs = (data ?? []).filter((j) => INCLUDE_INACTIVE || j.active !== false);
  const rows = jobs.map((job) => ({
    jobid: job.jobid,
    jobname: job.jobname,
    schedule: job.schedule,
    active: job.active,
    command: job.command,
    last_status: job.last_status ?? null,
    last_start_time_utc: job.last_start_time_utc ?? null,
    ...classifyCronCommand({ jobname: job.jobname, command: job.command }),
  }));

  const failures = rows.filter((r) => r.verdict === 'FAIL');
  const warnings = rows.filter((r) => r.verdict === 'WARN');
  const clean = rows.filter((r) => r.verdict === 'PASS');

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          jobs_checked: rows.length,
          pass: clean.length,
          warn: warnings.length,
          fail: failures.length,
          strict: STRICT,
          violations: failures.map((r) => ({ jobid: r.jobid, jobname: r.jobname, command: r.command, reason: r.reason })),
          warnings: warnings.map((r) => ({ jobid: r.jobid, jobname: r.jobname, command: r.command, reason: r.reason })),
          jobs: rows,
        },
        null,
        2,
      ),
    );
  } else {
    log(`[cron-health] ${rows.length} scheduled job(s) checked (include_inactive=${INCLUDE_INACTIVE})`);
    log('');
    for (const r of rows) {
      log(`${ICON[r.verdict]} #${String(r.jobid).padEnd(3)} ${String(r.jobname).padEnd(32)} ${r.verdict.padEnd(4)} ${r.reason}`);
    }
    log('');
    log(`  PASS ${clean.length}  ·  WARN ${warnings.length}  ·  FAIL ${failures.length}`);
    if (warnings.length) {
      log('\n  🟡 WARNING — a bare RPC the Edge Function currently only forwards to.');
      log('     Equivalent today, but it will silently miss any future EF-side logic');
      log('     (exactly how FIX-Task-36 happened). Re-point it at its EF when convenient.');
    }
    if (failures.length) {
      log('\n  ❌ VIOLATION — a scheduled caller reaches a provider/ledger-owning routine bare.');
      log('     Point the job at its Edge Function wrapper instead, e.g.');
      log("       SELECT public.rpc_fire_edge_function('/<path>');");
    }
    log(
      failures.length === 0 && (!STRICT || warnings.length === 0)
        ? '\n✅ cron health OK'
        : STRICT && warnings.length
          ? '\n❌ --strict: warnings count as violations'
          : '\n❌ cron health FAILED',
    );
  }

  const violated = failures.length > 0 || (STRICT && warnings.length > 0);
  process.exit(violated ? 1 : 0);
}

main().catch((err) => {
  console.error(`[cron-health] ${err instanceof Error ? err.message : err}`);
  process.exit(2);
});

/**
 * FIX-Task-36 (2026-09-14) — cron-health classification rules.
 *
 * WHY THIS EXISTS — "name the cron/caller, not just the function"
 *   Playbook R14 says drive the Edge Function, not the bare RPC (a TESTER rule).
 *   R100 says name the WRITER of a value before filing a finding (a READER rule).
 *   Neither obliged anyone to check what a *scheduled* caller invokes — which is
 *   how `cron.job` jobid 42 kept running
 *       SELECT public.rpc_process_auto_complete(100);
 *   (the bare RPC: a DB status flip with NO Stripe capture) long after that exact
 *   defect had already been fixed twice in application code. On 2026-09-14 at
 *   21:45:00 a single 15-minute tick flipped 3 trades to `completed` with
 *   uncaptured authorizations — $53.87 never collected — while
 *   `payments.derived_state` read `succeeded` because it is a trigger MIRROR of
 *   `trades.status` (R100).
 *
 * This module is deliberately PURE (no I/O, no Supabase client) so that the live
 * sweep and `--self-test` share ONE implementation, and so the rule can be
 * asserted without touching a database.
 */

/**
 * Routines that POST to an Edge Function on the cron's behalf. Finding one of
 * these in a job command proves the job reaches the Edge Function path — which is
 * the sanctioned entry point for anything that touches a provider (Stripe) or an
 * audit/ledger the RPC alone cannot write.
 */
export const EF_WRAPPER_ROUTINES = new Set([
  'rpc_fire_edge_function',
  'rpc_fire_process_extension_timeouts',
  'invoke_trial_conversion_edge_function',
  'invoke_grace_period_cron',
  'invoke_cpsc_import_cron',
]);

/** A literal `net.http_post(...)` in the command also proves the Edge Function path. */
export const EF_WRAPPER_TEXT = /net\.http_post\s*\(/i;

/**
 * Repo-owned routine-name prefixes. Deliberately NOT a generic `name(` matcher —
 * that would swallow `now()`, `jsonb_build_object()`, `COALESCE()` and friends.
 * The hyphenated EF-path segment inside a URL (`/functions/v1/process-…`) does not
 * match, because a hyphen is not in the character class.
 */
const ROUTINE_CALL =
  /\b(?:public\.)?((?:rpc_|invoke_|scheduled_|fn_|process_|send_|check_)[a-z0-9_]*)\s*\(/gi;

/**
 * FAIL — the Edge Function owns a step the RPC structurally CANNOT perform, so a
 * bare call silently drops real work (in FIX-Task-36's case: a Stripe capture).
 */
export const MONEY_ROUTINES_REQUIRE_EF = {
  rpc_process_auto_complete:
    'Stripe PaymentIntent capture + payment_captured / tax_collected audit exist ONLY in the process-auto-complete Edge Function (FIX-Task-36)',
  rpc_process_expired_offers:
    'the Stripe PaymentIntent cancel exists only in the process-expired-offers Edge Function (FIX-Task-24)',
  rpc_release_due_payouts:
    'payout dispatch exists only in the release-due-payouts Edge Function (BP-21)',
  rpc_mark_tax_collected: 'tax-ledger writer — Edge-Function owned',
  rpc_mark_tax_capture_failed: 'tax-ledger writer — Edge-Function owned',
  rpc_void_tax_for_trade: 'tax-ledger writer — Edge-Function owned',
  create_seller_payout_on_trade_completion:
    'payout-row creation — must not be cron-driven directly',
};

/**
 * WARN — the Edge Function is currently a PURE PASS-THROUGH to this RPC, so the
 * bare call is behaviourally equivalent TODAY. It is still flagged, because this
 * is precisely how FIX-Task-36 happened: the EF grew a capture step and the cron,
 * wired to the RPC, silently missed it. `--strict` promotes these to FAIL.
 */
export const PASSTHROUGH_EQUIVALENT_BARE = {
  // FIX-Task-37 item 5 (2026-09-16): the live job was re-pointed at the Edge
  // Function, so this entry no longer matches any scheduled command. It is
  // deliberately KEPT as a regression guard: if a future edit reverts the job to
  // the bare RPC, it stays WARN (a classified, explained risk) instead of falling
  // through to the generic "unclassified bare routine" WARN.
  rpc_release_pending_sp:
    'release-pending-sp Edge Function is a pure pass-through to this RPC (verified 2026-09-16); the cron was re-pointed at the EF by FIX-Task-37 item 5. A bare call here means that re-point regressed, and it will silently miss any future EF-side logic',
};

/**
 * Bare routines that are explicitly ALLOWED, each individually justified. Adding
 * an entry here is a decision, not a default — that is the point of the rule.
 */
export const ALLOWLISTED_BARE_ROUTINES = {
  scheduled_message_cleanup: 'message retention cleanup — no EF counterpart, moves no money',
  scheduled_send_message_emails: 'email fan-out worker — no money movement',
  scheduled_award_tenure_badges: 'gamification badges — no money movement',
  scheduled_trial_reminders: 'trial reminder notifications, DB-side only',
  process_sp_expiration: 'SP expiry sweep — points expiry, no EF counterpart today',
  send_sp_expiration_warnings: 'SP expiry warnings, DB-side notifications only',
  rpc_emit_daily_analytics_snapshots: 'analytics aggregation — no EF counterpart, moves no money',
  fn_escalate_expired_cancel_requests: 'cancel-request escalation state machine — no provider step',
};

/** Every repo-owned routine name invoked by a cron command. */
export function routinesIn(command) {
  const found = new Set();
  const text = String(command ?? '');
  const re = new RegExp(ROUTINE_CALL.source, 'gi');
  let match;
  while ((match = re.exec(text)) !== null) found.add(match[1].toLowerCase());
  return [...found];
}

/** Which Edge-Function wrapper (if any) the command reaches, or null. */
export function efWrapperUsed(command) {
  const text = String(command ?? '');
  if (EF_WRAPPER_TEXT.test(text)) return 'net.http_post(...)';
  for (const routine of routinesIn(text)) {
    if (EF_WRAPPER_ROUTINES.has(routine)) return `${routine}(...)`;
  }
  return null;
}

/**
 * Classify one cron job's command.
 * @returns {{verdict: 'PASS'|'WARN'|'FAIL', reason: string, routines: string[]}}
 */
export function classifyCronCommand({ command } = {}) {
  const text = String(command ?? '');
  const wrapper = efWrapperUsed(text);
  if (wrapper) {
    return { verdict: 'PASS', reason: `invokes an Edge Function via ${wrapper}`, routines: routinesIn(text) };
  }

  const routines = routinesIn(text);
  if (!routines.length) {
    return { verdict: 'PASS', reason: 'no DB routine invocation detected', routines };
  }

  const money = routines.filter((r) => Object.hasOwn(MONEY_ROUTINES_REQUIRE_EF, r));
  if (money.length) {
    return {
      verdict: 'FAIL',
      reason: `${money.map((r) => `${r}()`).join(', ')} reached BARE — ${MONEY_ROUTINES_REQUIRE_EF[money[0]]}`,
      routines,
    };
  }

  const passThrough = routines.filter((r) => Object.hasOwn(PASSTHROUGH_EQUIVALENT_BARE, r));
  if (passThrough.length) {
    return {
      verdict: 'WARN',
      reason: `${passThrough.map((r) => `${r}()`).join(', ')} reached bare — ${PASSTHROUGH_EQUIVALENT_BARE[passThrough[0]]}`,
      routines,
    };
  }

  const unclassified = routines.filter((r) => !Object.hasOwn(ALLOWLISTED_BARE_ROUTINES, r));
  if (unclassified.length) {
    return {
      verdict: 'WARN',
      reason: `unclassified bare routine(s) ${unclassified.join(', ')} — allowlist it with a justification, or wrap it in an Edge Function`,
      routines,
    };
  }

  return {
    verdict: 'PASS',
    reason: `allowlisted non-money routine(s): ${routines.join(', ')}`,
    routines,
  };
}

/**
 * Deterministic regression fixtures. The FIRST entry is the exact live pre-fix
 * command captured from `cron.job` jobid 42 on 2026-09-14 — if the classifier
 * ever stops catching it, `--self-test` fails loudly.
 */
export const SELF_TEST_FIXTURES = [
  // ── the real bug: the verbatim pre-fix command must be caught ──────────────
  {
    jobname: 'process-auto-complete',
    command: 'SELECT public.rpc_process_auto_complete(100);',
    expect: 'FAIL',
    note: 'THE FIX-Task-36 pre-fix command, captured live from cron.job jobid 42',
  },
  {
    jobname: 'process-expired-offers',
    command: 'SELECT public.rpc_process_expired_offers(100);',
    expect: 'FAIL',
    note: 'same class, different routine (the FIX-Task-24 expiry leg)',
  },
  {
    jobname: 'release-due-payouts',
    command: 'SELECT public.rpc_release_due_payouts(50);',
    expect: 'FAIL',
    note: 'same class on the payout-dispatch routine',
  },
  // ── the corrected / sibling-good forms ────────────────────────────────────
  {
    jobname: 'process-auto-complete',
    command: "SELECT public.rpc_fire_edge_function('/process-auto-complete');",
    expect: 'PASS',
    note: 'THE FIX-Task-36 post-fix command',
  },
  {
    jobname: 'dispatch-manual-payouts',
    command: "SELECT public.rpc_fire_edge_function('/dispatch-manual-payouts');",
    expect: 'PASS',
  },
  {
    jobname: 'send-offer-reminders',
    command: "SELECT public.rpc_fire_edge_function('/send-offer-reminders');",
    expect: 'PASS',
  },
  {
    jobname: 'process-extension-timeouts',
    command: 'SELECT public.rpc_fire_process_extension_timeouts();',
    expect: 'PASS',
    note: 'named EF wrapper (posts via net.http_post internally)',
  },
  {
    jobname: 'process-expired-offers',
    command:
      "SELECT net.http_post(url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/process-expired-offers', headers := jsonb_build_object('Content-Type','application/json'), body := '{}'::jsonb);",
    expect: 'PASS',
    note: 'inline net.http_post to the EF — the hyphen in the URL must not create a false routine match',
  },
  // ── pass-through equivalence is flagged, not silently passed ─────────────
  {
    jobname: 'release-pending-sp',
    command: 'SELECT public.rpc_release_pending_sp(200);',
    expect: 'WARN',
    note: 'pre-fix state of jobid 49 — retained as the regression guard for a reverted re-point (FIX-Task-37 item 5)',
  },
  {
    jobname: 'release-pending-sp',
    command: "SELECT public.rpc_fire_edge_function('/release-pending-sp');",
    expect: 'PASS',
    note: 'post-fix (FIX-Task-37 item 5) — reaches the Edge Function; mirrors the FIX-Task-36 auto-complete re-point',
  },
  // ── allowlisted non-money bare routines ──────────────────────────────────
  {
    jobname: 'analytics-daily-snapshots',
    command: 'SELECT public.rpc_emit_daily_analytics_snapshots();',
    expect: 'PASS',
  },
  {
    jobname: 'escalate-cancel-requests',
    command: 'SELECT public.fn_escalate_expired_cancel_requests();',
    expect: 'PASS',
  },
  {
    jobname: 'sp-expiration-processing',
    command: 'SELECT process_sp_expiration()',
    expect: 'PASS',
    note: 'no `public.` prefix — the prefix-qualified matcher must still find it',
  },
  // ── a future money-path cron must be classified, not assumed safe ─────────
  {
    jobname: 'some-new-job',
    command: 'SELECT public.rpc_do_something_new(5);',
    expect: 'WARN',
    note: 'unknown bare routine → WARN by default, so every new cron must be classified',
  },
];

/**
 * Run the fixtures through the classifier.
 * @returns {{passed: boolean, results: Array<{fixture: object, actual: string, ok: boolean}>}}
 */
export function runSelfTest() {
  const results = SELF_TEST_FIXTURES.map((fixture) => {
    const actual = classifyCronCommand(fixture).verdict;
    return { fixture, actual, ok: actual === fixture.expect };
  });
  return { passed: results.every((r) => r.ok), results };
}

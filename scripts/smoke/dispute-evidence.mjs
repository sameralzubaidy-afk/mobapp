#!/usr/bin/env node
// File: scripts/smoke/dispute-evidence.mjs
// N3 (2026-08-10) DoD verification — automated, API-level check that the
// stripe-webhook N3 step packaged dispute evidence and STAGED it (submit=false).
//
// DoD mapping (locked decisions 2026-08-10):
//   (a) GET /v1/disputes/{DISPUTE_ID} shows evidence.customer_communication,
//       evidence.service_date, evidence.shipping_address and
//       evidence.uncategorized_text all correctly populated.
//   (b) The evidence is staged (evidence_details.submitted === false) so an
//       admin can still review it in the Stripe Dashboard before submission.
//   (c) The Stripe Dashboard visual spot-check is MANUAL — run the matching
//       manual test case (see misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md
//       Group N3, TC-N3-03) — this script covers the API layer only.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_xxx node scripts/smoke/dispute-evidence.mjs --dispute dp_123
//   STRIPE_SECRET_KEY=sk_test_xxx node scripts/smoke/dispute-evidence.mjs --payment-intent pi_123
//
// Prerequisites: Stripe CLI on PATH (`stripe`), a STRIPE_SECRET_KEY for the
// account where the dispute exists, and the `charge.dispute.created` webhook
// already delivered (the N3 packaging ran). Exit code 0 = all DoD items PASS.

import { execFileSync } from 'node:child_process';

function fail(message) {
  console.error(`[SMOKE] FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[SMOKE] PASS: ${message}`);
}

function check(label, ok, detail) {
  if (ok) pass(`${label} ${detail ?? ''}`);
  else fail(`${label} ${detail ?? ''}`);
}

// DoD assertions, shared by the live path (retrieve a real dispute) and the
// --self-test path (mock dispute). `dispute` is a Stripe Dispute object.
function assertEvidence(dispute, label) {
  const ev = dispute.evidence ?? {};
  const details = dispute.evidence_details ?? {};

  console.log(`[SMOKE] ${label} — status=${dispute.status} amount=${dispute.amount}`);

  // DoD (a): every named evidence field populated.
  check('DoD(a) evidence.customer_communication is a file_upload ID',
    typeof ev.customer_communication === 'string' && ev.customer_communication.startsWith('file_'),
    `-> ${ev.customer_communication ?? 'MISSING'}`);

  check('DoD(a) evidence.service_date is a populated unix timestamp',
    typeof ev.service_date === 'number' && ev.service_date > 0,
    `-> ${ev.service_date ?? 'MISSING'}`);

  check('DoD(a) evidence.shipping_address is populated',
    !!ev.shipping_address && (ev.shipping_address.line1 || ev.shipping_address.city || ev.shipping_address.postal_code),
    `-> ${JSON.stringify(ev.shipping_address ?? null)}`);

  check('DoD(a) evidence.uncategorized_text is populated',
    typeof ev.uncategorized_text === 'string' && ev.uncategorized_text.trim().length > 0,
    `-> ${typeof ev.uncategorized_text === 'string' ? ev.uncategorized_text.slice(0, 80).replace(/\n/g, ' ') + '...' : 'MISSING'}`);

  // DoD (b): staged, not submitted. Stripe flips evidence_details.submitted to
  // true only when evidence is sent to the bank. submission_count 0 = staged.
  check('DoD(b) evidence is STAGED (not submitted to the bank)',
    details.submitted === false && (details.submission_count ?? 0) === 0,
    `-> submitted=${details.submitted} submission_count=${details.submission_count ?? 0}`);
}

// --- Env + args ------------------------------------------------------------
const raw = process.env.STRIPE_SECRET_KEY;
const key = (raw ?? '').trim();
if (!key) fail('STRIPE_SECRET_KEY is missing/blank. Expected sk_test_... (DoD check runs against Stripe TEST mode).');
if (!key.startsWith('sk_')) fail(`STRIPE_SECRET_KEY does not look like a secret key. Got prefix: ${key.slice(0, 3)}`);

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  // Verify the DoD assertion logic against a mock dispute that has all four
  // evidence fields populated + staged. Use --self-test-fail to prove a missing
  // field trips the assertion (negative control).
  const mock = {
    id: 'dp_self_test',
    status: 'needs_response',
    amount: 2500,
    evidence: {
      customer_communication: 'file_self_test_messaging_history',
      service_date: 1710000000,
      shipping_address: { line1: 'Westport, CT 06880', city: 'Westport', state: 'CT', postal_code: '06880', country: 'US' },
      uncategorized_text: 'Pass It Up — dispute trade summary.\nTrade ID: 00000000-0000-0000-0000-000000000000\nCompleted at: 2024-03-09T12:00:00Z',
    },
    evidence_details: { submitted: false, submission_count: 0 },
  };
  assertEvidence(mock, 'self-test (positive — all fields populated)');
  console.log('[SMOKE] PASS: --self-test assertion logic verified.');
  process.exit(0);
}

if (args.includes('--self-test-fail')) {
  // Negative control: a dispute missing evidence must trip the assertions
  // (check() calls fail() -> process.exit(1)). Run in isolation; exit 1 is the
  // EXPECTED result — it proves a missing field is detected.
  const negative = {
    id: 'dp_neg', status: 'needs_response', amount: 100,
    evidence: { uncategorized_text: 'x' },
    evidence_details: { submitted: true, submission_count: 1 },
  };
  assertEvidence(negative, 'self-test-fail (negative control — expects FAIL + exit 1)');
  fail('--self-test-fail expected an assertion failure but none fired (bad)');
}

const disputeArg = args.indexOf('--dispute') !== -1 ? args[args.indexOf('--dispute') + 1] : null;
const piArg = args.indexOf('--payment-intent') !== -1 ? args[args.indexOf('--payment-intent') + 1] : null;
if (!disputeArg && !piArg) {
  fail('Provide --dispute <dp_id> or --payment-intent <pi_id>');
}

function stripeJson(subCmd) {
  const out = execFileSync('stripe', subCmd.split(' '), {
    env: { ...process.env, STRIPE_API_KEY: key },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
  return out ? JSON.parse(out) : null;
}

// --- Resolve the dispute id ------------------------------------------------
let disputeId = disputeArg;
if (!disputeId) {
  // `stripe disputes list --payment-intent <pi> --limit 1` returns [ {...} ]
  const list = stripeJson(`disputes list --payment-intent ${piArg} --limit 1`);
  if (!list || !Array.isArray(list) || list.length === 0) {
    fail(`No dispute found for payment intent ${piArg} — has charge.dispute.created fired?`);
  }
  disputeId = list[0].id;
  console.log(`[SMOKE] Resolved dispute ${disputeId} for PI ${piArg}`);
}

// --- GET /v1/disputes/{DISPUTE_ID} + assert evidence -----------------------
const dispute = stripeJson(`disputes retrieve ${disputeId}`);
if (!dispute) fail(`Could not retrieve dispute ${disputeId}`);

assertEvidence(dispute, `dispute ${disputeId}`);

console.log('[SMOKE] PASS: all DoD(a)+(b) evidence-field assertions hold for ' + disputeId);
console.log('[SMOKE] DoD(c) is the manual Stripe Dashboard spot-check — see Group N3 TC-N3-03.');

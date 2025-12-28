#!/usr/bin/env node

function fail(message) {
  console.error(`[SMOKE] FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[SMOKE] PASS: ${message}`);
}

// This smoke is intentionally lightweight: it prevents a common misconfig
// that leads to Stripe returning: "You did not provide an API key".
const raw = process.env.STRIPE_SECRET_KEY;
const key = (raw ?? '').trim();

if (!key) {
  fail('STRIPE_SECRET_KEY is missing/blank. Expected sk_test_... or sk_live_...');
}

if (!key.startsWith('sk_')) {
  fail(`STRIPE_SECRET_KEY does not look like a secret key. Got prefix: ${key.slice(0, 3)}`);
}

pass('STRIPE_SECRET_KEY is present and has sk_ prefix');

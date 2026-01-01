#!/usr/bin/env node

function fail(message) {
  console.error(`[SMOKE] FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[SMOKE] PASS: ${message}`);
}

const required = [
  // PayPal
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  // Stripe (webhooks)
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];
for (const key of required) {
  const value = (process.env[key] ?? '').trim();
  if (!value) {
    fail(`${key} is missing/blank. Required for real PayPal/Venmo payouts + webhooks.`);
  }
}

const baseUrl = (process.env.PAYPAL_BASE_URL ?? '').trim();
if (baseUrl && !baseUrl.startsWith('https://')) {
  fail(`PAYPAL_BASE_URL must be https://... if set. Got: ${baseUrl}`);
}

pass('PayPal payout env vars are present');

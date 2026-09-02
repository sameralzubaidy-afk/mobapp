/**
 * DEV-TASK-88 config fix (2026-09-02): subscribe `invoice.payment_succeeded` on
 * the stripe-webhook-subscriptions Stripe endpoint so renewal-success events are
 * delivered to the webhook (which now advances the DB period window + writes the
 * billing_history row). PRESERVES the existing 3 subscribed events.
 *
 * Read-only? NO — this MUTATES the webhook endpoint's enabled_events on the
 * shared test-mode Stripe account (owner-approved as part of the DT-88 fix).
 * Reversible: restore the original 3-event list.
 * Reads test key from ~/.dt11-stripe-key (never echoed).
 * Run: node scripts/qa/dev-task-88-subscribe-payment-succeeded.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();
const ENDPOINT_ID = process.argv[2] || 'we_1T2k3z4I6kCJlvXob2DFTJI9';

const DESIRED_EVENTS = [
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
];

async function stripeReq(method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// Stripe wants repeated `enabled_events[]=x&enabled_events[]=y` style params.
function buildBody(events) {
  const params = new URLSearchParams();
  for (const e of events) {
    params.append('enabled_events[]', e);
  }
  return params;
}

async function main() {
  // 1. Before: read current endpoint
  const before = await stripeReq('GET', `/webhook_endpoints/${ENDPOINT_ID}`);
  console.log('BEFORE enabled_events:', before.enabled_events?.join(', '));

  // 2. Apply: set the full desired list (POST replaces the list)
  const after = await stripeReq('POST', `/webhook_endpoints/${ENDPOINT_ID}`, buildBody(DESIRED_EVENTS));
  console.log('AFTER  enabled_events:', after.enabled_events?.join(', '));
  console.log('url:', after.url, '| status:', after.status);

  const ok = DESIRED_EVENTS.every((e) => after.enabled_events?.includes(e));
  console.log(ok ? '✅ invoice.payment_succeeded subscribed' : '❌ MISSING event — check');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });

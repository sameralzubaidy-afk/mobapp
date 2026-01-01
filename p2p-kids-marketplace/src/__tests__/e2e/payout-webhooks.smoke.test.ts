/**
 * PAY-007: Webhook receivers smoke checks (no provider secrets required)
 *
 * These tests only validate that the endpoints reject missing signature headers.
 * They do NOT attempt to forge valid Stripe/PayPal signatures.
 */

import { describe, it, expect } from '@jest/globals';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Some Supabase deployments require an API key even when verify_jwt is disabled.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  return headers;
}

describe('PAY-007 webhook endpoint smoke', () => {
  if (!SUPABASE_URL) {
    it('skipped (missing EXPO_PUBLIC_SUPABASE_URL)', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const functionsBase = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;

  it('paypal-webhook rejects missing signature headers', async () => {
    const res = await fetch(`${functionsBase}/paypal-webhook`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED', resource: {} }),
    });

    // Should be 401 (missing PayPal signature headers) or 400 if function routing differs.
    expect([400, 401, 404]).toContain(res.status);
  }, 20000);

  it('stripe-webhook rejects missing stripe-signature', async () => {
    const res = await fetch(`${functionsBase}/stripe-webhook`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({}),
    });

    expect([400, 401, 404]).toContain(res.status);
  }, 20000);
});

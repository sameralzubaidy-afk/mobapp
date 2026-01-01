// File: supabase/functions/_shared/payouts/paypalVerify.test.ts

import {
  hasAllPayPalVerifyHeaders,
  verifyPayPalWebhookSignature,
} from './paypalVerify.ts';
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('hasAllPayPalVerifyHeaders: requires all values', () => {
  assertEquals(
    hasAllPayPalVerifyHeaders({
      transmissionId: 't',
      transmissionTime: 'time',
      transmissionSig: 'sig',
      certUrl: 'https://example.com/cert',
      authAlgo: 'SHA256withRSA',
    }),
    true
  );

  assertEquals(
    hasAllPayPalVerifyHeaders({
      transmissionId: '',
      transmissionTime: 'time',
      transmissionSig: 'sig',
      certUrl: 'https://example.com/cert',
      authAlgo: 'SHA256withRSA',
    }),
    false
  );
});

Deno.test('verifyPayPalWebhookSignature: SUCCESS -> true', async () => {
  const originalFetch = globalThis.fetch;

  try {
    let call = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      const url = String(input);

      if (call === 1) {
        // token
        assertEquals(url.includes('/v1/oauth2/token'), true);
        return new Response(JSON.stringify({ access_token: 'TOKEN' }), { status: 200 });
      }

      // verify
      assertEquals(url.includes('/v1/notifications/verify-webhook-signature'), true);
      const body = init?.body ? String(init.body) : '';
      assertEquals(body.includes('webhook_id'), true);
      return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 });
    }) as typeof fetch;

    const ok = await verifyPayPalWebhookSignature({
      env: {
        clientId: 'id',
        clientSecret: 'secret',
        webhookId: 'whid',
        baseUrl: 'https://api-m.paypal.com',
      },
      headers: {
        transmissionId: 'tid',
        transmissionTime: 'time',
        transmissionSig: 'sig',
        certUrl: 'https://example.com/cert',
        authAlgo: 'SHA256withRSA',
      },
      webhookEvent: { event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' },
    });

    assertEquals(ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

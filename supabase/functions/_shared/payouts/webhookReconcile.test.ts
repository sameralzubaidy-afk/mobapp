// File: supabase/functions/_shared/payouts/webhookReconcile.test.ts

import {
  extractPayPalProviderReferenceId,
  mapPayPalEventToUpdate,
  mapStripePayoutEventToUpdate,
} from './webhookReconcile.ts';
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('mapStripePayoutEventToUpdate: payout.paid -> completed', () => {
  const update = mapStripePayoutEventToUpdate('payout.paid', { failure_message: null });
  assertEquals(update?.status, 'completed');
});

Deno.test('mapStripePayoutEventToUpdate: payout.failed -> failed', () => {
  const update = mapStripePayoutEventToUpdate('payout.failed', { failure_message: 'nope' });
  assertEquals(update?.status, 'failed');
  assertEquals(update?.failure_reason, 'nope');
});

Deno.test('extractPayPalProviderReferenceId: payout_batch_id', () => {
  assertEquals(extractPayPalProviderReferenceId({ payout_batch_id: 'BATCH123' }), 'BATCH123');
});

Deno.test('mapPayPalEventToUpdate: succeeded -> completed', () => {
  const update = mapPayPalEventToUpdate('PAYMENT.PAYOUTS-ITEM.SUCCEEDED', {});
  assertEquals(update?.status, 'completed');
});

// File: supabase/functions/_shared/subscription-payment-method.test.ts
//
// FIX-Task-34 item 2/3 (F6) regression guard — the Stripe default-payment-method sync.
//
// Run with:
//   deno test --allow-env --no-config --no-lock supabase/functions/_shared/subscription-payment-method.test.ts
//
// WHY THIS TEST EXISTS
// --------------------
// F6 is a LAYER-3 (provider) defect: the DB looked right, the app looked right,
// and only Stripe knew a different card would be charged at renewal. There is no
// pure-logic assertion available on the live objects, so the honest guard is on
// the WRITE: this helper must put the card on the level a renewal actually reads
// (the subscription) as well as the customer level, and must never let a Stripe
// failure abort the caller's primary action.
//
// A mocked Stripe client is used deliberately — no staging, no Stripe, no
// feature flag, so this runs in the default suite.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  syncStripeDefaultPaymentMethod,
  type StripeDefaultsClient,
} from './subscription-payment-method.ts';

/** Records every call; optionally fails one of the levels. */
function makeStripe(opts: { failSubscription?: boolean; failCustomer?: boolean } = {}) {
  const calls: string[] = [];
  const client: StripeDefaultsClient = {
    subscriptions: {
      update(id, params) {
        calls.push(`sub:${id}:${params.default_payment_method}`);
        return opts.failSubscription
          ? Promise.reject(new Error('sub boom'))
          : Promise.resolve({ id });
      },
    },
    customers: {
      update(id, params) {
        calls.push(`cus:${id}:${params.invoice_settings.default_payment_method}`);
        return opts.failCustomer
          ? Promise.reject(new Error('cus boom'))
          : Promise.resolve({ id });
      },
    },
  };
  return { client, calls };
}

Deno.test('item 2/3: writes the card to BOTH levels a renewal consults', async () => {
  const { client, calls } = makeStripe();
  const res = await syncStripeDefaultPaymentMethod(client, {
    customerId: 'cus_1',
    subscriptionId: 'sub_1',
    paymentMethodId: 'pm_new',
  });
  assertEquals(res.subscription_synced, true);
  assertEquals(res.customer_synced, true);
  assertEquals(res.errors, []);
  // The subscription level is the one that actually wins at renewal — assert it
  // was written, so a future edit that drops it fails here.
  assertEquals(calls.includes('sub:sub_1:pm_new'), true);
  assertEquals(calls.includes('cus:cus_1:pm_new'), true);
});

Deno.test('no payment method recorded ⇒ no Stripe call at all', async () => {
  for (const pm of [null, undefined, '']) {
    const { client, calls } = makeStripe();
    const res = await syncStripeDefaultPaymentMethod(client, {
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      paymentMethodId: pm as string | null | undefined,
    });
    assertEquals(res.subscription_synced, false);
    assertEquals(res.customer_synced, false);
    assertEquals(calls.length, 0);
  }
});

Deno.test('a user with no live Stripe subscription still syncs the customer level', async () => {
  const { client, calls } = makeStripe();
  const res = await syncStripeDefaultPaymentMethod(client, {
    customerId: 'cus_1',
    subscriptionId: null,
    paymentMethodId: 'pm_new',
  });
  assertEquals(res.subscription_synced, false);
  assertEquals(res.customer_synced, true);
  assertEquals(calls, ['cus:cus_1:pm_new']);
});

Deno.test('a missing customer id still syncs the subscription level', async () => {
  const { client, calls } = makeStripe();
  const res = await syncStripeDefaultPaymentMethod(client, {
    customerId: null,
    subscriptionId: 'sub_1',
    paymentMethodId: 'pm_new',
  });
  assertEquals(res.subscription_synced, true);
  assertEquals(res.customer_synced, false);
  assertEquals(calls, ['sub:sub_1:pm_new']);
});

Deno.test('a Stripe failure is REPORTED, never thrown — the caller keeps working', async () => {
  const subFails = makeStripe({ failSubscription: true });
  const r1 = await syncStripeDefaultPaymentMethod(subFails.client, {
    customerId: 'cus_1',
    subscriptionId: 'sub_1',
    paymentMethodId: 'pm_new',
  });
  assertEquals(r1.subscription_synced, false);
  assertEquals(r1.customer_synced, true, 'a subscription failure must not skip the customer write');
  assertEquals(r1.errors.length, 1);
  assertEquals(r1.errors[0].startsWith('subscription:'), true);

  const cusFails = makeStripe({ failCustomer: true });
  const r2 = await syncStripeDefaultPaymentMethod(cusFails.client, {
    customerId: 'cus_1',
    subscriptionId: 'sub_1',
    paymentMethodId: 'pm_new',
  });
  assertEquals(r2.subscription_synced, true, 'a customer failure must not undo the subscription write');
  assertEquals(r2.customer_synced, false);
  assertEquals(r2.errors[0].startsWith('customer:'), true);
});

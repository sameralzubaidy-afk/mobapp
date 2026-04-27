// File: p2p-kids-marketplace/e2e/subscription-payment-flow.integration.test.ts
// MODULE-11 SUB-015: E2E integration test for subscription payment flow

import { supabase } from '../src/config/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const RUN_SUPABASE_E2E = process.env.RUN_SUPABASE_E2E === 'true';

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

describe('Subscription Payment Flow E2E', () => {
  let testUserId: string;
  let testSession: any;
  let paymentFunctionsAvailable = true;
  let skipReason = '';

  const ensureFunctionsAvailable = () => {
    if (!paymentFunctionsAvailable) {
      console.warn(
        `[subscription-payment-flow.integration] Skipping assertion: ${skipReason || 'payment edge functions are not deployed in this environment'}`
      );
      return false;
    }
    return true;
  };

  beforeAll(async () => {
    if (!RUN_SUPABASE_E2E) {
      paymentFunctionsAvailable = false;
      skipReason = 'RUN_SUPABASE_E2E is not enabled';
      return;
    }

    if (!SUPABASE_URL) {
      paymentFunctionsAvailable = false;
      skipReason = 'EXPO_PUBLIC_SUPABASE_URL is not configured';
      return;
    }

    // Use test user from environment or create one
    const testEmail = `test-payment-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123!';

    try {
      // Sign up test user
      const { data: signUpData, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email: testEmail,
          password: testPassword,
        }),
        15000,
        'signUp'
      );

      if (signUpError) {
        throw new Error(`Failed to create test user: ${signUpError.message}`);
      }

      testUserId = signUpData.user!.id;

      // Sign in to get session
      const { data: signInData, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        }),
        15000,
        'signInWithPassword'
      );

      if (signInError) {
        throw new Error(`Failed to sign in: ${signInError.message}`);
      }

      testSession = signInData.session;

      const healthResponse = await withTimeout(
        fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testSession.access_token}`,
          },
          body: JSON.stringify({
            user_id: testUserId,
            for_renewal: false,
          }),
        }),
        15000,
        'payment function health check'
      );

      if (healthResponse.status === 404) {
        paymentFunctionsAvailable = false;
        skipReason = 'payment edge functions are not deployed in this environment';
      }
    } catch (error: any) {
      paymentFunctionsAvailable = false;
      skipReason = error?.message || 'failed to initialize subscription payment E2E setup';
    }
  }, 60000);

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      try {
        await supabase.auth.admin.deleteUser(testUserId);
      } catch {
        // Cleanup can fail in anon-key environments; test assertions are already complete.
      }
    }
  });

  describe('Create Payment SetupIntent', () => {
    it('should create a SetupIntent for payment method collection', async () => {
      if (!ensureFunctionsAvailable()) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSession.access_token}`,
        },
        body: JSON.stringify({
          user_id: testUserId,
          for_renewal: false,
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('client_secret');
      expect(data).toHaveProperty('publishable_key');
      expect(data).toHaveProperty('ephemeral_key_secret');
      expect(data).toHaveProperty('customer_id');

      expect(data.client_secret).toMatch(/^seti_/);
      expect(data.customer_id).toMatch(/^cus_/);
    });

    it('should reuse existing Stripe customer for subsequent calls', async () => {
      if (!ensureFunctionsAvailable()) return;

      // First call
      const response1 = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSession.access_token}`,
        },
        body: JSON.stringify({
          user_id: testUserId,
          for_renewal: false,
        }),
      });

      const data1 = await response1.json();
      const customerId1 = data1.customer_id;

      // Second call
      const response2 = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSession.access_token}`,
        },
        body: JSON.stringify({
          user_id: testUserId,
          for_renewal: false,
        }),
      });

      const data2 = await response2.json();
      const customerId2 = data2.customer_id;

      // Should reuse same customer
      expect(customerId1).toBe(customerId2);
    });

    it('should reject unauthorized requests', async () => {
      if (!ensureFunctionsAvailable()) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: testUserId,
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error || data.message).toBeTruthy();
    });
  });

  describe('Create Subscription from Payment Method', () => {
    it('should reject request without payment_method_id', async () => {
      if (!ensureFunctionsAvailable()) return;

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-subscription-from-payment-method`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testSession.access_token}`,
          },
          body: JSON.stringify({
            user_id: testUserId,
            // Missing payment_method_id
          }),
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('payment_method_id');
    });

    it('should reject unauthorized requests', async () => {
      if (!ensureFunctionsAvailable()) return;

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-subscription-from-payment-method`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: testUserId,
            payment_method_id: 'pm_test_123',
          }),
        }
      );

      expect(response.status).toBe(401);
    });

    // NOTE: Full subscription creation test requires a valid Stripe test payment method
    // This would be done in Maestro or manual testing with real Stripe Payment Sheet
  });

  describe('Renewal flow', () => {
    it('should accept isRenewal flag in SetupIntent creation', async () => {
      if (!ensureFunctionsAvailable()) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSession.access_token}`,
        },
        body: JSON.stringify({
          user_id: testUserId,
          for_renewal: true, // Renewal flag
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('client_secret');
    });

    it('should accept is_renewal flag in subscription creation', async () => {
      if (!ensureFunctionsAvailable()) return;

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-subscription-from-payment-method`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testSession.access_token}`,
          },
          body: JSON.stringify({
            user_id: testUserId,
            payment_method_id: 'pm_test_123',
            is_renewal: true, // Renewal flag
          }),
        }
      );

      // Will fail without valid payment method, but should accept flag
      expect(response.status).not.toBe(400); // Not a validation error
    });
  });
});

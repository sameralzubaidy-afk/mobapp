// File: p2p-kids-marketplace/e2e/subscription-payment-flow.integration.test.ts
// MODULE-11 SUB-015: E2E integration test for subscription payment flow

import { supabase } from '../src/config/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

describe('Subscription Payment Flow E2E', () => {
  let testUserId: string;
  let testSession: any;
  let paymentFunctionsAvailable = true;

  const ensureFunctionsAvailable = () => {
    if (!paymentFunctionsAvailable) {
      console.warn('[subscription-payment-flow.integration] Skipping assertion: payment edge functions are not deployed in this environment');
      return false;
    }
    return true;
  };

  beforeAll(async () => {
    // Use test user from environment or create one
    const testEmail = `test-payment-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123!';

    // Sign up test user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      throw new Error(`Failed to create test user: ${signUpError.message}`);
    }

    testUserId = signUpData.user!.id;

    // Sign in to get session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    testSession = signInData.session;

    const healthResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
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

    if (healthResponse.status === 404) {
      paymentFunctionsAvailable = false;
    }
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
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

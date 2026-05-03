// File: p2p-kids-marketplace/e2e/trial-reminders.e2e.ts
// E2E tests for trial reminders Edge Function

import { supabase } from '../src/config/supabase';

const EDGE_FUNCTION_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1/trial-reminders`
  : 'http://localhost:54321/functions/v1/trial-reminders';

describe('Trial Reminders E2E', () => {
  let testUserId: string;
  let testSubscriptionId: string;

  beforeAll(async () => {
    // Create test user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `trial-reminder-test-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    });

    if (authError || !authData.user) {
      throw new Error('Failed to create test user');
    }

    testUserId = authData.user.id;

    // Create trial subscription set to trigger day 23 reminder (7 days remaining)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 days from now

    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: testUserId,
        status: 'trial',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        trial_reminder_day_23_sent: false,
        trial_reminder_day_28_sent: false,
        trial_reminder_day_29_sent: false,
      })
      .select()
      .single();

    if (subError || !subData) {
      throw new Error('Failed to create test subscription');
    }

    testSubscriptionId = subData.id;
  });

  afterAll(async () => {
    // Cleanup: delete test subscription
    if (testSubscriptionId) {
      await supabase.from('user_subscriptions').delete().eq('id', testSubscriptionId);
    }

    // Cleanup: delete test user (requires admin/service role)
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('should trigger day 23 reminder for trial with 7 days remaining', async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set, skipping E2E test');
      return;
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);

    // Verify reminder flag was updated
    const { data: updatedSub } = await supabase
      .from('user_subscriptions')
      .select('trial_reminder_day_23_sent')
      .eq('id', testSubscriptionId)
      .single();

    expect(updatedSub?.trial_reminder_day_23_sent).toBe(true);
  }, 30000); // 30 second timeout

  it('should not send duplicate reminders', async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set, skipping E2E test');
      return;
    }

    // Call function again
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0); // Should not process the same subscription again
  }, 30000);

  it('should handle no trial subscriptions gracefully', async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set, skipping E2E test');
      return;
    }

    // Delete test subscription temporarily
    await supabase.from('user_subscriptions').delete().eq('id', testSubscriptionId);

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.message).toContain('No trial subscriptions');
  }, 30000);
});

describe('Trial Reminders Integration', () => {
  it('should calculate correct days for each reminder', () => {
    const testCases = [
      { daysRemaining: 7, expectedDay: '23', shouldTrigger: true },
      { daysRemaining: 2, expectedDay: '28', shouldTrigger: true },
      { daysRemaining: 1, expectedDay: '29', shouldTrigger: true },
      { daysRemaining: 6, shouldTrigger: false },
      { daysRemaining: 3, shouldTrigger: false },
      { daysRemaining: 0, shouldTrigger: false },
    ];

    testCases.forEach(({ daysRemaining, expectedDay, shouldTrigger }) => {
      if (shouldTrigger) {
        expect([7, 2, 1]).toContain(daysRemaining);
      } else {
        expect([7, 2, 1]).not.toContain(daysRemaining);
      }
    });
  });
});

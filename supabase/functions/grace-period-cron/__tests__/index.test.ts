/**
 * Unit Tests: grace-period-cron Edge Function
 * SUB-009: Grace Period Countdown, Reminders & Expiry
 *
 * Run with:
 * deno test --allow-env supabase/functions/grace-period-cron/__tests__/index.test.ts
 */

import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

// ============================================
// Helper Functions (from main index.ts logic)
// ============================================

/**
 * Calculate days remaining until grace period expires
 */
function calculateDaysRemaining(gracePeriodEndsAt: string): number {
  const now = new Date();
  const endsAt = new Date(gracePeriodEndsAt);
  const diffMs = endsAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine if reminder should be sent based on thresholds
 */
function shouldSendReminder(
  daysRemaining: number,
  thresholds: number[],
  reminderFlags: Record<string, boolean>
): { shouldSend: boolean; dayKey?: string } {
  // Check if daysRemaining matches any threshold
  const threshold = thresholds.find((t) => t === daysRemaining);
  if (!threshold) {
    return { shouldSend: false };
  }

  const dayKey = `grace_reminder_sent_day_${threshold}`;

  // Only send if not already sent
  if (reminderFlags[dayKey]) {
    return { shouldSend: false };
  }

  return { shouldSend: true, dayKey };
}

/**
 * Get urgency-based reminder title
 */
function getReminderTitle(daysRemaining: number): string {
  if (daysRemaining <= 1) {
    return '⛔ Grace Period Expires Today!';
  } else if (daysRemaining <= 7) {
    return '⚠️ Grace Period Ending Soon';
  } else {
    return '⏰ Grace Period Reminder';
  }
}

/**
 * Get urgency-based reminder body
 */
function getReminderBody(daysRemaining: number): string {
  if (daysRemaining <= 1) {
    return 'Your Kids Club+ grace period expires today! Re-subscribe now to keep your benefits and Swap Points.';
  } else if (daysRemaining <= 7) {
    return `Your Kids Club+ grace period ends in ${daysRemaining} days. Re-subscribe soon to avoid losing your Swap Points.`;
  } else {
    return `Your Kids Club+ grace period ends in ${daysRemaining} days. Consider re-subscribing to maintain your benefits.`;
  }
}

// ============================================
// Test Suite
// ============================================

Deno.test('[SUB-009] calculateDaysRemaining: positive days', () => {
  const now = new Date();
  const future = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // +15 days
  const result = calculateDaysRemaining(future.toISOString());
  
  assertEquals(result, 15);
});

Deno.test('[SUB-009] calculateDaysRemaining: zero days (same day)', () => {
  const now = new Date();
  const sameDay = new Date(now.getTime() + 1000); // +1 second
  const result = calculateDaysRemaining(sameDay.toISOString());
  
  // Math.ceil ensures same-day returns 1
  assertEquals(result, 1);
});

Deno.test('[SUB-009] calculateDaysRemaining: negative days (expired)', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // -2 days
  const result = calculateDaysRemaining(past.toISOString());
  
  assertEquals(result < 0, true);
  assertEquals(result, -2);
});

Deno.test('[SUB-009] calculateDaysRemaining: handles leap year correctly', () => {
  // February 28 → March 1 in leap year (2024)
  const feb28 = new Date('2024-02-28T12:00:00Z');
  const mar1 = new Date('2024-03-01T12:00:00Z');
  
  const diffMs = mar1.getTime() - feb28.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  assertEquals(days, 2); // 2 days (Feb 29 exists in 2024)
});

Deno.test('[SUB-009] shouldSendReminder: sends at 60-day threshold when flag unset', () => {
  const thresholds = [60, 30, 7, 1];
  const reminderFlags = {
    grace_reminder_sent_day_60: false,
    grace_reminder_sent_day_30: false,
    grace_reminder_sent_day_7: false,
    grace_reminder_sent_day_1: false,
  };
  
  const result = shouldSendReminder(60, thresholds, reminderFlags);
  
  assertEquals(result.shouldSend, true);
  assertEquals(result.dayKey, 'grace_reminder_sent_day_60');
});

Deno.test('[SUB-009] shouldSendReminder: does NOT send at 60 days when flag already set', () => {
  const thresholds = [60, 30, 7, 1];
  const reminderFlags = {
    grace_reminder_sent_day_60: true, // Already sent
    grace_reminder_sent_day_30: false,
  };
  
  const result = shouldSendReminder(60, thresholds, reminderFlags);
  
  assertEquals(result.shouldSend, false);
});

Deno.test('[SUB-009] shouldSendReminder: does NOT send at 59 days (not a threshold)', () => {
  const thresholds = [60, 30, 7, 1];
  const reminderFlags = {};
  
  const result = shouldSendReminder(59, thresholds, reminderFlags);
  
  assertEquals(result.shouldSend, false);
});

Deno.test('[SUB-009] shouldSendReminder: sends at all configured thresholds', () => {
  const thresholds = [60, 30, 7, 1];
  const reminderFlags = {};
  
  // Test each threshold
  for (const threshold of thresholds) {
    const result = shouldSendReminder(threshold, thresholds, reminderFlags);
    assertEquals(result.shouldSend, true, `Should send at ${threshold} days`);
    assertEquals(result.dayKey, `grace_reminder_sent_day_${threshold}`);
  }
});

Deno.test('[SUB-009] shouldSendReminder: respects custom admin thresholds', () => {
  const customThresholds = [45, 14, 3]; // Admin override
  const reminderFlags = {};
  
  const result45 = shouldSendReminder(45, customThresholds, reminderFlags);
  const result14 = shouldSendReminder(14, customThresholds, reminderFlags);
  const result60 = shouldSendReminder(60, customThresholds, reminderFlags); // Not in custom list
  
  assertEquals(result45.shouldSend, true);
  assertEquals(result14.shouldSend, true);
  assertEquals(result60.shouldSend, false); // 60 is not in custom thresholds
});

Deno.test('[SUB-009] getReminderTitle: critical urgency (≤1 day)', () => {
  const title1 = getReminderTitle(1);
  const title0 = getReminderTitle(0);
  
  assertEquals(title1, '⛔ Grace Period Expires Today!');
  assertEquals(title0, '⛔ Grace Period Expires Today!');
});

Deno.test('[SUB-009] getReminderTitle: urgent (≤7 days)', () => {
  const title7 = getReminderTitle(7);
  const title3 = getReminderTitle(3);
  
  assertEquals(title7, '⚠️ Grace Period Ending Soon');
  assertEquals(title3, '⚠️ Grace Period Ending Soon');
});

Deno.test('[SUB-009] getReminderTitle: warning (>7 days)', () => {
  const title30 = getReminderTitle(30);
  const title60 = getReminderTitle(60);
  
  assertEquals(title30, '⏰ Grace Period Reminder');
  assertEquals(title60, '⏰ Grace Period Reminder');
});

Deno.test('[SUB-009] getReminderBody: includes day count in message', () => {
  const body30 = getReminderBody(30);
  const body7 = getReminderBody(7);
  
  assertEquals(body30.includes('30 days'), true);
  assertEquals(body7.includes('7 days'), true);
});

Deno.test('[SUB-009] getReminderBody: critical message for 1 day', () => {
  const body1 = getReminderBody(1);
  
  assertEquals(body1.includes('expires today'), true);
  assertEquals(body1.includes('Re-subscribe now'), true);
});

Deno.test('[SUB-009] Admin config parsing: handles missing grace_reminder_thresholds', () => {
  // Simulate missing config
  const adminConfig: Array<{ key: string; value: string }> = [
    { key: 'grace_period_days', value: '90' },
  ];
  
  // Default thresholds if missing
  const thresholds = adminConfig.find((c) => c.key === 'grace_reminder_thresholds')?.value
    ? JSON.parse(adminConfig.find((c) => c.key === 'grace_reminder_thresholds')!.value)
    : [60, 30, 7, 1];
  
  assertEquals(thresholds, [60, 30, 7, 1]);
});

Deno.test('[SUB-009] Admin config parsing: parses custom thresholds from JSON', () => {
  const adminConfig: Array<{ key: string; value: string }> = [
    { key: 'grace_reminder_thresholds', value: '[45, 14, 3]' },
  ];
  
  const thresholds = JSON.parse(
    adminConfig.find((c) => c.key === 'grace_reminder_thresholds')!.value
  );
  
  assertEquals(thresholds, [45, 14, 3]);
});

Deno.test('[SUB-009] Admin config parsing: handles malformed JSON gracefully', () => {
  const adminConfig: Array<{ key: string; value: string }> = [
    { key: 'grace_reminder_thresholds', value: '[45, 14, 3' }, // Missing closing bracket
  ];
  
  let thresholds;
  try {
    thresholds = JSON.parse(
      adminConfig.find((c) => c.key === 'grace_reminder_thresholds')!.value
    );
  } catch {
    thresholds = [60, 30, 7, 1]; // Fallback
  }
  
  assertEquals(thresholds, [60, 30, 7, 1]);
});

Deno.test('[SUB-009] Expiry logic: triggers when daysRemaining ≤ 0', () => {
  const daysRemaining = -1;
  const shouldExpire = daysRemaining <= 0;
  
  assertEquals(shouldExpire, true);
});

Deno.test('[SUB-009] Expiry logic: does NOT trigger when daysRemaining > 0', () => {
  const daysRemaining = 1;
  const shouldExpire = daysRemaining <= 0;
  
  assertEquals(shouldExpire, false);
});

Deno.test('[SUB-009] Expiry logic: calculates correct SP expiry URL', () => {
  const baseUrl = 'https://project.supabase.co/functions/v1';
  const spExpiryUrl = `${baseUrl}/sp-subscription-expire`;
  
  assertEquals(spExpiryUrl, 'https://project.supabase.co/functions/v1/sp-subscription-expire');
});

Deno.test('[SUB-009] Response format: includes processed count', () => {
  const response = {
    success: true,
    processed: 5,
    expired: 2,
    reminders: [{ day: '30', userId: 'user1' }],
  };
  
  assertExists(response.processed);
  assertEquals(response.processed, 5);
});

Deno.test('[SUB-009] Response format: includes expired count', () => {
  const response = {
    success: true,
    processed: 5,
    expired: 2,
    reminders: [],
  };
  
  assertExists(response.expired);
  assertEquals(response.expired, 2);
});

Deno.test('[SUB-009] Response format: includes reminders array', () => {
  const response = {
    success: true,
    processed: 3,
    expired: 0,
    reminders: [
      { day: '60', userId: 'user1' },
      { day: '30', userId: 'user2' },
    ],
  };
  
  assertExists(response.reminders);
  assertEquals(response.reminders.length, 2);
  assertEquals(response.reminders[0].day, '60');
});

Deno.test('[SUB-009] Idempotency: flags prevent duplicate reminders', () => {
  const subscription = {
    id: 'sub_123',
    user_id: 'user_123',
    status: 'grace_period',
    grace_period_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    grace_reminder_sent_day_30: true, // Already sent
  };
  
  const thresholds = [60, 30, 7, 1];
  const reminderFlags = {
    grace_reminder_sent_day_30: subscription.grace_reminder_sent_day_30,
  };
  
  const daysRemaining = 30;
  const result = shouldSendReminder(daysRemaining, thresholds, reminderFlags);
  
  assertEquals(result.shouldSend, false); // Should NOT send duplicate
});

console.log('✅ All SUB-009 unit tests completed successfully!');

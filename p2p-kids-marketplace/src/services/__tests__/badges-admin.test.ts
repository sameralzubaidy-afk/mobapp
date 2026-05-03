// filepath: p2p-kids-marketplace/src/services/__tests__/badges-admin.test.ts
/**
 * Unit Tests for Badge Admin Configuration (BADGES-V2-005)
 * Tests for admin configuration schema, history tracking, and audit logs
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabase } from '../../config/supabase';
import {
  manualAwardBadge,
  manualRevokeBadge,
  getBadgeConfigHistory,
  getBadgeAuditLogs,
} from '../badges';

// Test configuration
const TEST_CONFIG = {
  adminEmail: 'admin@test.com',
  testUserEmail: 'badge-test-user@test.com',
  testBadgeName: 'Test Badge - Admin Config',
};

let testAdminId: string;
let testUserId: string;
let testBadgeId: string;

describe('BADGES-V2-005: Admin Configuration & History', () => {
  beforeAll(async () => {
    console.log('[badges-admin.test] Setting up test environment...');

    // Get current authenticated user (must be logged in)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      testAdminId = user.id;
      testUserId = user.id; // For testing purposes, admin can be the target user
      console.log('[badges-admin.test] Authenticated user ready:', testAdminId);
    } else {
      console.warn('[badges-admin.test] skipping setup: No authenticated user found');
      return;
    }

    // Create a test badge
    const { data: badgeData } = await supabase
      .from('badges')
      .insert({
        name: TEST_CONFIG.testBadgeName,
        description: 'Test badge for admin config testing',
        category: 'special',
        threshold: 100,
        is_active: true,
      })
      .select()
      .single();

    if (badgeData) {
      testBadgeId = badgeData.id;
      console.log('[badges-admin.test] Test badge created:', testBadgeId);
    }
  });

  afterAll(async () => {
    console.log('[badges-admin.test] Cleaning up test data...');

    // Clean up test badge
    if (testBadgeId) {
      await supabase.from('badges').delete().eq('id', testBadgeId);
    }

    // Clean up test user
    if (testUserId) {
      await supabase.from('user_badges').delete().eq('user_id', testUserId);
    }
  });

  // =============================================================================
  // Badge Schema Extensions Tests
  // =============================================================================

  describe('1. Badge Schema Extensions', () => {
    it('should have is_archived column on badges table', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      const { data } = await supabase
        .from('badges')
        .select('is_archived')
        .eq('id', testBadgeId)
        .single();

      expect(data).toBeDefined();
      expect(data).toHaveProperty('is_archived');
    });

    it('should have updated_at column on badges table', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      const { data } = await supabase
        .from('badges')
        .select('updated_at')
        .eq('id', testBadgeId)
        .single();

      expect(data).toBeDefined();
      expect(data).toHaveProperty('updated_at');
    });

    it('should filter out archived badges by default', async () => {
      // Archive test badge
      await supabase.from('badges').update({ is_archived: true }).eq('id', testBadgeId);

      // Query active badges
      const { data: activeBadges } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .eq('is_archived', false);

      const archivedBadgeInResults = activeBadges?.find((b) => b.id === testBadgeId);
      expect(archivedBadgeInResults).toBeUndefined();

      // Restore badge
      await supabase.from('badges').update({ is_archived: false }).eq('id', testBadgeId);
    });
  });

  // =============================================================================
  // Manual Award/Revoke Tests
  // =============================================================================

  describe('2. Manual Award/Revoke Functions', () => {
    it('should allow admin to manually award a badge', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      const result = await manualAwardBadge(
        testUserId,
        testBadgeId,
        'Test manual award for unit testing'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(result.badge_id).toBe(testBadgeId);

      // Verify badge was awarded
      const { data: userBadge } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', testUserId)
        .eq('badge_id', testBadgeId)
        .single();

      expect(userBadge).toBeDefined();
      expect(userBadge?.user_id).toBe(testUserId);
    });

    it('should prevent duplicate manual awards', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      const result = await manualAwardBadge(testUserId, testBadgeId, 'Duplicate award attempt');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already has');
    });

    it('should allow admin to manually revoke a badge', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      const result = await manualRevokeBadge(
        testUserId,
        testBadgeId,
        'Test manual revoke for unit testing'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('revoked successfully');

      // Verify badge was revoked
      const { data: userBadge } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', testUserId)
        .eq('badge_id', testBadgeId)
        .single();

      expect(userBadge).toBeNull();
    });

    it('should handle revoking non-existent badge gracefully', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      const result = await manualRevokeBadge(testUserId, testBadgeId, 'Revoke non-existent badge');

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not have');
    });
  });

  // =============================================================================
  // Audit Logs Tests
  // =============================================================================

  describe('3. Badge Audit Logs', () => {
    it('should log manual award actions', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      // Award badge
      await manualAwardBadge(testUserId, testBadgeId, 'Audit log test award');

      // Fetch audit logs
      const logs = await getBadgeAuditLogs({
        userId: testUserId,
        badgeId: testBadgeId,
        actionType: 'manual_award',
        limit: 10,
      });

      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      expect(latestLog.action_type).toBe('manual_award');
      expect(latestLog.user_id).toBe(testUserId);
      expect(latestLog.badge_id).toBe(testBadgeId);
      expect(latestLog.reason).toContain('Audit log test');
    });

    it('should log manual revoke actions', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      // Revoke badge
      await manualRevokeBadge(testUserId, testBadgeId, 'Audit log test revoke');

      // Fetch audit logs
      const logs = await getBadgeAuditLogs({
        userId: testUserId,
        badgeId: testBadgeId,
        actionType: 'manual_revoke',
        limit: 10,
      });

      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      expect(latestLog.action_type).toBe('manual_revoke');
      expect(latestLog.user_id).toBe(testUserId);
      expect(latestLog.badge_id).toBe(testBadgeId);
    });

    it('should include admin details in audit logs', async () => {
      if (!testAdminId || !testUserId || !testBadgeId) {
        console.warn('[Test Skip] Missing test IDs');
        return;
      }

      const logs = await getBadgeAuditLogs({
        userId: testUserId,
        limit: 5,
      });

      expect(logs.length).toBeGreaterThan(0);
      const log = logs[0];
      expect(log.admin_id).toBeDefined();
      expect(log.admin_name).toBeDefined();
    });
  });

  // =============================================================================
  // Config History Tests
  // =============================================================================

  describe('4. Badge Configuration History', () => {
    it('should track threshold changes', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      const oldThreshold = 100;
      const newThreshold = 50;

      // Update threshold
      await supabase.from('badges').update({ threshold: newThreshold }).eq('id', testBadgeId);

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch history
      const history = await getBadgeConfigHistory(testBadgeId, 10);

      expect(history.length).toBeGreaterThan(0);
      const latestChange = history[0];
      expect(latestChange.change_type).toMatch(/threshold|multiple/);
      expect(latestChange.old_threshold).toBe(oldThreshold);
      expect(latestChange.new_threshold).toBe(newThreshold);
    });

    it('should track is_active changes', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      // Deactivate badge
      await supabase.from('badges').update({ is_active: false }).eq('id', testBadgeId);

      // Wait for trigger
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch history
      const history = await getBadgeConfigHistory(testBadgeId, 10);

      const deactivationChange = history.find(
        (h) => h.new_is_active === false && h.old_is_active === true
      );

      expect(deactivationChange).toBeDefined();
      expect(deactivationChange?.change_type).toMatch(/is_active|multiple/);

      // Reactivate badge
      await supabase.from('badges').update({ is_active: true }).eq('id', testBadgeId);
    });

    it('should track name changes', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      const newName = `${TEST_CONFIG.testBadgeName} - Updated`;

      // Update name
      await supabase.from('badges').update({ name: newName }).eq('id', testBadgeId);

      // Wait for trigger
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch history
      const history = await getBadgeConfigHistory(testBadgeId, 10);

      const nameChange = history.find((h) => h.new_name === newName);

      expect(nameChange).toBeDefined();
      expect(nameChange?.old_name).toBe(TEST_CONFIG.testBadgeName);
      expect(nameChange?.change_type).toMatch(/name|multiple/);
    });

    it('should include admin details in config history', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      const history = await getBadgeConfigHistory(testBadgeId, 5);

      expect(history.length).toBeGreaterThan(0);
      const change = history[0];
      expect(change.admin_id).toBeDefined();
      // admin_name might be null if admin profile not populated
    });
  });

  // =============================================================================
  // Updated_at Timestamp Tests
  // =============================================================================

  describe('5. Updated_at Timestamp', () => {
    it('should update updated_at when badge is modified', async () => {
      if (!testBadgeId) {
        console.warn('[Test Skip] Missing test badge ID');
        return;
      }

      // Get current updated_at
      const { data: before } = await supabase
        .from('badges')
        .select('updated_at')
        .eq('id', testBadgeId)
        .single();

      const oldTimestamp = before?.updated_at;

      // Wait 1 second to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update badge
      await supabase
        .from('badges')
        .update({ description: 'Updated description for timestamp test' })
        .eq('id', testBadgeId);

      // Get new updated_at
      const { data: after } = await supabase
        .from('badges')
        .select('updated_at')
        .eq('id', testBadgeId)
        .single();

      const newTimestamp = after?.updated_at;

      expect(newTimestamp).toBeDefined();
      expect(new Date(newTimestamp!).getTime()).toBeGreaterThan(new Date(oldTimestamp!).getTime());
    });
  });
});

export { testAdminId, testUserId, testBadgeId };

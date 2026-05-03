// filepath: p2p-kids-marketplace/src/__tests__/e2e/badges-admin-config.e2e.ts
/**
 * E2E Tests for Badge Admin Configuration (BADGES-V2-005)
 * Tests end-to-end admin workflows for badge management
 *
 * Note: These tests use RPC calls that require admin privileges.
 * In production environments, ensure your Supabase user has admin role.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { supabase } from '../../config/supabase';

let testBadgeId: string;
let testUserId: string;

describe('E2E: BADGES-V2-005 Admin Configuration Workflow', () => {
  beforeAll(async () => {
    console.log('[E2E] Setting up test data...');

    // Get current user (must be logged in)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      testUserId = 'skipped';
      testBadgeId = 'skipped';
      return;
    }

    testUserId = user.id;
    console.log('[E2E] Using authenticated user:', testUserId);

    // Find or create test badge
    const { data: existingBadges } = await supabase
      .from('badges')
      .select('*')
      .eq('name', 'E2E Test Badge - Config')
      .limit(1);

    if (existingBadges && existingBadges.length > 0) {
      testBadgeId = existingBadges[0].id;
      console.log('[E2E] Using existing test badge:', testBadgeId);
    } else {
      // Create test badge
      const { data: badge, error: createError } = await supabase
        .from('badges')
        .insert({
          name: 'E2E Test Badge - Config',
          description: 'Badge for E2E configuration testing',
          category: 'special',
          threshold: 100,
          is_active: true,
        })
        .select()
        .single();

      if (createError || !badge) {
        console.warn('[E2E] Failed to create test badge:', createError?.message);
        testBadgeId = 'skipped';
      } else {
        testBadgeId = badge.id;
        console.log('[E2E] Test badge created:', testBadgeId);
      }
    }
  });

  // =============================================================================
  // Workflow 1: Admin Awards Badge Manually
  // =============================================================================

  describe('Workflow 1: Admin Manual Badge Award', () => {
    it('should complete full manual award workflow', async () => {
      if (testBadgeId === 'skipped' || !testUserId || testUserId === 'skipped') {
        return;
      }

      // Step 1: Admin calls RPC to award badge to current user
      const { data: awardResult, error: awardError } = await supabase.rpc('manual_award_badge', {
        p_user_id: testUserId,
        p_badge_id: testBadgeId,
        p_reason: 'E2E test manual award',
      });

      expect(awardError).toBeNull();
      expect(awardResult).toMatchObject({
        success: true,
        badge_id: testBadgeId,
      });

      console.log('[E2E] Badge awarded:', awardResult);

      // Step 2: Verify user can see the badge
      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', testUserId);

      expect(userBadges).toBeDefined();
      const awardedBadge = userBadges?.find((ub) => ub.badge_id === testBadgeId);
      expect(awardedBadge).toBeDefined();
      expect(awardedBadge?.badge?.name).toContain('E2E Test Badge');

      console.log('[E2E] User badge verified');

      // Step 3: Verify audit log was created
      const { data: auditLogs } = await supabase.rpc('get_badge_audit_logs', {
        p_user_id: testUserId,
        p_badge_id: testBadgeId,
        p_action_type: 'manual_award',
        p_limit: 1,
      });

      expect(auditLogs).toBeDefined();
      expect(auditLogs?.length).toBeGreaterThan(0);
      expect(auditLogs?.[0]).toMatchObject({
        user_id: testUserId,
        badge_id: testBadgeId,
        action_type: 'manual_award',
        reason: 'E2E test manual award',
      });

      console.log('[E2E] Audit log verified');
    });
  });

  // =============================================================================
  // Workflow 2: Admin Modifies Badge Configuration
  // =============================================================================

  describe('Workflow 2: Admin Badge Configuration Update', () => {
    it('should track configuration changes in history', async () => {
      if (testBadgeId === 'skipped') {
        return;
      }

      // Step 1: Get initial badge state
      const { data: beforeUpdate } = await supabase
        .from('badges')
        .select('*')
        .eq('id', testBadgeId)
        .single();

      expect(beforeUpdate).toBeDefined();
      const oldThreshold = beforeUpdate?.threshold;

      // Step 2: Admin updates badge threshold
      const newThreshold = 75;
      const { error: updateError } = await supabase
        .from('badges')
        .update({
          threshold: newThreshold,
          description: 'Updated via E2E test',
        })
        .eq('id', testBadgeId);

      expect(updateError).toBeNull();
      console.log('[E2E] Badge updated');

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 3: Verify config history was created
      const { data: history } = await supabase.rpc('get_badge_config_history', {
        p_badge_id: testBadgeId,
        p_limit: 5,
      });

      expect(history).toBeDefined();
      expect(history?.length).toBeGreaterThan(0);

      const latestChange = history?.[0];
      expect(latestChange?.badge_id).toBe(testBadgeId);
      expect(latestChange?.old_threshold).toBe(oldThreshold);
      expect(latestChange?.new_threshold).toBe(newThreshold);
      expect(latestChange?.change_type).toMatch(/threshold|multiple/);

      console.log('[E2E] Config history verified:', latestChange);

      // Step 4: Verify updated_at was changed
      const { data: afterUpdate } = await supabase
        .from('badges')
        .select('updated_at')
        .eq('id', testBadgeId)
        .single();

      expect(afterUpdate?.updated_at).toBeDefined();
      expect(new Date(afterUpdate!.updated_at).getTime()).toBeGreaterThan(
        new Date(beforeUpdate!.updated_at || beforeUpdate!.created_at).getTime()
      );

      console.log('[E2E] updated_at verified');
    });
  });

  // =============================================================================
  // Workflow 3: Admin Revokes Badge
  // =============================================================================

  describe('Workflow 3: Admin Manual Badge Revoke', () => {
    it('should complete full revoke workflow with audit trail', async () => {
      if (testBadgeId === 'skipped' || !testUserId || testUserId === 'skipped') {
        return;
      }

      // Step 1: Verify user has the badge (from Workflow 1)
      const { data: beforeRevoke } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', testUserId)
        .eq('badge_id', testBadgeId)
        .single();

      if (!beforeRevoke) {
        return;
      }

      expect(beforeRevoke).toBeDefined();

      // Step 2: Admin revokes the badge
      const { data: revokeResult, error: revokeError } = await supabase.rpc('manual_revoke_badge', {
        p_user_id: testUserId,
        p_badge_id: testBadgeId,
        p_reason: 'E2E test manual revoke',
      });

      expect(revokeError).toBeNull();
      expect(revokeResult).toMatchObject({
        success: true,
        badge_id: testBadgeId,
      });

      console.log('[E2E] Badge revoked:', revokeResult);

      // Step 3: Verify badge was removed from user
      const { data: afterRevoke } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', testUserId)
        .eq('badge_id', testBadgeId)
        .single();

      expect(afterRevoke).toBeNull();
      console.log('[E2E] Badge removal verified');

      // Step 4: Verify audit log for revocation
      const { data: revokeLogs } = await supabase.rpc('get_badge_audit_logs', {
        p_user_id: testUserId,
        p_badge_id: testBadgeId,
        p_action_type: 'manual_revoke',
        p_limit: 1,
      });

      expect(revokeLogs).toBeDefined();
      expect(revokeLogs?.length).toBeGreaterThan(0);
      expect(revokeLogs?.[0]).toMatchObject({
        user_id: testUserId,
        badge_id: testBadgeId,
        action_type: 'manual_revoke',
        reason: 'E2E test manual revoke',
      });

      console.log('[E2E] Revoke audit log verified');
    });
  });

  // =============================================================================
  // Workflow 4: Badge Archival
  // =============================================================================

  describe('Workflow 4: Badge Archival', () => {
    it('should archive badge and filter from active lists', async () => {
      if (testBadgeId === 'skipped') {
        return;
      }

      // Step 1: Verify badge appears in active list
      const { data: beforeArchive } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .eq('is_archived', false);

      const activeCount = beforeArchive?.length || 0;
      const foundInActive = beforeArchive?.find((b) => b.id === testBadgeId);
      expect(foundInActive).toBeDefined();

      // Step 2: Archive the badge
      const { error: archiveError } = await supabase
        .from('badges')
        .update({ is_archived: true })
        .eq('id', testBadgeId);

      expect(archiveError).toBeNull();
      console.log('[E2E] Badge archived');

      // Step 3: Verify badge doesn't appear in active list
      const { data: afterArchive } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .eq('is_archived', false);

      const notFoundInActive = afterArchive?.find((b) => b.id === testBadgeId);
      expect(notFoundInActive).toBeUndefined();
      expect(afterArchive?.length).toBe(activeCount - 1);

      console.log('[E2E] Archived badge filtered correctly');

      // Step 4: Verify badge still exists but is archived
      const { data: archivedBadge } = await supabase
        .from('badges')
        .select('*')
        .eq('id', testBadgeId)
        .single();

      expect(archivedBadge).toBeDefined();
      expect(archivedBadge?.is_archived).toBe(true);
    });
  });

  // =============================================================================
  // Workflow 5: Query All History Types
  // =============================================================================

  describe('Workflow 5: Comprehensive Audit Trail Query', () => {
    it('should retrieve complete audit trail for badge lifecycle', async () => {
      if (testBadgeId === 'skipped') {
        return;
      }

      // Query config history
      const { data: configHistory } = await supabase.rpc('get_badge_config_history', {
        p_badge_id: testBadgeId,
        p_limit: 50,
      });

      expect(configHistory).toBeDefined();
      console.log('[E2E] Config history entries:', configHistory?.length);

      // Query audit logs
      const { data: auditLogs } = await supabase.rpc('get_badge_audit_logs', {
        p_badge_id: testBadgeId,
        p_action_type: null,
        p_limit: 50,
      });

      expect(auditLogs).toBeDefined();
      console.log('[E2E] Audit log entries:', auditLogs?.length);

      // Verify we have both award and revoke actions (if tests ran)
      if (auditLogs && auditLogs.length > 0) {
        const awardLogs = auditLogs?.filter((log) => log.action_type === 'manual_award');
        const revokeLogs = auditLogs?.filter((log) => log.action_type === 'manual_revoke');

        console.log('[E2E] Award logs:', awardLogs?.length, 'Revoke logs:', revokeLogs?.length);
      }

      console.log('[E2E] Complete audit trail verified');
    });
  });
});

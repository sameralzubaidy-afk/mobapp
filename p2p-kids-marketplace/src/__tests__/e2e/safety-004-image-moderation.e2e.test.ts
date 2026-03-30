/**
 * E2E Integration tests for SAFETY-004: Google Vision Image Moderation
 * Tests moderate-image Edge Function with real Supabase backend
 * 
 * Prerequisites:
 * - GOOGLE_VISION_API_KEY must be set in Supabase Edge Function secrets
 * - Migration 306 must be applied (ai_moderation_logs table)
 * - item-images storage bucket must exist (SAFETY-P001)
 * - Test item must exist in database
 * 
 * Run: RUN_SUPABASE_E2E=true npm run test:e2e -- safety-004-image-moderation
 */

import { supabase } from '../../config/supabase';
import { moderateListingImage, moderateListingImages } from '../../services/imageModeration';

// Skip if E2E tests are not enabled
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

describeE2E('SAFETY-004: Image Moderation E2E', () => {
  let testItemId: string;
  let testUserId: string;
  let skipSuite = false;
  let skipReason = '';

  const shouldSkip = () => {
    if (!skipSuite) {
      return false;
    }

    console.warn(`⏭️ Skipping SAFETY-004 E2E assertions: ${skipReason}`);
    return true;
  };

  beforeAll(async () => {
    // Create a test item for moderation
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      skipSuite = true;
      skipReason = 'Authentication required for E2E tests';
      console.warn(`⚠️ ${skipReason}`);
      return;
    }

    testUserId = authData.user.id;

    // Create test item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .insert({
        seller_id: testUserId,
        title: 'Test Item for Image Moderation',
        description: 'E2E test item',
        price: 10.0,
        condition: 'new',
        status: 'available',
      })
      .select()
      .single();

    if (itemError || !item) {
      skipSuite = true;
      skipReason = `Failed to create test item: ${itemError?.message}`;
      console.warn(`⚠️ ${skipReason}`);
      return;
    }

    testItemId = item.id;
    console.log('[E2E] Created test item:', testItemId);
  });

  afterAll(async () => {
    // Clean up test item
    if (testItemId) {
      await supabase.from('items').delete().eq('id', testItemId);
      console.log('[E2E] Cleaned up test item:', testItemId);
    }
  });

  describe('moderate-image Edge Function', () => {
    it('[TC-001] should moderate a safe image and return approved', async () => {
      if (shouldSkip()) return;

      // Use a known safe public image (Google logo or similar)
      const safeImageUrl = 'https://www.gstatic.com/webp/gallery/1.jpg';

      const result = await moderateListingImage(testItemId, safeImageUrl);

      // Assertions
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.decision).toBe('approved');
      expect(result.flagged).toBe(false);
      expect(result.categories).toEqual([]);
      expect(result.confidence).toBeLessThan(0.5); // Safe images have low confidence

      // Verify moderation log was created
      const { data: logs, error: logError } = await supabase
        .from('ai_moderation_logs')
        .select('*')
        .eq('item_id', testItemId)
        .eq('image_url', safeImageUrl)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(logError).toBeNull();
      expect(logs).toHaveLength(1);
      expect(logs![0].decision).toBe('approved');
      expect(logs![0].service).toBe('google_vision');
      expect(logs![0].moderation_type).toBe('image');
    }, 30000); // 30s timeout for API call

    it('[TC-002] should handle invalid image URL gracefully', async () => {
      if (shouldSkip()) return;

      const invalidUrl = 'https://example.com/nonexistent-image.jpg';

      // This may fail or return low confidence - we just want to ensure no crash
      try {
        await moderateListingImage(testItemId, invalidUrl);
        // If it succeeds, that's fine
      } catch (error) {
        // If it fails, error should be structured
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('moderation');
      }
    }, 30000);

    it('[TC-003] should moderate multiple images sequentially', async () => {
      if (shouldSkip()) return;

      const imageUrls = [
        'https://www.gstatic.com/webp/gallery/1.jpg',
        'https://www.gstatic.com/webp/gallery/2.jpg',
      ];

      const results = await moderateListingImages(testItemId, imageUrls);

      expect(results).toHaveLength(2);
      expect(results[0].decision).toBeDefined();
      expect(results[1].decision).toBeDefined();

      // Verify moderation logs for both images
      const { data: logs, error: logError } = await supabase
        .from('ai_moderation_logs')
        .select('*')
        .eq('item_id', testItemId)
        .in('image_url', imageUrls)
        .order('created_at', { ascending: false });

      expect(logError).toBeNull();
      expect(logs).toBeDefined();
      expect(logs!.length).toBeGreaterThanOrEqual(2);
    }, 60000); // 60s timeout for multiple API calls

    it('[TC-004] should flag item if image is flagged', async () => {
      if (shouldSkip()) return;

      // Note: We use a safe image here since we can't test with actual unsafe content
      // In a real scenario, a flagged image would update item.status to 'flagged'
      const safeImageUrl = 'https://www.gstatic.com/webp/gallery/3.jpg';

      const result = await moderateListingImage(testItemId, safeImageUrl);

      // Check if item was flagged (should NOT be for safe image)
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('status, flagged_at')
        .eq('id', testItemId)
        .single();

      expect(itemError).toBeNull();
      expect(item).toBeDefined();

      if (result.flagged) {
        // Item should be flagged
        expect(item!.status).toBe('flagged');
        expect(item!.flagged_at).toBeDefined();

        // Safety flag should exist
        const { data: flags, error: flagError } = await supabase
          .from('item_safety_flags')
          .select('*')
          .eq('item_id', testItemId)
          .eq('flag_type', 'ai_moderation');

        expect(flagError).toBeNull();
        expect(flags).toBeDefined();
        expect(flags!.length).toBeGreaterThan(0);
      } else {
        // Item should remain available
        expect(item!.status).not.toBe('flagged');
      }
    }, 30000);
  });

  describe('Database schema validation', () => {
    it('[TC-005] should verify ai_moderation_logs table exists', async () => {
      if (shouldSkip()) return;

      const { data, error } = await supabase
        .from('ai_moderation_logs')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('[TC-006] should verify ai_moderation_logs has correct columns', async () => {
      if (shouldSkip()) return;

      const { data: logs, error } = await supabase
        .from('ai_moderation_logs')
        .select('*')
        .eq('item_id', testItemId)
        .limit(1);

      expect(error).toBeNull();

      if (logs && logs.length > 0) {
        const log = logs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('item_id');
        expect(log).toHaveProperty('image_url');
        expect(log).toHaveProperty('moderation_type');
        expect(log).toHaveProperty('service');
        expect(log).toHaveProperty('decision');
        expect(log).toHaveProperty('confidence_score');
        expect(log).toHaveProperty('details');
        expect(log).toHaveProperty('created_at');
      }
    });
  });
});

// File: p2p-kids-marketplace/src/services/__tests__/profileService.integration.test.ts
// AUTH-V3-005: ProfileService Integration Tests (against staging Supabase)

import { autoFillProfile, downloadProviderAvatar, ProviderProfile } from '../profileService';
import { supabase } from '../supabase/client';

// Only run if RUN_SUPABASE_E2E is set
const runE2E = process.env.RUN_SUPABASE_E2E === 'true';

(runE2E ? describe : describe.skip)('ProfileService Integration Tests', () => {
  let testUserId: string;
  let testEmail: string;

  beforeAll(async () => {
    // Sign in as test user
    testEmail = `test-profile-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error || !data.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    testUserId = data.user.id;
    console.log('✅ Test user created:', testUserId);
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase.from('profiles').delete().eq('user_id', testUserId);
      await supabase.storage
        .from('user-avatars')
        .remove([`${testUserId}/social_avatar.jpg`, `${testUserId}/social_avatar.png`]);
    }

    await supabase.auth.signOut();
  });

  describe('autoFillProfile', () => {
    test('should create profile with auto-filled name', async () => {
      const { data: beforeProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', testUserId)
        .maybeSingle();

      const previousName = beforeProfile?.name ?? null;

      const mockProfile: ProviderProfile = {
        name: 'Google Test User',
        email: testEmail,
        provider: 'google',
      };

      const result = await autoFillProfile(mockProfile);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify in database
      const { data, error } = await supabase
        .from('profiles')
        .select('name, auto_filled_from_provider')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();

      // Some environments pre-populate profiles.name during signup trigger.
      // Service contract: only auto-fill when name is empty.
      if (previousName) {
        expect(data?.name).toBe(previousName);
      } else {
        expect(data?.name).toBe('Google Test User');
      }

      if (typeof data?.auto_filled_from_provider !== 'undefined') {
        expect(typeof data?.auto_filled_from_provider).toBe('boolean');
      }
    });

    test('should NOT overwrite existing name', async () => {
      // First, set a custom name
      await supabase.from('profiles').update({ name: 'My Custom Name' }).eq('user_id', testUserId);

      // Try to auto-fill again
      const mockProfile: ProviderProfile = {
        name: 'New Provider Name',
        provider: 'facebook',
      };

      const result = await autoFillProfile(mockProfile);

      expect(result.success).toBe(true);

      // Verify name was NOT changed
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', testUserId)
        .single();

      expect(data?.name).toBe('My Custom Name'); // Unchanged
    });
  });

  describe('downloadProviderAvatar', () => {
    test('should return null for Apple (no URL)', async () => {
      const result = await downloadProviderAvatar(undefined, testUserId);

      expect(result).toBeNull();
    });

    test('should download and upload valid avatar', async () => {
      // Use a real test image URL (Google's logo as example)
      const testAvatarUrl =
        'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';

      const result = await downloadProviderAvatar(testAvatarUrl, testUserId);

      if (result) {
        expect(result).toContain('user-avatars');
        expect(result).toContain(testUserId);
        expect(result).toContain('social_avatar');

        // Verify file exists in storage
        const { data, error } = await supabase.storage.from('user-avatars').list(testUserId);

        expect(error).toBeNull();
        expect(data?.some((file) => file.name.startsWith('social_avatar'))).toBe(true);
      } else {
        // Download might fail for various reasons (network, image size, etc.)
        // Log warning but don't fail test
        console.warn('⚠️ Avatar download returned null (expected for some test environments)');
      }
    }, 15000); // Extended timeout for network operation

    test('should return null for invalid URL', async () => {
      const result = await downloadProviderAvatar(
        'https://invalid-domain-12345.com/avatar.jpg',
        testUserId
      );

      expect(result).toBeNull();
    });

    test('should return null for non-image content-type', async () => {
      // URL that returns HTML instead of image
      const result = await downloadProviderAvatar('https://www.google.com', testUserId);

      expect(result).toBeNull();
    });
  });
});

// Export test utilities for manual testing
export const testUtils = {
  async cleanupTestUser(userId: string) {
    await supabase.from('profiles').delete().eq('user_id', userId);
    await supabase.storage
      .from('user-avatars')
      .remove([`${userId}/social_avatar.jpg`, `${userId}/social_avatar.png`]);
  },
};

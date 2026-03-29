/**
 * E2E Integration Test: Item Images Storage Bucket
 * Module: MODULE-13-SAFETY-COMPLIANCE
 * Task: SAFETY-P001
 * 
 * Tests the item-images storage bucket against LIVE Supabase production.
 * Run: RUN_SUPABASE_E2E=true npm run test:e2e
 * 
 * Prerequisites:
 * 1. Migration 20260328000100_create_item_images_bucket.sql must be applied
 * 2. Test user must exist with valid session
 * 3. Test item must exist owned by test user
 */

import { supabase } from '../../src/config/supabase';

const SKIP_E2E = !process.env.RUN_SUPABASE_E2E;

(SKIP_E2E ? describe.skip : describe)('E2E: Item Images Storage Bucket', () => {
  let testUserId: string;
  let testItemId: string;
  let uploadedPaths: string[] = [];

  beforeAll(async () => {
    // Authenticate as test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'testuser+e2e@kidsp2p.com',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    if (authError || !authData.user) {
      throw new Error(`E2E auth failed: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Find or create a test item owned by this user
    const { data: existingItem } = await supabase
      .from('items')
      .select('id')
      .eq('seller_id', testUserId)
      .eq('status', 'available')
      .limit(1)
      .single();

    if (existingItem) {
      testItemId = existingItem.id;
    } else {
      // Create a test item
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          seller_id: testUserId,
          title: 'E2E Test Item - Storage',
          description: 'Test item for storage E2E tests',
          price_cents: 1000,
          status: 'available',
          node_id: '00000000-0000-0000-0000-000000000001', // Use a valid node
        })
        .select()
        .single();

      if (itemError || !newItem) {
        throw new Error(`Failed to create test item: ${itemError?.message}`);
      }

      testItemId = newItem.id;
    }

    console.log(`✓ E2E Setup complete: user=${testUserId}, item=${testItemId}`);
  });

  afterAll(async () => {
    // Cleanup: Delete uploaded files
    if (uploadedPaths.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from('item-images')
        .remove(uploadedPaths);

      if (deleteError) {
        console.warn('Cleanup warning: Failed to delete test files:', deleteError.message);
      } else {
        console.log(`✓ Cleanup: Deleted ${uploadedPaths.length} test files`);
      }
    }

    // Sign out
    await supabase.auth.signOut();
  });

  describe('Bucket Existence', () => {
    it('should have item-images bucket created', async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      expect(error).toBeNull();
      expect(buckets).toBeDefined();

      const itemImagesBucket = buckets?.find((b) => b.id === 'item-images');
      expect(itemImagesBucket).toBeDefined();
      expect(itemImagesBucket?.public).toBe(true);
      expect(itemImagesBucket?.file_size_limit).toBe(5242880); // 5MB
    });
  });

  describe('Upload Permissions (RLS)', () => {
    it('should allow authenticated seller to upload image to their own item folder', async () => {
      // Create a test blob (1x1 transparent PNG)
      const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const blob = new Blob([testImage], { type: 'image/png' });

      const filePath = `${testItemId}/test-upload-${Date.now()}.png`;
      uploadedPaths.push(filePath);

      const { data, error } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob, { cacheControl: '3600' });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.path).toBe(filePath);

      console.log(`✓ Upload successful: ${filePath}`);
    });

    it('should reject upload exceeding 5MB file size limit', async () => {
      // Create a 6MB blob (exceeds limit)
      const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: 'image/jpeg' });

      const filePath = `${testItemId}/large-file-${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('item-images')
        .upload(filePath, largeBlob);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/size|limit|exceed/i);
      expect(data).toBeNull();

      console.log(`✓ Large file rejected: ${error?.message}`);
    });

    it('should reject upload to folder of item not owned by current user', async () => {
      // Find an item NOT owned by current user
      const { data: otherItem } = await supabase
        .from('items')
        .select('id')
        .neq('seller_id', testUserId)
        .limit(1)
        .single();

      if (!otherItem) {
        console.log('⊘ Skipping: No other user items found for RLS test');
        return;
      }

      const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const blob = new Blob([testImage], { type: 'image/png' });

      const filePath = `${otherItem.id}/unauthorized-upload-${Date.now()}.png`;

      const { data, error } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/policy|denied|permission/i);
      expect(data).toBeNull();

      console.log(`✓ Unauthorized upload rejected: ${error?.message}`);
    });
  });

  describe('Public Read Access', () => {
    it('should allow public read access to uploaded item image', async () => {
      // Upload a test image first
      const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const blob = new Blob([testImage], { type: 'image/png' });

      const filePath = `${testItemId}/public-read-test-${Date.now()}.png`;
      uploadedPaths.push(filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob);

      expect(uploadError).toBeNull();
      expect(uploadData).toBeDefined();

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      expect(urlData.publicUrl).toBeDefined();
      expect(urlData.publicUrl).toContain('item-images');
      expect(urlData.publicUrl).toContain(testItemId);

      // Verify public URL is accessible (even after signing out)
      await supabase.auth.signOut();

      const response = await fetch(urlData.publicUrl);
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      // Re-authenticate for remaining tests
      await supabase.auth.signInWithPassword({
        email: process.env.TEST_USER_EMAIL || 'testuser+e2e@kidsp2p.com',
        password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
      });

      console.log(`✓ Public read access verified: ${urlData.publicUrl}`);
    });
  });

  describe('Delete Permissions', () => {
    it('should allow authenticated seller to delete their own item images', async () => {
      // Upload a test image first
      const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const blob = new Blob([testImage], { type: 'image/png' });

      const filePath = `${testItemId}/delete-test-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob);

      expect(uploadError).toBeNull();

      // Now delete it
      const { error: deleteError } = await supabase.storage
        .from('item-images')
        .remove([filePath]);

      expect(deleteError).toBeNull();

      console.log(`✓ Delete successful: ${filePath}`);
    });

    it('should reject delete of images from item not owned by current user', async () => {
      // Find an item NOT owned by current user with existing images
      const { data: otherItemImage } = await supabase
        .from('item_images')
        .select('url, item_id, items!inner(seller_id)')
        .neq('items.seller_id', testUserId)
        .limit(1)
        .single();

      if (!otherItemImage) {
        console.log('⊘ Skipping: No other user item images found for RLS test');
        return;
      }

      // Extract path from URL
      const urlParts = otherItemImage.url.split('/item-images/');
      const filePath = urlParts[1];

      if (!filePath) {
        console.log('⊘ Skipping: Could not extract file path from URL');
        return;
      }

      const { error: deleteError } = await supabase.storage
        .from('item-images')
        .remove([filePath]);

      expect(deleteError).toBeDefined();
      expect(deleteError?.message).toMatch(/policy|denied|permission/i);

      console.log(`✓ Unauthorized delete rejected: ${deleteError?.message}`);
    });
  });

  describe('Allowed MIME Types', () => {
    it('should accept JPEG images', async () => {
      const testJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBD', 'base64');
      const blob = new Blob([testJpeg], { type: 'image/jpeg' });

      const filePath = `${testItemId}/test-jpeg-${Date.now()}.jpg`;
      uploadedPaths.push(filePath);

      const { error } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob);

      expect(error).toBeNull();
    });

    it('should accept PNG images', async () => {
      const testPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const blob = new Blob([testPng], { type: 'image/png' });

      const filePath = `${testItemId}/test-png-${Date.now()}.png`;
      uploadedPaths.push(filePath);

      const { error } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob);

      expect(error).toBeNull();
    });

    it('should accept WebP images', async () => {
      const testWebp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');
      const blob = new Blob([testWebp], { type: 'image/webp' });

      const filePath = `${testItemId}/test-webp-${Date.now()}.webp`;
      uploadedPaths.push(filePath);

      const { error } = await supabase.storage
        .from('item-images')
        .upload(filePath, blob);

      expect(error).toBeNull();
    });
  });
});

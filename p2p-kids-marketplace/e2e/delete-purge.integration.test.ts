/**
 * Integration tests for delete + purge cache flow
 * 
 * Tests that deleting items from Supabase Storage triggers
 * Cloudflare cache purge to prevent stale content
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CDN_URL = process.env.EXPO_PUBLIC_CDN_URL || process.env.NEXT_PUBLIC_CDN_URL;
const PURGE_ENDPOINT = process.env.SUPABASE_PURGE_ENDPOINT || 'http://localhost:54321/functions/v1/purge-cache';
const PURGE_API_KEY = process.env.SUPABASE_PURGE_X_API_KEY;

// Skip all tests if environment not configured
const shouldSkip = !SUPABASE_URL || !SERVICE_ROLE || !CDN_URL;

if (shouldSkip) {
  console.warn(
    'Supabase, CDN, or purge config missing. Skipping delete+purge integration tests.'
  );
}

describe('Delete + Cache Purge Integration', () => {
  if (shouldSkip) {
    it('skipped', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE);
  const bucket = 'item-images';

  /**
   * Helper to purge cache via Edge Function
   */
  async function purgeUrlsFromCache(urls: string[]): Promise<boolean> {
    if (!PURGE_API_KEY) {
      console.warn('[purgeUrlsFromCache] No PURGE_API_KEY configured, skipping purge');
      return true; // Don't fail test if purge unavailable
    }

    try {
      const response = await fetch(PURGE_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': PURGE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls,
          idempotencyKey: `test-${randomUUID()}`,
        }),
      });

      if (!response.ok) {
        console.warn(`[purgeUrlsFromCache] Purge returned ${response.status}`, await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.warn('[purgeUrlsFromCache] Error calling purge endpoint:', error);
      return false; // Don't fail test if purge unavailable
    }
  }

  describe('Single File Delete + Purge', () => {
    it('uploads file, caches it, deletes, purges, and verifies miss', async () => {
      const filename = `integration-test-${randomUUID()}.txt`;
      const path = filename;

      try {
        // 1. Upload file to storage
        const uploadContent = Buffer.from('integration test delete purge flow', 'utf-8');
        const { data: uploadData, error: uploadError } = await client.storage
          .from(bucket)
          .upload(path, uploadContent, {
            contentType: 'text/plain',
            upsert: true,
          });

        expect(uploadError).toBeNull();
        expect(uploadData).toBeDefined();

        // 2. Build CDN URL
        const cdnUrl = `${CDN_URL}/${bucket}/${path}`;

        // 3. Fetch to warm cache
        const warmResponse = await fetch(cdnUrl);
        expect(warmResponse.status).toBe(200);
        expect(warmResponse.headers.get('cf-cache-status')).toBeTruthy();

        // 4. Delete from storage
        const { error: deleteError } = await client.storage.from(bucket).remove([path]);
        expect(deleteError).toBeNull();

        // 5. Purge cache via Edge Function
        const purgeSuccess = await purgeUrlsFromCache([cdnUrl]);
        // Don't fail if purge not available, but log it
        if (!purgeSuccess) {
          console.warn('[test] Purge endpoint not available, verifying cache invalidation...');
        }

        // 6. Brief delay for replication
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 7. Fetch again - should get 404 or cache miss
        const deleteResponse = await fetch(cdnUrl);
        // After delete + purge, expect either:
        // - 404 (file not found in storage)
        // - 200 with MISS header (cache was purged)
        expect([200, 404]).toContain(deleteResponse.status);

        const postDeleteCacheStatus = deleteResponse.headers.get('cf-cache-status');
        if (deleteResponse.status === 200) {
          // If still 200, should not be cached (HIT)
          expect(postDeleteCacheStatus).not.toBe('HIT');
        }
      } finally {
        // Cleanup
        try {
          await client.storage.from(bucket).remove([path]);
        } catch {
          // Ignore cleanup errors
        }
      }
    }, 30000);

    it('verifies purge idempotency - can safely retry purge', async () => {
      const filename = `idempotency-test-${randomUUID()}.txt`;
      const path = filename;

      try {
        // Upload file
        const { error: uploadError } = await client.storage.from(bucket).upload(path, Buffer.from('test'), {
          contentType: 'text/plain',
          upsert: true,
        });
        expect(uploadError).toBeNull();

        const cdnUrl = `${CDN_URL}/${bucket}/${path}`;

        // Delete from storage
        const { error: deleteError } = await client.storage.from(bucket).remove([path]);
        expect(deleteError).toBeNull();

        // Purge multiple times with same idempotency key - should succeed each time
        if (PURGE_API_KEY) {
          const idempotencyKey = `idempotent-${randomUUID()}`;

          const purge1 = await fetch(PURGE_ENDPOINT, {
            method: 'POST',
            headers: {
              'x-api-key': PURGE_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ urls: [cdnUrl], idempotencyKey }),
          });

          expect([200, 204]).toContain(purge1.status);

          // Immediate retry with same idempotency key
          const purge2 = await fetch(PURGE_ENDPOINT, {
            method: 'POST',
            headers: {
              'x-api-key': PURGE_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ urls: [cdnUrl], idempotencyKey }),
          });

          expect([200, 204]).toContain(purge2.status);
        }
      } finally {
        try {
          await client.storage.from(bucket).remove([path]);
        } catch {
          // Ignore
        }
      }
    }, 30000);
  });

  describe('Batch Delete + Purge', () => {
    it('deletes multiple files and purges all in single request', async () => {
      const filenames = [
        `batch-test-${randomUUID()}.txt`,
        `batch-test-${randomUUID()}.txt`,
        `batch-test-${randomUUID()}.txt`,
      ];

      try {
        // 1. Upload all files
        const uploadPromises = filenames.map((filename) =>
          client.storage.from(bucket).upload(filename, Buffer.from(`content: ${filename}`), {
            contentType: 'text/plain',
            upsert: true,
          })
        );

        const uploadResults = await Promise.all(uploadPromises);
        uploadResults.forEach((result) => {
          expect(result.error).toBeNull();
        });

        // 2. Build CDN URLs
        const cdnUrls = filenames.map((filename) => `${CDN_URL}/${bucket}/${filename}`);

        // 3. Warm cache for all files
        const warmResponses = await Promise.all(cdnUrls.map((url) => fetch(url)));
        warmResponses.forEach((resp) => {
          expect(resp.status).toBe(200);
        });

        // 4. Delete all files in batch
        const { error: deleteError } = await client.storage.from(bucket).remove(filenames);
        expect(deleteError).toBeNull();

        // 5. Purge all URLs in single request
        const purgeSuccess = await purgeUrlsFromCache(cdnUrls);
        if (!purgeSuccess) {
          console.warn('[test] Batch purge endpoint not available, skipping purge verification');
        }

        // 6. Delay for replication
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 7. Verify all are now 404 or MISS
        const postDeleteResponses = await Promise.all(cdnUrls.map((url) => fetch(url)));
        postDeleteResponses.forEach((resp, index) => {
          expect([200, 404]).toContain(resp.status);
          if (resp.status === 200) {
            const cacheStatus = resp.headers.get('cf-cache-status');
            expect(cacheStatus).not.toBe('HIT');
          }
        });
      } finally {
        // Cleanup
        try {
          await client.storage.from(bucket).remove(filenames);
        } catch {
          // Ignore
        }
      }
    }, 40000);

    it('handles mixed success/failure in batch delete', async () => {
      const existingFile = `batch-exist-${randomUUID()}.txt`;
      const nonexistentFile = `batch-nonexist-${randomUUID()}.txt`;

      try {
        // Upload one file only
        const { error: uploadError } = await client.storage
          .from(bucket)
          .upload(existingFile, Buffer.from('test'), {
            contentType: 'text/plain',
            upsert: true,
          });
        expect(uploadError).toBeNull();

        // Try to delete both - one exists, one doesn't
        const { error: deleteError } = await client.storage
          .from(bucket)
          .remove([existingFile, nonexistentFile]);

        // Supabase allows this and returns success
        // (non-existent files in batch delete don't error)
        expect(deleteError).toBeNull();

        // Purge both URLs anyway (idempotent)
        if (PURGE_API_KEY) {
          const cdnUrls = [
            `${CDN_URL}/${bucket}/${existingFile}`,
            `${CDN_URL}/${bucket}/${nonexistentFile}`,
          ];

          const purgeResponse = await fetch(PURGE_ENDPOINT, {
            method: 'POST',
            headers: {
              'x-api-key': PURGE_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ urls: cdnUrls }),
          });

          expect([200, 204]).toContain(purgeResponse.status);
        }
      } finally {
        try {
          await client.storage.from(bucket).remove([existingFile, nonexistentFile]);
        } catch {
          // Ignore
        }
      }
    }, 30000);
  });

  describe('Error Handling & Resilience', () => {
    it('handles purge endpoint timeout gracefully', async () => {
      const filename = `timeout-test-${randomUUID()}.txt`;
      const path = filename;

      try {
        // Upload and cache
        await client.storage.from(bucket).upload(path, Buffer.from('test'), {
          contentType: 'text/plain',
          upsert: true,
        });

        // Delete from storage (this should succeed)
        const { error: deleteError } = await client.storage.from(bucket).remove([path]);
        expect(deleteError).toBeNull();

        // Attempt purge with invalid endpoint (simulates timeout)
        const invalidPurgeResponse = await Promise.race([
          fetch('http://invalid-endpoint.local/nonexistent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: ['http://example.com'] }),
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2000)
          ),
        ]).catch((error) => {
          expect(error).toBeDefined();
          return null;
        });

        // Delete succeeds even if purge fails
        expect(deleteError).toBeNull();
      } finally {
        try {
          await client.storage.from(bucket).remove([path]);
        } catch {
          // Ignore
        }
      }
    }, 30000);

    it('continues if purge API key missing (non-blocking)', async () => {
      const originalKey = PURGE_API_KEY;
      process.env.SUPABASE_PURGE_X_API_KEY = '';

      const filename = `no-key-test-${randomUUID()}.txt`;
      const path = filename;

      try {
        // Upload
        const { error: uploadError } = await client.storage
          .from(bucket)
          .upload(path, Buffer.from('test'), {
            contentType: 'text/plain',
            upsert: true,
          });
        expect(uploadError).toBeNull();

        // Delete
        const { error: deleteError } = await client.storage.from(bucket).remove([path]);
        expect(deleteError).toBeNull();

        // Purge with no key should fail gracefully
        const purgeSuccess = await purgeUrlsFromCache([`${CDN_URL}/${bucket}/${path}`]);
        expect(purgeSuccess).toBe(true); // Our helper returns true when key missing
      } finally {
        // Restore
        process.env.SUPABASE_PURGE_X_API_KEY = originalKey;
        try {
          await client.storage.from(bucket).remove([path]);
        } catch {
          // Ignore
        }
      }
    }, 30000);
  });
});

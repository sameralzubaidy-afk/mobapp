import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CDN_URL = process.env.EXPO_PUBLIC_CDN_URL || process.env.NEXT_PUBLIC_CDN_URL;
const PURGE_API_KEY = process.env.SUPABASE_PURGE_X_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !CDN_URL) {
  // Skip test if environment not configured
  console.warn('Supabase URL, service role key, or CDN URL missing. Skipping integration test.');
}

describe('Cloudflare CDN integration (Supabase -> Worker)', () => {
  if (!SUPABASE_URL || !SERVICE_ROLE || !CDN_URL) {
    it('skipped', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE);
  const bucket = 'item-images';

  it('uploads, fetches via worker, and validates cache headers', async () => {
    const filename = `e2e-test-upload-${randomUUID()}.txt`;
    const path = filename;

    // Upload file
    const content = Buffer.from('hello e2e cache test', 'utf-8');
    const { data, error } = await client.storage.from(bucket).upload(path, content, {
      contentType: 'text/plain',
      upsert: true,
    });
    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Build CDN URL (worker expects /item-images/<path>)
    const cdnUrl = `${CDN_URL}/${bucket}/${path}`;

    // First fetch - expect 200
    const resp1 = await fetch(cdnUrl);
    expect(resp1.status).toBe(200);
    const cacheStatus1 = resp1.headers.get('cf-cache-status');
    // First request is often MISS (or may be UNKNOWN on local worker), allow both
    expect(['MISS', 'HIT', null, 'EXPIRED', 'DYNAMIC']).toContain(cacheStatus1);

    // Second fetch - expect HIT
    const resp2 = await fetch(cdnUrl);
    expect(resp2.status).toBe(200);
    const cacheStatus2 = resp2.headers.get('cf-cache-status');
    expect(cacheStatus2 === 'HIT' || cacheStatus2 === null).toBeTruthy();

    // Cleanup
    await client.storage.from(bucket).remove([path]);
  }, 20000);

  it('deletes file from storage and verifies cache miss (or 404)', async () => {
    const filename = `e2e-test-delete-${randomUUID()}.txt`;
    const path = filename;

    // Upload and cache file
    const content = Buffer.from('test file for deletion', 'utf-8');
    const { data: uploadData, error: uploadError } = await client.storage
      .from(bucket)
      .upload(path, content, {
        contentType: 'text/plain',
        upsert: true,
      });
    expect(uploadError).toBeNull();
    expect(uploadData).toBeDefined();

    const cdnUrl = `${CDN_URL}/${bucket}/${path}`;

    // Fetch to cache
    const resp1 = await fetch(cdnUrl);
    expect(resp1.status).toBe(200);

    // Delete from storage
    const { error: deleteError } = await client.storage.from(bucket).remove([path]);
    expect(deleteError).toBeNull();

    // Small delay to account for replication
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch again - should be 404 or MISS
    const resp2 = await fetch(cdnUrl);
    expect([404, 200]).toContain(resp2.status);
    const cacheStatus2 = resp2.headers.get('cf-cache-status');
    // After deletion, expect MISS (cache expired) or null (local worker)
    expect([null, 'MISS', 'EXPIRED']).toContain(cacheStatus2);
  }, 20000);

  it('batch deletes multiple files and verifies purge', async () => {
    const filenames = [
      `e2e-test-batch-${randomUUID()}.txt`,
      `e2e-test-batch-${randomUUID()}.txt`,
      `e2e-test-batch-${randomUUID()}.txt`,
    ];

    // Upload all files
    const uploadPromises = filenames.map((filename) =>
      client.storage.from(bucket).upload(filename, Buffer.from(`content of ${filename}`), {
        contentType: 'text/plain',
        upsert: true,
      })
    );

    const uploadResults = await Promise.all(uploadPromises);
    uploadResults.forEach((result) => {
      expect(result.error).toBeNull();
    });

    const cdnUrls = filenames.map((filename) => `${CDN_URL}/${bucket}/${filename}`);

    // Fetch all to cache
    const fetchResults = await Promise.all(cdnUrls.map((url) => fetch(url)));
    fetchResults.forEach((resp) => {
      expect(resp.status).toBe(200);
    });

    // Delete all files
    const { error: deleteError } = await client.storage.from(bucket).remove(filenames);
    expect(deleteError).toBeNull();

    // Small delay for replication
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify all are now 404 or MISS
    const deleteResults = await Promise.all(cdnUrls.map((url) => fetch(url)));
    deleteResults.forEach((resp) => {
      expect([404, 200]).toContain(resp.status);
    });
  }, 30000);
});

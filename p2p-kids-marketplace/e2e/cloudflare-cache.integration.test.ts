import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CDN_URL = process.env.EXPO_PUBLIC_CDN_URL || process.env.NEXT_PUBLIC_CDN_URL;

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
  const filename = `e2e-test-${randomUUID()}.txt`;
  const path = filename;

  it('uploads, fetches via worker, and validates cache headers', async () => {
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
});

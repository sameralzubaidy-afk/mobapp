import { serve } from 'std/server';
import { validatePurgeRequest, type PurgeResponse } from '../_shared/purge-validator.ts';

/**
 * Supabase Edge Function to purge Cloudflare cache.
 * Admin-only operation protected by x-api-key header.
 * 
 * Request:
 * POST /functions/v1/purge-cache
 * Headers: x-api-key: <SUPABASE_PURGE_X_API_KEY>
 * Body: { urls: ["https://...", ...] }
 * 
 * Response:
 * 200: { success: true, files_purged: N }
 * 400: { error: "Invalid payload" }
 * 401: { error: "Unauthorized" }
 * 500: { error: "Server error" }
 */

const EXPECTED_API_KEY = Deno.env.get('SUPABASE_PURGE_X_API_KEY');
const CF_API_TOKEN = Deno.env.get('CF_API_TOKEN');
const CF_ZONE_ID = Deno.env.get('CF_ZONE_ID');

serve(async (req): Promise<Response> => {
  // Only allow POST
  if (req.method !== 'POST') {
    const response: PurgeResponse = { success: false, error: 'Method not allowed' };
    return new Response(JSON.stringify(response), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify API key (x-api-key header)
    const providedKey = req.headers.get('x-api-key');
    if (!providedKey || providedKey !== EXPECTED_API_KEY) {
      console.warn('[PURGE-CACHE] Unauthorized: Invalid or missing API key');
      const response: PurgeResponse = { success: false, error: 'Unauthorized: Invalid API key' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate Cloudflare secrets are configured
    if (!CF_API_TOKEN || !CF_ZONE_ID) {
      console.error('[PURGE-CACHE] Cloudflare secrets not configured');
      const response: PurgeResponse = {
        success: false,
        error: 'Internal Server Error: CF secrets not configured',
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Parse and validate request payload
    const body = await req.json();
    const purgeRequest = validatePurgeRequest(body);
    const { urls, idempotencyKey } = purgeRequest;

    console.log(
      `[PURGE-CACHE] Purging ${urls.length} URL(s)${
        idempotencyKey ? ` (idempotency: ${idempotencyKey})` : ''
      }`
    );

    // 4. Call Cloudflare purge API
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    const cfData = await cfResponse.json() as Record<string, unknown>;

    // 5. Handle Cloudflare API response
    if (!cfResponse.ok) {
      console.error(`[PURGE-CACHE] CF API error: ${cfResponse.status}`, cfData);
      const response: PurgeResponse = {
        success: false,
        error: 'Failed to purge cache',
        details: cfData.errors || cfData.error,
      };
      return new Response(JSON.stringify(response), {
        status: cfResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PURGE-CACHE] Successfully purged ${urls.length} URL(s)`);

    const response: PurgeResponse = {
      success: true,
      files_purged: urls.length,
      details: cfData,
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[PURGE-CACHE] Unexpected error:', error);
    const response: PurgeResponse = {
      success: false,
      error: 'Internal Server Error',
      details: error,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

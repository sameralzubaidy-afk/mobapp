/**
 * FILE: supabase/functions/batch-analyze-items/index.ts
 * MODULE: MODULE-04-ITEM-LISTING-V3
 * TASK: LISTING-V3-002 - Batch AI Image Analysis Edge Function
 * 
 * Parallelizes multiple calls to analyze-item-image with:
 * - Max concurrency: 5 concurrent requests
 * - Per-item timeout: 10 seconds
 * - Partial failure tolerance: failed items don't block successful ones
 * 
 * Uses Promise.allSettled + semaphore pattern for controlled parallelism.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { 
  BatchAnalyzeRequest,
  BatchAnalyzeResponse,
  AIAnalysisResult 
} from '../_shared/aiTypes.ts';

const ANALYZE_IMAGE_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/analyze-item-image';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const MAX_CONCURRENCY = 5;
const TIMEOUT_MS = 20_000; // 20 seconds per item

type DownstreamAuthHeaders = {
  authorization: string;
  apikey: string;
};

function normalizeAuthorizationHeader(value: string | null): string | null {
  if (!value) return null;
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
}

function getDownstreamAuthHeaders(req: Request): DownstreamAuthHeaders {
  const incomingAuthorization = normalizeAuthorizationHeader(req.headers.get('authorization'));
  const incomingApiKey = req.headers.get('apikey');

  const fallbackAuthorization = normalizeAuthorizationHeader(SUPABASE_SERVICE_ROLE_KEY);
  const fallbackApiKey = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY ?? null;

  const authorization = incomingAuthorization ?? fallbackAuthorization;
  const apikey = incomingApiKey ?? fallbackApiKey;

  if (!authorization || !apikey) {
    throw new Error(
      'Missing downstream auth headers for analyze-item-image call. Provide Authorization/apikey on request or set SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return { authorization, apikey };
}

/**
 * Semaphore to limit concurrent operations
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}

/**
 * Analyze a single item with timeout
 */
async function analyzeItemWithTimeout(
  groupId: string,
  primaryPhotoUrl: string,
  sellerId: string,
  timeoutMs: number,
  authHeaders: DownstreamAuthHeaders
): Promise<{ groupId: string; analysis?: AIAnalysisResult; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANALYZE_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeaders.authorization,
        'apikey': authHeaders.apikey
      },
      body: JSON.stringify({
        photoUrl: primaryPhotoUrl,
        sellerId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analysis failed: ${response.status} ${errorText}`);
    }

    const analysis: AIAnalysisResult = await response.json();

    return { groupId, analysis };

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error(`[batch-analyze-items] Timeout for item ${groupId}`);
      return { groupId, error: 'timeout' };
    }

    console.error(`[batch-analyze-items] Error analyzing item ${groupId}:`, error);
    return { groupId, error: error.message || 'Analysis failed' };
  }
}

/**
 * Process items with semaphore-controlled concurrency
 */
async function analyzeItemsBatch(
  items: Array<{ groupId: string; primaryPhotoUrl: string; allPhotoUrls?: string[] }>,
  sellerId: string,
  maxConcurrency: number,
  timeoutMs: number,
  authHeaders: DownstreamAuthHeaders
): Promise<Array<{ groupId: string; analysis?: AIAnalysisResult; error?: string }>> {
  const semaphore = new Semaphore(maxConcurrency);
  
  const tasks = items.map(async (item) => {
    await semaphore.acquire();
    
    try {
      const result = await analyzeItemWithTimeout(
        item.groupId,
        item.primaryPhotoUrl,
        sellerId,
        timeoutMs,
        authHeaders
      );
      return result;
    } finally {
      semaphore.release();
    }
  });

  // Promise.allSettled ensures all items complete (success or failure)
  const results = await Promise.allSettled(tasks);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // This shouldn't happen since we catch errors in analyzeItemWithTimeout,
      // but handle it defensively
      console.error(`[batch-analyze-items] Unexpected rejection for item ${items[index].groupId}:`, result.reason);
      return {
        groupId: items[index].groupId,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  try {
    const downstreamAuthHeaders = getDownstreamAuthHeaders(req);
    const { items, sellerId }: BatchAnalyzeRequest = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid items array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!sellerId) {
      return new Response(
        JSON.stringify({ error: 'Missing sellerId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate items structure
    for (const item of items) {
      if (!item.groupId || !item.primaryPhotoUrl) {
        return new Response(
          JSON.stringify({ error: 'Each item must have groupId and primaryPhotoUrl' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[batch-analyze-items] Processing ${items.length} items for seller ${sellerId}`);
    console.log(`[batch-analyze-items] Max concurrency: ${MAX_CONCURRENCY}, Timeout: ${TIMEOUT_MS}ms`);

    const startTime = Date.now();

    // Process items with controlled concurrency
    const results = await analyzeItemsBatch(
      items,
      sellerId,
      MAX_CONCURRENCY,
      TIMEOUT_MS,
      downstreamAuthHeaders
    );

    const totalProcessed = results.length;
    const totalFailed = results.filter(r => r.error).length;
    const totalSuccess = results.filter(r => r.analysis).length;

    const duration = Date.now() - startTime;

    console.log(`[batch-analyze-items] Completed in ${duration}ms: ${totalSuccess} success, ${totalFailed} failed`);

    const response: BatchAnalyzeResponse = {
      results,
      totalProcessed,
      totalFailed
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error: any) {
    console.error('[batch-analyze-items] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        results: [],
        totalProcessed: 0,
        totalFailed: 0
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
});

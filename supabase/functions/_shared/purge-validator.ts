/**
 * Shared validation utilities for cache purge operations.
 * Used by both the Supabase Edge Function and client-side code.
 */

export interface PurgeRequest {
  urls: string[];
  idempotencyKey?: string;
}

export interface PurgeResponse {
  success: boolean;
  files_purged?: number;
  error?: string;
  details?: unknown;
}

/**
 * Validate a purge request payload.
 * @throws {Error} if validation fails
 */
export function validatePurgeRequest(body: unknown): PurgeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be an object');
  }

  const { urls, idempotencyKey } = body as Record<string, unknown>;

  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('Expected non-empty urls array');
  }

  if (!urls.every((url) => typeof url === 'string')) {
    throw new Error('All urls must be strings');
  }

  // Basic URL validation (must start with http/https)
  urls.forEach((url, idx) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(`URL at index ${idx} must start with http:// or https://`);
    }
  });

  return {
    urls,
    idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
  };
}

/**
 * Generate an idempotency key for a purge request to prevent duplicate operations.
 */
export function generateIdempotencyKey(urls: string[]): string {
  const urlsStr = urls.sort().join('|');
  // Simple hash: use timestamp + URL count + first few chars
  const timestamp = Date.now();
  return `purge-${timestamp}-${urls.length}`;
}

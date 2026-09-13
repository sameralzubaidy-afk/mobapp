// File: p2p-kids-marketplace/src/utils/withTimeout.ts
/**
 * Bounded promise wait.
 *
 * FIX-Task-26 item 5 (2026-09-13) — QA Phase 0 F6: the Review Offer screen had no
 * upper bound on its data fetch, so a stalled request left the user on a bare
 * spinner with no way forward but Back (the 2026-09-13 staging outage made that a
 * 60s+ dead end). The repo already had several module-local `Promise.race`
 * variants (`aiService`, `AuthContext`, `profileService`, `oauthService`); this is
 * the shared implementation new code should use.
 *
 * The timeout only rejects the WAIT — it cannot cancel the underlying request, so
 * callers must treat it as "unknown outcome, safe to retry", never as "it failed".
 */

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Resolves with `thenable`'s value, or rejects with `TimeoutError` after `timeoutMs`. */
export function withTimeout<T>(
  thenable: PromiseLike<T>,
  timeoutMs: number,
  message = 'Request timed out'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);

    thenable.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** True when an error came from `withTimeout` rather than the request itself. */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof TimeoutError || (error as { name?: string } | null)?.name === 'TimeoutError';
}

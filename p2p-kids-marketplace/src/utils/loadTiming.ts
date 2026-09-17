/**
 * File: p2p-kids-marketplace/src/utils/loadTiming.ts
 *
 * FIX-Task-47 item 2 (2026-09-16) — dev-only timing marks for the subscription
 * load chain.
 *
 * WHY: a round of Android QA measured ~20–50s to first paint on the Kids Club+
 * screens, with the instrumented log showing a **16.1s gap between the route push
 * and the first payment-method log line**. That gap is fully explained by strictly
 * SERIAL legs (a subscription/config fan-out, then a sequential payment-method
 * fetch that itself awaits AsyncStorage + a session read before it logs) — but you
 * cannot prove which leg dominates without per-leg numbers.
 *
 * These helpers are no-ops in production (`__DEV__ === false`), so they add no
 * runtime cost or console noise to a release build; they exist so the next device
 * run can attribute the time in one pass instead of guessing (the FIX-Task-46
 * lesson: measure a "slow" claim before changing the thing you suspect).
 *
 * They are intentionally NOT a generic logger — use them only for load chains whose
 * perceived load time is being tracked.
 */

declare const __DEV__: boolean | undefined;

const TIMING_ENABLED = typeof __DEV__ !== 'undefined' && __DEV__ === true;

/** Log a start mark and return the timestamp to pass to `loadEnd`. */
export function loadStart(label: string): number {
  const startedAt = Date.now();
  if (TIMING_ENABLED) {
    // eslint-disable-next-line no-console
    console.log(`[load] ▶ ${label}`);
  }
  return startedAt;
}

/** Log the elapsed time for a `loadStart` mark. Returns the elapsed milliseconds. */
export function loadEnd(label: string, startedAt: number): number {
  const elapsedMs = Date.now() - startedAt;
  if (TIMING_ENABLED) {
    // eslint-disable-next-line no-console
    console.log(`[load] ⏱ ${label}: ${elapsedMs}ms`);
  }
  return elapsedMs;
}

/**
 * Time an existing promise (or any thenable — Supabase query builders qualify)
 * without changing its value or its rejection behaviour. When timing is disabled
 * this resolves to the same value with no logging.
 *
 * The `Awaited<T>` return type keeps whatever the wrapped call resolved to, so
 * instrumenting a call site never widens its types.
 */
export function withLoadTiming<T extends PromiseLike<unknown>>(
  label: string,
  promise: T
): Promise<Awaited<T>> {
  const asPromise = Promise.resolve(promise) as Promise<Awaited<T>>;
  if (!TIMING_ENABLED) return asPromise;

  const startedAt = loadStart(label);
  return asPromise.finally(() => loadEnd(label, startedAt));
}

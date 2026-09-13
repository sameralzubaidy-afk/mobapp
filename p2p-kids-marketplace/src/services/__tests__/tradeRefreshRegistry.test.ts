/**
 * Unit Tests: tradeRefreshRegistry (FIX-Task-25 item 1)
 *
 * The Trade List registers its full refetch here; a trade-mutation screen calls
 * `requestTradesRefresh()` on success so a completed trade can never keep
 * rendering as IN PROGRESS with frozen summary tiles (QA Task 2026-09-13,
 * finding F1 — a manual `qa-refresh` was needed to correct the list).
 *
 * The module holds a single module-level slot, so every case unregisters.
 */

import { registerTradesRefresh, requestTradesRefresh } from '../tradeRefreshRegistry';

describe('tradeRefreshRegistry', () => {
  it('returns false when no screen is registered (list not mounted)', () => {
    expect(requestTradesRefresh()).toBe(false);
  });

  it('invokes the registered refetch and reports that it did', () => {
    const refresh = jest.fn();
    const unregister = registerTradesRefresh(refresh);

    expect(requestTradesRefresh()).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    unregister();
  });

  it('stops invoking the refetch after unregister (screen unmounted)', () => {
    const refresh = jest.fn();
    const unregister = registerTradesRefresh(refresh);
    unregister();

    expect(requestTradesRefresh()).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('only clears the callback it registered, never a newer one', () => {
    // A late unmount of an OLD screen instance must not wipe the live
    // registration — otherwise the list silently stops refreshing.
    const stale = jest.fn();
    const live = jest.fn();
    const unregisterStale = registerTradesRefresh(stale);
    const unregisterLive = registerTradesRefresh(live);

    unregisterStale();

    expect(requestTradesRefresh()).toBe(true);
    expect(live).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();

    unregisterLive();
  });

  it('never throws out of a mutation success path when the refetch fails', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const unregister = registerTradesRefresh(() => {
      throw new Error('refetch blew up');
    });

    expect(() => requestTradesRefresh()).not.toThrow();

    unregister();
    warn.mockRestore();
  });

  it('clears the slot when registered with null', () => {
    const refresh = jest.fn();
    registerTradesRefresh(refresh);
    registerTradesRefresh(null);

    expect(requestTradesRefresh()).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});

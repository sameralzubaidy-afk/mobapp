// File: p2p-kids-marketplace/src/services/__tests__/notificationBadgeRefreshRegistry.test.ts
//
// FIX-Task-66 item 2 (2026-09-18): unit tests for the notification-badge refresh
// registry that closes the "header bell badge stays at 99+ after Mark all read"
// defect.

import {
  __notificationBadgeRefreshSubscriberCount,
  __resetNotificationBadgeRefreshRegistryForTests,
  registerNotificationBadgeRefresh,
  requestNotificationBadgeRefresh,
} from '../notificationBadgeRefreshRegistry';

describe('notificationBadgeRefreshRegistry (FIX-Task-66 item 2)', () => {
  beforeEach(() => {
    __resetNotificationBadgeRefreshRegistryForTests();
    jest.restoreAllMocks();
  });

  it('refreshes EVERY registered subscriber — multi-header, not single-slot', () => {
    // React Navigation keeps previously-pushed screens mounted, so more than one
    // AppHeader (and therefore more than one badge hook) is alive at once. A
    // single-slot registry would leave the header you navigate BACK to stale.
    const firstHeader = jest.fn();
    const secondHeader = jest.fn();
    const thirdHeader = jest.fn();

    registerNotificationBadgeRefresh(firstHeader);
    registerNotificationBadgeRefresh(secondHeader);
    registerNotificationBadgeRefresh(thirdHeader);

    const invoked = requestNotificationBadgeRefresh();

    expect(invoked).toBe(3);
    expect(firstHeader).toHaveBeenCalledTimes(1);
    expect(secondHeader).toHaveBeenCalledTimes(1);
    expect(thirdHeader).toHaveBeenCalledTimes(1);
  });

  it('returns 0 and does not throw when no header is mounted', () => {
    // Harmless: the hook refetches on mount, so nothing is missed.
    expect(requestNotificationBadgeRefresh()).toBe(0);
  });

  it('unregisters on unmount so an unmounted header is never refreshed', () => {
    const mountedHeader = jest.fn();
    const unregister = registerNotificationBadgeRefresh(mountedHeader);

    expect(__notificationBadgeRefreshSubscriberCount()).toBe(1);

    unregister();

    expect(__notificationBadgeRefreshSubscriberCount()).toBe(0);
    expect(requestNotificationBadgeRefresh()).toBe(0);
    expect(mountedHeader).not.toHaveBeenCalled();
  });

  it('registering the same callback reference twice is deduplicated (Set semantics)', () => {
    const refresh = jest.fn();

    registerNotificationBadgeRefresh(refresh);
    registerNotificationBadgeRefresh(refresh);

    expect(__notificationBadgeRefreshSubscriberCount()).toBe(1);
    expect(requestNotificationBadgeRefresh()).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a throwing subscriber cannot break the mutation success path or its siblings', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failingHeader = jest.fn(() => {
      throw new Error('boom');
    });
    const healthyHeader = jest.fn();

    registerNotificationBadgeRefresh(failingHeader);
    registerNotificationBadgeRefresh(healthyHeader);

    expect(() => requestNotificationBadgeRefresh()).not.toThrow();
    expect(healthyHeader).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('supports async refresh callbacks without awaiting them (fire-and-forget)', async () => {
    const asyncRefresh = jest.fn(async () => {
      await Promise.resolve();
    });

    registerNotificationBadgeRefresh(asyncRefresh);

    expect(requestNotificationBadgeRefresh()).toBe(1);
    expect(asyncRefresh).toHaveBeenCalledTimes(1);

    await Promise.resolve();
  });
});

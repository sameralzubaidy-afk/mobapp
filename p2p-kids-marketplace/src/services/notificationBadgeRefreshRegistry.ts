// File: p2p-kids-marketplace/src/services/notificationBadgeRefreshRegistry.ts
//
// FIX-Task-66 item 2 (2026-09-18) — lets a mutation surface force every mounted
// notification-badge hook to re-read the authoritative unread count.
//
// WHY THIS EXISTS (MSG Round 2 finding F2): after Notification Center's
// "Mark all read" the DB held 0 unread and the list rendered every row as read, but
// the header bell badge stayed at "99+" until the app was restarted. The badge is
// owned by `useNotificationBadge`, which is mounted once PER `AppHeader` instance —
// there is no shared context, prop drilling, or module-level store — and the bulk
// action never told any instance to re-read. `useNotificationBadge` already exposes
// `refresh()` but no consumer ever called it.
//
// The hook's Realtime UPDATE subscription is correctly shaped, but the refresh must
// not depend on it alone: Realtime delivery can miss, and the hook deliberately
// keeps the previous value when a count read fails. So this registry is the
// cause-independent half of the fix.
//
// DESIGN NOTE — multi-subscriber, NOT the single-slot `tradeRefreshRegistry` shape:
// several `AppHeader` instances can be mounted simultaneously (React Navigation keeps
// previously-pushed screens mounted). A single-slot registry would refresh only the
// most recently mounted instance and leave the header you navigate BACK to showing a
// stale count. This registry therefore holds a Set and refreshes every subscriber.

export type NotificationBadgeRefreshFn = () => void | Promise<void>;

const subscribers = new Set<NotificationBadgeRefreshFn>();

/**
 * Registers a mounted badge hook's refresh callback and returns an unregister
 * function. The hook calls the unregister on unmount so the set never holds a
 * callback for an unmounted component.
 */
export function registerNotificationBadgeRefresh(
  fn: NotificationBadgeRefreshFn
): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * Asks every mounted notification-badge hook to re-read the unread count.
 *
 * Safe to call from anywhere at any time — it never throws, so a refresh problem
 * can never break the mutation's own success path.
 *
 * @returns the number of mounted badge hooks that were asked to refresh (0 when
 *          no header is mounted, which is harmless: the hook refetches on mount).
 */
export function requestNotificationBadgeRefresh(): number {
  let invoked = 0;

  for (const fn of subscribers) {
    try {
      void fn();
      invoked += 1;
    } catch (e) {
      console.warn('[notificationBadgeRefreshRegistry] subscriber refresh failed', e);
    }
  }

  return invoked;
}

/** Test-only: clears all subscribers so suites cannot leak into each other. */
export function __resetNotificationBadgeRefreshRegistryForTests(): void {
  subscribers.clear();
}

/** Test-only: how many badge hooks are currently registered. */
export function __notificationBadgeRefreshSubscriberCount(): number {
  return subscribers.size;
}

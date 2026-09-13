// File: p2p-kids-marketplace/src/utils/bundleCount.ts
/**
 * Shared bundle counting for trade screens.
 *
 * FIX-Task-26 item 2 (2026-09-13) — QA Phase 0 F8: on Review Offer the green
 * banner counted the WHOLE bundle (`bundleSiblings.length + 1`, no status filter)
 * while the primary CTA counted only PENDING items (FIX-Task-25 item 2), so one
 * render said "Bundle offer · 3 items" directly above "Accept All 2 Items".
 *
 * The bug class is "two counters, two status filters, one screen". The counters
 * now all come from here, and the sibling set is filtered by the SAME status the
 * action will actually act on.
 *
 * NOTE: only a PENDING item is actionable by the seller. `in_progress` /
 * `completed` were accepted, and `cancelled` (declined, expired, withdrawn) is
 * resolved — neither can be accepted or declined again.
 */

export interface BundleCountable {
  status?: string | null;
}

export interface BundleCounts {
  /** Every item in the snapshot (this offer + its siblings). */
  total: number;
  /** Items the seller can still act on (the button/banner number). */
  pending: number;
  /** Items already accepted by the seller (in_progress or completed). */
  accepted: number;
  /** Items resolved another way (declined, expired, cancelled). */
  resolved: number;
}

function toItems<T extends BundleCountable>(
  offer: T | null | undefined,
  siblings: readonly T[] | null | undefined
): T[] {
  const rest = Array.isArray(siblings) ? siblings.filter(Boolean) : [];
  return offer ? [offer, ...rest] : rest;
}

/** The items the seller can still accept/decline. */
export function getPendingBundleItems<T extends BundleCountable>(
  offer: T | null | undefined,
  siblings: readonly T[] | null | undefined
): T[] {
  return toItems(offer, siblings).filter((item) => item?.status === 'pending');
}

/** Single source of truth for every "N items" number on Review Offer. */
export function getPendingBundleCount<T extends BundleCountable>(
  offer: T | null | undefined,
  siblings: readonly T[] | null | undefined
): number {
  return getPendingBundleItems(offer, siblings).length;
}

/** Banner counts, so the banner can state pending AND accepted without disagreeing. */
export function getBundleCounts<T extends BundleCountable>(
  offer: T | null | undefined,
  siblings: readonly T[] | null | undefined
): BundleCounts {
  const items = toItems(offer, siblings);
  const pending = items.filter((item) => item?.status === 'pending').length;
  const accepted = items.filter(
    (item) => item?.status === 'in_progress' || item?.status === 'completed'
  ).length;

  return {
    total: items.length,
    pending,
    accepted,
    resolved: items.length - pending - accepted,
  };
}

/**
 * File: p2p-kids-marketplace/src/utils/cartSpMath.ts
 * DT-63 (QA Task 7, item 2): pure Swap-Point math for the bundle checkout's
 * "Max: N SP" hint. Kept dependency-free so it unit-tests without pulling in
 * the RN/Stripe screen module graph.
 *
 * Regression: the old formula `wallet - (wallet - used) + spApplied` double-
 * subtracted the item's own applied SP and showed "Max: 0 SP" whenever nothing
 * was applied yet — even with SP available (QA observed buyer with 4 SP seeing
 * "Max: 0 SP"). otherUsed below excludes this item's own applied SP:
 * remaining = wallet - (totalApplied - thisItemApplied).
 */

export interface CartItemSpState {
  spApplied: number;
  /** Max SP this item can accept (category spending cap for the item price). */
  maxAllowed: number;
  /** Category spending-cap percentage (informational). */
  catCap?: number;
}

/**
 * Max Swap Points the given item can apply given the wallet balance and what
 * OTHER items are already applying. Returns 0 for unknown items and clamps to 0
 * when the wallet is fully consumed by other items.
 */
export function computeMaxSpForItem(
  itemSpState: Record<string, CartItemSpState>,
  walletBalance: number,
  itemId: string
): number {
  const state = itemSpState[itemId];
  if (!state) return 0;
  const used = Object.values(itemSpState).reduce((sum, s) => sum + (s.spApplied ?? 0), 0);
  const otherUsed = Math.max(0, used - (state.spApplied ?? 0));
  return Math.min(state.maxAllowed, Math.max(0, walletBalance - otherUsed));
}

export type SpLimitSource = 'wallet' | 'category';

export interface SpLimitInfo {
  /** The binding max SP for this item (min of category cap and wallet remaining). */
  bindingMax: number;
  /** Which limit binds — 'wallet' when the SP balance is the ceiling, 'category' when the category cap is. */
  source: SpLimitSource;
}

/**
 * DEV-TASK-72: single, unambiguous "you can use up to N SP" ceiling for the bundle
 * checkout. Returns the binding limit (min of category cap and wallet-remaining)
 * plus which limit it came from, so the UI can show ONE number and ONE source
 * subtext instead of two different denominators ("Max: N SP" vs "X of Y — balance limit").
 */
export function getSpLimitInfo(
  itemSpState: Record<string, CartItemSpState>,
  walletBalance: number,
  itemId: string
): SpLimitInfo {
  const state = itemSpState[itemId];
  const bindingMax = computeMaxSpForItem(itemSpState, walletBalance, itemId);
  const source: SpLimitSource = state && bindingMax < state.maxAllowed ? 'wallet' : 'category';
  return { bindingMax, source };
}

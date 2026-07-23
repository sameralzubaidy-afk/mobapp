/**
 * File: p2p-kids-marketplace/src/utils/sellerGroup.ts
 *
 * SELLER-GROUP-001: Anonymous Seller Group Identification
 *
 * Generates a deterministic, non-reversible hash from a seller_id to produce:
 * - A stable color (for the Seller Group badge)
 * - A stable group label (e.g., "Seller A", "Seller B")
 *
 * NEVER exposes the seller's name, avatar, location, or any PII.
 * The hash is opaque — it cannot be reversed to recover the seller_id.
 *
 * Uses SHA-256 (via expo-crypto) truncated to produce a color index.
 *
 * DEFERRED-DECISION (2026-07-13): This utility survived a partial revert.
 * Context: Seller Group badges were initially placed on Discover/search grid cards,
 * then rolled back in favor of "More from this seller" page discovery.
 * What remains: This utility + SellerGroupBadge + MatchesCartBadge are still used on
 * ItemDetailScreen and MoreFromThisSellerScreen. The hash comparison (isSameSellerGroup)
 * powers the "Matches Your Cart" logic. The SellerGroupBadge component is used on
 * the "More from this seller" filtered page.
 * Do NOT remove without confirming both ItemDetailScreen and MoreFromThisSellerScreen
 * no longer need seller group identification.
 */

import * as Crypto from 'expo-crypto';

/** 12 distinct, accessible colors for seller group badges */
const SELLER_GROUP_COLORS = [
  '#5DBB8E', // green
  '#6B8FD4', // blue
  '#D4789B', // pink
  '#E8A838', // amber
  '#9B7EC4', // purple
  '#4ECDC4', // teal
  '#F77F5E', // coral
  '#7EC8A0', // sage
  '#C49B6C', // tan
  '#6C9BC4', // steel blue
  '#C47E9B', // mauve
  '#8EC46C', // lime
];

const SELLER_GROUP_LABELS = [
  'Seller ● Blue', 'Seller ● Green', 'Seller ● Coral', 'Seller ● Purple',
  'Seller ● Teal', 'Seller ● Amber', 'Seller ● Pink', 'Seller ● Sage',
  'Seller ● Steel', 'Seller ● Mauve', 'Seller ● Tan', 'Seller ● Lime',
];

export interface SellerGroupInfo {
  /** Opaque hash of seller_id — for comparison only, never displayed */
  hash: string;
  /** Stable color hex for the badge */
  color: string;
  /** Stable human-readable label for the badge (e.g., "Seller ● Blue") */
  label: string;
  /** Numeric index into the color/label arrays */
  index: number;
}

// In-memory cache to avoid re-hashing the same seller_id repeatedly
const cache = new Map<string, SellerGroupInfo>();

/**
 * Compute the seller group info for a given seller_id.
 * Returns a cached result if the seller_id has been seen before in this session.
 */
export async function getSellerGroup(sellerId: string): Promise<SellerGroupInfo> {
  if (cache.has(sellerId)) {
    return cache.get(sellerId)!;
  }

  // Hash the seller_id deterministically
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    sellerId,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // Use first 4 hex chars as a deterministic index
  const index = parseInt(digest.substring(0, 4), 16) % SELLER_GROUP_COLORS.length;

  const info: SellerGroupInfo = {
    hash: digest,
    color: SELLER_GROUP_COLORS[index],
    label: SELLER_GROUP_LABELS[index],
    index,
  };

  cache.set(sellerId, info);
  return info;
}

/**
 * Synchronously check if two seller group hashes match.
 * Use this for quick comparison without async overhead.
 */
export function isSameSellerGroup(hashA: string, hashB: string): boolean {
  return hashA === hashB;
}

/**
 * Clear the in-memory cache. Useful for testing or when the user logs out.
 */
export function clearSellerGroupCache(): void {
  cache.clear();
}

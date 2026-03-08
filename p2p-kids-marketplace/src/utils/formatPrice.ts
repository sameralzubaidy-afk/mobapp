/**
 * File: p2p-kids-marketplace/src/utils/formatPrice.ts
 * Utility to format price in cents to dollar string
 * MODULE-11 TASK SUB-010
 */

/**
 * Converts price in cents to formatted dollar string
 * @param priceCents - Price in cents (e.g., 150000 for $1500.00)
 * @returns Formatted price string (e.g., "$4.99")
 */
export function formatPrice(priceCents: number | null | undefined): string {
  if (priceCents === null || priceCents === undefined) {
    return '$0.00';
  }

  const dollars = priceCents / 100;
  return `$${dollars.toFixed(2)}`;
}

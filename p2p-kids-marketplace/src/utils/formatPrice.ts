/**
 * File: p2p-kids-marketplace/src/utils/formatPrice.ts
 * Utility to format prices - removes decimals for whole dollar amounts
 * MODULE-11 TASK SUB-010 + FLOW-12 Price Formatting Enhancement
 */

/**
 * Converts price in cents to formatted dollar string (smart decimal handling)
 * @param priceCents - Price in cents (e.g., 499 for $4.99, 1500 for $15.00)
 * @returns Formatted price string (e.g., "$4.99", "$15", "$1500")
 */
export function formatPrice(priceCents: number | null | undefined): string {
  if (priceCents === null || priceCents === undefined || priceCents === 0) {
    return '$0';
  }

  const dollars = priceCents / 100;
  
  // Check if it's a whole dollar amount (no cents)
  if (priceCents % 100 === 0) {
    return `$${(priceCents / 100).toFixed(0)}`;
  }

  // Has cents, show 2 decimals
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format dollar amount (already in dollars, not cents)
 * @param dollars - Price in dollars (e.g., 4.99, 15.00, 1500.00)
 * @returns Formatted price string (e.g., "$4.99", "$15", "$1500")
 */
export function formatDollarAmount(dollars: number | null | undefined): string {
  if (dollars === null || dollars === undefined || dollars === 0) {
    return '$0';
  }

  // Check if it's a whole dollar amount (no cents)
  if (dollars % 1 === 0) {
    return `$${dollars.toFixed(0)}`;
  }

  // Has cents, show 2 decimals
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format price with period suffix (e.g., "/month", "/mo")
 * @param dollars - Price in dollars
 * @param period - Period suffix (default: "/mo")
 * @returns Formatted price with period (e.g., "$4.99/mo", "$15/month")
 */
export function formatPriceWithPeriod(dollars: number, period: string = '/mo'): string {
  return `${formatDollarAmount(dollars)}${period}`;
}


/**
 * File: p2p-kids-marketplace/src/test-data/tax-fixtures.ts
 * MODULE-15.3-PART3 TAX-014
 *
 * Reference fixtures for sales-tax tests. NO HARDCODED RATES outside this file.
 * Real configuration is loaded from admin_config + nodes table at runtime.
 */
export const TAX_FIXTURES = {
  CT_RATE_FRACTION: 0.0635,
  CT_JURISDICTION: 'CT',
  DEFAULT_GLOBAL_RATE_KEY: 'default_sales_tax_rate',
  GLOBAL_ENABLED_KEY: 'sales_tax_enabled',
  SUBSCRIPTION_TAXABLE_KEY: 'subscription_fee_taxable',
  REMITTANCE_JUR_KEY: 'tax_remittance_jurisdiction',
  SAMPLE_TAXABLE_AMOUNTS_CENTS: [100, 999, 10000, 12345, 50000],
};

export function expectedTaxCents(
  taxableCents: number,
  rateFraction: number,
): number {
  // Matches FLOOR((amount * rate) + 0.5) used in SQL `calculate_tax`.
  return Math.floor(taxableCents * rateFraction + 0.5);
}

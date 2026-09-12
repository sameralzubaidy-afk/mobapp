/**
 * File: p2p-kids-marketplace/src/services/tax.ts
 * MODULE-15.3-PART3 TAX-013
 * Sales tax service: client wrappers for tax RPCs.
 *
 * All amounts in CENTS. Tax rate is a DECIMAL FRACTION (0.0635 = 6.35%).
 */
import { supabase } from '@/config/supabase';

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export interface TaxCalculation {
  taxable_amount_cents: number;
  tax_rate: number;
  tax_amount_cents: number;
  tax_jurisdiction: string | null;
  global_enabled: boolean;
}

export interface TaxApplyResult {
  trade_id: string;
  tax_record_id: string;
  tax_amount_cents: number;
  taxable_amount_cents: number;
  tax_rate_applied: number;
  tax_jurisdiction: string | null;
  idempotent_hit: boolean;
}

export interface TaxRefundResult {
  tax_record_id: string;
  refunded_total: number;
  tax_amount_cents: number;
  remaining_cents: number;
}

export interface TaxSummaryRow {
  jurisdiction: string;
  transaction_count: number;
  taxable_total_cents: number;
  tax_collected_cents: number;
  tax_refunded_cents: number;
  tax_net_cents: number;
}

export interface TaxSummary {
  start_date: string;
  end_date: string;
  node_id: string | null;
  transaction_count: number;
  taxable_total_cents: number;
  tax_collected_cents: number;
  tax_refunded_cents: number;
  tax_net_cents: number;
  by_jurisdiction: TaxSummaryRow[];
}

function unwrap<T>(rpcData: unknown): ServiceResult<T> {
  const r = rpcData as { success: boolean; data?: T; error?: { code: string; message: string; details?: unknown } };
  if (r && r.success && r.data !== undefined) return { success: true, data: r.data };
  if (r && r.error) return { success: false, error: r.error };
  return { success: false, error: { code: 'UNKNOWN', message: 'Unknown RPC response shape' } };
}

/**
 * Pure preview - safe to call repeatedly from UI.
 * taxCategoryId/itemPriceCents are optional (BP-fix 2026-07-29): when supplied,
 * the RPC honors the item's tax category exemption / price-threshold rule
 * instead of always applying the node's flat rate.
 */
export async function calculateTax(
  nodeId: string | null,
  taxableAmountCents: number,
  taxCategoryId?: string | null,
  itemPriceCents?: number | null,
): Promise<ServiceResult<TaxCalculation>> {
  try {
    const { data, error } = await supabase.rpc('calculate_tax', {
      p_node_id: nodeId,
      p_taxable_amount_cents: taxableAmountCents,
      p_tax_category_id: taxCategoryId ?? null,
      p_item_price_cents: itemPriceCents ?? null,
    });
    if (error) {
      console.error('[tax] calculateTax rpc error:', error);
      return { success: false, error: { code: 'RPC_ERROR', message: error.message } };
    }
    return unwrap<TaxCalculation>(data);
  } catch (e: any) {
    console.error('[tax] calculateTax exception:', e);
    return { success: false, error: { code: 'EXCEPTION', message: e?.message ?? 'unknown' } };
  }
}

/** Apply tax to an existing trade (idempotent). Call AFTER trade row exists. */
export async function applyTaxToTrade(tradeId: string): Promise<ServiceResult<TaxApplyResult>> {
  try {
    const { data, error } = await supabase.rpc('apply_tax_to_trade', { p_trade_id: tradeId });
    if (error) {
      console.error('[tax] applyTaxToTrade rpc error:', error);
      return { success: false, error: { code: 'RPC_ERROR', message: error.message } };
    }
    return unwrap<TaxApplyResult>(data);
  } catch (e: any) {
    console.error('[tax] applyTaxToTrade exception:', e);
    return { success: false, error: { code: 'EXCEPTION', message: e?.message ?? 'unknown' } };
  }
}

/** Refund (partial or full) collected tax for a trade. */
export async function refundTax(
  tradeId: string,
  refundAmountCents: number,
  reason?: string,
): Promise<ServiceResult<TaxRefundResult>> {
  try {
    const { data, error } = await supabase.rpc('refund_tax', {
      p_trade_id: tradeId,
      p_refund_amount_cents: refundAmountCents,
      p_reason: reason ?? null,
    });
    if (error) {
      console.error('[tax] refundTax rpc error:', error);
      return { success: false, error: { code: 'RPC_ERROR', message: error.message } };
    }
    return unwrap<TaxRefundResult>(data);
  } catch (e: any) {
    console.error('[tax] refundTax exception:', e);
    return { success: false, error: { code: 'EXCEPTION', message: e?.message ?? 'unknown' } };
  }
}

/** Admin: aggregated tax for date range, optionally scoped to a node. */
export async function getTaxSummary(
  startDate: string, // ISO YYYY-MM-DD
  endDate: string,
  nodeId?: string | null,
): Promise<ServiceResult<TaxSummary>> {
  try {
    const { data, error } = await supabase.rpc('get_tax_summary_for_period', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_node_id: nodeId ?? null,
    });
    if (error) {
      console.error('[tax] getTaxSummary rpc error:', error);
      return { success: false, error: { code: 'RPC_ERROR', message: error.message } };
    }
    return unwrap<TaxSummary>(data);
  } catch (e: any) {
    console.error('[tax] getTaxSummary exception:', e);
    return { success: false, error: { code: 'EXCEPTION', message: e?.message ?? 'unknown' } };
  }
}

/** Format cents as USD with 2 decimals. */
export function formatCents(cents: number | null | undefined): string {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

/** Format a decimal fraction (0.0635) as a percent string "6.35%". */
export function formatTaxRate(rate: number | null | undefined): string {
  const r = typeof rate === 'number' && Number.isFinite(rate) ? rate : 0;
  return `${(r * 100).toFixed(2)}%`;
}

/** One line of the Order Summary tax preview (FIX-Task-19 item 4). */
export interface TaxLineRateInput {
  /** The per-line `tax_rate` returned by `calculate_tax` (0 when no taxable rule applies). */
  taxRate: number;
  /** True when this line's tax category is exempt (`tax_exempt_goods`). */
  isExempt: boolean;
}

/**
 * FIX-Task-19 item 4 (2026-09-11): resolves the rate shown in the Order Summary
 * tax row's parenthetical, e.g. "Sales Tax (6.99%)".
 *
 * The row used to show a BLENDED rate (totalTax / full cart subtotal). On a cart
 * mixing a tax-exempt line with taxable ones that produced a percentage which
 * applied to no single line — e.g. "Sales Tax (4.67%)" on a cart with two lines
 * at 6.99% plus one exempt line — and the guide expects plain "Sales Tax" there.
 *
 * Rule: show a rate ONLY when the cart is uniform — there is no exempt line, and
 * every line is taxed at the same non-zero rate. Returns 0 to mean "show no
 * rate" (TaxBreakdownRow hides the parenthetical when taxRate <= 0).
 */
export function resolveDisplayTaxRate(lines: TaxLineRateInput[]): number {
  if (lines.length === 0) return 0;
  // Any exempt line makes the cart mixed — one parenthetical would mislead.
  if (lines.some((l) => l.isExempt)) return 0;
  const rates = lines.map((l) =>
    typeof l.taxRate === 'number' && Number.isFinite(l.taxRate)
      ? Number(l.taxRate.toFixed(6))
      : 0,
  );
  // A non-taxable line inside an otherwise-taxable cart is also non-uniform.
  if (rates.some((r) => r <= 0)) return 0;
  const unique = new Set(rates);
  return unique.size === 1 ? rates[0] : 0;
}

/** Key of the platform's canonical tax-exempt category (see tax_categories seed). */
const TAX_EXEMPT_CATEGORY_KEY = 'tax_exempt_goods';

let taxCategoriesPromise: Promise<Map<string, string>> | null = null;

/**
 * Lazily fetch id → key for all tax categories and cache for the app session.
 * tax_categories is readable by all authenticated users (RLS USING(TRUE)).
 * Fail-safe: on any error returns an empty map (the badge simply won't render).
 */
function getTaxCategoryKeyMap(): Promise<Map<string, string>> {
  if (!taxCategoriesPromise) {
    taxCategoriesPromise = (async () => {
      const map = new Map<string, string>();
      try {
        const { data, error } = await supabase.from('tax_categories').select('id, key');
        if (error) {
          console.error('[tax] getTaxCategoryKeyMap error:', error.message);
          return map;
        }
        for (const row of data ?? []) {
          if (row?.id && row?.key) map.set(String(row.id), String(row.key));
        }
      } catch (e: any) {
        console.error('[tax] getTaxCategoryKeyMap exception:', e?.message ?? e);
      }
      return map;
    })();
  }
  return taxCategoriesPromise;
}

/**
 * True when the item's tax category is the platform's exempt category
 * (tax_exempt_goods) — the driver for the "Tax Free" badge (TC-O05).
 * Deliberately does NOT treat `review_required` as exempt: that category is a
 * pending operational state, not a real exemption.
 */
export async function isTaxExemptCategory(
  taxCategoryId: string | null | undefined,
): Promise<boolean> {
  if (!taxCategoryId) return false;
  const map = await getTaxCategoryKeyMap();
  return map.get(taxCategoryId) === TAX_EXEMPT_CATEGORY_KEY;
}

/** Test-only: clear the cached tax-category lookup (e.g. between test cases). */
export function __resetTaxCategoriesCache(): void {
  taxCategoriesPromise = null;
}

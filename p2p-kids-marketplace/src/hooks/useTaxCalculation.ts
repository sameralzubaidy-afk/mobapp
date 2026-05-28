/**
 * File: p2p-kids-marketplace/src/hooks/useTaxCalculation.ts
 * MODULE-15.3-PART3 TAX-010
 *
 * Debounced (300ms) live tax preview for checkout / cart UIs.
 * - Returns 0 immediately while waiting / errored (fail-safe).
 * - Never throws; surfaces error via `error` field.
 */
import { useEffect, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { calculateTax, TaxCalculation } from '@/services/tax';

export interface UseTaxCalculationOptions {
  nodeId: string | null | undefined;
  taxableAmountCents: number;
  /** Disable the hook entirely (e.g. while parent inputs are loading). */
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseTaxCalculationResult {
  loading: boolean;
  taxAmountCents: number;
  taxRate: number;
  jurisdiction: string | null;
  globalEnabled: boolean;
  error: string | null;
  /** Raw RPC payload (or null if no successful fetch yet). */
  raw: TaxCalculation | null;
}

const EMPTY: TaxCalculation = {
  taxable_amount_cents: 0,
  tax_rate: 0,
  tax_amount_cents: 0,
  tax_jurisdiction: null,
  global_enabled: false,
};

export function useTaxCalculation(opts: UseTaxCalculationOptions): UseTaxCalculationResult {
  const { nodeId, taxableAmountCents, enabled = true, debounceMs = 300 } = opts;
  const debouncedAmount = useDebouncedValue(taxableAmountCents, debounceMs);
  const debouncedNodeId = useDebouncedValue(nodeId, debounceMs);

  const [state, setState] = useState<{
    loading: boolean;
    data: TaxCalculation;
    error: string | null;
    raw: TaxCalculation | null;
  }>({ loading: false, data: EMPTY, error: null, raw: null });

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return () => {
        cancelled = true;
      };
    }
    if (!debouncedAmount || debouncedAmount <= 0) {
      setState({ loading: false, data: EMPTY, error: null, raw: null });
      return () => {
        cancelled = true;
      };
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    calculateTax(debouncedNodeId ?? null, debouncedAmount)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setState({ loading: false, data: res.data, error: null, raw: res.data });
        } else {
          setState({ loading: false, data: EMPTY, error: res.error.message, raw: null });
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setState({ loading: false, data: EMPTY, error: e?.message ?? 'tax error', raw: null });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedAmount, debouncedNodeId, enabled]);

  return {
    loading: state.loading,
    taxAmountCents: state.data.tax_amount_cents,
    taxRate: state.data.tax_rate,
    jurisdiction: state.data.tax_jurisdiction,
    globalEnabled: state.data.global_enabled,
    error: state.error,
    raw: state.raw,
  };
}

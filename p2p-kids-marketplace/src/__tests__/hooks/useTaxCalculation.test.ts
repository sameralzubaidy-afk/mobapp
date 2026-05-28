/**
 * File: p2p-kids-marketplace/src/__tests__/hooks/useTaxCalculation.test.ts
 * MODULE-15.3-PART3 TAX-014 (unit)
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useTaxCalculation } from '@/hooks/useTaxCalculation';
import { supabase } from '@/config/supabase';

jest.mock('@/config/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as unknown as jest.Mock;

const OK_PAYLOAD = {
  data: {
    success: true,
    data: {
      taxable_amount_cents: 10000,
      tax_rate: 0.0635,
      tax_amount_cents: 635,
      tax_jurisdiction: 'CT',
      global_enabled: true,
    },
  },
  error: null,
};

describe('useTaxCalculation (TAX-014)', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('returns zero when amount is 0 (no rpc call)', async () => {
    mockRpc.mockResolvedValue(OK_PAYLOAD);
    const { result } = renderHook(() =>
      useTaxCalculation({ nodeId: 'n', taxableAmountCents: 0, debounceMs: 10 }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.taxAmountCents).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('debounces then fetches and maps tax data', async () => {
    mockRpc.mockResolvedValue(OK_PAYLOAD);
    const { result } = renderHook(() =>
      useTaxCalculation({ nodeId: 'n', taxableAmountCents: 10000, debounceMs: 10 }),
    );
    await waitFor(() => expect(result.current.taxAmountCents).toBe(635), { timeout: 2000 });
    expect(result.current.taxRate).toBeCloseTo(0.0635);
    expect(result.current.jurisdiction).toBe('CT');
    expect(result.current.error).toBeNull();
  });

  it('surfaces error and keeps amount at 0', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc dead' } });
    const { result } = renderHook(() =>
      useTaxCalculation({ nodeId: 'n', taxableAmountCents: 10000, debounceMs: 10 }),
    );
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 2000 });
    expect(result.current.taxAmountCents).toBe(0);
  });

  it('does nothing when enabled=false', async () => {
    mockRpc.mockResolvedValue(OK_PAYLOAD);
    const { result } = renderHook(() =>
      useTaxCalculation({
        nodeId: 'n',
        taxableAmountCents: 10000,
        enabled: false,
        debounceMs: 10,
      }),
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(result.current.taxAmountCents).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

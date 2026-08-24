// File: src/services/__tests__/devTestingService.test.ts
// Unit tests for the QA provider-outage simulation toggle (AUTH-TC-C05).
//
// getSimulatedProviderOutage() reads the `qa_provider_unavailable` admin_config
// toggle via fn_get_admin_config_values and returns the armed provider (or
// 'all'), or null when unset / unknown / RPC error. `isDevEnvironment()` is true
// under Jest (NODE_ENV === 'test'), so the RPC path is exercised directly.

import { supabase } from '@/config/supabase';
import { QA_PROVIDER_UNAVAILABLE_KEY, getSimulatedProviderOutage } from '../devTestingService';

jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as unknown as { rpc: jest.Mock };

describe('devTestingService — getSimulatedProviderOutage (AUTH-TC-C05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the toggle is unset (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getSimulatedProviderOutage()).resolves.toBeNull();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_admin_config_values', {
      p_keys: [QA_PROVIDER_UNAVAILABLE_KEY],
    });
  });

  it('returns the armed provider name', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PROVIDER_UNAVAILABLE_KEY, out_value: 'google' }],
      error: null,
    });

    await expect(getSimulatedProviderOutage()).resolves.toBe('google');
  });

  it('returns "all" when every provider is simulated as down', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PROVIDER_UNAVAILABLE_KEY, out_value: 'all' }],
      error: null,
    });

    await expect(getSimulatedProviderOutage()).resolves.toBe('all');
  });

  it('returns null for "none" (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PROVIDER_UNAVAILABLE_KEY, out_value: 'none' }],
      error: null,
    });

    await expect(getSimulatedProviderOutage()).resolves.toBeNull();
  });

  it('returns null for unknown values (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PROVIDER_UNAVAILABLE_KEY, out_value: 'random_junk' }],
      error: null,
    });

    await expect(getSimulatedProviderOutage()).resolves.toBeNull();
  });

  it('returns null when the RPC errors (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(getSimulatedProviderOutage()).resolves.toBeNull();
  });
});

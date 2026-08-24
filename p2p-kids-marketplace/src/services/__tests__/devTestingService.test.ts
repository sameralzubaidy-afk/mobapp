// File: src/services/__tests__/devTestingService.test.ts
// Unit tests for the QA provider-outage simulation toggle (AUTH-TC-C05).
//
// getSimulatedProviderOutage() reads the `qa_provider_unavailable` admin_config
// toggle via fn_get_admin_config_values and returns the armed provider (or
// 'all'), or null when unset / unknown / RPC error. `isDevEnvironment()` is true
// under Jest (NODE_ENV === 'test'), so the RPC path is exercised directly.

import { supabase } from '@/config/supabase';
import {
  QA_PROVIDER_UNAVAILABLE_KEY,
  getSimulatedProviderOutage,
  QA_PUSH_SIMULATION_KEY,
  getPushSimulationMode,
  QA_FORCE_PREF_SAVE_FAILURE_KEY,
  getSimulatedNotificationPrefSaveError,
  QA_LINK_EMAIL_MISMATCH_KEY,
  getSimulatedLinkEmailMismatch,
} from '../devTestingService';

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

describe('devTestingService — getPushSimulationMode (AUTH-TC-A03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "none" when the toggle is unset (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getPushSimulationMode()).resolves.toBe('none');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_admin_config_values', {
      p_keys: [QA_PUSH_SIMULATION_KEY],
    });
  });

  it('returns "token" to simulate a registered push token', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PUSH_SIMULATION_KEY, out_value: 'token' }],
      error: null,
    });

    await expect(getPushSimulationMode()).resolves.toBe('token');
  });

  it('returns "rate_limited" and "quiet_hours" modes', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PUSH_SIMULATION_KEY, out_value: 'rate_limited' }],
      error: null,
    });
    await expect(getPushSimulationMode()).resolves.toBe('rate_limited');

    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PUSH_SIMULATION_KEY, out_value: 'quiet_hours' }],
      error: null,
    });
    await expect(getPushSimulationMode()).resolves.toBe('quiet_hours');
  });

  it('returns "none" for unknown values and RPC errors (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_PUSH_SIMULATION_KEY, out_value: 'random_junk' }],
      error: null,
    });
    await expect(getPushSimulationMode()).resolves.toBe('none');

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    await expect(getPushSimulationMode()).resolves.toBe('none');
  });
});

describe('devTestingService — getSimulatedNotificationPrefSaveError (AUTH-TC-D02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the toggle is unset (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_admin_config_values', {
      p_keys: [QA_FORCE_PREF_SAVE_FAILURE_KEY],
    });
  });

  it('returns an Error when armed with save_failure', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_FORCE_PREF_SAVE_FAILURE_KEY, out_value: 'save_failure' }],
      error: null,
    });

    const err = await getSimulatedNotificationPrefSaveError();
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('qa_force_pref_save_failure');
  });

  it('returns null for "none", unknown values and RPC errors (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_FORCE_PREF_SAVE_FAILURE_KEY, out_value: 'none' }],
      error: null,
    });
    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();

    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_FORCE_PREF_SAVE_FAILURE_KEY, out_value: 'random_junk' }],
      error: null,
    });
    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();
  });
});

describe('devTestingService — getSimulatedLinkEmailMismatch (AUTH-TC-C04)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the toggle is unset (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_admin_config_values', {
      p_keys: [QA_LINK_EMAIL_MISMATCH_KEY],
    });
  });

  it('returns the armed provider name', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_LINK_EMAIL_MISMATCH_KEY, out_value: 'facebook' }],
      error: null,
    });

    await expect(getSimulatedLinkEmailMismatch()).resolves.toBe('facebook');
  });

  it('returns "all" when every provider email mismatches', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_LINK_EMAIL_MISMATCH_KEY, out_value: 'all' }],
      error: null,
    });

    await expect(getSimulatedLinkEmailMismatch()).resolves.toBe('all');
  });

  it('returns null for "none", unknown values and RPC errors (fail-closed)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_LINK_EMAIL_MISMATCH_KEY, out_value: 'none' }],
      error: null,
    });
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();

    mockSupabase.rpc.mockResolvedValue({
      data: [{ out_key: QA_LINK_EMAIL_MISMATCH_KEY, out_value: 'random_junk' }],
      error: null,
    });
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();
  });
});

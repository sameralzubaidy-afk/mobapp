// File: src/services/__tests__/devTestingService.test.ts
// Unit tests for the QA simulation toggles.
//
// - getSimulatedProviderOutage() (C05) is admin_config-backed via
//   fn_get_admin_config_values (still DB-backed — out of scope for the
//   session-local migration) and returns the armed provider (or 'all'), or null
//   when unset / unknown / RPC error.
// - getPushSimulationMode() (A03), getSimulatedNotificationPrefSaveError() (D02)
//   and getSimulatedLinkEmailMismatch() (C04) are SESSION-LOCAL: they read
//   AsyncStorage keys armed via the `p2pkidsmarketplace://qa-dev-toggle` deep
//   link (setQaLocalValue). `isDevEnvironment()` is true under Jest
//   (NODE_ENV === 'test'), so the AsyncStorage path is exercised directly.

import { supabase } from '@/config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QA_PROVIDER_UNAVAILABLE_KEY,
  getSimulatedProviderOutage,
  QA_PUSH_SIMULATION_KEY,
  getPushSimulationMode,
  QA_FORCE_PREF_SAVE_FAILURE_KEY,
  getSimulatedNotificationPrefSaveError,
  QA_LINK_EMAIL_MISMATCH_KEY,
  getSimulatedLinkEmailMismatch,
  setQaLocalValue,
  clearQaLocalValues,
  isValidQaToggleValue,
  QA_TOGGLE_SHORT_NAMES,
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

describe('devTestingService — getPushSimulationMode (AUTH-TC-A03, session-local)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('returns "none" when the toggle is unset (fail-closed)', async () => {
    await expect(getPushSimulationMode()).resolves.toBe('none');
  });

  it('returns "token" to simulate a registered push token', async () => {
    await setQaLocalValue(QA_PUSH_SIMULATION_KEY, 'token');
    await expect(getPushSimulationMode()).resolves.toBe('token');
  });

  it('returns "rate_limited" and "quiet_hours" modes', async () => {
    await setQaLocalValue(QA_PUSH_SIMULATION_KEY, 'rate_limited');
    await expect(getPushSimulationMode()).resolves.toBe('rate_limited');

    await setQaLocalValue(QA_PUSH_SIMULATION_KEY, 'quiet_hours');
    await expect(getPushSimulationMode()).resolves.toBe('quiet_hours');
  });

  it('returns "none" for unknown values (fail-closed)', async () => {
    await setQaLocalValue(QA_PUSH_SIMULATION_KEY, 'random_junk');
    await expect(getPushSimulationMode()).resolves.toBe('none');
  });

  it('expires the toggle after the TTL (fail-closed)', async () => {
    // Seed a value whose setAt is beyond the 60-minute TTL window.
    const expired = JSON.stringify({
      value: 'token',
      setAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
    });
    await AsyncStorage.setItem(QA_PUSH_SIMULATION_KEY, expired);

    await expect(getPushSimulationMode()).resolves.toBe('none');
  });
});

describe('devTestingService — getSimulatedNotificationPrefSaveError (AUTH-TC-D02, session-local)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('returns null when the toggle is unset (fail-closed)', async () => {
    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();
  });

  it('returns an Error when armed with save_failure', async () => {
    await setQaLocalValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'save_failure');

    const err = await getSimulatedNotificationPrefSaveError();
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain(QA_FORCE_PREF_SAVE_FAILURE_KEY);
  });

  it('returns null for "none" and unknown values (fail-closed)', async () => {
    await setQaLocalValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'none');
    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();

    await setQaLocalValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'random_junk');
    await expect(getSimulatedNotificationPrefSaveError()).resolves.toBeNull();
  });
});

describe('devTestingService — getSimulatedLinkEmailMismatch (AUTH-TC-C04, session-local)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('returns null when the toggle is unset (fail-closed)', async () => {
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();
  });

  it('returns the armed provider name', async () => {
    await setQaLocalValue(QA_LINK_EMAIL_MISMATCH_KEY, 'facebook');
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBe('facebook');
  });

  it('returns "all" when every provider email mismatches', async () => {
    await setQaLocalValue(QA_LINK_EMAIL_MISMATCH_KEY, 'all');
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBe('all');
  });

  it('returns null for "none" and unknown values (fail-closed)', async () => {
    await setQaLocalValue(QA_LINK_EMAIL_MISMATCH_KEY, 'none');
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();

    await setQaLocalValue(QA_LINK_EMAIL_MISMATCH_KEY, 'random_junk');
    await expect(getSimulatedLinkEmailMismatch()).resolves.toBeNull();
  });
});

describe('devTestingService — session-local QA toggle storage + validation', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('setQaLocalValue writes a TTL-stamped value the getter reads back', async () => {
    await setQaLocalValue(QA_PUSH_SIMULATION_KEY, 'token');

    const raw = await AsyncStorage.getItem(QA_PUSH_SIMULATION_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.value).toBe('token');
    expect(parsed.setAt).toBeTruthy();
  });

  it('clearQaLocalValues clears all three QA toggle keys', async () => {
    await setQaLocalValue(QA_PUSH_SIMULATION_KEY, 'token');
    await setQaLocalValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'save_failure');
    await setQaLocalValue(QA_LINK_EMAIL_MISMATCH_KEY, 'facebook');

    await clearQaLocalValues();

    await expect(AsyncStorage.getItem(QA_PUSH_SIMULATION_KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(QA_FORCE_PREF_SAVE_FAILURE_KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(QA_LINK_EMAIL_MISMATCH_KEY)).resolves.toBeNull();
  });

  it('QA_TOGGLE_SHORT_NAMES maps each deep-link key to its storage key', () => {
    expect(QA_TOGGLE_SHORT_NAMES).toEqual({
      push_simulation: QA_PUSH_SIMULATION_KEY,
      pref_save_failure: QA_FORCE_PREF_SAVE_FAILURE_KEY,
      link_email_mismatch: QA_LINK_EMAIL_MISMATCH_KEY,
    });
  });

  it('isValidQaToggleValue accepts only the documented values per key', () => {
    // push_simulation
    expect(isValidQaToggleValue(QA_PUSH_SIMULATION_KEY, 'token')).toBe(true);
    expect(isValidQaToggleValue(QA_PUSH_SIMULATION_KEY, 'rate_limited')).toBe(true);
    expect(isValidQaToggleValue(QA_PUSH_SIMULATION_KEY, 'quiet_hours')).toBe(true);
    expect(isValidQaToggleValue(QA_PUSH_SIMULATION_KEY, 'none')).toBe(true);
    expect(isValidQaToggleValue(QA_PUSH_SIMULATION_KEY, 'nope')).toBe(false);

    // pref_save_failure
    expect(isValidQaToggleValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'save_failure')).toBe(true);
    expect(isValidQaToggleValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'none')).toBe(true);
    expect(isValidQaToggleValue(QA_FORCE_PREF_SAVE_FAILURE_KEY, 'token')).toBe(false);

    // link_email_mismatch
    expect(isValidQaToggleValue(QA_LINK_EMAIL_MISMATCH_KEY, 'google')).toBe(true);
    expect(isValidQaToggleValue(QA_LINK_EMAIL_MISMATCH_KEY, 'facebook')).toBe(true);
    expect(isValidQaToggleValue(QA_LINK_EMAIL_MISMATCH_KEY, 'apple')).toBe(true);
    expect(isValidQaToggleValue(QA_LINK_EMAIL_MISMATCH_KEY, 'all')).toBe(true);
    expect(isValidQaToggleValue(QA_LINK_EMAIL_MISMATCH_KEY, 'none')).toBe(true);
    expect(isValidQaToggleValue(QA_LINK_EMAIL_MISMATCH_KEY, 'save_failure')).toBe(false);

    // Unknown storage key → always invalid.
    expect(isValidQaToggleValue('qa_unknown', 'token')).toBe(false);
  });
});

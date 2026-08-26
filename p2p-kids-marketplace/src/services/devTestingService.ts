// File: p2p-kids-marketplace/src/services/devTestingService.ts
// Development & Testing Service - OTP Bypass + Dummy User Creation
// ⚠️ FOR TESTING ONLY - Should never be used in production

import { supabase } from '../config/supabase';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ========================================
// CONFIGURATION & ENVIRONMENT CHECKS
// ========================================

const TEST_OTP_CODE = '123456';
const DEV_EMAIL_DOMAIN = '@testpass.dev';

/**
 * Check if dev/testing features should be enabled
 */
function isDevEnvironment(): boolean {
  return (
    __DEV__ ||
    process.env.NODE_ENV === 'test' ||
    process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
    process.env.EXPO_PUBLIC_DEV_SMS_BYPASS === 'true'
  );
}

/**
 * Guard function - throws if not in dev environment
 */
function requireDevEnvironment(operation: string): void {
  if (!isDevEnvironment()) {
    throw new Error(
      `[DevTestingService] ${operation} is only available in development/test environments`
    );
  }
}

/**
 * Get service role client for admin operations
 * Only available in test environment with explicit service role key
 */
function getServiceRoleClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn(
      '[DevTestingService] Service role client not available - some operations may fail'
    );
    return null;
  }

  return createClient(url, serviceKey);
}

// ========================================
// OTP BYPASS SERVICE
// ========================================

export interface OTPBypassConfig {
  enabled: boolean;
  testCode: string;
}

/**
 * Get OTP bypass configuration
 */
export function getOTPBypassConfig(): OTPBypassConfig {
  return {
    enabled: isDevEnvironment(),
    testCode: TEST_OTP_CODE,
  };
}

/**
 * Check if a given OTP code is the test bypass code
 */
export function isTestOTPCode(code: string): boolean {
  return isDevEnvironment() && code === TEST_OTP_CODE;
}

/**
 * Bypass OTP verification for testing
 * This creates a verified phone_verification_codes record
 *
 * @param userId - User ID to verify
 * @param phone - Phone number to verify
 * @returns Success status
 */
export async function bypassOTPVerification(
  userId: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  requireDevEnvironment('bypassOTPVerification');

  try {
    console.warn('🧪 [DEV] Bypassing OTP verification for:', { userId, phone });

    // Insert a verified code record
    const { error: insertError } = await supabase.from('phone_verification_codes').insert({
      user_id: userId,
      phone,
      code: TEST_OTP_CODE,
      verified: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('❌ [DEV] Failed to insert verified OTP record:', insertError);
      return { success: false, error: insertError.message };
    }

    // Call verify_user_phone RPC to update profile
    const { data: result, error: rpcError } = await supabase.rpc('verify_user_phone', {
      p_user_id: userId,
      p_phone: phone,
    });

    if (rpcError) {
      console.error('❌ [DEV] RPC error during OTP bypass:', rpcError);
      return { success: false, error: rpcError.message };
    }

    const rpcResult = result as {
      success: boolean;
      message?: string;
      rows_updated?: number;
    } | null;

    if (rpcResult?.success) {
      console.warn('✅ [DEV] OTP bypassed successfully');
      return { success: true };
    }

    return {
      success: false,
      error: rpcResult?.message || 'Failed to verify phone',
    };
  } catch (error) {
    console.error('❌ [DEV] Exception during OTP bypass:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ========================================
// DUMMY USER CREATION SERVICE
// ========================================

export interface DummyUserParams {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  nodeId?: string;
  zipCode?: string;
  subscriptionTier?: 'free' | 'kids_club_plus' | 'kids_club_pro';
  autoVerifyPhone?: boolean;
  autoConfirmEmail?: boolean;
}

export interface DummyUserResult {
  userId: string;
  email: string;
  password: string;
  profile?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
}

/**
 * Generate a unique test email
 */
function generateTestEmail(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const emailPrefix = prefix || `testuser${timestamp}${random}`;
  return `${emailPrefix}${DEV_EMAIL_DOMAIN}`;
}

/**
 * Generate a unique test phone number
 */
function generateTestPhone(): string {
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `+1555000${random}`;
}

/**
 * Create a dummy user for testing
 *
 * @param params - User parameters (all optional, will use defaults)
 * @returns Created user details
 */
export async function createDummyUser(params: DummyUserParams = {}): Promise<DummyUserResult> {
  requireDevEnvironment('createDummyUser');

  const {
    email = generateTestEmail(),
    password = 'TestPass123!',
    firstName = 'Test',
    lastName = 'User',
    displayName,
    phone = generateTestPhone(),
    dob = '2010-01-01',
    nodeId,
    zipCode,
    subscriptionTier = 'free',
    autoVerifyPhone = true,
    autoConfirmEmail = true,
  } = params;

  const finalDisplayName = displayName || `${firstName} ${lastName.charAt(0)}`;

  console.warn('🧪 [DEV] Creating dummy user:', { email, firstName, lastName });

  try {
    // Try to use service role client for auto-confirmed users
    const serviceClient = getServiceRoleClient();

    if (serviceClient && autoConfirmEmail) {
      // Create user with email already confirmed (service role only)
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: finalDisplayName,
          first_name: firstName,
          last_name: lastName,
          phone,
          dob,
          ...(nodeId && { node_id: nodeId }),
          ...(zipCode && { zip_code: zipCode }),
        },
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create user via service role: ${authError?.message}`);
      }

      const userId = authData.user.id;
      console.warn('✅ [DEV] User created via service role:', userId);

      // Update profile with additional details
      const { error: profileError } = await serviceClient
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          display_name: finalDisplayName,
          phone_number: phone,
          date_of_birth: dob,
          ...(nodeId && { node_id: nodeId }),
          ...(zipCode && { zip_code: zipCode }),
          subscription_tier: subscriptionTier,
        })
        .eq('user_id', userId);

      if (profileError) {
        console.warn('⚠️ [DEV] Profile update failed:', profileError);
      }

      // Auto-verify phone if requested
      if (autoVerifyPhone && phone) {
        const { success } = await bypassOTPVerification(userId, phone);
        if (!success) {
          console.warn('⚠️ [DEV] Phone verification bypass failed');
        }
      }

      // Fetch final profile
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('id, first_name, last_name, phone_number')
        .eq('user_id', userId)
        .single();

      return {
        userId,
        email,
        password,
        profile: profile
          ? {
              id: profile.id,
              firstName: profile.first_name,
              lastName: profile.last_name,
              phone: profile.phone_number,
            }
          : undefined,
      };
    }

    // Fallback: Use regular signup (no auto-confirm)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: finalDisplayName,
          first_name: firstName,
          last_name: lastName,
          phone,
          dob,
          ...(nodeId && { node_id: nodeId }),
          ...(zipCode && { zip_code: zipCode }),
        },
      },
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create user: ${authError?.message}`);
    }

    const userId = authData.user.id;
    console.warn('✅ [DEV] User created via signup:', userId);
    console.warn('⚠️ [DEV] Email confirmation required - check email or use service role');

    return {
      userId,
      email,
      password,
    };
  } catch (error) {
    console.error('❌ [DEV] Failed to create dummy user:', error);
    throw error;
  }
}

/**
 * Create multiple dummy users in bulk
 *
 * @param count - Number of users to create
 * @param baseParams - Base parameters for all users (will be randomized)
 * @returns Array of created user details
 */
export async function createBulkDummyUsers(
  count: number,
  baseParams: Partial<DummyUserParams> = {}
): Promise<DummyUserResult[]> {
  requireDevEnvironment('createBulkDummyUsers');

  console.warn(`🧪 [DEV] Creating ${count} dummy users...`);

  const users: DummyUserResult[] = [];
  const names = [
    ['Alex', 'River'],
    ['Sam', 'Green'],
    ['Jamie', 'Lee'],
    ['Taylor', 'Brooks'],
    ['Riley', 'Fox'],
    ['Jordan', 'Stone'],
    ['Casey', 'Blue'],
    ['Morgan', 'Sky'],
  ];

  for (let i = 0; i < count; i++) {
    const [firstName, lastName] = names[i % names.length];

    try {
      const user = await createDummyUser({
        ...baseParams,
        firstName: `${firstName}${i + 1}`,
        lastName,
        email: generateTestEmail(`user${i + 1}`),
      });

      users.push(user);
      console.warn(`✅ [DEV] Created user ${i + 1}/${count}:`, user.email);
    } catch (error) {
      console.error(`❌ [DEV] Failed to create user ${i + 1}/${count}:`, error);
    }
  }

  console.warn(`✅ [DEV] Bulk creation complete: ${users.length}/${count} users created`);
  return users;
}

/**
 * Delete a test user (cleanup)
 *
 * @param userId - User ID to delete
 */
export async function deleteDummyUser(userId: string): Promise<void> {
  requireDevEnvironment('deleteDummyUser');

  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    throw new Error('Service role client required to delete users');
  }

  console.warn('🧪 [DEV] Deleting dummy user:', userId);

  try {
    await serviceClient.auth.admin.deleteUser(userId);
    console.warn('✅ [DEV] User deleted:', userId);
  } catch (error) {
    console.error('❌ [DEV] Failed to delete user:', error);
    throw error;
  }
}

/**
 * Cleanup all test users (delete all users with @testpass.dev email)
 * ⚠️ DANGEROUS - Use with caution!
 */
export async function cleanupAllTestUsers(): Promise<{ deleted: number; errors: number }> {
  requireDevEnvironment('cleanupAllTestUsers');

  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    throw new Error('Service role client required for cleanup');
  }

  console.warn('🧪 [DEV] ⚠️ CLEANING UP ALL TEST USERS...');

  try {
    // Find all profiles with test email domain
    const { data: profiles, error: findError } = await serviceClient
      .from('profiles')
      .select('user_id, email')
      .ilike('email', `%${DEV_EMAIL_DOMAIN}`);

    if (findError) {
      throw findError;
    }

    if (!profiles || profiles.length === 0) {
      console.warn('✅ [DEV] No test users found');
      return { deleted: 0, errors: 0 };
    }

    console.warn(`🧪 [DEV] Found ${profiles.length} test users to delete`);

    let deleted = 0;
    let errors = 0;

    for (const profile of profiles) {
      try {
        await serviceClient.auth.admin.deleteUser(profile.user_id);
        deleted++;
        console.warn(`✅ [DEV] Deleted: ${profile.email}`);
      } catch (error) {
        errors++;
        console.error(`❌ [DEV] Failed to delete ${profile.email}:`, error);
      }
    }

    console.warn(`✅ [DEV] Cleanup complete: ${deleted} deleted, ${errors} errors`);
    return { deleted, errors };
  } catch (error) {
    console.error('❌ [DEV] Cleanup failed:', error);
    throw error;
  }
}

// ========================================
// QA AUTH ERROR SIMULATION (S03/S04 staging toggle — dev-only)
// ========================================

export interface SimulatedForgotPasswordError {
  message: string;
  status: number;
}

/**
 * Canonical admin_config key that arms the S03/S04 simulation.
 * Absence, 'none', or any unknown value = no simulation (fail-closed).
 * Values: 'rate_limited' | 'smtp_500'
 */
export const QA_RESET_ERROR_SIMULATION_KEY = 'qa_reset_error_simulation';

/**
 * QA staging toggle for AUTH-TC-S03 (rate-limit) / AUTH-TC-S04 (SMTP-500).
 *
 * Why this exists: ForgotPasswordScreen calls GoTrue (`resetPasswordForEmail`)
 * directly, so a rate-limit / SMTP-500 cannot be reproduced backend-only without
 * genuinely exhausting GoTrue's per-IP/email limit or breaking staging SMTP for
 * all traffic. Instead, dev/test builds read an admin_config toggle and
 * short-circuit with a FAITHFUL synthetic error object that flows through the
 * screen's existing error-branching — so the exact alert copy the AUTH guide
 * asserts for S03/S04 renders, on demand, with zero infra impact.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return null and
 *    the real GoTrue call always runs. The simulation never alters server state.
 *  - admin_config is read via `fn_get_admin_config_values` (SECURITY DEFINER,
 *    already GRANTed to anon) because direct SELECT on admin_config is RLS-locked
 *    to authenticated/service_role — this screen is pre-login (anon).
 *  - Toggle unset / read error / unknown value → null (no simulation).
 *
 * Arming (dev team, staging only — see /memories/repo/qa-test-accounts.md):
 *   supabase.rpc('upsert_admin_config_setting', {
 *     p_key: 'qa_reset_error_simulation',
 *     p_value: 'rate_limited' | 'smtp_500' | 'none',
 *     p_category: 'feature_flags',
 *     p_data_type: 'string',
 *     p_admin_id: <admin user id>,   // records the editor (BP-48)
 *   })
 */
export async function getSimulatedForgotPasswordError(): Promise<SimulatedForgotPasswordError | null> {
  if (!isDevEnvironment()) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
      p_keys: [QA_RESET_ERROR_SIMULATION_KEY],
    });

    if (error || !data) {
      console.warn(
        `[DevTestingService] ${QA_RESET_ERROR_SIMULATION_KEY} read failed: ${error?.message ?? 'no data'}`
      );
      return null;
    }

    const rows = Array.isArray(data) ? data : [data];
    const row = rows.find(
      (r) => (r as { out_key?: string })?.out_key === QA_RESET_ERROR_SIMULATION_KEY
    );
    const value = (row as { out_value?: string })?.out_value ?? 'none';

    switch (value) {
      case 'rate_limited':
        // Faithful GoTrue 429 message (matches the observed staging message the
        // app's `lm.includes('rate limit')` S03 branch keys on).
        return { message: 'Request rate limit reached', status: 429 };
      case 'smtp_500':
        // Faithful 5xx "error sending recovery email" (matches the app's S04 branch).
        return { message: 'Error sending recovery email', status: 500 };
      default:
        return null;
    }
  } catch (err) {
    console.warn(
      `[DevTestingService] ${QA_RESET_ERROR_SIMULATION_KEY} read error: ${(err as Error).message}`
    );
    return null;
  }
}

// ========================================
// QA AVATAR UPLOAD FAILURE SIMULATION (H03 staging toggle — dev-only)
// ========================================

/**
 * Canonical admin_config key that arms the AUTH-TC-H03 avatar-failure simulation.
 * Absence, 'none', or any unknown value = no simulation (fail-closed).
 * Values: 'upload_failure' | 'none'
 */
export const QA_AVATAR_UPLOAD_FAILURE_KEY = 'qa_avatar_upload_failure';

/**
 * QA staging toggle for AUTH-TC-H03 (avatar upload fails during Profile Setup).
 *
 * Why this exists: `uploadProfileAvatar` is a pure real-upload path — a genuine
 * upload failure cannot be reproduced on demand without breaking storage or
 * network. Instead, dev/test builds read an admin_config toggle and return a
 * FAITHFUL error object that flows through ProfileSetupScreen's existing
 * non-blocking branch (Warning alert → profile created without avatar), so the
 * exact behavior the AUTH guide asserts for H03 renders on demand.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return null and
 *    the real upload always runs. The simulation never alters server state.
 *  - Toggle unset / read error / unknown value → null (no simulation).
 *
 * Arming (dev team, staging only — see /memories/repo/qa-test-accounts.md):
 *   supabase.rpc('upsert_admin_config_setting', {
 *     p_key: 'qa_avatar_upload_failure',
 *     p_value: 'upload_failure' | 'none',
 *     p_category: 'feature_flags',
 *     p_data_type: 'string',
 *     p_admin_id: <admin user id>,   // records the editor (BP-48)
 *   })
 */
export async function getSimulatedAvatarUploadError(): Promise<Error | null> {
  if (!isDevEnvironment()) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
      p_keys: [QA_AVATAR_UPLOAD_FAILURE_KEY],
    });

    if (error || !data) {
      console.warn(
        `[DevTestingService] ${QA_AVATAR_UPLOAD_FAILURE_KEY} read failed: ${error?.message ?? 'no data'}`
      );
      return null;
    }

    const rows = Array.isArray(data) ? data : [data];
    const row = rows.find(
      (r) => (r as { out_key?: string })?.out_key === QA_AVATAR_UPLOAD_FAILURE_KEY
    );
    const value = (row as { out_value?: string })?.out_value ?? 'none';

    if (value === 'upload_failure') {
      // Faithful storage-upload failure. Deliberately NOT an app-crash-style
      // message — ProfileSetupScreen's H03 branch (Warning alert → continue
      // without avatar) is what must be exercised.
      return new Error('Simulated avatar upload failure (qa_avatar_upload_failure)');
    }
    return null;
  } catch (err) {
    console.warn(
      `[DevTestingService] ${QA_AVATAR_UPLOAD_FAILURE_KEY} read error: ${(err as Error).message}`
    );
    return null;
  }
}

// ========================================
// QA PROVIDER-OUTAGE SIMULATION (C05 staging toggle — dev-only)
// ========================================

/**
 * Canonical admin_config key that arms the AUTH-TC-C05 provider-outage simulation.
 * Absence, 'none', or any unknown value = no simulation (fail-closed).
 * Values: 'google' | 'facebook' | 'apple' | 'all' | 'none'
 *   - a provider name simulates THAT provider returning a 5xx
 *   - 'all' simulates every provider being unavailable
 */
export const QA_PROVIDER_UNAVAILABLE_KEY = 'qa_provider_unavailable';

/**
 * QA staging toggle for AUTH-TC-C05 ("Provider unavailable → email fallback
 * banner").
 *
 * Why this exists: `initiateSocialLogin` throws `ProviderUnavailableError` only
 * when the provider genuinely 503s / times out — not reproducible on healthy
 * staging without breaking a real provider. Instead, dev/test builds read an
 * admin_config toggle BEFORE the real OAuth call and short-circuit with a
 * FAITHFUL `ProviderUnavailableError` that flows through SocialLoginButtons'
 * existing catch → inline "{Provider} is temporarily unavailable. Sign up with
 * email instead?" banner, so the exact behavior the AUTH guide asserts for C05
 * renders on demand, with zero infra impact.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return null and
 *    the real OAuth initiation always runs. The simulation never alters server
 *    state.
 *  - admin_config is read via `fn_get_admin_config_values` (SECURITY DEFINER,
 *    already GRANTed to anon) because direct SELECT on admin_config is RLS-locked
 *    to authenticated/service_role — this screen is pre-login (anon).
 *  - Toggle unset / read error / unknown value → null (no simulation).
 *
 * Arming (dev team, staging only — see /memories/repo/qa-test-accounts.md):
 *   supabase.rpc('upsert_admin_config_setting', {
 *     p_key: 'qa_provider_unavailable',
 *     p_value: 'google' | 'facebook' | 'apple' | 'all' | 'none',
 *     p_category: 'feature_flags',
 *     p_data_type: 'string',
 *     p_admin_id: <admin user id>,   // records the editor (BP-48)
 *   })
 */
export async function getSimulatedProviderOutage(): Promise<string | null> {
  if (!isDevEnvironment()) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
      p_keys: [QA_PROVIDER_UNAVAILABLE_KEY],
    });

    if (error || !data) {
      console.warn(
        `[DevTestingService] ${QA_PROVIDER_UNAVAILABLE_KEY} read failed: ${error?.message ?? 'no data'}`
      );
      return null;
    }

    const rows = Array.isArray(data) ? data : [data];
    const row = rows.find(
      (r) => (r as { out_key?: string })?.out_key === QA_PROVIDER_UNAVAILABLE_KEY
    );
    const value = (row as { out_value?: string })?.out_value ?? 'none';

    switch (value) {
      case 'google':
      case 'facebook':
      case 'apple':
      case 'all':
        return value;
      default:
        return null;
    }
  } catch (err) {
    console.warn(
      `[DevTestingService] ${QA_PROVIDER_UNAVAILABLE_KEY} read error: ${(err as Error).message}`
    );
    return null;
  }
}

// ========================================
// SESSION-LOCAL QA TOGGLE STORAGE (A03/D02/C04) — AsyncStorage-backed
// ========================================

/**
 * TTL for the session-local QA toggles. A toggle armed via the
 * `p2pkidsmarketplace://qa-dev-toggle` deep link auto-expires after this window
 * even if it is never explicitly disarmed — a safety net that bounds leakage
 * into unrelated later runs (a full app reinstall also wipes AsyncStorage, so
 * that path is handled by the OS). Values are additionally cleared on logout
 * (AuthContext.logout → clearQaLocalValues) so a logout-then-different-persona
 * sequence starts clean.
 */
const QA_LOCAL_TOGGLE_TTL_MS = 60 * 60 * 1000; // 60 minutes

/** Shape stored per QA toggle key. `setAt` drives the TTL expiry. */
interface QaLocalValue {
  value: string;
  setAt: string; // ISO timestamp
}

/**
 * Read a session-local QA toggle value, honoring the TTL. Returns null when
 * unset, expired, unparsable, or on storage error (fail-closed).
 */
async function readQaLocalValue(key: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as QaLocalValue;
    if (!parsed || typeof parsed.value !== 'string') return null;

    const ageMs = Date.now() - new Date(parsed.setAt).getTime();
    if (Number.isNaN(ageMs) || ageMs > QA_LOCAL_TOGGLE_TTL_MS) {
      // Expired → fail-closed. Best-effort clear so the next read is clean.
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }
    return parsed.value;
  } catch (err) {
    console.warn(`[DevTestingService] ${key} read error: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Write a session-local QA toggle value. Gated by `isDevEnvironment()` — a
 * release build can never arm a toggle (the deep-link handler is inert there
 * too, but this is the fail-closed backstop).
 */
export async function setQaLocalValue(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDevEnvironment()) {
    return {
      success: false,
      error: 'QA local toggles are only available in development/test environments',
    };
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ value, setAt: new Date().toISOString() }));
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Clear every session-local QA toggle. Called from AuthContext.logout() so a
 * logout-then-different-persona sequence never leaks an armed toggle into an
 * unrelated run. No-op outside dev/test (same gate as the reads).
 */
export async function clearQaLocalValues(): Promise<void> {
  if (!isDevEnvironment()) return;
  try {
    await AsyncStorage.multiRemove([
      QA_PUSH_SIMULATION_KEY,
      QA_FORCE_PREF_SAVE_FAILURE_KEY,
      QA_LINK_EMAIL_MISMATCH_KEY,
      QA_CRASH_TRIGGER_KEY,
      QA_POLICY_LOAD_FAILURE_KEY,
    ]);
  } catch (err) {
    console.warn(`[DevTestingService] clearQaLocalValues error: ${(err as Error).message}`);
  }
}

// ========================================
// QA PUSH SIMULATION (A03 staging toggle — dev-only)
// ========================================

/**
 * Session-local AsyncStorage key that arms the AUTH-TC-A03 push simulation.
 * Absence, 'none', or any unknown value = no simulation (fail-closed).
 * Values: 'token' | 'rate_limited' | 'quiet_hours' | 'none'
 *   - 'token'         → simulate a registered push token AND mock the send so the
 *                       normal leg proceeds (instead of "No push tokens registered")
 *   - 'rate_limited'  → force the rate-limit state (10+/hr "Rate Limited" alert)
 *   - 'quiet_hours'   → force the quiet-hours state ("Quiet Hours" alert)
 */
export const QA_PUSH_SIMULATION_KEY = 'qa_local_push_simulation';

/**
 * QA staging toggle for AUTH-TC-A03 (Test Push Notification) — session-local.
 *
 * Why this exists: `sendPushNotification` hits "No push tokens registered" on the
 * simulator before the rate-limit / quiet-hours / send legs can be observed —
 * real Expo push tokens require a physical device (Device.isDevice is false on
 * sims). Dev/test builds read a SESSION-LOCAL toggle (AsyncStorage, set via the
 * `p2pkidsmarketplace://qa-dev-toggle` deep link) and force the exact leg the QA
 * run wants: a fake token + mocked send ('token'), a forced rate-limit
 * ('rate_limited'), or a forced quiet-hours ('quiet_hours'). The simulation never
 * alters server state and never makes a real Expo call.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return 'none'
 *    immediately and the real push path always runs.
 *  - Toggle unset / expired (TTL) / storage error / unknown value → 'none'.
 *
 * Arming (QA agent, self-service, session-local — see /memories/repo/qa-test-accounts.md):
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=token"
 *   values: token | rate_limited | quiet_hours | none
 */
export async function getPushSimulationMode(): Promise<
  'token' | 'rate_limited' | 'quiet_hours' | 'none'
> {
  if (!isDevEnvironment()) {
    return 'none';
  }
  const value = await readQaLocalValue(QA_PUSH_SIMULATION_KEY);
  switch (value) {
    case 'token':
    case 'rate_limited':
    case 'quiet_hours':
      return value;
    default:
      return 'none';
  }
}

// ========================================
// QA NOTIFICATION-PREF SAVE FAILURE SIMULATION (D02 staging toggle — dev-only)
// ========================================

/**
 * Session-local AsyncStorage key that arms the AUTH-TC-D02 save-failure simulation.
 * Absence, 'none', or any unknown value = no simulation (fail-closed).
 * Values: 'save_failure' | 'none'
 */
export const QA_FORCE_PREF_SAVE_FAILURE_KEY = 'qa_local_pref_save_failure';

/**
 * QA staging toggle for AUTH-TC-D02 (optimistic toggle reverts on failure) — session-local.
 *
 * Why this exists: `updateNotificationPreference` is a pure real-write path — a
 * genuine save failure cannot be reproduced on demand without breaking network
 * or DB permissions. Instead, dev/test builds read a SESSION-LOCAL toggle
 * (AsyncStorage, set via the `p2pkidsmarketplace://qa-dev-toggle` deep link) and
 * return a FAITHFUL failure result that flows through NotificationPreferencesScreen's
 * existing revert branch (optimistic update → revert + error alert), so the exact
 * behavior the ACC guide asserts for D02 renders on demand.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return null and
 *    the real save always runs. The simulation never alters server state.
 *  - Toggle unset / expired (TTL) / storage error / unknown value → null.
 *
 * Arming (QA agent, self-service, session-local — see /memories/repo/qa-test-accounts.md):
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=pref_save_failure&value=save_failure"
 *   values: save_failure | none
 */
export async function getSimulatedNotificationPrefSaveError(): Promise<Error | null> {
  if (!isDevEnvironment()) {
    return null;
  }
  const value = await readQaLocalValue(QA_FORCE_PREF_SAVE_FAILURE_KEY);
  if (value === 'save_failure') {
    // Faithful save-failure. Deliberately NOT an app-crash-style message —
    // NotificationPreferencesScreen's D02 branch (revert + error alert) is
    // what must be exercised.
    return new Error(`Simulated preference save failure (${QA_FORCE_PREF_SAVE_FAILURE_KEY})`);
  }
  return null;
}

// ========================================
// QA LINK EMAIL-MISMATCH SIMULATION (C04 staging toggle — dev-only)
// ========================================

/**
 * Session-local AsyncStorage key that arms the AUTH-TC-C04 email-mismatch simulation.
 * Absence, 'none', or any unknown value = no simulation (fail-closed).
 * Values: 'google' | 'facebook' | 'apple' | 'all' | 'none'
 *   - a provider name simulates THAT provider's OAuth callback returning a
 *     mismatched provider email
 *   - 'all' simulates every provider email mismatching
 */
export const QA_LINK_EMAIL_MISMATCH_KEY = 'qa_local_link_email_mismatch';

/**
 * QA staging toggle for AUTH-TC-C04 ("Email mismatch on link blocked") — session-local.
 *
 * Why this exists: `EmailMismatchError` is only thrown when a REAL OAuth callback
 * returns a provider email that differs from the account email — the dev Link
 * flow on LinkedAccountsScreen is simulated (initiateSocialLogin + an "OAuth
 * Flow" alert), so the mismatch path is never exercised. Dev/test builds read a
 * SESSION-LOCAL toggle (AsyncStorage, set via the `p2pkidsmarketplace://qa-dev-toggle`
 * deep link) AFTER the simulated initiation and throw a FAITHFUL
 * `EmailMismatchError` that flows through the screen's existing catch → "Email
 * Mismatch" alert, so the exact behavior the ACC guide asserts for C04 renders
 * on demand, with zero real provider round-trip.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return null and
 *    the real link flow always runs. The simulation never alters server state.
 *  - Toggle unset / expired (TTL) / storage error / unknown value → null.
 *
 * Arming (QA agent, self-service, session-local — see /memories/repo/qa-test-accounts.md):
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=link_email_mismatch&value=facebook"
 *   values: google | facebook | apple | all | none
 */
export async function getSimulatedLinkEmailMismatch(): Promise<string | null> {
  if (!isDevEnvironment()) {
    return null;
  }
  const value = await readQaLocalValue(QA_LINK_EMAIL_MISMATCH_KEY);
  switch (value) {
    case 'google':
    case 'facebook':
    case 'apple':
    case 'all':
      return value;
    default:
      return null;
  }
}

// ========================================
// QA RENDER-CRASH TRIGGER (L01-L04 staging toggle — dev-only)
// ========================================

/**
 * Session-local AsyncStorage key that arms the ACC-TC-L01-L04 render-time crash
 * trigger. Absence, 'none', or any unknown value = no crash (fail-closed).
 * Values: 'once' | 'persist' | 'none'
 *   - 'once'    → QaCrashProbe throws a render-time error ONCE, then disarms
 *                 itself so the ErrorBoundary's "Try Again" recovers (L01 + L02).
 *   - 'persist' → QaCrashProbe throws on every render while armed, so "Try
 *                 Again" re-crashes and the fallback persists, proving the
 *                 error is contained (L03).
 */
export const QA_CRASH_TRIGGER_KEY = 'qa_local_crash_trigger';

/**
 * QA staging toggle for ACC-TC-L01-L04 (ErrorBoundary fallback + recovery) —
 * session-local.
 *
 * Why this exists: ErrorBoundary is wired at the app root but there was no way
 * to trigger a render-time crash on demand. Dev/test builds read a SESSION-LOCAL
 * toggle (AsyncStorage, set via the `p2pkidsmarketplace://qa-dev-toggle` deep
 * link) and QaCrashProbe throws a CONTROLLED Error during render, which the root
 * ErrorBoundary catches → friendly fallback + recovery path, on demand.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return 'none'
 *    immediately and the probe renders nothing (it never throws).
 *  - Toggle unset / expired (TTL) / storage error / unknown value → 'none'.
 *
 * Arming (QA agent, self-service, session-local — see /memories/repo/qa-test-accounts.md):
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=crash_trigger&value=once"
 *   values: once | persist | none
 *   Recovering from an armed 'persist' crash: cold-start the app with the
 *   disarm URL (value=none) so QaDevToggleDeepLinkHandler processes it before
 *   QaCrashProbe reads the toggle.
 */
export async function getQaCrashTriggerMode(): Promise<'once' | 'persist' | 'none'> {
  if (!isDevEnvironment()) {
    return 'none';
  }
  const value = await readQaLocalValue(QA_CRASH_TRIGGER_KEY);
  switch (value) {
    case 'once':
    case 'persist':
      return value;
    default:
      return 'none';
  }
}

// ========================================
// QA POLICY LOAD FAILURE SIMULATION (J07/J08/J12 staging toggle — dev-only)
// ========================================

/**
 * Session-local AsyncStorage key that arms the ACC-TC-J07/J08/J12 legal-screen
 * unavailable / load-failure simulation. Absence, 'none', or any unknown value
 * = no simulation (fail-closed). Values: 'no_policy' | 'fetch_failure' | 'none'
 *   - 'no_policy'     → simulate "no published policy" (get_current_policy
 *                       returns null/empty) → the J07/J12 "…not available"
 *                       states on TOS / Privacy / Disclaimer.
 *   - 'fetch_failure' → simulate a network/RPC failure (the load throws) → the
 *                       J08 "Failed to load …" + Retry states.
 */
export const QA_POLICY_LOAD_FAILURE_KEY = 'qa_local_policy_failure';

export type QaPolicyLoadFailureMode = 'no_policy' | 'fetch_failure' | 'none';

/**
 * QA staging toggle for ACC-TC-J07/J08/J12 (legal-screen unavailable +
 * load-failure states) — session-local.
 *
 * Why this exists: the TOS/Privacy/Disclaimer "no published policy" and
 * fetch-failure states cannot be induced on healthy staging without an admin
 * unpublish or network manipulation. Dev/test builds read a SESSION-LOCAL
 * toggle (AsyncStorage, armed via the `p2pkidsmarketplace://qa-dev-toggle` deep
 * link) and short-circuit the policy load path so the exact states the guide
 * asserts for J07/J08/J12 render on demand.
 *
 * FAIL-CLOSED (never active outside dev/test):
 *  - `isDevEnvironment()` gates the whole read — release builds return 'none'
 *    immediately, so the real load always runs.
 *  - Toggle unset / expired (TTL) / storage error / unknown value → 'none'.
 *
 * Arming (QA agent, self-service, session-local — see /memories/repo/qa-test-accounts.md):
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=policy_failure&value=no_policy"
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=policy_failure&value=fetch_failure"
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=policy_failure&value=none"
 */
export async function getQaPolicyLoadFailureMode(): Promise<QaPolicyLoadFailureMode> {
  if (!isDevEnvironment()) {
    return 'none';
  }
  const value = await readQaLocalValue(QA_POLICY_LOAD_FAILURE_KEY);
  switch (value) {
    case 'no_policy':
    case 'fetch_failure':
      return value;
    default:
      return 'none';
  }
}

// ========================================
// QA DEV-TOGGLE DEEP-LINK KEY/VALUE VALIDATION (A03/D02/C04/L01-L04/J07-J12)
// ========================================

/**
 * Short-name → AsyncStorage key map for the `p2pkidsmarketplace://qa-dev-toggle`
 * deep link (`key` query param). Single source of truth for which session-local
 * toggles the QA agent can arm/disarm itself.
 */
export const QA_TOGGLE_SHORT_NAMES: Record<string, string> = {
  push_simulation: QA_PUSH_SIMULATION_KEY,
  pref_save_failure: QA_FORCE_PREF_SAVE_FAILURE_KEY,
  link_email_mismatch: QA_LINK_EMAIL_MISMATCH_KEY,
  crash_trigger: QA_CRASH_TRIGGER_KEY,
  policy_failure: QA_POLICY_LOAD_FAILURE_KEY,
};

/** Allowed arming values per QA toggle (AsyncStorage key → accepted values). */
const QA_TOGGLE_ALLOWED_VALUES: Record<string, string[]> = {
  [QA_PUSH_SIMULATION_KEY]: ['token', 'rate_limited', 'quiet_hours', 'none'],
  [QA_FORCE_PREF_SAVE_FAILURE_KEY]: ['save_failure', 'none'],
  [QA_LINK_EMAIL_MISMATCH_KEY]: ['google', 'facebook', 'apple', 'all', 'none'],
  [QA_CRASH_TRIGGER_KEY]: ['once', 'persist', 'none'],
  [QA_POLICY_LOAD_FAILURE_KEY]: ['no_policy', 'fetch_failure', 'none'],
};

/**
 * True when `value` is a valid arming value for the given QA toggle key.
 * Unknown keys/values are rejected so the deep link can never write garbage.
 */
export function isValidQaToggleValue(key: string, value: string): boolean {
  return (QA_TOGGLE_ALLOWED_VALUES[key] ?? []).includes(value);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Log current dev testing configuration
 */
export function logDevTestingConfig(): void {
  if (!isDevEnvironment()) {
    console.log('[DevTestingService] Not in dev environment - testing features disabled');
    return;
  }

  console.log('🧪 [DevTestingService] Configuration:');
  console.log('  Environment:', process.env.EXPO_PUBLIC_ENVIRONMENT);
  console.log('  __DEV__:', __DEV__);
  console.log('  OTP Bypass Enabled:', getOTPBypassConfig().enabled);
  console.log('  Test OTP Code:', TEST_OTP_CODE);
  console.log('  Test Email Domain:', DEV_EMAIL_DOMAIN);
  console.log('  Service Role Available:', !!getServiceRoleClient());
}

// ========================================
// EXPORTS
// ========================================

export default {
  // Environment
  isDevEnvironment,
  logDevTestingConfig,

  // OTP Bypass
  getOTPBypassConfig,
  isTestOTPCode,
  bypassOTPVerification,

  // User Creation
  createDummyUser,
  createBulkDummyUsers,
  deleteDummyUser,
  cleanupAllTestUsers,

  // QA Auth Error Simulation (S03/S04)
  getSimulatedForgotPasswordError,

  // QA Provider-Outage Simulation (C05)
  getSimulatedProviderOutage,

  // QA Push Simulation (A03)
  getPushSimulationMode,

  // QA Notification-Pref Save-Failure Simulation (D02)
  getSimulatedNotificationPrefSaveError,

  // QA Link Email-Mismatch Simulation (C04)
  getSimulatedLinkEmailMismatch,

  // Session-local QA toggle storage (A03/D02/C04)
  setQaLocalValue,
  clearQaLocalValues,
  QA_TOGGLE_SHORT_NAMES,
  isValidQaToggleValue,
};

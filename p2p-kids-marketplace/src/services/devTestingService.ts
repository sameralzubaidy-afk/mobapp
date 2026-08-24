// File: p2p-kids-marketplace/src/services/devTestingService.ts
// Development & Testing Service - OTP Bypass + Dummy User Creation
// ⚠️ FOR TESTING ONLY - Should never be used in production

import { supabase } from '../config/supabase';
import { createClient } from '@supabase/supabase-js';

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
};

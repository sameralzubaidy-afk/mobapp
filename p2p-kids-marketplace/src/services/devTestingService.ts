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
    console.warn('[DevTestingService] Service role client not available - some operations may fail');
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
    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
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
export async function createDummyUser(
  params: DummyUserParams = {}
): Promise<DummyUserResult> {
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
};

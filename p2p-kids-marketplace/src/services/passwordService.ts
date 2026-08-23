// File: p2p-kids-marketplace/src/services/passwordService.ts
// Password management service for social users (password fallback)

import { supabase } from './supabase/client';
import { captureException } from './errorReporter';
import { COMMON_PASSWORDS } from '@/data/common-passwords';

/**
 * Error codes for password operations
 */
export enum PasswordErrorCode {
  TOO_SHORT = 'TOO_SHORT',
  NO_LETTER = 'NO_LETTER',
  NO_DIGIT = 'NO_DIGIT',
  COMMON_PASSWORD = 'COMMON_PASSWORD',
  UPDATE_FAILED = 'UPDATE_FAILED',
  NOT_ALLOWED = 'NOT_ALLOWED',
}

/**
 * Password strength validation result
 */
export interface PasswordStrengthResult {
  valid: boolean;
  reasons: PasswordErrorCode[];
}

/**
 * Check if a user can set a password (i.e., signed up via OAuth and has no password yet)
 *
 * @param userId - User ID to check
 * @returns true if user can set password (no password currently set)
 *
 * @example
 * ```ts
 * const canSet = await canSetPassword(user.id);
 * if (canSet) {
 *   // Show "Set Password" UI
 * }
 * ```
 */
export async function canSetPassword(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_set_password', {
      p_user_id: userId,
    });

    if (error) {
      captureException(error, {
        tags: { service: 'passwordService', action: 'can_set_password_rpc' },
      });
      return false; // Graceful fallback: assume cannot set password
    }

    return data === true;
  } catch (err) {
    captureException(err, {
      tags: { service: 'passwordService', action: 'can_set_password_exception' },
    });
    return false;
  }
}

/**
 * Validate password strength
 *
 * Requirements:
 * - Length >= 8 characters
 * - Contains at least one letter (a-z, A-Z)
 * - Contains at least one digit (0-9)
 * - Not in common passwords blocklist
 *
 * @param password - Password to validate
 * @returns Validation result with reasons array (empty if valid)
 *
 * @example
 * ```ts
 * const result = validatePasswordStrength('MyPass1');
 * if (!result.valid) {
 *   console.log('Weak password:', result.reasons);
 *   // ['TOO_SHORT']
 * }
 * ```
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const reasons: PasswordErrorCode[] = [];

  // Check length
  if (password.length < 8) {
    reasons.push(PasswordErrorCode.TOO_SHORT);
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    reasons.push(PasswordErrorCode.NO_LETTER);
  }

  // Check for at least one digit
  if (!/\d/.test(password)) {
    reasons.push(PasswordErrorCode.NO_DIGIT);
  }

  // Check against common passwords (case-insensitive)
  const passwordLower = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(passwordLower)) {
    reasons.push(PasswordErrorCode.COMMON_PASSWORD);
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Set password for a social user (OAuth signup) who doesn't have a password yet
 *
 * Process:
 * 1. Validates password strength
 * 2. Calls supabase.auth.updateUser({ password }) to set password
 * 3. NEVER writes directly to auth.users table
 *
 * @param newPassword - New password to set
 * @returns Success status and error message if failed
 *
 * @throws {Error} with code 'NOT_ALLOWED' if user already has a password
 * @throws {Error} with validation codes if password is weak
 *
 * @example
 * ```ts
 * const result = await setPasswordForSocialUser('MySecurePass123');
 * if (!result.success) {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export async function setPasswordForSocialUser(
  newPassword: string
): Promise<{ success: boolean; error?: string; code?: PasswordErrorCode }> {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      captureException(userError, {
        tags: { service: 'passwordService', action: 'get_current_user' },
      });
      return {
        success: false,
        error: 'Not authenticated',
        code: PasswordErrorCode.UPDATE_FAILED,
      };
    }

    // Check if user can set password
    const allowed = await canSetPassword(user.id);
    if (!allowed) {
      return {
        success: false,
        error: 'User already has a password or is not eligible to set one',
        code: PasswordErrorCode.NOT_ALLOWED,
      };
    }

    // Validate password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      const reasonsText = validation.reasons.join(', ');
      return {
        success: false,
        error: `Password validation failed: ${reasonsText}`,
        code: validation.reasons[0], // Return first reason as primary code
      };
    }

    // Set password via Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      captureException(updateError, {
        tags: { service: 'passwordService', action: 'update_user' },
      });
      return {
        success: false,
        error: updateError.message || 'Failed to set password',
        code: PasswordErrorCode.UPDATE_FAILED,
      };
    }

    console.log('[passwordService] Password set successfully for user:', user.id);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    captureException(error, {
      tags: { service: 'passwordService', action: 'set_password_exception' },
    });
    return {
      success: false,
      error: error.message || 'Unexpected error setting password',
      code: PasswordErrorCode.UPDATE_FAILED,
    };
  }
}

/**
 * Get user-friendly error messages for password error codes
 */
export function getPasswordErrorMessage(code: PasswordErrorCode): string {
  switch (code) {
    case PasswordErrorCode.TOO_SHORT:
      return 'Password must be at least 8 characters long';
    case PasswordErrorCode.NO_LETTER:
      return 'Password must contain at least one letter';
    case PasswordErrorCode.NO_DIGIT:
      return 'Password must contain at least one digit';
    case PasswordErrorCode.COMMON_PASSWORD:
      return 'This password is too common. Please choose a stronger password';
    case PasswordErrorCode.NOT_ALLOWED:
      return 'You already have a password set';
    case PasswordErrorCode.UPDATE_FAILED:
      return 'Failed to update password. Please try again';
    default:
      return 'Invalid password';
  }
}

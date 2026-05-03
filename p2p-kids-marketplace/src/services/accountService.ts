// File: src/services/accountService.ts
// TASK: AUTH-V3-004 — AccountService (Check / Link / Unlink / List Providers)
// Source: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md v1.0

import { supabase } from '../config/supabase';
import type { OAuthProvider, LinkedProvider, ProviderProfile } from '../types/auth-v3';
import { EmailMismatchError, LastLoginMethodError } from '../types/auth-v3-errors';

/**
 * Result of checking if an account exists by email
 * Used for smart account-linking decisions during OAuth flows
 */
export interface AccountCheckResult {
  /** Whether an account with this email exists */
  exists: boolean;

  /** User ID if account exists */
  userId?: string;

  /** Linked OAuth providers if account exists */
  providers?: OAuthProvider[];

  /** Whether the account has a password set */
  hasPassword?: boolean;
}

/**
 * Check if an account exists for a given email
 *
 * @param email - Email address to check
 * @returns Account existence details
 *
 * @throws {Error} Database query errors
 *
 * @example
 * ```ts
 * const result = await checkAccountExists('user@example.com');
 * if (result.exists && result.hasPassword) {
 *   // Prompt for password re-auth before linking
 * }
 * ```
 */
export async function checkAccountExists(email: string): Promise<AccountCheckResult> {
  try {
    // Query auth.users for account existence
    // Note: This requires a SECURITY DEFINER RPC if direct access is blocked by RLS
    // For now, we'll use Supabase Admin API pattern via service role
    const { data: userData, error: userError } = await supabase.rpc(
      'check_account_exists_by_email',
      {
        p_email: email.toLowerCase(),
      }
    );

    if (userError) {
      // If RPC doesn't exist, fall back to querying user_linked_providers
      // This is a temporary fallback - in production, the RPC should exist
      console.warn(
        '[accountService] check_account_exists_by_email RPC not found, using fallback',
        userError
      );

      // Fallback: query current user only
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return { exists: false };
      }

      if (user.email?.toLowerCase() !== email.toLowerCase()) {
        return { exists: false };
      }

      const providers = await getLinkedProviders();
      const hasPassword = await checkIfUserHasPassword(user.id);

      return {
        exists: true,
        userId: user.id,
        providers: providers.map((p) => p.provider),
        hasPassword,
      };
    }

    if (!userData || !userData.exists) {
      return { exists: false };
    }

    const hasPassword =
      Boolean(userData.has_password) ||
      (userData.user_id ? await checkIfUserHasPassword(userData.user_id) : false);

    return {
      exists: true,
      userId: userData.user_id,
      providers: userData.providers || [],
      hasPassword,
    };
  } catch (error) {
    console.error('[accountService] checkAccountExists failed:', error);
    throw error;
  }
}

/**
 * Link a social account to the current user
 *
 * Requires password re-authentication if the account has a password set.
 * For social-only accounts, requires signing in with an existing provider first.
 *
 * @param provider - OAuth provider to link ('google' | 'facebook' | 'apple')
 * @param providerProfile - Profile data from the provider
 * @param passwordForReauth - Current password for re-authentication (required if account has password)
 * @returns Updated list of linked providers
 *
 * @throws {EmailMismatchError} If provider email doesn't match account email
 * @throws {Error} If password re-auth fails or link operation fails
 *
 * @example
 * ```ts
 * const updated = await linkSocialAccount('google', {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   avatar: 'https://...',
 *   provider: 'google',
 *   providerUserId: '12345'
 * }, 'myPassword123');
 * ```
 */
export async function linkSocialAccount(
  provider: OAuthProvider,
  providerProfile: ProviderProfile,
  passwordForReauth?: string
): Promise<LinkedProvider[]> {
  try {
    // 1. Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // 2. Verify email match (critical security check)
    if (user.email?.toLowerCase() !== providerProfile.email.toLowerCase()) {
      throw new EmailMismatchError(providerProfile.email, user.email || 'unknown');
    }

    // 3. Password re-authentication (if account has password)
    const hasPassword = await checkIfUserHasPassword(user.id);

    if (hasPassword) {
      if (!passwordForReauth) {
        throw new Error('Password re-authentication required for accounts with password set');
      }

      // Re-authenticate with password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForReauth,
      });

      if (reauthError) {
        throw new Error(`Password re-authentication failed: ${reauthError.message}`);
      }
    }

    // 4. Link the identity via Supabase Auth
    // Note: linkIdentity is called via the signInWithOAuth flow
    // The actual linking happens when the OAuth callback completes
    // Here we prepare the linking request
    const { error: oauthError } = await supabase.auth.linkIdentity({
      provider: provider as any, // Cast to satisfy Supabase types
    });

    if (oauthError) {
      throw new Error(`Failed to initiate identity linking: ${oauthError.message}`);
    }

    // 5. Call the link_social_account RPC for audit + email validation
    // This RPC is SECURITY DEFINER and writes to admin_audit_logs
    const { error: rpcError } = await supabase.rpc('link_social_account', {
      p_provider_name: provider,
      p_provider_user_id: providerProfile.providerUserId,
      p_provider_email: providerProfile.email,
      p_provider_data: {
        name: providerProfile.name,
        avatar: providerProfile.avatar,
      },
    });

    if (rpcError) {
      // Check for email mismatch error from RPC
      if (rpcError.message?.includes('EmailMismatchError')) {
        const match = rpcError.message.match(/EmailMismatchError: (.*) vs (.*)/);
        if (match) {
          throw new EmailMismatchError(match[1], match[2]);
        }
      }
      throw new Error(`Failed to link social account: ${rpcError.message}`);
    }

    // 6. Return updated list of linked providers
    return await getLinkedProviders();
  } catch (error) {
    console.error('[accountService] linkSocialAccount failed:', error);
    throw error;
  }
}

/**
 * Unlink a social account from the current user
 *
 * Enforces the last-method guard: cannot unlink if it's the only login method.
 *
 * @param provider - OAuth provider to unlink
 * @returns Updated list of linked providers
 *
 * @throws {LastLoginMethodError} If unlinking would leave no login methods
 * @throws {Error} If unlink operation fails
 *
 * @example
 * ```ts
 * try {
 *   const updated = await unlinkSocialAccount('google');
 * } catch (error) {
 *   if (error instanceof LastLoginMethodError) {
 *     alert('You must keep at least one login method');
 *   }
 * }
 * ```
 */
export async function unlinkSocialAccount(provider: OAuthProvider): Promise<LinkedProvider[]> {
  try {
    // 1. Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // 2. Count login methods (last-method guard)
    const methodCount = await countLoginMethods(user.id);

    if (methodCount <= 1) {
      throw new LastLoginMethodError(
        `Cannot unlink ${provider} - it's your only login method. Add another method first.`
      );
    }

    // 3. Find the identity to unlink
    const { data: identities, error: identitiesError } = await supabase.auth.getUserIdentities();

    if (identitiesError) {
      throw new Error(`Failed to fetch identities: ${identitiesError.message}`);
    }

    const identity = identities?.identities?.find((id) => id.provider === provider);

    if (!identity) {
      throw new Error(`No ${provider} identity found to unlink`);
    }

    // 4. Unlink the identity
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);

    if (unlinkError) {
      throw new Error(`Failed to unlink identity: ${unlinkError.message}`);
    }

    // 5. Write audit log
    await writeAuditLog(user.id, 'unlink_social_account', {
      provider,
      identity_id: identity.id,
    });

    // 6. Return updated list of linked providers
    return await getLinkedProviders();
  } catch (error) {
    console.error('[accountService] unlinkSocialAccount failed:', error);
    throw error;
  }
}

/**
 * Get list of linked OAuth providers for the current user
 *
 * @returns List of linked providers ordered by linkedAt (oldest first)
 *
 * @throws {Error} Database query errors
 *
 * @example
 * ```ts
 * const linked = await getLinkedProviders();
 * // [{ provider: 'google', providerEmail: 'user@gmail.com', linkedAt: '...' }]
 * ```
 */
export async function getLinkedProviders(): Promise<LinkedProvider[]> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return [];
    }

    // Query the user_linked_providers view
    const { data, error } = await supabase
      .from('user_linked_providers')
      .select('provider, provider_email, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[accountService] getLinkedProviders query failed:', error);
      throw new Error(`Failed to fetch linked providers: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((row) => ({
      provider: row.provider as OAuthProvider,
      providerEmail: row.provider_email || '',
      linkedAt: row.created_at || '',
    }));
  } catch (error) {
    console.error('[accountService] getLinkedProviders failed:', error);
    throw error;
  }
}

/**
 * Count total login methods for a user
 *
 * Login methods = number of OAuth identities + 1 (if password is set)
 *
 * @param userId - User ID to count methods for
 * @returns Total number of login methods
 *
 * @example
 * ```ts
 * const count = await countLoginMethods(userId);
 * // User has password + Google => 2
 * // User has Google + Facebook, no password => 2
 * // User has only Google, no password => 1
 * ```
 */
export async function countLoginMethods(userId: string): Promise<number> {
  try {
    // Count identities from auth.identities
    const { data: identities, error: identitiesError } = await supabase.auth.getUserIdentities();

    if (identitiesError) {
      throw new Error(`Failed to fetch identities: ${identitiesError.message}`);
    }

    const identitiesCount = identities?.identities?.length || 0;

    // Check if user has password
    const hasPassword = await checkIfUserHasPassword(userId);

    const passwordCount = hasPassword ? 1 : 0;

    return identitiesCount + passwordCount;
  } catch (error) {
    console.error('[accountService] countLoginMethods failed:', error);
    throw error;
  }
}

// ===== INTERNAL HELPERS =====

/**
 * Check if user has a password set
 *
 * @internal
 * @param userId - User ID to check
 * @returns true if user has password, false otherwise
 */
async function checkIfUserHasPassword(userId: string): Promise<boolean> {
  try {
    // First try RPC if it exists
    const { data, error } = await supabase.rpc('can_set_password', {
      p_user_id: userId,
    });

    if (!error && data !== null && data !== undefined) {
      // RPC returns true if user CAN set password (no password exists)
      // So we invert it
      return !data;
    }

    // Fallback: check user metadata
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Check if user has password via identities
    // If user has an 'email' identity, they have a password
    const { data: identities } = await supabase.auth.getUserIdentities();
    const hasEmailIdentity = identities?.identities?.some((id) => id.provider === 'email');

    return hasEmailIdentity || false;
  } catch (error) {
    console.error('[accountService] checkIfUserHasPassword failed:', error);
    // Default to false on error (safer to assume no password)
    return false;
  }
}

/**
 * Write an audit log entry
 *
 * @internal
 * @param userId - User performing the action
 * @param action - Action type
 * @param details - Additional details as JSON
 */
async function writeAuditLog(
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase.from('admin_audit_logs').insert({
      actor_id: userId,
      action_type: action,
      entity_type: 'user',
      entity_id: userId,
      payload: details,
      reason: `User-initiated ${action}`,
    });

    if (error) {
      console.warn('[accountService] Failed to write audit log:', error);
      // Don't throw - audit log failure shouldn't block the operation
    }
  } catch (error) {
    console.warn('[accountService] writeAuditLog failed:', error);
  }
}

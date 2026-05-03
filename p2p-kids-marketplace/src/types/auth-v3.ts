// File: src/types/auth-v3.ts
// Shared TypeScript types for AUTH V3 (Social Login, Account Linking, Phone Verification)
// Source: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md (TASK AUTH-V3-002)

/**
 * Supported OAuth providers for social authentication
 * No string escape hatch - strict union only
 */
export type OAuthProvider = 'google' | 'facebook' | 'apple';

/**
 * Profile data extracted from OAuth provider
 * Used for auto-fill during social signup
 */
export interface ProviderProfile {
  /** Full name from provider (e.g., "John Doe") */
  name: string;

  /** Email from provider (already verified by provider) */
  email: string;

  /** Avatar URL from provider (optional - may not exist for Apple) */
  avatar?: string;

  /** Which provider this profile came from */
  provider: OAuthProvider;

  /** Provider's unique user ID (e.g., Google sub, Facebook id) */
  providerUserId: string;
}

/**
 * A linked provider account on a user's account
 * Used in Settings → Linked Accounts screen
 */
export interface LinkedProvider {
  /** Which provider is linked */
  provider: OAuthProvider;

  /** Email address registered with this provider */
  providerEmail: string;

  /** ISO timestamp when this provider was linked */
  linkedAt: string;
}

/**
 * OAuth session state for CSRF protection
 * Stored in expo-secure-store during OAuth flow
 */
export interface OAuthSession {
  /** Cryptographically random state token (32 bytes base64) */
  state: string;

  /** Which provider this session is for */
  provider: OAuthProvider;

  /** ISO timestamp when state was generated */
  createdAt: string;

  /** Return URL after OAuth callback (deep link) */
  returnUrl?: string;
}

/**
 * Result of authentication operations (signup, login, link)
 * Standardized response format across all auth flows
 */
export interface AuthResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** User ID if success=true */
  userId?: string;

  /** Session token if success=true */
  sessionToken?: string;

  /** Error code if success=false (stable codes from auth-v3-errors.ts) */
  errorCode?: string;

  /** Human-readable error message if success=false */
  errorMessage?: string;

  /** Additional metadata (e.g., trial activated, phone required) */
  metadata?: Record<string, unknown>;
}

/**
 * Phone verification code record (server-side)
 * Stored in phone_verification_codes table
 */
export interface PhoneVerificationCode {
  /** Unique ID for this verification attempt */
  id: string;

  /** User ID requesting verification */
  userId: string;

  /** Phone number (E.164 format, e.g., +14155551234) */
  phone: string;

  /** Bcrypt hash of the 6-digit OTP code (never store plaintext) */
  codeHash: string;

  /** Number of failed verification attempts for this code */
  attempts: number;

  /** ISO timestamp when code was generated */
  createdAt: string;

  /** ISO timestamp when code expires (5 minutes from created_at) */
  expiresAt: string;
}

/**
 * Result of password strength validation
 * Value return (never throws) - UI displays reasons array
 */
export interface PasswordStrengthResult {
  /** Whether password meets all strength requirements */
  valid: boolean;

  /** Array of reasons password failed (empty if valid=true) */
  reasons: string[];
}

// File: src/types/auth-v3-errors.ts
// Typed error classes for AUTH V3 (Social Login, Account Linking, Phone Verification)
// Source: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md (TASK AUTH-V3-002)
// All errors carry a stable `code` field for structured error handling

/**
 * OAuth state token mismatch during callback
 * Indicates potential CSRF attack or stale session
 * Recovery: abort flow, clear session, prompt fresh login
 */
export class OAuthStateMismatchError extends Error {
  public readonly code = 'OAUTH_STATE_MISMATCH';
  
  constructor(message: string = 'OAuth state token mismatch - possible CSRF attack') {
    super(message);
    this.name = 'OAuthStateMismatchError';
    Object.setPrototypeOf(this, OAuthStateMismatchError.prototype);
  }
}

/**
 * Provider email doesn't match existing account email during linking
 * Prevents account takeover via different email
 * Recovery: show error, suggest signing in with matching provider
 */
export class EmailMismatchError extends Error {
  public readonly code = 'EMAIL_MISMATCH';
  
  /** Email from provider that was attempted */
  public readonly providerEmail: string;
  
  /** Email on existing account */
  public readonly accountEmail: string;
  
  constructor(providerEmail: string, accountEmail: string) {
    super(
      `Cannot link provider email "${providerEmail}" - account email is "${accountEmail}"`
    );
    this.name = 'EmailMismatchError';
    this.providerEmail = providerEmail;
    this.accountEmail = accountEmail;
    Object.setPrototypeOf(this, EmailMismatchError.prototype);
  }
}

/**
 * Attempting to unlink the last remaining login method
 * At least one method must remain to prevent account lockout
 * Recovery: show error, require user to add another method first
 */
export class LastLoginMethodError extends Error {
  public readonly code = 'LAST_LOGIN_METHOD';
  
  /** The provider that cannot be unlinked */
  public readonly provider: string;
  
  constructor(provider: string) {
    super(
      `Cannot unlink ${provider} - it is your last login method. Add another method first.`
    );
    this.name = 'LastLoginMethodError';
    this.provider = provider;
    Object.setPrototypeOf(this, LastLoginMethodError.prototype);
  }
}

/**
 * OTP code has expired (> 5 minutes old)
 * Recovery: send a new code
 */
export class OTPExpiredError extends Error {
  public readonly code = 'OTP_EXPIRED';
  
  /** ISO timestamp when code expired */
  public readonly expiredAt: string;
  
  constructor(expiredAt: string) {
    super(`Verification code expired at ${expiredAt}. Request a new code.`);
    this.name = 'OTPExpiredError';
    this.expiredAt = expiredAt;
    Object.setPrototypeOf(this, OTPExpiredError.prototype);
  }
}

/**
 * Too many OTP send attempts
 * Rate limits: 3/phone/hour, 5/user/day
 * Recovery: wait until retry_after, show countdown timer
 */
export class OTPRateLimitError extends Error {
  public readonly code = 'OTP_RATE_LIMIT';
  
  /** Seconds until next attempt allowed */
  public readonly retryAfterSeconds: number;
  
  /** Human-readable rate limit reason (e.g., "3 per hour") */
  public readonly limitType: string;
  
  constructor(retryAfterSeconds: number, limitType: string) {
    super(
      `Too many verification attempts (${limitType}). Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`
    );
    this.name = 'OTPRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.limitType = limitType;
    Object.setPrototypeOf(this, OTPRateLimitError.prototype);
  }
}

/**
 * Password does not meet strength requirements
 * Requirements: min 8 chars, 1 letter, 1 digit, not in blocklist
 * Recovery: show reasons array to user, prompt for stronger password
 */
export class WeakPasswordError extends Error {
  public readonly code = 'WEAK_PASSWORD';
  
  /** Array of specific reasons password failed (for UI display) */
  public readonly reasons: string[];
  
  constructor(reasons: string[]) {
    super(`Password does not meet requirements: ${reasons.join(', ')}`);
    this.name = 'WeakPasswordError';
    this.reasons = reasons;
    Object.setPrototypeOf(this, WeakPasswordError.prototype);
  }
}

/**
 * Failed to download avatar from provider
 * Non-blocking - signup continues with default avatar
 * Recovery: log warning, fall back to default avatar
 */
export class AvatarDownloadError extends Error {
  public readonly code = 'AVATAR_DOWNLOAD_FAILED';
  
  /** The URL that failed to download */
  public readonly avatarUrl: string;
  
  /** Underlying error reason (e.g., "timeout", "invalid_format") */
  public readonly reason: string;
  
  constructor(avatarUrl: string, reason: string) {
    super(`Failed to download avatar from ${avatarUrl}: ${reason}`);
    this.name = 'AvatarDownloadError';
    this.avatarUrl = avatarUrl;
    this.reason = reason;
    Object.setPrototypeOf(this, AvatarDownloadError.prototype);
  }
}

/**
 * OAuth provider is temporarily unavailable (503, timeout > 10s)
 * Recovery: show fallback CTA for email signup
 */
export class ProviderUnavailableError extends Error {
  public readonly code = 'PROVIDER_UNAVAILABLE';
  
  /** The provider that is unavailable */
  public readonly provider: string;
  
  /** HTTP status code or "timeout" */
  public readonly status: string;
  
  constructor(provider: string, status: string) {
    super(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} is temporarily unavailable. Try email signup instead.`
    );
    this.name = 'ProviderUnavailableError';
    this.provider = provider;
    this.status = status;
    Object.setPrototypeOf(this, ProviderUnavailableError.prototype);
  }
}

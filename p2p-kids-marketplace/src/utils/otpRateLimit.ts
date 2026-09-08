// File: p2p-kids-marketplace/src/utils/otpRateLimit.ts
// FIX-Task-6 (QA Task 43m, 2026-09-08): shared OTP rate-limit presentation
// helpers — the single source of truth for (a) detecting an OTP rate-limit
// error and reading its retry window, (b) the friendly copy shown to parents,
// and (c) how the resend countdown is displayed.
//
// Why this exists: the standalone signup PhoneVerificationScreen showed the raw
// backend string ("Rate limit exceeded") in a generic Alert and left Resend
// enabled for the whole retry window, while EditProfileScreen / usePhoneVerification
// already rendered the friendly "Too many attempts..." copy with a disabled,
// live-countdown Resend. Instead of copy-pasting that handling into the signup
// screen (recreating the same divergence risk later), the presentation logic is
// extracted here and consumed by every OTP send surface.
//
// Cross-class note: this codebase has TWO OTPRateLimitError classes (one thrown
// by @/services/phoneService, one declared in @/types/auth-v3-errors), so
// `instanceof` alone is unreliable across call sites. resolveOtpRetrySeconds
// therefore detects rate-limit errors STRUCTURALLY (presence of a positive
// `retryAfterSeconds`), which works for both classes and for any error payload
// that carries the field.

/**
 * Read the retry window (seconds) off an OTP send failure, or null when the
 * error is not an OTP rate limit. Structural detection — handles both
 * OTPRateLimitError classes and any object carrying `retryAfterSeconds`.
 *
 * @param error - The error thrown by sendPhoneVerificationCode (or a mock).
 * @returns A positive whole number of seconds, or null when not a rate limit.
 */
export function resolveOtpRetrySeconds(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  if (!('retryAfterSeconds' in error)) {
    return null;
  }
  const raw = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  const seconds = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.round(seconds);
}

/**
 * Friendly copy for an OTP rate-limit, reporting the same retryAfterSeconds the
 * disabled Resend countdown counts down from (they must always agree).
 */
export function buildOtpRateLimitMessage(retryAfterSeconds: number): string {
  return `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`;
}

/**
 * Format a resend/retry countdown so it stays HUMAN for the whole window:
 * - >= 1h  -> "1h"/"1h 30m"/"24h" (range-based: 3600–7199s all read "1h", so a
 *   long rate-limit retry window never dumps raw seconds like "3598s").
 * - 2m–59m -> "30m" (a 30-minute retry window reads "30m", not "1800s").
 * - < 2m   -> "59s" (preserves the guide's normal 60s-cooldown UX, AUTH-TC-E03).
 *
 * The underlying value is never truncated — we only change how it is displayed,
 * keeping it in agreement with the sibling buildOtpRateLimitMessage message
 * (which reports the same retryAfterSeconds in seconds).
 *
 * Range-based (vs. exact-value) formatting is intentional: a live countdown
 * decrements 1s at a time, so an exact-value branch like `>= 3600 -> "1h"` would
 * fire only for the single second the value equals a round hour and then dump
 * raw seconds for the rest of the window (FIX-Task-6 QA finding #2, 2026-09-08).
 */
export function formatOtpCountdown(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));

  if (rounded >= 3600) {
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (rounded >= 120) {
    const minutes = Math.floor(rounded / 60);
    return `${minutes}m`;
  }

  return `${rounded}s`;
}

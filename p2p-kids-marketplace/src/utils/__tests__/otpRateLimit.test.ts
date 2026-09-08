// File: p2p-kids-marketplace/src/utils/__tests__/otpRateLimit.test.ts
// FIX-Task-6 (QA Task 43m): unit tests for the shared OTP rate-limit helpers.

import {
  buildOtpRateLimitMessage,
  formatOtpCountdown,
  resolveOtpRetrySeconds,
} from '../otpRateLimit';
import { OTPRateLimitError as AuthV3OtpRateLimitError } from '@/types/auth-v3-errors';

describe('resolveOtpRetrySeconds', () => {
  it('reads retryAfterSeconds off the auth-v3-errors OTPRateLimitError class', () => {
    const error = new AuthV3OtpRateLimitError(3600, '3 per hour');
    expect(resolveOtpRetrySeconds(error)).toBe(3600);
  });

  it('reads retryAfterSeconds off the phoneService-style error (plain class shape)', () => {
    // phoneService declares its OWN OTPRateLimitError class, so structural
    // detection must work for any object carrying a positive retryAfterSeconds.
    const error = new Error('Rate limit exceeded') as Error & { retryAfterSeconds: number };
    error.retryAfterSeconds = 86400;
    expect(resolveOtpRetrySeconds(error)).toBe(86400);
  });

  it('rounds fractional retry windows to whole seconds', () => {
    const error = { retryAfterSeconds: 119.6 };
    expect(resolveOtpRetrySeconds(error)).toBe(120);
  });

  it('returns null for a generic (non-rate-limit) Error', () => {
    expect(resolveOtpRetrySeconds(new Error('Failed to send'))).toBeNull();
  });

  it('returns null for non-object / nullish inputs', () => {
    expect(resolveOtpRetrySeconds(null)).toBeNull();
    expect(resolveOtpRetrySeconds(undefined)).toBeNull();
    expect(resolveOtpRetrySeconds('rate limited')).toBeNull();
  });

  it('returns null when retryAfterSeconds is missing, zero, negative, or NaN', () => {
    expect(resolveOtpRetrySeconds({})).toBeNull();
    expect(resolveOtpRetrySeconds({ retryAfterSeconds: 0 })).toBeNull();
    expect(resolveOtpRetrySeconds({ retryAfterSeconds: -5 })).toBeNull();
    expect(resolveOtpRetrySeconds({ retryAfterSeconds: NaN })).toBeNull();
    expect(resolveOtpRetrySeconds({ retryAfterSeconds: 'nope' })).toBeNull();
  });
});

describe('buildOtpRateLimitMessage', () => {
  it('renders the friendly copy with the exact retry window', () => {
    expect(buildOtpRateLimitMessage(3600)).toBe(
      'Too many attempts. Please try again in 3600 seconds.'
    );
    expect(buildOtpRateLimitMessage(120)).toBe(
      'Too many attempts. Please try again in 120 seconds.'
    );
  });
});

describe('formatOtpCountdown', () => {
  it('renders sub-two-minute windows (incl. the normal 60s cooldown) as seconds', () => {
    expect(formatOtpCountdown(59)).toBe('59s');
    expect(formatOtpCountdown(60)).toBe('60s');
    expect(formatOtpCountdown(90)).toBe('90s');
    expect(formatOtpCountdown(119)).toBe('119s');
  });

  it('renders 2–59 minute windows as minutes, not raw seconds', () => {
    expect(formatOtpCountdown(120)).toBe('2m');
    expect(formatOtpCountdown(300)).toBe('5m');
    expect(formatOtpCountdown(1800)).toBe('30m');
    // Just under an hour must NOT dump raw seconds (the QA finding #2 case).
    expect(formatOtpCountdown(3599)).toBe('59m');
  });

  it('renders whole hours readably for long rate-limit windows', () => {
    expect(formatOtpCountdown(3600)).toBe('1h');
    expect(formatOtpCountdown(86400)).toBe('24h');
  });

  it('stays range-based for the whole long window (not only at exact hours)', () => {
    // 1h 59m remaining (3599s into a 2h window) reads "1h 59m", not "7199s".
    expect(formatOtpCountdown(7199)).toBe('1h 59m');
    expect(formatOtpCountdown(7200)).toBe('2h');
    // A window just past 1h reads "1h", then minutes as it ticks below the hour.
    expect(formatOtpCountdown(3660)).toBe('1h 1m');
  });

  it('renders hours + minutes when the window has a non-zero minute part', () => {
    expect(formatOtpCountdown(5400)).toBe('1h 30m');
    expect(formatOtpCountdown(3600 + 60 * 45 + 12)).toBe('1h 45m');
  });

  it('clamps negative values to 0s', () => {
    expect(formatOtpCountdown(-1)).toBe('0s');
  });
});

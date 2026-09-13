// File: p2p-kids-marketplace/src/utils/authError.ts
/**
 * Auth error normalization + raw-infrastructure containment.
 *
 * FIX-Task-26 item 1 (2026-09-13) — QA Phase 0 finding F1: the "Login Failed"
 * dialog rendered the SERIALIZED fetch `Response` of a failed
 * `POST /auth/v1/token?grant_type=password` — Supabase project ref, internal
 * URLs, Cloudflare `cf-ray`/`sb-request-id`, and a live `__cf_bm` cookie.
 *
 * Root cause (source-verified): `@supabase/auth-js` falls back to
 * `JSON.stringify(response)` as the error message when a 502/503/504 comes back
 * (`_getErrorMessage`), and `loginWithContext` copied that string verbatim into
 * `AuthError.message`. `AuthError.code` was the SDK CLASS NAME
 * (`AuthRetryableFetchError`) which matched no branch in the screen's switch, so
 * the `default:` arm rendered the dump.
 *
 * Rules (superset of the `userFacingError.ts` contract):
 * - Codes are NORMALIZED here; screens switch on the code, never on the SDK's
 *   class name (the un-matched class name is what made the friendly branch dead
 *   code — BP-88 "classification branch whose trigger never fires").
 * - A raw error object / `Response` never reaches a user-visible surface: the
 *   copy helpers always return a plain sentence, and
 *   `sanitizeUserFacingMessage()` is the last-line guard applied at the render
 *   paths (`components/ui/Modal`, `providers/GlobalAlertProvider`).
 * - Raw detail is still captured for diagnosis, but only through
 *   `redactForLogging()`, which strips headers/cookies/URLs first — the
 *   errorReporter fallback logs to `console.error`, and a dev-build LogBox IS a
 *   user-visible surface (QA hit exactly that red box in Phase 0).
 */

import { AuthError } from '@/types/user';
import {
  getErrorSearchText,
  getErrorStatus,
  isGatewayOrServerError,
  isTransientNetworkError,
} from './userFacingError';

/** Normalized auth failure codes. Screens switch on THESE, not SDK class names. */
export type AuthFailureCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'WEAK_PASSWORD'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'PROFILE_NOT_FOUND'
  | 'ACCOUNT_DELETED'
  | 'LOGIN_FAILED'
  | 'SIGNUP_FAILED'
  | 'SIGNUP_ERROR'
  | 'UNKNOWN';

/**
 * Substrings/markers that only ever appear in a serialized HTTP response or a
 * dumped SDK error object — never in copy a person should read.
 */
const INFRASTRUCTURE_SIGNALS = [
  'cf-ray',
  'cf_bm',
  'sb-project-ref',
  'sb-gateway-version',
  'sb-request-id',
  'set-cookie',
  'alt-svc',
  'bodyused',
  '_bodyinit',
  '_bodyblob',
  'cloudflare',
  '"headers":{"map"',
  'supabase.co/auth/v1',
];

/** Object keys that mark a value as a raw fetch `Response`/error dump. */
const RESPONSE_OBJECT_KEYS = ['headers', 'bodyUsed', '_bodyInit', '_bodyBlob', 'statusText'];

/** Fallback length guard — real copy is a sentence or two, a dump is far longer. */
const DEFAULT_MAX_LENGTH = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** SDK errors are named `<something>Error`; our app-thrown codes are SCREAMING_SNAKE. */
function isSdkErrorName(code: string): boolean {
  return /Error$/.test(code);
}

/** The status may sit on the error itself or one level down (`AuthError.details`). */
function getNestedStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const details = (error as { details?: unknown }).details;
  if (!isRecord(details)) return null;
  const raw = details.status;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 100 && parsed < 600
    ? parsed
    : null;
}

/**
 * True when a value is (or contains) a serialized HTTP response / SDK dump:
 * a raw object, or a string carrying headers, cookies, gateway or project-ref
 * markers. Used both to classify errors and to guard the render paths.
 */
export function looksLikeInfrastructureDump(value: unknown): boolean {
  if (isRecord(value)) {
    return RESPONSE_OBJECT_KEYS.some((key) => key in value);
  }
  if (typeof value !== 'string') return false;

  const text = value.toLowerCase();
  return INFRASTRUCTURE_SIGNALS.some((signal) => text.includes(signal));
}

/**
 * Last-line guard for anything user-visible. Returns `fallback` unless the value
 * is a short, plain, human-readable string.
 */
export function sanitizeUserFacingMessage(
  value: unknown,
  fallback: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): string {
  const text = asString(value);
  if (!text) return fallback;
  if (text.length > maxLength) return fallback;
  if (looksLikeInfrastructureDump(text)) return fallback;
  return text;
}

/**
 * Maps any auth failure — an `AuthError`, a raw SDK error, or a thrown value —
 * to a normalized code. App-thrown codes (`PROFILE_NOT_FOUND`, `ACCOUNT_DELETED`,
 * …) are preserved; SDK class names are classified.
 */
export function normalizeAuthFailure(
  error: unknown,
  fallback: AuthFailureCode = 'UNKNOWN'
): AuthFailureCode {
  const rawCode = asString((error as { code?: unknown } | null)?.code);
  if (rawCode && !isSdkErrorName(rawCode)) {
    return rawCode as AuthFailureCode;
  }

  const status = getErrorStatus(error) ?? getNestedStatus(error);
  const text = getErrorSearchText(error);

  if (status !== null && status >= 500) return 'SERVICE_UNAVAILABLE';
  // A dump with no readable status is still an upstream failure, never copy.
  if (looksLikeInfrastructureDump(text)) return 'SERVICE_UNAVAILABLE';
  if (
    status === 429 ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('email rate limit exceeded')
  ) {
    return 'RATE_LIMITED';
  }
  if (
    text.includes('already registered') ||
    text.includes('already been registered') ||
    text.includes('user already exists')
  ) {
    return 'EMAIL_ALREADY_REGISTERED';
  }
  if (text.includes('weak password') || text.includes('password should be at least')) {
    return 'WEAK_PASSWORD';
  }
  if (text.includes('email not confirmed')) return 'EMAIL_NOT_CONFIRMED';
  if (
    status === 401 ||
    text.includes('invalid login credentials') ||
    text.includes('invalid credentials') ||
    text.includes('invalid grant')
  ) {
    return 'INVALID_CREDENTIALS';
  }
  if (isGatewayOrServerError(error) || isTransientNetworkError(error)) {
    return 'SERVICE_UNAVAILABLE';
  }
  return fallback;
}

/**
 * User-facing copy for an auth failure. `action` is a plain-language verb phrase
 * ("sign you in", "create your account"). NEVER returns a raw backend string.
 *
 * Copy note: the INVALID_CREDENTIALS / EMAIL_ALREADY_REGISTERED /
 * PROFILE_NOT_FOUND / ACCOUNT_DELETED strings are asserted by the canonical
 * manual-testing guide (AUTH-ONBOARDING-… §auth cases), so they are preserved
 * verbatim rather than re-worded.
 */
export function getAuthFailureMessage(errorOrCode: unknown, action = 'sign you in'): string {
  const code: string =
    typeof errorOrCode === 'string' ? errorOrCode : normalizeAuthFailure(errorOrCode);

  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.';
    case 'EMAIL_ALREADY_REGISTERED':
      return 'This email is already registered. Please log in instead.';
    case 'WEAK_PASSWORD':
      return 'Please choose a stronger password and try again.';
    case 'EMAIL_NOT_CONFIRMED':
      return 'Please confirm your email address, then try again.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'SERVICE_UNAVAILABLE':
      return `We couldn't ${action} right now. Please check your connection and try again.`;
    case 'PROFILE_NOT_FOUND':
      return 'Profile not found. Please contact support.';
    case 'ACCOUNT_DELETED':
      return 'Your account has been deleted. Please contact support.';
    default:
      return `We couldn't ${action} just now. Please try again in a moment.`;
  }
}

/**
 * A safe, loggable summary of any error: name/code/status plus a sanitized
 * message. Never returns headers, cookies, URLs or the raw object, so it is safe
 * both for the errorReporter fallback (`console.error`, which a dev-build LogBox
 * renders on screen) and for Sentry.
 */
export function redactForLogging(error: unknown): Record<string, unknown> {
  const source = isRecord(error) ? error : {};
  const details = isRecord(source.details) ? (source.details as Record<string, unknown>) : {};

  const name =
    asString(source.name) ?? asString(details.name) ?? (error instanceof AuthError ? 'AuthError' : 'UnknownError');
  const code = asString(source.code) ?? asString(details.name) ?? null;
  const rawMessage = asString(source.message) ?? '';
  const message = sanitizeUserFacingMessage(rawMessage, '<redacted: not user-facing>', 400);

  return {
    name,
    code,
    status: getErrorStatus(error) ?? getNestedStatus(error),
    message,
    detailRedacted: looksLikeInfrastructureDump(rawMessage) || looksLikeInfrastructureDump(details),
  };
}

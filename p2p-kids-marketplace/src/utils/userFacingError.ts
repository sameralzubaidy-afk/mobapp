/**
 * Shared user-facing error copy + transient-error classification.
 *
 * FIX-Task-22 item 1 (2026-09-12): a failed review submission surfaced the raw
 * PostgREST string "Gateway Timeout" straight into a user-facing dialog. That is
 * the §6.3 raw-machine-string class this app has now hit several times (the
 * Notification Center's "Gateway Timeout" was the same bug, FIX-Task-15 item 5),
 * so the mapping lives here once instead of being re-derived per screen.
 *
 * Rules:
 * - NEVER render a Supabase/PostgREST `error.message` to a user. Pass the error
 *   through `getUserFacingError()` instead.
 * - `action` must be a plain-language verb phrase ("submit your review"); the
 *   copy is built as `We couldn't <action> just now. …`.
 * - Keep the raw error for diagnosis at the CALL SITE (console/Sentry, behind
 *   `if (__DEV__)`), never in the dialog.
 */

/** The error shapes we may receive from Supabase, fetch, or a thrown value. */
interface ErrorLike {
  message?: unknown;
  error_description?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
}

export interface UserFacingErrorOptions {
  /** Plain-language phrase for what the user was trying to do, e.g. "submit your review". */
  action?: string;
  /** Overrides the copy when nothing more specific matches. */
  fallback?: string;
}

/**
 * Substrings that mean "the request never completed, retrying is reasonable".
 *
 * This is the UNION of the predicate previously hand-rolled in AuthContext,
 * AppNavigator, discovery, notificationAnalytics, phoneService,
 * referralNotifications and subscription — so consolidating those into this
 * module can only WIDEN transient classification, never narrow it.
 */
const NETWORK_SIGNALS = [
  'network request failed',
  'fetch failed',
  'failed to fetch',
  'timeout',
  'timed out',
  // Same family, defined once here rather than re-guessed per module.
  'networkerror',
  'network error',
  'offline',
  'no internet',
  'econnreset',
  'econnrefused',
  'etimedout',
  'socket hang up',
];

/** Server-side/upstream failures — also retryable, but a different copy path is not needed. */
const SERVER_SIGNALS = [
  'gateway',
  'bad gateway',
  'upstream',
  'service unavailable',
  'internal server error',
  'statement timeout',
  '57014',
];

const DEFAULT_ACTION = 'finish that';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Builds a lower-cased haystack from every string/number field an error object
 * might carry, so classification works for PostgrestError, FunctionsHttpError,
 * a nested relay payload, or a plain string.
 */
export function getErrorSearchText(error: unknown): string {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'number') return String(error);
  if (!isRecord(error)) return String(error).toLowerCase();

  const e = error as ErrorLike;
  return [e.name, e.message, e.error_description, e.details, e.hint, e.code, e.status]
    .filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
    .join(' ')
    .toLowerCase();
}

/** Extracts an HTTP status code from an error object, when one is present. */
export function getErrorStatus(error: unknown): number | null {
  if (typeof error === 'number') {
    return error >= 100 && error < 600 ? error : null;
  }
  if (!isRecord(error)) return null;

  const raw = (error as ErrorLike).status;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 100 && parsed < 600
    ? parsed
    : null;
}

/**
 * True when the failure looks like a dropped/slow connection rather than a
 * rejection by our own business rules — i.e. retrying is reasonable.
 */
export function isTransientNetworkError(error: unknown): boolean {
  const text = getErrorSearchText(error);
  if (!text) return false;
  return NETWORK_SIGNALS.some((signal) => text.includes(signal));
}

/** True for 5xx / gateway failures (includes the raw "Gateway Timeout" string). */
export function isGatewayOrServerError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null && status >= 500) return true;

  const text = getErrorSearchText(error);
  return SERVER_SIGNALS.some((signal) => text.includes(signal));
}

/**
 * Maps any thrown/returned error to copy that is safe and useful for a parent.
 * Never returns the raw backend string.
 */
export function getUserFacingError(error: unknown, options: UserFacingErrorOptions = {}): string {
  const action = options.action ?? DEFAULT_ACTION;
  const generic =
    options.fallback ?? `We couldn't ${action} just now. Please try again in a moment.`;

  const text = getErrorSearchText(error);
  if (!text) return generic;

  if (text.includes('offline') || text.includes('no internet')) {
    return 'You appear to be offline. Please check your connection and try again.';
  }

  if (isTransientNetworkError(error) || isGatewayOrServerError(error)) {
    return `We couldn't ${action} just now. Please check your connection and try again.`;
  }

  return generic;
}

/**
 * File: p2p-kids-marketplace/src/utils/aiErrorFormat.ts
 * MODULE-04 LISTING-V3: User-friendly AI error messages
 *
 * Translates raw AI analysis error strings into messages
 * the user can understand and act on.
 */

/**
 * Map a raw AI analysis error to a user-friendly message.
 *
 * The raw error can come from:
 * - Edge Function response (e.g. Google Vision API billing errors)
 * - Network / timeout errors from the service layer
 * - Generic "analysis failed" propagation strings
 */
export function getUserFriendlyAiError(rawError: string | null | undefined): string {
  if (!rawError) {
    return 'Photo analysis could not complete. Please try again or fill in the details manually.';
  }

  const lower = rawError.toLowerCase();

  // Google Vision / external API billing or permission errors
  if (
    lower.includes('billing') ||
    lower.includes('403') ||
    lower.includes('permission') ||
    lower.includes('quota')
  ) {
    return 'Photo analysis is temporarily unavailable. Please try again later or fill in the details manually.';
  }

  // Timeout errors
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('taking too long')
  ) {
    return 'Photo analysis took too long. Tap Retry to try again, or fill in the details manually.';
  }

  // Network / connectivity errors
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection') ||
    lower.includes('offline')
  ) {
    return 'Could not reach the analysis service. Check your internet connection and try again.';
  }

  // Generic service error
  if (
    lower.includes('internal') ||
    lower.includes('server error') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503')
  ) {
    return 'The analysis service encountered a problem. Please try again later.';
  }

  // Catch-all: return a safe default
  return 'Photo analysis could not complete. Please try again or fill in the details manually.';
}

/**
 * FIX-Task-61 item 5: plain-language CAUSE + a short technical reference for the
 * AI failure card's opt-in "Details" disclosure.
 *
 * Why a second mapper rather than showing the raw error: the raw string from the
 * Edge Function is provider jargon (e.g. `Analysis failed: 401 {"error":{"code":
 * "UNAUTHORIZED","message":"Invalid or expired bearer token"}}`), which must not be
 * shown to a parent — but support still needs something to triage with. Categories
 * mirror `getUserFriendlyAiError` so the two can never classify the same failure
 * differently.
 *
 * Returns null when there is no raw error to describe, so callers can omit the
 * disclosure entirely rather than render an empty affordance.
 */
export function getAiErrorDetail(rawError: string | null | undefined): string | null {
  if (!rawError) {
    return null;
  }

  const lower = rawError.toLowerCase();

  // Provider credential / permission / quota problem (the 401 shape observed on
  // staging where the AI provider's bearer token was invalid or expired).
  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid or expired bearer token') ||
    lower.includes('billing') ||
    lower.includes('403') ||
    lower.includes('permission') ||
    lower.includes('quota')
  ) {
    return 'The photo analysis service rejected our request — its provider credential is invalid, expired, or out of quota (technical reference: 401/403 authorization error).';
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('taking too long')
  ) {
    return 'The photo analysis service did not respond in time (technical reference: request timeout).';
  }

  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection') ||
    lower.includes('offline')
  ) {
    return 'The app could not reach the photo analysis service (technical reference: network/connection error).';
  }

  if (
    lower.includes('internal') ||
    lower.includes('server error') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503')
  ) {
    return 'The photo analysis service returned a server error (technical reference: 5xx from the analysis provider).';
  }

  return 'No further technical detail was recorded for this failure.';
}

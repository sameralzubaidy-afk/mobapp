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

/**
 * Unit tests for aiErrorFormat
 * FIX-Task-61 item 5: the AI error card's "Details" disclosure.
 *
 * Covers both mappers, because item 5 adds a SECOND mapper alongside the existing
 * friendly-copy one and the two must classify the same failure consistently.
 */

import { getUserFriendlyAiError, getAiErrorDetail } from '../aiErrorFormat';

/**
 * The exact raw failure string QA captured on staging (AUTH Android R3, FINDING F2):
 * the deployed Edge Function forwards its provider's 401 to the client verbatim.
 */
const STAGING_401_RAW =
  'Analysis failed: 401 {"error":{"code":"UNAUTHORIZED","message":"Invalid or expired bearer token"}}';

describe('aiErrorFormat', () => {
  describe('getUserFriendlyAiError (copy must stay parent-facing)', () => {
    it('returns the safe default when there is no error', () => {
      expect(getUserFriendlyAiError(null)).toBe(
        'Photo analysis could not complete. Please try again or fill in the details manually.'
      );
    });

    it('maps billing / permission errors to the temporarily-unavailable copy', () => {
      expect(getUserFriendlyAiError('403 forbidden')).toContain('temporarily unavailable');
    });

    it('maps timeouts to the too-long copy', () => {
      expect(getUserFriendlyAiError('analysis timeout')).toContain('took too long');
    });

    it('maps network failures to the connectivity copy', () => {
      expect(getUserFriendlyAiError('Network request failed')).toContain(
        'Could not reach the analysis service'
      );
    });

    it('never leaks provider JSON into the friendly copy', () => {
      const friendly = getUserFriendlyAiError(STAGING_401_RAW);
      expect(friendly).not.toMatch(/[{}"]/);
      expect(friendly).not.toContain('UNAUTHORIZED');
    });
  });

  describe('getAiErrorDetail (FIX-Task-61 item 5)', () => {
    it('returns null when there is no raw error, so the caller omits the affordance', () => {
      expect(getAiErrorDetail(null)).toBeNull();
      expect(getAiErrorDetail(undefined)).toBeNull();
      expect(getAiErrorDetail('')).toBeNull();
    });

    it('describes the staging 401 provider-credential failure as an authorization problem', () => {
      const detail = getAiErrorDetail(STAGING_401_RAW);

      expect(detail).not.toBeNull();
      expect(detail).toContain('credential');
      expect(detail).toContain('401/403');
    });

    it('surfaces a technical reference for support without echoing raw provider JSON', () => {
      const detail = getAiErrorDetail(STAGING_401_RAW) as string;

      // This is the contract that makes the affordance safe for a parent to open:
      // a cause they can read + a reference support can search on, and nothing else.
      expect(detail).not.toMatch(/[{}"]/);
      expect(detail).not.toContain('UNAUTHORIZED');
      expect(detail).not.toContain('bearer token');
    });

    it('classifies a timeout', () => {
      expect(getAiErrorDetail('Analysis timed out')).toContain('did not respond in time');
    });

    it('classifies a network failure', () => {
      expect(getAiErrorDetail('Network request failed')).toContain('could not reach');
    });

    it('classifies a server error', () => {
      expect(getAiErrorDetail('Internal server error')).toContain('server error');
    });

    it('still returns a detail line for an unrecognised failure', () => {
      expect(getAiErrorDetail('something nobody has seen before')).toBe(
        'No further technical detail was recorded for this failure.'
      );
    });
  });
});

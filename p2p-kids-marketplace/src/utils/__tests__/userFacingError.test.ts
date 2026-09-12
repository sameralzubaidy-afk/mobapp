import {
  getUserFacingError,
  isTransientNetworkError,
  isGatewayOrServerError,
  getErrorStatus,
} from '../userFacingError';

/**
 * FIX-Task-22 item 1: a failed review submission surfaced the raw PostgREST string
 * "Gateway Timeout" in a user dialog. These tests pin the mapping AND (per the
 * FIX-Task-15 item 5 precedent) assert the raw string never comes back out.
 */
describe('userFacingError', () => {
  describe('getUserFacingError', () => {
    it('never returns the raw "Gateway Timeout" string', () => {
      const message = getUserFacingError(
        { message: 'Gateway Timeout' },
        { action: 'submit your review' }
      );

      expect(message).not.toContain('Gateway Timeout');
      expect(message).not.toMatch(/gateway/i);
      expect(message).toBe(
        "We couldn't submit your review just now. Please check your connection and try again."
      );
    });

    it('maps a 504 status to friendly retryable copy', () => {
      const message = getUserFacingError({ status: 504 }, { action: 'submit your review' });
      expect(message).toBe(
        "We couldn't submit your review just now. Please check your connection and try again."
      );
    });

    it('maps a statement timeout to friendly copy', () => {
      const message = getUserFacingError(
        { code: '57014', message: 'canceling statement due to statement timeout' },
        { action: 'report this review' }
      );
      expect(message).toBe(
        "We couldn't report this review just now. Please check your connection and try again."
      );
    });

    it('maps a dropped connection to friendly copy', () => {
      const message = getUserFacingError(new Error('Network request failed'), {
        action: 'submit your review',
      });
      expect(message).not.toContain('Network request failed');
      expect(message).toContain('submit your review');
    });

    it('uses offline-specific copy when the device is offline', () => {
      const message = getUserFacingError({ message: 'You are offline' }, { action: 'submit' });
      expect(message).toBe('You appear to be offline. Please check your connection and try again.');
    });

    it('falls back to generic actionable copy for an unmapped error', () => {
      const message = getUserFacingError({ message: 'some unmapped backend detail' }, {
        action: 'submit your review',
      });
      expect(message).toBe(
        "We couldn't submit your review just now. Please try again in a moment."
      );
    });

    it('falls back when there is no error at all', () => {
      expect(getUserFacingError(null, { action: 'submit your review' })).toBe(
        "We couldn't submit your review just now. Please try again in a moment."
      );
      expect(getUserFacingError(undefined, { action: 'submit your review' })).toBe(
        "We couldn't submit your review just now. Please try again in a moment."
      );
    });

    it('honours an explicit fallback override', () => {
      expect(
        getUserFacingError({ message: 'weird' }, { action: 'x', fallback: 'Custom copy.' })
      ).toBe('Custom copy.');
    });
  });

  describe('isTransientNetworkError', () => {
    it.each([
      'Network request failed',
      'fetch failed',
      'Failed to fetch',
      'request timed out',
      'Gateway Timeout',
      'socket hang up',
    ])('treats %s as transient', (text) => {
      expect(isTransientNetworkError({ message: text })).toBe(true);
    });

    it('accepts a plain string error', () => {
      expect(isTransientNetworkError('fetch failed')).toBe(true);
    });

    it('does not treat a validation message as transient', () => {
      expect(isTransientNetworkError({ message: 'You have already reviewed this trade' })).toBe(
        false
      );
    });

    it('returns false for null/undefined/number', () => {
      expect(isTransientNetworkError(null)).toBe(false);
      expect(isTransientNetworkError(undefined)).toBe(false);
      expect(isTransientNetworkError(42)).toBe(false);
    });
  });

  describe('isGatewayOrServerError / getErrorStatus', () => {
    it('treats any 5xx status as a server error', () => {
      expect(isGatewayOrServerError({ status: 500 })).toBe(true);
      expect(isGatewayOrServerError({ status: 503 })).toBe(true);
    });

    it('does not treat a 4xx as a server error', () => {
      expect(isGatewayOrServerError({ status: 401 })).toBe(false);
    });

    it('reads a numeric status from either a number or a string', () => {
      expect(getErrorStatus({ status: 504 })).toBe(504);
      expect(getErrorStatus({ status: '504' })).toBe(504);
      expect(getErrorStatus({ status: 'nope' })).toBeNull();
      expect(getErrorStatus({})).toBeNull();
    });
  });
});

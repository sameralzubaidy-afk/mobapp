import {
  getAuthFailureMessage,
  looksLikeInfrastructureDump,
  normalizeAuthFailure,
  redactForLogging,
  sanitizeUserFacingMessage,
} from '../authError';
import { AuthError } from '@/types/user';

/**
 * FIX-Task-26 item 1 (2026-09-13) — QA Phase 0 F1.
 *
 * The "Login Failed" dialog rendered the SERIALIZED fetch `Response` of a 504
 * from `POST /auth/v1/token`: Supabase project ref, internal URLs, Cloudflare
 * `cf-ray`/`sb-request-id`, and a live `__cf_bm` cookie. These tests pin the
 * classification AND assert the leak can never come back out, at every layer:
 * the code, the copy, the render-path sanitizer and the log redactor.
 *
 * The fixture below is the verbatim shape QA captured (trimmed).
 */
const LEAKED_RESPONSE_DUMP =
  '{"type":"default","status":504,"ok":false,"statusText":"","headers":{"map":{' +
  '"alt-svc":"h3=\\":443\\"; ma=86400","cf-cache-status":"DYNAMIC",' +
  '"cf-ray":"a3a7a27abc4e9aaa-BOS","content-type":"text/plain",' +
  '"sb-gateway-version":"2","sb-project-ref":"drntwgporzabmxdqykrp",' +
  '"sb-request-id":"01a09b0a-1111-2222-3333-444455556666","server":"cloudflare",' +
  '"set-cookie":"__cf_bm=ZgK2M7lmZGJ27Y7WdW53Z.PQ3UpgcjIfsEU5eGdlkM-123; HttpOnly",' +
  '"url":"https://drntwgporzabmxdqykrp.supabase.co/auth/v1/token?grant_type=password",' +
  '"bodyUsed":false,"_bodyInit":{},"_bodyBlob":{}}';

/** The real SDK shape: name = class name, raw Response wired as `details`. */
function makeRetryableFetchError() {
  return new AuthError(LEAKED_RESPONSE_DUMP, 'AuthRetryableFetchError', {
    name: 'AuthRetryableFetchError',
    status: 504,
    message: LEAKED_RESPONSE_DUMP,
  });
}

describe('authError', () => {
  describe('normalizeAuthFailure', () => {
    it('classifies the 504 Response dump as SERVICE_UNAVAILABLE', () => {
      expect(normalizeAuthFailure(makeRetryableFetchError())).toBe('SERVICE_UNAVAILABLE');
    });

    it('classifies the SDK class name it is called with (unnormalized)', () => {
      expect(
        normalizeAuthFailure({ name: 'AuthRetryableFetchError', status: 504 })
      ).toBe('SERVICE_UNAVAILABLE');
    });

    it('classifies a wrong-password 401 — the branch that used to be dead code', () => {
      // BP-88: `INVALID_CREDENTIALS` was consumed by LoginScreen but never produced,
      // because the service copied the SDK name (`AuthApiError`) into `code`.
      expect(
        normalizeAuthFailure({
          name: 'AuthApiError',
          status: 401,
          message: 'Invalid login credentials',
        })
      ).toBe('INVALID_CREDENTIALS');
    });

    it('classifies signup collisions, rate limits and unconfirmed emails', () => {
      expect(normalizeAuthFailure({ message: 'User already registered' })).toBe(
        'EMAIL_ALREADY_REGISTERED'
      );
      expect(normalizeAuthFailure({ status: 429, message: 'email rate limit exceeded' })).toBe(
        'RATE_LIMITED'
      );
      expect(normalizeAuthFailure({ message: 'Email not confirmed' })).toBe(
        'EMAIL_NOT_CONFIRMED'
      );
    });

    it('classifies a dropped connection as SERVICE_UNAVAILABLE', () => {
      expect(normalizeAuthFailure(new Error('Network request failed'))).toBe(
        'SERVICE_UNAVAILABLE'
      );
    });

    it('preserves our own app-thrown codes', () => {
      expect(normalizeAuthFailure(new AuthError('nope', 'PROFILE_NOT_FOUND'))).toBe(
        'PROFILE_NOT_FOUND'
      );
      expect(normalizeAuthFailure(new AuthError('nope', 'ACCOUNT_DELETED'))).toBe(
        'ACCOUNT_DELETED'
      );
    });

    it('uses the supplied fallback for an unrecognised failure', () => {
      expect(normalizeAuthFailure({ message: 'something odd' }, 'LOGIN_FAILED')).toBe(
        'LOGIN_FAILED'
      );
    });
  });

  describe('getAuthFailureMessage', () => {
    it('returns the F1 copy for a gateway failure — never the dump', () => {
      const message = getAuthFailureMessage(makeRetryableFetchError(), 'sign you in');

      expect(message).toBe(
        "We couldn't sign you in right now. Please check your connection and try again."
      );
      expect(message).not.toContain('cf-ray');
      expect(message).not.toContain('drntwgporzabmxdqykrp');
      expect(message).not.toContain('__cf_bm');
      expect(message).not.toContain('504');
    });

    it('keeps the guide-asserted copy for the mapped codes', () => {
      expect(getAuthFailureMessage('INVALID_CREDENTIALS')).toBe('Invalid email or password.');
      expect(getAuthFailureMessage('EMAIL_ALREADY_REGISTERED')).toBe(
        'This email is already registered. Please log in instead.'
      );
      expect(getAuthFailureMessage('PROFILE_NOT_FOUND')).toBe(
        'Profile not found. Please contact support.'
      );
    });

    it('never echoes an unmapped raw message', () => {
      const message = getAuthFailureMessage(
        { message: 'PGPGRST something internal' },
        'create your account'
      );
      expect(message).not.toContain('PGPGRST');
    });
  });

  describe('looksLikeInfrastructureDump', () => {
    it('detects the leaked response string', () => {
      expect(looksLikeInfrastructureDump(LEAKED_RESPONSE_DUMP)).toBe(true);
    });

    it('detects a Response-shaped object', () => {
      expect(looksLikeInfrastructureDump({ status: 504, headers: {}, bodyUsed: false })).toBe(
        true
      );
    });

    it('leaves ordinary copy alone', () => {
      expect(looksLikeInfrastructureDump('Invalid email or password.')).toBe(false);
      expect(looksLikeInfrastructureDump('We could not send your email. Please try again.')).toBe(
        false
      );
    });
  });

  describe('sanitizeUserFacingMessage (the render-path guard)', () => {
    it('replaces a dump with friendly copy', () => {
      expect(
        sanitizeUserFacingMessage(LEAKED_RESPONSE_DUMP, 'Something went wrong. Please try again.')
      ).toBe('Something went wrong. Please try again.');
    });

    it('replaces a non-string value (React child hazard) with friendly copy', () => {
      expect(
        sanitizeUserFacingMessage({ status: 504 }, 'Something went wrong. Please try again.')
      ).toBe('Something went wrong. Please try again.');
      expect(sanitizeUserFacingMessage(undefined, 'fallback')).toBe('fallback');
      expect(sanitizeUserFacingMessage('   ', 'fallback')).toBe('fallback');
    });

    it('passes real copy through untouched', () => {
      expect(sanitizeUserFacingMessage('Invalid email or password.', 'fallback')).toBe(
        'Invalid email or password.'
      );
    });
  });

  describe('redactForLogging (LogBox/Sentry safety)', () => {
    it('keeps the classification but drops the headers, cookie and project ref', () => {
      const redacted = redactForLogging(makeRetryableFetchError());
      const serialized = JSON.stringify(redacted);

      expect(redacted.status).toBe(504);
      expect(redacted.detailRedacted).toBe(true);
      expect(serialized).not.toContain('cf-ray');
      expect(serialized).not.toContain('__cf_bm');
      expect(serialized).not.toContain('drntwgporzabmxdqykrp');
      expect(serialized).not.toContain('supabase.co');
    });
  });
});

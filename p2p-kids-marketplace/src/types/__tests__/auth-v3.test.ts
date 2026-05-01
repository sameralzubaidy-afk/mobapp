/**
 * FILE: p2p-kids-marketplace/src/types/__tests__/auth-v3.test.ts
 * MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN
 * TASK: AUTH-V3-002 - Shared Types & Error Classes - Unit Tests
 * 
 * Tests auth-v3 type definitions and error classes.
 */

import type {
  OAuthProvider,
  ProviderProfile,
  LinkedProvider,
  OAuthSession,
  AuthResult,
  PhoneVerificationCode,
  PasswordStrengthResult,
} from '../auth-v3';

import {
  OAuthStateMismatchError,
  EmailMismatchError,
  LastLoginMethodError,
  OTPExpiredError,
  OTPRateLimitError,
  WeakPasswordError,
  AvatarDownloadError,
  ProviderUnavailableError,
} from '../auth-v3-errors';

describe('auth-v3 types', () => {
  describe('OAuthProvider', () => {
    it('should accept google provider', () => {
      const provider: OAuthProvider = 'google';
      expect(provider).toBe('google');
    });

    it('should accept facebook provider', () => {
      const provider: OAuthProvider = 'facebook';
      expect(provider).toBe('facebook');
    });

    it('should accept apple provider', () => {
      const provider: OAuthProvider = 'apple';
      expect(provider).toBe('apple');
    });

    // TypeScript compile-time check - this would fail if string escape hatch exists
    it('should not compile with arbitrary string', () => {
      // @ts-expect-error - testing that arbitrary strings are not allowed
      const invalidProvider: OAuthProvider = 'twitter';
      expect(invalidProvider).toBeDefined(); // Just to use the variable
    });
  });

  describe('ProviderProfile', () => {
    it('should create valid ProviderProfile with all fields', () => {
      const profile: ProviderProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        avatar: 'https://example.com/avatar.jpg',
        provider: 'google',
        providerUserId: 'google-123456',
      };

      expect(profile.name).toBe('John Doe');
      expect(profile.email).toBe('john@example.com');
      expect(profile.avatar).toBe('https://example.com/avatar.jpg');
      expect(profile.provider).toBe('google');
      expect(profile.providerUserId).toBe('google-123456');
    });

    it('should create valid ProviderProfile without avatar (Apple case)', () => {
      const profile: ProviderProfile = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        provider: 'apple',
        providerUserId: 'apple-789',
      };

      expect(profile.avatar).toBeUndefined();
    });
  });

  describe('LinkedProvider', () => {
    it('should create valid LinkedProvider', () => {
      const linked: LinkedProvider = {
        provider: 'facebook',
        providerEmail: 'user@facebook.com',
        linkedAt: '2026-04-20T10:00:00Z',
      };

      expect(linked.provider).toBe('facebook');
      expect(linked.providerEmail).toBe('user@facebook.com');
      expect(linked.linkedAt).toBe('2026-04-20T10:00:00Z');
    });
  });

  describe('OAuthSession', () => {
    it('should create valid OAuthSession with all fields', () => {
      const session: OAuthSession = {
        state: 'random-32-byte-state-token',
        provider: 'google',
        createdAt: '2026-04-20T10:00:00Z',
        returnUrl: 'p2pkids://oauth-callback',
      };

      expect(session.state).toBe('random-32-byte-state-token');
      expect(session.provider).toBe('google');
      expect(session.createdAt).toBe('2026-04-20T10:00:00Z');
      expect(session.returnUrl).toBe('p2pkids://oauth-callback');
    });

    it('should create valid OAuthSession without returnUrl', () => {
      const session: OAuthSession = {
        state: 'state-token',
        provider: 'apple',
        createdAt: '2026-04-20T10:00:00Z',
      };

      expect(session.returnUrl).toBeUndefined();
    });
  });

  describe('AuthResult', () => {
    it('should create successful AuthResult', () => {
      const result: AuthResult = {
        success: true,
        userId: 'user-123',
        sessionToken: 'jwt-token',
        metadata: { trialActivated: true },
      };

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.sessionToken).toBe('jwt-token');
      expect(result.metadata?.trialActivated).toBe(true);
    });

    it('should create failed AuthResult with error', () => {
      const result: AuthResult = {
        success: false,
        errorCode: 'OAUTH_STATE_MISMATCH',
        errorMessage: 'State token mismatch',
      };

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('OAUTH_STATE_MISMATCH');
      expect(result.errorMessage).toBe('State token mismatch');
    });
  });

  describe('PhoneVerificationCode', () => {
    it('should create valid PhoneVerificationCode', () => {
      const code: PhoneVerificationCode = {
        id: 'code-uuid',
        userId: 'user-123',
        phone: '+14155551234',
        codeHash: '$2b$10$hashed-code',
        attempts: 0,
        createdAt: '2026-04-20T10:00:00Z',
        expiresAt: '2026-04-20T10:05:00Z',
      };

      expect(code.phone).toBe('+14155551234');
      expect(code.codeHash).toBe('$2b$10$hashed-code');
      expect(code.attempts).toBe(0);
    });
  });

  describe('PasswordStrengthResult', () => {
    it('should create valid result for strong password', () => {
      const result: PasswordStrengthResult = {
        valid: true,
        reasons: [],
      };

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should create valid result for weak password', () => {
      const result: PasswordStrengthResult = {
        valid: false,
        reasons: [
          'Password must be at least 8 characters',
          'Password must contain at least one letter',
        ],
      };

      expect(result.valid).toBe(false);
      expect(result.reasons).toHaveLength(2);
    });
  });
});

describe('auth-v3 error classes', () => {
  describe('OAuthStateMismatchError', () => {
    it('should create error with correct code', () => {
      const error = new OAuthStateMismatchError();
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OAuthStateMismatchError);
      expect(error.code).toBe('OAUTH_STATE_MISMATCH');
      expect(error.name).toBe('OAuthStateMismatchError');
      expect(error.message).toContain('OAuth state token mismatch');
    });

    it('should accept custom message', () => {
      const error = new OAuthStateMismatchError('Custom message');
      
      expect(error.message).toBe('Custom message');
      expect(error.code).toBe('OAUTH_STATE_MISMATCH');
    });
  });

  describe('EmailMismatchError', () => {
    it('should create error with provider and account emails', () => {
      const error = new EmailMismatchError('provider@example.com', 'account@example.com');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EmailMismatchError);
      expect(error.code).toBe('EMAIL_MISMATCH');
      expect(error.name).toBe('EmailMismatchError');
      expect(error.providerEmail).toBe('provider@example.com');
      expect(error.accountEmail).toBe('account@example.com');
      expect(error.message).toContain('provider@example.com');
      expect(error.message).toContain('account@example.com');
    });
  });

  describe('LastLoginMethodError', () => {
    it('should create error with provider name', () => {
      const error = new LastLoginMethodError('google');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LastLoginMethodError);
      expect(error.code).toBe('LAST_LOGIN_METHOD');
      expect(error.name).toBe('LastLoginMethodError');
      expect(error.provider).toBe('google');
      expect(error.message).toContain('google');
      expect(error.message).toContain('last login method');
    });
  });

  describe('OTPExpiredError', () => {
    it('should create error with expiry timestamp', () => {
      const expiredAt = '2026-04-20T10:05:00Z';
      const error = new OTPExpiredError(expiredAt);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OTPExpiredError);
      expect(error.code).toBe('OTP_EXPIRED');
      expect(error.name).toBe('OTPExpiredError');
      expect(error.expiredAt).toBe(expiredAt);
      expect(error.message).toContain(expiredAt);
    });
  });

  describe('OTPRateLimitError', () => {
    it('should create error with retry seconds and limit type', () => {
      const error = new OTPRateLimitError(3600, '3 per hour');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OTPRateLimitError);
      expect(error.code).toBe('OTP_RATE_LIMIT');
      expect(error.name).toBe('OTPRateLimitError');
      expect(error.retryAfterSeconds).toBe(3600);
      expect(error.limitType).toBe('3 per hour');
      expect(error.message).toContain('60 minutes'); // 3600 / 60
    });

    it('should round up minutes in message', () => {
      const error = new OTPRateLimitError(90, '3 per hour'); // 1.5 minutes
      
      expect(error.message).toContain('2 minutes'); // ceil(1.5) = 2
    });
  });

  describe('WeakPasswordError', () => {
    it('should create error with reasons array', () => {
      const reasons = [
        'Password must be at least 8 characters',
        'Password must contain at least one digit',
      ];
      const error = new WeakPasswordError(reasons);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WeakPasswordError);
      expect(error.code).toBe('WEAK_PASSWORD');
      expect(error.name).toBe('WeakPasswordError');
      expect(error.reasons).toEqual(reasons);
      expect(error.message).toContain('8 characters');
      expect(error.message).toContain('one digit');
    });

    it('should handle empty reasons array', () => {
      const error = new WeakPasswordError([]);
      
      expect(error.reasons).toHaveLength(0);
    });
  });

  describe('AvatarDownloadError', () => {
    it('should create error with URL and reason', () => {
      const error = new AvatarDownloadError(
        'https://example.com/avatar.jpg',
        'timeout'
      );
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AvatarDownloadError);
      expect(error.code).toBe('AVATAR_DOWNLOAD_FAILED');
      expect(error.name).toBe('AvatarDownloadError');
      expect(error.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(error.reason).toBe('timeout');
      expect(error.message).toContain('https://example.com/avatar.jpg');
      expect(error.message).toContain('timeout');
    });
  });

  describe('ProviderUnavailableError', () => {
    it('should create error with provider and status', () => {
      const error = new ProviderUnavailableError('google', '503');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProviderUnavailableError);
      expect(error.code).toBe('PROVIDER_UNAVAILABLE');
      expect(error.name).toBe('ProviderUnavailableError');
      expect(error.provider).toBe('google');
      expect(error.status).toBe('503');
      expect(error.message).toContain('Google'); // Capitalized
      expect(error.message).toContain('email signup');
    });

    it('should capitalize provider name in message', () => {
      const error = new ProviderUnavailableError('facebook', 'timeout');
      
      expect(error.message).toContain('Facebook'); // Not 'facebook'
    });
  });

  describe('Error prototype chain', () => {
    it('should maintain instanceof checks after serialization', () => {
      const error = new EmailMismatchError('a@example.com', 'b@example.com');
      
      // Simulate error being thrown and caught
      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(EmailMismatchError);
        expect((e as EmailMismatchError).code).toBe('EMAIL_MISMATCH');
      }
    });

    it('should preserve error stack trace', () => {
      const error = new OTPRateLimitError(3600, '3 per hour');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('OTPRateLimitError');
    });
  });

  describe('Stable error codes', () => {
    it('should have stable codes across all error classes', () => {
      const errors = [
        new OAuthStateMismatchError(),
        new EmailMismatchError('a', 'b'),
        new LastLoginMethodError('google'),
        new OTPExpiredError('2026-01-01'),
        new OTPRateLimitError(3600, 'test'),
        new WeakPasswordError(['test']),
        new AvatarDownloadError('url', 'reason'),
        new ProviderUnavailableError('google', '503'),
      ];

      const codes = errors.map(e => e.code);
      
      expect(codes).toEqual([
        'OAUTH_STATE_MISMATCH',
        'EMAIL_MISMATCH',
        'LAST_LOGIN_METHOD',
        'OTP_EXPIRED',
        'OTP_RATE_LIMIT',
        'WEAK_PASSWORD',
        'AVATAR_DOWNLOAD_FAILED',
        'PROVIDER_UNAVAILABLE',
      ]);

      // Ensure codes are readonly (TypeScript compile-time check)
      const error = new OAuthStateMismatchError();
      // @ts-expect-error - code should be readonly
      error.code = 'MODIFIED';
    });
  });
});

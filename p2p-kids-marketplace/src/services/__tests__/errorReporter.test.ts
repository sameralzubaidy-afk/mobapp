// File: p2p-kids-marketplace/src/services/__tests__/errorReporter.test.ts
// PROD-P004: errorReporter unit tests.
// Verifies no-op behavior when DSN missing and safety guarantees.

import {
  initErrorReporter,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  __resetForTests,
  __isActiveForTests,
} from '../errorReporter';

describe('errorReporter', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetForTests();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
    __resetForTests();
  });

  it('is a no-op when EXPO_PUBLIC_SENTRY_DSN is missing', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    initErrorReporter();
    expect(__isActiveForTests()).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[errorReporter] EXPO_PUBLIC_SENTRY_DSN missing')
    );
  });

  it('captureException falls back to console.error when reporter disabled', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    initErrorReporter();
    const err = new Error('boom');
    captureException(err, { tags: { source: 'test' } });
    expect(errorSpy).toHaveBeenCalledWith(
      '[errorReporter:fallback]',
      err,
      expect.objectContaining({ tags: { source: 'test' } })
    );
  });

  it('captureMessage falls back to console.log when reporter disabled', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    initErrorReporter();
    captureMessage('hello', 'info');
    expect(logSpy).toHaveBeenCalledWith('[errorReporter:fallback:info]', 'hello');
  });

  it('setUser is a safe no-op when reporter disabled', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    initErrorReporter();
    expect(() => setUser({ id: 'u1' })).not.toThrow();
    expect(() => setUser(null)).not.toThrow();
  });

  it('addBreadcrumb is a safe no-op when reporter disabled', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    initErrorReporter();
    expect(() => addBreadcrumb({ message: 'nav', category: 'navigation' })).not.toThrow();
  });

  it('initErrorReporter is idempotent', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    initErrorReporter();
    initErrorReporter();
    initErrorReporter();
    // Only one disabled-warning log on the first init.
    const matches = logSpy.mock.calls.filter((c) =>
      String(c[0]).includes('EXPO_PUBLIC_SENTRY_DSN missing')
    );
    expect(matches).toHaveLength(1);
  });
});

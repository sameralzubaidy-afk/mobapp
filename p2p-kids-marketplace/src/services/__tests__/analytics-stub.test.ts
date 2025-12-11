// We will require the analytics module after setting process.env in each test

describe('analytics document stub behavior', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('does not add document stub when not allowed', async () => {
    process.env.EXPO_DEV_ALLOW_DOCUMENT_STUB = 'false';
    process.env.EXPO_PUBLIC_FUN_KEY = 'something';
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'production';
    const { initAnalytics } = require('../analytics');
    await initAnalytics();
    expect((global as any).document).toBeUndefined();
  });

  it('adds document stub when allowed in development', async () => {
    process.env.EXPO_DEV_ALLOW_DOCUMENT_STUB = 'true';
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = 'fake';
    const { initAnalytics } = require('../analytics');
    await initAnalytics();
    expect((global as any).document).toBeDefined();
  });
});

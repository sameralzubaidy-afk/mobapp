import { initAnalytics, trackEvent, identifyUser } from '../analytics';

jest.mock('@amplitude/analytics-react-native', () => ({
  init: jest.fn(),
  track: jest.fn(),
  setUserId: jest.fn(),
  identify: jest.fn(),
  Identify: jest.fn().mockImplementation(() => ({ set: jest.fn() })),
}));

describe('analytics service', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = 'test-key';
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    process.env.EXPO_DEV_ALLOW_DOCUMENT_STUB = 'true';
  });

  it('initializes amplitude without throwing', async () => {
    await expect(initAnalytics()).resolves.not.toThrow();
  });

  it('sends trackEvent without throwing', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
  });

  it('sets user id and identify without throwing', () => {
    expect(() => identifyUser('user123', { plan: 'free' })).not.toThrow();
  });
});

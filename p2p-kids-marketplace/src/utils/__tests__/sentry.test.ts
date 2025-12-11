import Sentry from '../sentry';

describe('Mobile Sentry initialization', () => {
  it('exports a Sentry object with captureException function', () => {
    expect(Sentry).toBeDefined();
    // captureException exists on both CRA and NextJS Sentry SDKs
    expect(typeof Sentry.captureException === 'function').toBeTruthy();
  });
});

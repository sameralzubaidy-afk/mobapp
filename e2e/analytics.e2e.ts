import { device, element, by, expect } from 'detox';

describe('Analytics E2E', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('sends debug analytics event', async () => {
    // Navigate to Debug screen (assuming accessible via tab or nav)
    // Placeholder for navigation. Adjust to your app navigation structure.
    await element(by.id('nav-debug')).tap();
    await expect(element(by.text('Debug — Sentry Test'))).toBeVisible();
    await element(by.text('Send Amplitude Test Event')).tap();
    // Optionally, you can wait here a few seconds for ripples and to allow client to send data
    await new Promise((r) => setTimeout(r, 3000));
  });
});

/// <reference types="detox" />
/**
 * TC-06: Subscription — Kids Club+ Screen Renders
 *
 * Verifies that the Kids Club+ subscription overview screen loads and
 * displays the key subscription information.
 * NOTE: Cannot automate Stripe payment — this test stops before checkout.
 *
 * testIDs used:
 *   home-tab, kids-club-overview-screen, subscribe-cta-button,
 *   subscription-payment-screen, payment-title
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';

describe('TC-06: Subscription — Kids Club+ Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the Kids Club+ overview', async () => {
    // Navigate to Home first
    try {
      await element(by.id('home-tab')).tap();
      await new Promise(r => setTimeout(r, 600));
    } catch {}

    // Find Kids Club+ entry point (text or testID)
    try {
      await element(by.text("Kids Club+")).tap();
    } catch {
      await element(by.id('kids-club-subscription-banner')).tap();
    }

    await waitFor(element(by.id('kids-club-overview-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('06-kids-club-overview');
  });

  it('shows the subscribe CTA button', async () => {
    await expect(element(by.id('subscribe-cta-button'))).toBeVisible();
  });

  it('opens the subscription payment screen', async () => {
    await element(by.id('subscribe-cta-button')).tap();
    await waitFor(element(by.id('subscription-payment-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('payment-title'))).toBeVisible();
    await device.takeScreenshot('06-subscription-payment-screen');
    // NOTE: Stripe checkout cannot be automated — stop here
  });
});

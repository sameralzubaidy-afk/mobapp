/// <reference types="detox" />
/**
 * TC-04b: Trade Flow — Complete (Offer → Disclaimer → Success Screen)
 *
 * Completes a full trade offer: discover → item detail → offer screen →
 * enter SP amount → accept disclaimer → submit → verify success.
 *
 * NOTE: This creates a real trade record in the staging DB on every run.
 *       That is acceptable for staging — trades do not affect production.
 *
 * Prerequisites:
 *   - npm run seed:staging has run (buyer has SP balance, test listings exist)
 *   - Buyer account has an active subscription (required for SP offers)
 *
 * testIDs used:
 *   tab-discover, discover-results-list, item-detail-title,
 *   request-to-buy-button, sp-amount-input, safety-disclaimer,
 *   disclaimer-modal, disclaimer-modal-checkbox, disclaimer-modal-accept-button,
 *   send-offer-button, success-icon, cta-view-trades-button
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-04b: Trade Flow — Complete', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates from Discover to the Trade Offer screen', async () => {
    await goToDiscover();
    await element(by.id('discover-results-list')).atIndex(0).tap();

    await waitFor(element(by.id('request-to-buy-button')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('request-to-buy-button')).tap();

    await waitFor(element(by.id('send-offer-button')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('04b-offer-screen-ready');
  });

  it('enters an SP amount in the offer form', async () => {
    await waitFor(element(by.id('sp-amount-input')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('sp-amount-input')).clearText();
    await element(by.id('sp-amount-input')).typeText('10');
    await device.takeScreenshot('04b-sp-amount-entered');
  });

  it('accepts the safety disclaimer', async () => {
    // Scroll to disclaimer if needed
    try {
      await element(by.id('safety-disclaimer')).tap();
      await new Promise(r => setTimeout(r, 500));
    } catch {}

    // Handle disclaimer modal if it appears
    try {
      await waitFor(element(by.id('disclaimer-modal')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('disclaimer-modal-checkbox')).tap();
      await element(by.id('disclaimer-modal-accept-button')).tap();
      await new Promise(r => setTimeout(r, 500));
    } catch {}

    await device.takeScreenshot('04b-disclaimer-accepted');
  });

  it('submits the offer and shows the Trade Success screen', async () => {
    await waitFor(element(by.id('send-offer-button')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('send-offer-button')).tap();

    await waitFor(element(by.id('success-icon')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('cta-view-trades-button'))).toBeVisible();
    await device.takeScreenshot('04b-trade-success');
  });
});

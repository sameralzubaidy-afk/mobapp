/// <reference types="detox" />
/**
 * TC-04a: Trade Flow — Initiate (Discover → Item Detail → Offer Screen)
 *
 * Verifies a buyer can discover a listing and reach the Trade Offer screen.
 * Stops at offer screen without submitting — TC-04b covers full submission.
 *
 * Prerequisites: npm run seed:staging has been run (creates test listings).
 *
 * testIDs used:
 *   tab-discover, discover-results-list, item-detail-title, item-detail-price,
 *   request-to-buy-button, send-offer-button, value-stack-row
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-04a: Trade Flow — Initiate', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('loads the Discover screen with listing results', async () => {
    await goToDiscover();
    await expect(element(by.id('discover-results-list'))).toBeVisible();
    await device.takeScreenshot('04a-discover-results');
  });

  it('opens item detail screen when a listing is tapped', async () => {
    // Tap the first listing in the results list
    await element(by.id('discover-results-list')).atIndex(0).tap();
    await waitFor(element(by.id('item-detail-title')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('item-detail-price'))).toBeVisible();
    await device.takeScreenshot('04a-item-detail');
  });

  it('shows the Trade Offer screen after tapping Request to Buy', async () => {
    await waitFor(element(by.id('request-to-buy-button')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('request-to-buy-button')).tap();

    await waitFor(element(by.id('send-offer-button')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('value-stack-row'))).toBeVisible();
    await device.takeScreenshot('04a-offer-screen');
  });
});

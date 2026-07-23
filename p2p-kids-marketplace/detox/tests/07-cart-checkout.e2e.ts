/// <reference types="detox" />
/**
 * TC-07: Cart / Checkout — Add to Cart Flow
 *
 * Verifies that a buyer can discover a listing, open item detail, and
 * reach the trade offer (checkout) screen. Covers the cart-adjacent flow.
 *
 * Prerequisites: npm run seed:staging has run (test listings exist).
 *
 * testIDs used:
 *   tab-discover, discover-results-list, item-detail-title,
 *   item-detail-price, request-to-buy-button
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-07: Cart / Checkout — Add to Cart Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows listing results on the Discover screen', async () => {
    await goToDiscover();
    await expect(element(by.id('discover-results-list'))).toBeVisible();
    await device.takeScreenshot('07-discover-loaded');
  });

  it('opens item detail screen and shows price and CTA', async () => {
    await element(by.id('discover-results-list')).atIndex(0).tap();
    await waitFor(element(by.id('item-detail-title')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('item-detail-price'))).toBeVisible();
    await device.takeScreenshot('07-item-detail');
  });

  it('shows the Request to Buy / checkout CTA', async () => {
    await waitFor(element(by.id('request-to-buy-button')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('request-to-buy-button'))).toBeVisible();
    await device.takeScreenshot('07-checkout-cta-visible');
  });
});

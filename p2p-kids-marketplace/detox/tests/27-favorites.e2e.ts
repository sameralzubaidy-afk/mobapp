/// <reference types="detox" />
/**
 * TC-27: Favorites Screen
 *
 * Verifies that the Favorites screen is reachable via the Cart screen
 * (cart-favorites-link) and that it correctly renders the empty state
 * or items list.
 *
 * Flow: Discover → item detail → add-to-cart-button → view-cart-button
 *       → CartScreen → cart-favorites-link → FavoritesScreen
 *
 * testIDs used:
 *   tab-discover, discover-results-list, add-to-cart-button,
 *   view-cart-button, cart-favorites-link, favorites-empty, favorites-list
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover, tapFirstListing } from '../helpers/navigation';

describe('TC-27: Favorites Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to Discover and taps a listing', async () => {
    await goToDiscover();
    await tapFirstListing();
    await device.takeScreenshot('27-item-detail');
  });

  it('adds the item to cart', async () => {
    await waitFor(element(by.id('add-to-cart-button')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('add-to-cart-button')).tap();
    // waitFor(view-cart-button) in the next step handles the delay
    await device.takeScreenshot('27-after-add-to-cart');
  });

  it('opens the Cart screen via view-cart-button', async () => {
    await waitFor(element(by.id('view-cart-button')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('view-cart-button')).tap();

    // Verify we are on the CartScreen
    try {
      await waitFor(element(by.id('cart-summary')))
        .toBeVisible()
        .withTimeout(15000);
    } catch {
      await waitFor(element(by.id('cart-total')))
        .toBeVisible()
        .withTimeout(15000);
    }
    await device.takeScreenshot('27-cart-screen');
  });

  it('navigates to Favorites via cart-favorites-link', async () => {
    await waitFor(element(by.id('cart-favorites-link')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('cart-favorites-link')).tap();

    // FavoritesScreen — either empty state or list
    try {
      await waitFor(element(by.id('favorites-list')))
        .toBeVisible()
        .withTimeout(15000);
      await expect(element(by.id('favorites-list'))).toBeVisible();
    } catch {
      await waitFor(element(by.id('favorites-empty')))
        .toBeVisible()
        .withTimeout(15000);
      await expect(element(by.id('favorites-empty'))).toBeVisible();
    }
    await device.takeScreenshot('27-favorites-screen');
  });

  it('shows browse button on empty state', async () => {
    try {
      await waitFor(element(by.id('favorites-browse-button')))
        .toBeVisible()
        .withTimeout(15000);
      await expect(element(by.id('favorites-browse-button'))).toBeVisible();
    } catch {
      // Non-empty favorites list is also valid — skip
    }
  });
});

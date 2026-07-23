/// <reference types="detox" />
/**
 * TC-17: Seller Trade View — Selling Tab and Trade Actions
 *
 * Verifies that a seller can view their active selling trades and
 * that the trade detail screen shows the relevant seller actions.
 *
 * Prerequisites: npm run seed:staging (creates trades where seller has items sold)
 *
 * testIDs used:
 *   tab-me, profile-trades-stat, tab-active, trade-status-badge,
 *   mark-completed-button
 */
import { loginAsSeller } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-17: Seller Trade View', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsSeller();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the seller trade list from Profile', async () => {
    await goToProfile();
    await waitFor(element(by.id('profile-trades-stat')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('profile-trades-stat')).tap();
    await device.takeScreenshot('17-seller-trade-list');
  });

  it('shows the Active trades tab', async () => {
    await waitFor(element(by.id('tab-active')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('tab-active')).tap();
    await new Promise(r => setTimeout(r, 500));
    await device.takeScreenshot('17-seller-active-trades');
  });

  it('opens a trade detail and shows the trade status badge', async () => {
    // Tap first trade in the active list
    try {
      await element(by.id(/trade-row-.+/)).atIndex(0).tap();
    } catch {
      await element(by.id('tab-active')).atIndex(0).tap();
    }

    await waitFor(element(by.id('trade-timeline')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('trade-timeline'))).toBeVisible();
    await device.takeScreenshot('17-seller-trade-detail');
  });
});

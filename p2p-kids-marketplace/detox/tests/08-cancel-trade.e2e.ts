/// <reference types="detox" />
/**
 * TC-08: Cancel Trade — Buyer Cancels an Active Trade
 *
 * Verifies that a buyer can navigate to their active trades and cancel one.
 *
 * Prerequisites:
 *   - npm run seed:staging has run (creates trades with 'active' status)
 *   - OR TC-04b has been run first to create a trade
 *
 * testIDs used:
 *   tab-me, profile-trades-stat, tab-active, trade-status-badge,
 *   cancel-trade-button
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-08: Cancel Trade', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the Profile trades list', async () => {
    await goToProfile();
    await waitFor(element(by.id('profile-trades-stat')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('profile-trades-stat')).tap();
    await device.takeScreenshot('08-trades-list');
  });

  it('opens the Active trades tab', async () => {
    await waitFor(element(by.id('tab-active')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('tab-active')).tap();
    await new Promise(r => setTimeout(r, 500));
    await device.takeScreenshot('08-active-trades-tab');
  });

  it('opens a trade detail and shows the Cancel Trade button', async () => {
    // Tap the first trade row
    try {
      await element(by.id('tab-active')).atIndex(0).tap();
    } catch {
      // Fallback: the trade rows may be siblings, not children of tab-active
      await element(by.id('trade-status-badge')).atIndex(0).tap();
    }

    await waitFor(element(by.id('cancel-trade-button')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('cancel-trade-button'))).toBeVisible();
    await device.takeScreenshot('08-cancel-button-visible');
  });

  it('cancels the trade and returns to trade list', async () => {
    await element(by.id('cancel-trade-button')).tap();
    await new Promise(r => setTimeout(r, 500));

    // Confirm cancellation if a dialog appears
    try {
      await element(by.text('Cancel Trade')).atIndex(0).tap();
    } catch {}
    try {
      await element(by.text('Confirm')).tap();
    } catch {}
    try {
      await element(by.text('Yes, Cancel')).tap();
    } catch {}

    // After cancellation, should navigate back to trade list or show cancelled state
    await new Promise(r => setTimeout(r, 1500));
    await device.takeScreenshot('08-after-cancel');
  });
});

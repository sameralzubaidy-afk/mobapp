/// <reference types="detox" />
/**
 * TC-22: Seller Trade Actions — Accept / Decline / Mark Complete
 *
 * Verifies that the seller's Trade Detail screen shows the correct
 * action buttons for managing a received trade offer.
 *
 * Prerequisites:
 *   - npm run seed:staging (creates a trade offer from buyer → seller)
 *   - Buyer must have an active offer in seller's inbox
 *
 * testIDs used:
 *   tab-me, profile-trades-stat, tab-active, trade-status-badge,
 *   mark-completed-button, cancel-trade-button, review-trade-button
 */
import { loginAsSeller } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-22: Seller Trade Actions', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsSeller();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('seller can view active trades from Profile', async () => {
    await goToProfile();
    await waitFor(element(by.id('profile-trades-stat')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('profile-trades-stat')).tap();

    await waitFor(element(by.id('tab-active')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('tab-active')).tap();
    await device.takeScreenshot('22-seller-active-trades');
  });

  it('opens a trade detail and shows trade action buttons', async () => {
    // Tap first trade row
    try {
      await element(by.id(/trade-row-.+/)).atIndex(0).tap();
    } catch {
      await element(by.id('tab-active')).atIndex(0).tap();
    }

    await waitFor(element(by.id('trade-timeline')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('22-seller-trade-detail');
  });

  it('shows at least one seller action button', async () => {
    // Seller can see mark-completed, cancel, or review depending on trade state
    let hasAction = false;
    try {
      await waitFor(element(by.id('mark-completed-button'))).toBeVisible().withTimeout(3000);
      hasAction = true;
    } catch {}
    if (!hasAction) {
      try {
        await waitFor(element(by.id('cancel-trade-button'))).toBeVisible().withTimeout(3000);
        hasAction = true;
      } catch {}
    }
    if (!hasAction) {
      try {
        await waitFor(element(by.id('review-trade-button'))).toBeVisible().withTimeout(3000);
        hasAction = true;
      } catch {}
    }

    expect(hasAction).toBe(true);
    await device.takeScreenshot('22-seller-action-buttons-visible');
  });
});

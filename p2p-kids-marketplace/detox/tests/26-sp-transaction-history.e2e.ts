/// <reference types="detox" />
/**
 * TC-26: SP Transaction History Screen
 *
 * Verifies the SP transaction history is accessible from the SP Wallet
 * screen and that the tab filters (All / Earned / Spent) are visible.
 *
 * testIDs used:
 *   tab-me, profile-sp-balance-stat, sp-wallet-history-btn,
 *   sp-history-tab-all, sp-history-tab-earned, sp-history-tab-spent,
 *   sp-history-empty-state
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-26: SP Transaction History', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to SP Wallet from Profile', async () => {
    await goToProfile();

    await waitFor(element(by.id('profile-sp-balance-stat')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('profile-sp-balance-stat')).tap();

    await waitFor(element(by.id('sp-wallet-history-btn')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('26-sp-wallet-for-history');
  });

  it('opens SP transaction history screen', async () => {
    await element(by.id('sp-wallet-history-btn')).tap();

    await waitFor(element(by.id('sp-history-tab-all')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('sp-history-tab-all'))).toBeVisible();
    await device.takeScreenshot('26-sp-history-screen');
  });

  it('shows Earned and Spent tabs', async () => {
    await waitFor(element(by.id('sp-history-tab-earned')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('sp-history-tab-earned'))).toBeVisible();

    await waitFor(element(by.id('sp-history-tab-spent')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('sp-history-tab-spent'))).toBeVisible();
  });

  it('switches to Earned tab', async () => {
    await element(by.id('sp-history-tab-earned')).tap();
    await device.takeScreenshot('26-sp-history-earned');
  });

  it('switches to Spent tab', async () => {
    await element(by.id('sp-history-tab-spent')).tap();
    await device.takeScreenshot('26-sp-history-spent');
  });
});

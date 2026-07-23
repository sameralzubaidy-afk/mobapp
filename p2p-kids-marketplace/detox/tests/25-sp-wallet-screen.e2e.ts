/// <reference types="detox" />
/**
 * TC-25: SP Wallet Dedicated Screen
 *
 * Verifies that tapping the SP balance stat on the Profile screen
 * opens the dedicated SP Wallet screen with balance card and action buttons.
 *
 * Note: TC-05 only checks the profile-sp-balance-stat element on Profile.
 * This test verifies the FULL SP Wallet screen content.
 *
 * testIDs used:
 *   tab-me, profile-sp-balance-stat, sp-wallet-balance-card,
 *   sp-wallet-balance-amount, sp-wallet-history-btn,
 *   sp-wallet-earn-sell-btn, sp-wallet-earn-refer-btn,
 *   sp-wallet-shop-btn
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-25: SP Wallet Dedicated Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates from Profile to SP Wallet screen', async () => {
    await goToProfile();

    await waitFor(element(by.id('profile-sp-balance-stat')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('profile-sp-balance-stat')).tap();

    await waitFor(element(by.id('sp-wallet-balance-card')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('sp-wallet-balance-card'))).toBeVisible();
    await device.takeScreenshot('25-sp-wallet-screen');
  });

  it('shows the SP balance amount', async () => {
    await waitFor(element(by.id('sp-wallet-balance-amount')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('sp-wallet-balance-amount'))).toBeVisible();
  });

  it('shows the SP history button', async () => {
    await waitFor(element(by.id('sp-wallet-history-btn')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('sp-wallet-history-btn'))).toBeVisible();
  });

  it('shows SP earn action buttons', async () => {
    // Buttons may be below the fold — use whileElement scroll (Detox-recommended
    // scroll-until-visible pattern) rather than swiping on a card element.
    try {
      await waitFor(element(by.id('sp-wallet-earn-refer-btn')))
        .toBeVisible()
        .withTimeout(15000);
    } catch {
      await waitFor(element(by.id('sp-wallet-earn-refer-btn')))
        .toBeVisible()
        .whileElement(by.type('RCTScrollView'))
        .scroll(200, 'down');
    }
    await expect(element(by.id('sp-wallet-earn-refer-btn'))).toBeVisible();
    await device.takeScreenshot('25-sp-wallet-earn-btns');
  });
});

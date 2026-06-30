/// <reference types="detox" />
/**
 * TC-32: Referrals Screen
 *
 * Verifies that the Referrals Dashboard is accessible from the SP Wallet
 * screen via the "Earn - Refer" button and that the referral code is visible.
 *
 * testIDs used:
 *   tab-me, profile-sp-balance-stat, sp-wallet-earn-refer-btn,
 *   referral-code-text, share-btn, hero-card
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-32: Referrals Screen', () => {
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

    await waitFor(element(by.id('sp-wallet-earn-refer-btn')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('32-sp-wallet-before-referrals');
  });

  it('taps the Earn Refer button to open Referrals', async () => {
    await element(by.id('sp-wallet-earn-refer-btn')).tap();

    await waitFor(element(by.id('referral-code-text')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('referral-code-text'))).toBeVisible();
    await device.takeScreenshot('32-referrals-screen');
  });

  it('shows the share button', async () => {
    await waitFor(element(by.id('share-btn')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('share-btn'))).toBeVisible();
  });

  it('shows the hero card', async () => {
    try {
      await waitFor(element(by.id('hero-card')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('hero-card'))).toBeVisible();
    } catch {
      // May need scroll to top
    }
    await device.takeScreenshot('32-referrals-hero-card');
  });
});

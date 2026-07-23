/// <reference types="detox" />
/**
 * TC-05: SP Wallet — Balance Visible on Profile
 *
 * Verifies that the buyer's Swap Points balance is visible on the Profile screen.
 *
 * Prerequisites: npm run seed:staging has run (seeds SP ledger entries for buyer).
 *
 * testIDs used: tab-me, profile-sp-balance-stat
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-05: SP Wallet — Balance', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows the SP balance stat on the Profile screen', async () => {
    await goToProfile();
    await waitFor(element(by.id('profile-sp-balance-stat')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('profile-sp-balance-stat'))).toBeVisible();
    await device.takeScreenshot('05-sp-balance-visible');
  });
});

/// <reference types="detox" />
/**
 * TC-09: Profile — Screen Renders
 *
 * Verifies that the Profile (Me) screen loads and displays key user stats.
 *
 * Prerequisites: npm run seed:staging has run.
 *
 * testIDs used:
 *   tab-me, profile-trades-stat, profile-sp-balance-stat
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-09: Profile Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the Profile (Me) tab', async () => {
    await goToProfile();
    await device.takeScreenshot('09-profile-screen');
  });

  it('shows the trades stat', async () => {
    await waitFor(element(by.id('profile-trades-stat')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('profile-trades-stat'))).toBeVisible();
  });

  it('shows the SP balance stat', async () => {
    await waitFor(element(by.id('profile-sp-balance-stat')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('profile-sp-balance-stat'))).toBeVisible();
    await device.takeScreenshot('09-profile-stats-visible');
  });
});

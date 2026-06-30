/// <reference types="detox" />
/**
 * TC-01: Auth — Login
 *
 * Verifies that the test buyer can log in and land on the main navigation.
 * This is the most foundational smoke test — if this fails, all others will too.
 *
 * Prerequisites: npm run seed:staging has been run at least once.
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';

describe('TC-01: Auth — Login', () => {
  beforeAll(async () => {
    // DTXDisableMainRunLoopSync prevents Detox from blocking on RN's busy main queue
    // while still allowing waitFor + timeouts to operate normally.
    await device.launchApp({
      newInstance: true,
      delete: false,
      launchArgs: {
        DTXDisableMainRunLoopSync: true,
        detoxURLBlacklistRegex: '.*',
      },
    });
    await dismissSystemDialogs();
  }, 300000);

  afterAll(async () => {
    await device.terminateApp();
  });

  it('logs in as buyer and reaches the main tab navigation', async () => {
    await loginAsBuyer();
    await expect(element(by.id('tab-discover'))).toBeVisible();
    await device.takeScreenshot('01-login-success');
  });
});

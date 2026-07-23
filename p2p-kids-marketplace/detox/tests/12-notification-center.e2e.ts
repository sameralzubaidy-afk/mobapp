/// <reference types="detox" />
/**
 * TC-12: Notification Center — Bell Opens Notification List
 *
 * Verifies that tapping the notification bell navigates to the
 * Notification Center screen and the notification list renders.
 *
 * testIDs used:
 *   notif-button, notification-center-screen, notification-list, screen-title
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToHome } from '../helpers/navigation';

describe('TC-12: Notification Center', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToHome();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('opens the notification center when the bell is tapped', async () => {
    await waitFor(element(by.id('header-notifications-btn')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('header-notifications-btn')).tap();

    await waitFor(element(by.id('notification-center-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('12-notification-center-open');
  });

  it('shows the notification list', async () => {
    await waitFor(element(by.id('notification-list')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('notification-list'))).toBeVisible();
  });

  it('shows a Notifications screen title', async () => {
    try {
      await expect(element(by.id('screen-title'))).toBeVisible();
    } catch {
      await expect(element(by.text('Notifications'))).toBeVisible();
    }
    await device.takeScreenshot('12-notification-list-loaded');
  });
});

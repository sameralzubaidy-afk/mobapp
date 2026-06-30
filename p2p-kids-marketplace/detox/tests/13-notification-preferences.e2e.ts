/// <reference types="detox" />
/**
 * TC-13: Notification Preferences — Toggle Controls Render
 *
 * Verifies that the Notification Preferences screen loads with all
 * category sections and toggle switches visible.
 *
 * testIDs used:
 *   tab-me, settings-button, notification-preferences-row,
 *   category-section-subscription, category-section-sp_events,
 *   category-section-trades, toggle-subscription-push
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-13: Notification Preferences', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToProfile();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the Settings screen', async () => {
    await waitFor(element(by.id('settings-button')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('settings-button')).tap();
    await device.takeScreenshot('13-settings-screen');
  });

  it('opens the Notification Preferences screen', async () => {
    await waitFor(element(by.id('notification-preferences-row')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('notification-preferences-row')).tap();

    // Verify preferences screen loaded
    await waitFor(element(by.id('category-section-subscription')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('13-notification-preferences');
  });

  it('shows all notification category sections', async () => {
    await expect(element(by.id('category-section-subscription'))).toBeVisible();
    await expect(element(by.id('category-section-trades'))).toBeVisible();
    await waitFor(element(by.id('category-section-sp_events')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows push toggle for Subscription category', async () => {
    await waitFor(element(by.id('toggle-subscription-push')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('toggle-subscription-push'))).toBeVisible();
    await device.takeScreenshot('13-notification-toggles-visible');
  });
});

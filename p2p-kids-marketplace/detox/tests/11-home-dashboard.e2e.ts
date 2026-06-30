/// <reference types="detox" />
/**
 * TC-11: Home Dashboard — Key Widgets Render
 *
 * Verifies the home screen header row, greeting, notification bell,
 * and SP balance strip are all visible after login.
 *
 * testIDs used:
 *   dashboard-screen, header-row, header-avatar, greeting-text,
 *   notif-button, sp-strip
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToHome } from '../helpers/navigation';

describe('TC-11: Home Dashboard', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the Home tab and shows the dashboard screen', async () => {
    await goToHome();
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('11-home-dashboard');
  });

  it('renders the header row with avatar and greeting', async () => {
    await expect(element(by.id('header-row'))).toBeVisible();
    await expect(element(by.id('header-avatar'))).toBeVisible();
    await expect(element(by.id('greeting-text'))).toBeVisible();
  });

  it('shows the notification bell icon', async () => {
    await expect(element(by.id('notif-button'))).toBeVisible();
  });

  it('shows the SP balance strip', async () => {
    await waitFor(element(by.id('sp-strip')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('sp-strip'))).toBeVisible();
    await device.takeScreenshot('11-home-sp-strip');
  });
});

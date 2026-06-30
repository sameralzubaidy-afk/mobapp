/// <reference types="detox" />
/**
 * TC-18: Password Toggle — Show/Hide Password on Login Screen
 *
 * Verifies that the password field has a visibility toggle button on the
 * login screen that can be tapped to show/hide the entered password.
 *
 * testIDs used:
 *   landing-login-button, login-password-input,
 *   login-password-input-toggle-button, login-submit-button
 */
import { dismissSystemDialogs } from '../helpers/dialogs';

describe('TC-18: Password Toggle', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();

    // Navigate to login screen
    try {
      await element(by.id('welcome-get-started-button')).tap();
      await new Promise(r => setTimeout(r, 600));
    } catch {}

    try {
      await element(by.id('landing-login-button')).tap();
    } catch {}

    await waitFor(element(by.id('login-password-input')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows the password visibility toggle button', async () => {
    await expect(element(by.id('login-password-input-toggle-button'))).toBeVisible();
    await device.takeScreenshot('18-password-toggle-visible');
  });

  it('tapping the toggle does not crash the screen', async () => {
    await element(by.id('login-password-input')).typeText('testpass123');

    // Tap toggle twice (hide then show)
    await element(by.id('login-password-input-toggle-button')).tap();
    await new Promise(r => setTimeout(r, 300));
    await element(by.id('login-password-input-toggle-button')).tap();
    await new Promise(r => setTimeout(r, 300));

    // Form should still be functional
    await expect(element(by.id('login-submit-button'))).toBeVisible();
    await device.takeScreenshot('18-password-toggle-after');
  });
});

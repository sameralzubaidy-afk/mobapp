/// <reference types="detox" />
/**
 * TC-23: Forgot Password Flow
 *
 * Verifies that the user can navigate from the Login screen to the
 * Forgot Password screen via the "Forgot password?" link.
 *
 * testIDs used:
 *   welcome-get-started-button, landing-login-button, forgot-password-link,
 *   login-email-input
 */
import { dismissSystemDialogs } from '../helpers/dialogs';

describe('TC-23: Forgot Password', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates from Welcome to Login screen', async () => {
    // Welcome screen
    await waitFor(element(by.id('welcome-get-started-button')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('welcome-get-started-button')).tap();

    // Landing screen → login button
    await waitFor(element(by.id('landing-login-button')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('landing-login-button')).tap();

    // Login screen
    await waitFor(element(by.id('login-email-input')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('23-login-screen');
  });

  it('shows the forgot-password-link on the Login screen', async () => {
    await waitFor(element(by.id('login-forgot-password-link')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('login-forgot-password-link'))).toBeVisible();
    await device.takeScreenshot('23-forgot-password-link-visible');
  });

  it('taps forgot-password-link and opens password recovery screen', async () => {
    await element(by.id('login-forgot-password-link')).tap();

    // waitFor handles the navigation transition — no fixed sleep needed.
    // Verify we have moved away from the login screen.
    try {
      await waitFor(element(by.id('forgot-password-email-input')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('forgot-password-email-input'))).toBeVisible();
    } catch {
      // Fallback: just verify a send/submit button is visible
      await waitFor(element(by.id('set-password-button')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('set-password-button'))).toBeVisible();
    }
    await device.takeScreenshot('23-forgot-password-screen');
  });
});

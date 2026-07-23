/// <reference types="detox" />
/**
 * TC-02: Auth — Signup Form
 *
 * Verifies that the signup screen renders correctly and validates required fields.
 * Does NOT complete signup (avoids creating throwaway users in the staging DB on every run).
 *
 * testIDs used:
 *   welcome-get-started-button, landing-signup-button, login-signup-link,
 *   signup-display-name-input, signup-email-input, signup-phone-input,
 *   signup-dob-input, signup-password-input, signup-submit-button
 */
import { dismissSystemDialogs } from '../helpers/dialogs';

describe('TC-02: Auth — Signup Form', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();

    // Navigate: Welcome → Landing → Signup
    try {
      await element(by.id('welcome-get-started-button')).tap();
      await new Promise(r => setTimeout(r, 600));
    } catch {}

    try {
      await element(by.id('landing-signup-button')).tap();
    } catch {
      // Fallback: go through Login screen → Sign Up link
      try {
        await element(by.id('landing-login-button')).tap();
        await waitFor(element(by.id('login-signup-link')))
          .toBeVisible()
          .withTimeout(5000);
        await element(by.id('login-signup-link')).tap();
      } catch {}
    }

    await waitFor(element(by.id('signup-email-input')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('renders all required signup form fields', async () => {
    await expect(element(by.id('signup-display-name-input'))).toBeVisible();
    await expect(element(by.id('signup-email-input'))).toBeVisible();
    await expect(element(by.id('signup-phone-input'))).toBeVisible();
    await device.takeScreenshot('02-signup-form-rendered');
  });

  it('does not navigate away when submitting an empty form', async () => {
    await element(by.id('signup-submit-button')).tap();
    await new Promise(r => setTimeout(r, 800));
    // Form should still be visible — validation blocked navigation
    await expect(element(by.id('signup-email-input'))).toBeVisible();
    await device.takeScreenshot('02-signup-validation-blocked');
  });
});

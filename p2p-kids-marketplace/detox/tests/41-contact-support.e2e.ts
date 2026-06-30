/// <reference types="detox" />
/**
 * TC-41: Contact Support Screen
 *
 * Verifies the Contact Support screen is accessible from the Help
 * screen, and that the subject input and submit button are visible.
 *
 * testIDs used:
 *   tab-me, profile-settings, settings-scroll, help-screen (from TC-14),
 *   contact-support-button, subject-input, support-button
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-41: Contact Support Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates from Profile → Settings → Help', async () => {
    await goToProfile();

    await waitFor(element(by.id('profile-settings')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('profile-settings')).tap();

    // Help row on the Settings screen
    await waitFor(element(by.id('settings-scroll')))
      .toBeVisible()
      .withTimeout(8000);

    // Find the Help/FAQ row — label differs by implementation
    try {
      await element(by.text('Help & FAQ')).tap();
    } catch {
      try {
        await element(by.text('Help')).tap();
      } catch {
        await element(by.text('FAQ')).tap();
      }
    }

    await waitFor(element(by.id('help-screen')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('41-help-screen');
  });

  it('taps the Contact Support button', async () => {
    await waitFor(element(by.id('contact-support-button')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('contact-support-button')).tap();

    // Wait for the contact form to render instead of an arbitrary sleep
    await waitFor(element(by.id('subject-input')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('41-contact-support-screen');
  });

  it('shows the subject input', async () => {
    await waitFor(element(by.id('subject-input')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('subject-input'))).toBeVisible();
  });

  it('shows the submit/support button', async () => {
    await waitFor(element(by.id('support-button')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('support-button'))).toBeVisible();
    await device.takeScreenshot('41-contact-support-form');
  });
});

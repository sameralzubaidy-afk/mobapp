/// <reference types="detox" />
/**
 * TC-15: Settings & Legal — Privacy Policy and Terms Links
 *
 * Verifies the Settings screen renders with all Legal section links
 * and that Privacy Policy opens and back-navigates correctly.
 *
 * testIDs used:
 *   tab-me, settings-button, settings-privacy-policy-button,
 *   settings-tos-button, settings-liability-disclaimer-button,
 *   settings-sign-out-button, back-button
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-15: Settings & Legal', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToProfile();

    await waitFor(element(by.id('settings-button')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('settings-button')).tap();
    await new Promise(r => setTimeout(r, 500));
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows all Legal section buttons', async () => {
    await waitFor(element(by.id('settings-privacy-policy-button')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('settings-privacy-policy-button'))).toBeVisible();
    await expect(element(by.id('settings-tos-button'))).toBeVisible();
    await expect(element(by.id('settings-sign-out-button'))).toBeVisible();
    await device.takeScreenshot('15-settings-legal-section');
  });

  it('opens Privacy Policy and back-navigates to Settings', async () => {
    await element(by.id('settings-privacy-policy-button')).tap();
    await waitFor(element(by.text('Privacy Policy')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('15-privacy-policy-open');

    // Back to Settings
    try {
      await element(by.id('back-button')).tap();
    } catch {
      await device.pressBack(); // Android hardware back
    }

    await waitFor(element(by.id('settings-tos-button')))
      .toBeVisible()
      .withTimeout(5000);
    await device.takeScreenshot('15-back-to-settings');
  });

  it('opens Terms of Service', async () => {
    await element(by.id('settings-tos-button')).tap();
    await waitFor(element(by.text('Terms of Service')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('15-tos-open');

    try {
      await element(by.id('back-button')).tap();
    } catch {
      await device.pressBack();
    }
  });
});

/// <reference types="detox" />
/**
 * TC-16: ID Verification Screen
 *
 * Verifies that the ID Verification screen renders in the unverified state
 * with the upload area and submit button visible.
 * NOTE: Cannot automate actual document upload (system photo picker).
 *
 * testIDs used:
 *   tab-me, id-verification-menu-item, id-verification-screen,
 *   id-verification-unverified-state, id-verification-upload-area,
 *   id-verification-submit-btn, id-verification-back-btn
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-16: ID Verification Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToProfile();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('opens the ID Verification screen from the Profile menu', async () => {
    await waitFor(element(by.id('id-verification-menu-item')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('id-verification-menu-item')).tap();

    await waitFor(element(by.id('id-verification-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('16-id-verification-screen');
  });

  it('shows the unverified state with upload area', async () => {
    await expect(element(by.id('id-verification-upload-area'))).toBeVisible();
    await expect(element(by.id('id-verification-submit-btn'))).toBeVisible();
    await device.takeScreenshot('16-id-verification-upload-area');
    // NOTE: Cannot test actual image selection — system photo picker
  });

  it('back button navigates away from verification screen', async () => {
    try {
      await element(by.id('id-verification-back-btn')).tap();
    } catch {
      await device.pressBack();
    }
    await waitFor(element(by.id('id-verification-screen')))
      .not.toBeVisible()
      .withTimeout(5000);
  });
});

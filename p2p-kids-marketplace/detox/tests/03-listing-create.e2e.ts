/// <reference types="detox" />
/**
 * TC-03: Listing Create — Form Renders
 *
 * Verifies the create listing screen loads and all form fields are accessible.
 * NOTE: Image upload cannot be automated (iOS photo picker is a system UI).
 *       This test covers everything up to image selection.
 *
 * testIDs used:
 *   tab-discover, create-listing-title-input, create-listing-description-input,
 *   create-listing-price-input, create-listing-submit-button,
 *   create-listing-image-picker-add-from-gallery
 */
import { loginAsSeller } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';

describe('TC-03: Listing Create — Form', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsSeller();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to the create listing screen', async () => {
    // Try the sell/create tab (common testID patterns)
    const createButtonIds = ['tab-sell', 'create-listing-fab', 'sell-fab-button', 'add-listing-button'];
    let navigated = false;
    for (const testId of createButtonIds) {
      try {
        await element(by.id(testId)).tap();
        await new Promise(r => setTimeout(r, 800));
        navigated = true;
        break;
      } catch {}
    }

    if (!navigated) {
      // Fallback: look for a "+" or "Sell" text button
      try {
        await element(by.text('Sell')).tap();
      } catch {
        await element(by.text('List an Item')).tap();
      }
    }

    await waitFor(element(by.id('create-listing-title-input')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('03-create-listing-screen');
  });

  it('renders title, description, and price fields', async () => {
    await expect(element(by.id('create-listing-title-input'))).toBeVisible();
    await expect(element(by.id('create-listing-description-input'))).toBeVisible();
    await expect(element(by.id('create-listing-price-input'))).toBeVisible();
  });

  it('accepts text input in title and price fields', async () => {
    await element(by.id('create-listing-title-input')).clearText();
    await element(by.id('create-listing-title-input')).typeText('Detox Test Item');

    await element(by.id('create-listing-price-input')).clearText();
    await element(by.id('create-listing-price-input')).typeText('25');

    await device.takeScreenshot('03-create-listing-filled');
  });

  it('shows image picker option', async () => {
    await expect(element(by.id('create-listing-image-picker-add-from-gallery'))).toBeVisible();
    // NOTE: Cannot automate actual image selection — this is a system-level UI
  });
});

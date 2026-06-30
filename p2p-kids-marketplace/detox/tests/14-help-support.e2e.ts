/// <reference types="detox" />
/**
 * TC-14: Help & Support — FAQ Screen
 *
 * Verifies that the Help & Support screen loads with a visible FAQ list
 * and category chips for filtering.
 *
 * testIDs used:
 *   tab-me, settings-button, help-screen, search-input,
 *   category-chips-scroll, faq-list
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-14: Help & Support', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToProfile();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to Settings and opens Help & Support', async () => {
    await waitFor(element(by.id('settings-button')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('settings-button')).tap();
    await new Promise(r => setTimeout(r, 500));

    // Help & Support is typically a row in Settings
    try {
      await element(by.text('Help & Support')).tap();
    } catch {
      await element(by.id('settings-help-button')).tap();
    }

    await waitFor(element(by.id('help-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await device.takeScreenshot('14-help-screen-loaded');
  });

  it('shows the FAQ list', async () => {
    await waitFor(element(by.id('faq-list')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('faq-list'))).toBeVisible();
  });

  it('shows the search input bar', async () => {
    await expect(element(by.id('search-input'))).toBeVisible();
  });

  it('shows category filter chips', async () => {
    await waitFor(element(by.id('category-chips-scroll')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('category-chips-scroll'))).toBeVisible();
    await device.takeScreenshot('14-faq-chips-visible');
  });
});

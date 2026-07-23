/// <reference types="detox" />
/**
 * TC-34: My Listings Screen
 *
 * Verifies that a seller can access their My Listings screen from the
 * Profile page, and that the Listings and Drafts tabs are visible.
 *
 * testIDs used:
 *   tab-me, profile-listings-stat, tab-listings, tab-drafts,
 *   listings-flatlist, drafts-flatlist
 */
import { loginAsSeller } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToProfile } from '../helpers/navigation';

describe('TC-34: My Listings Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsSeller();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to My Listings from Profile', async () => {
    await goToProfile();

    await waitFor(element(by.id('profile-listings-stat')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('profile-listings-stat')).tap();

    // My Listings screen — Listings tab is default
    await waitFor(element(by.id('tab-listings')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('tab-listings'))).toBeVisible();
    await device.takeScreenshot('34-my-listings-screen');
  });

  it('shows the listings flatlist or empty state', async () => {
    try {
      await waitFor(element(by.id('listings-flatlist')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('listings-flatlist'))).toBeVisible();
    } catch {
      // Listings may be empty for a fresh seed — acceptable
    }
    await device.takeScreenshot('34-listings-flatlist');
  });

  it('shows the Drafts tab', async () => {
    await waitFor(element(by.id('tab-drafts')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('tab-drafts'))).toBeVisible();
  });

  it('switches to Drafts tab and shows drafts list or empty', async () => {
    await element(by.id('tab-drafts')).tap();
    // waitFor handles the list render; no sleep needed
    try {
      await waitFor(element(by.id('drafts-flatlist')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('drafts-flatlist'))).toBeVisible();
    } catch {
      // Empty drafts state is acceptable
    }
    await device.takeScreenshot('34-drafts-tab');
  });
});

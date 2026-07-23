/// <reference types="detox" />
/**
 * TC-10: Discovery & Browse — Search and Filter
 *
 * Verifies that the Discover screen loads listing results and that
 * the search input is functional.
 *
 * Prerequisites: npm run seed:staging has run (test listings exist).
 *
 * testIDs used:
 *   tab-discover, discover-results-list, discover-search-input,
 *   empty-state, discover-sp-toggle
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-10: Discovery & Browse', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToDiscover();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows seeded listing results on the Discover screen', async () => {
    await expect(element(by.id('discover-results-list'))).toBeVisible();
    await device.takeScreenshot('10-discover-results');
  });

  it('search input is visible and accepts text', async () => {
    await waitFor(element(by.id('discover-search-input')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('discover-search-input')).tap();
    await element(by.id('discover-search-input')).typeText('Detox Test');
    await new Promise(r => setTimeout(r, 800));
    await device.takeScreenshot('10-search-input-typed');
  });

  it('clears search and restores results', async () => {
    await element(by.id('discover-search-input')).clearText();
    await new Promise(r => setTimeout(r, 800));
    // Dismiss recent searches panel if visible
    try {
      await element(by.id('clear-recent-searches')).tap();
      await new Promise(r => setTimeout(r, 500));
    } catch {}
    // Dismiss keyboard — this blurs the search input (hides recent-searches-panel
    // and makes the FlatList fully visible instead of partially covered by keyboard)
    try {
      await element(by.id('discover-search-input')).tapReturnKey();
      await new Promise(r => setTimeout(r, 500));
    } catch {}
    await device.takeScreenshot('10-before-results-visibility-assert');
    // Scroll to ensure discover-results-list passes visibility threshold
    try {
      await element(by.id('discover-results-list')).scroll(100, 'down');
    } catch {}
    await expect(element(by.id('discover-results-list'))).toBeVisible();
    await device.takeScreenshot('10-search-cleared');
  });

  it('shows the SP-eligible filter switch', async () => {
    await waitFor(element(by.id('discover-sp-toggle')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('discover-sp-toggle'))).toBeVisible();
  });
});

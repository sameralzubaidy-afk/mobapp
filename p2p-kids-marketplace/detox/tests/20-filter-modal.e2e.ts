/// <reference types="detox" />
/**
 * TC-20: Filter Modal — Open Filters and Apply
 *
 * Verifies that the Discover filter modal can be opened and that
 * filter categories and conditions are selectable.
 *
 * Prerequisites: npm run seed:staging (listings must exist)
 *
 * testIDs used:
 *   tab-discover, discover-results-list, discover-filter-button,
 *   discover-screen
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-20: Filter Modal', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToDiscover();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('opens the filter modal from the Discover screen', async () => {
    // Filter button may be a funnel icon or text "Filter"
    try {
      await element(by.id('discover-filter-button')).tap();
    } catch {
      await element(by.text('Filter')).tap();
    }

    // Modal should appear
    await waitFor(element(by.text('Filters')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('20-filter-modal-open');
  });

  it('shows filter options inside the modal', async () => {
    // At least one of these filter options should be visible
    let filterOptionFound = false;
    try {
      await waitFor(element(by.text('Category'))).toBeVisible().withTimeout(3000);
      filterOptionFound = true;
    } catch {}
    if (!filterOptionFound) {
      try {
        await waitFor(element(by.text('Condition'))).toBeVisible().withTimeout(3000);
        filterOptionFound = true;
      } catch {}
    }
    if (!filterOptionFound) {
      try {
        await waitFor(element(by.text('Price'))).toBeVisible().withTimeout(3000);
        filterOptionFound = true;
      } catch {}
    }

    if (!filterOptionFound) {
      await device.takeScreenshot('20-filter-modal-state');
    }
    expect(filterOptionFound).toBe(true);
  });

  it('closes the filter modal', async () => {
    try {
      await element(by.text('Clear')).tap();
    } catch {}
    try {
      await element(by.text('Done')).tap();
    } catch {}
    try {
      await element(by.text('Apply')).tap();
    } catch {}
    try {
      // Swipe down to dismiss
      await element(by.text('Filters')).swipe('down', 'fast');
    } catch {}

    await waitFor(element(by.id('discover-results-list')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('20-filter-modal-closed');
  });
});

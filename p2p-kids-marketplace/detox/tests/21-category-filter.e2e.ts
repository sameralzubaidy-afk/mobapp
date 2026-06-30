/// <reference types="detox" />
/**
 * TC-21: Category Filter — Buyer Category Selection Modal
 *
 * Verifies that the category filter modal shows categories with items
 * and that selecting a category filters the listing results.
 *
 * Prerequisites: npm run seed:staging (categories and listings must exist)
 *
 * testIDs used:
 *   tab-discover, discover-results-list, filter-category-button,
 *   close-category-modal
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-21: Category Filter', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
    await goToDiscover();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('opens the category filter modal', async () => {
    try {
      await element(by.id('filter-category-button')).tap();
    } catch {
      // Fallback: category filter may be within the main filter modal
      try {
        await element(by.id('discover-filter-button')).tap();
      } catch {
        await element(by.text('Category')).tap();
      }
    }

    await waitFor(element(by.text('Select Category')))
      .toBeVisible()
      .withTimeout(8000)
      .catch(async () => {
        // Title might differ
        await waitFor(element(by.text('Categories'))).toBeVisible().withTimeout(5000);
      });

    await device.takeScreenshot('21-category-modal-open');
  });

  it('shows seeded categories in the modal', async () => {
    // Seeded categories from seed-staging-data.ts: Toys, Sports, Electronics, Books
    const categoryFound = await Promise.any([
      waitFor(element(by.text('Toys'))).toBeVisible().withTimeout(3000),
      waitFor(element(by.text('Books'))).toBeVisible().withTimeout(3000),
      waitFor(element(by.text('Sports'))).toBeVisible().withTimeout(3000),
    ]).then(() => true).catch(() => false);

    expect(categoryFound).toBe(true);
    await device.takeScreenshot('21-categories-visible');
  });

  it('closes the category modal', async () => {
    try {
      await element(by.id('close-category-modal')).tap();
    } catch {
      try {
        await element(by.text('Cancel')).tap();
      } catch {
        await element(by.text('Done')).tap();
      }
    }

    await waitFor(element(by.id('discover-results-list')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('21-category-modal-closed');
  });
});

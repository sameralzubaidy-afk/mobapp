/// <reference types="detox" />
/**
 * TC-38: Search Empty State
 *
 * Verifies that searching for a nonsense term in the Discover screen
 * results in an empty state being displayed.
 *
 * testIDs used:
 *   tab-discover, discover-search-input, empty-state, spell-suggestion-button
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-38: Search Empty State', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to Discover', async () => {
    await goToDiscover();
    await waitFor(element(by.id('discover-search-input')))
      .toBeVisible()
      .withTimeout(8000);
  });

  it('searches for a nonsense string and sees empty state', async () => {
    await element(by.id('discover-search-input')).tap();
    // clearText first: typeText appends to any pre-existing field content
    await element(by.id('discover-search-input')).clearText();
    await element(by.id('discover-search-input')).typeText('xyzxyzxyz123noitems');
    // waitFor with a generous timeout handles debounce + network round-trip;
    // the separate setTimeout before it was redundant.
    await waitFor(element(by.id('empty-state')))
      .toBeVisible()
      .withTimeout(14000);
    await expect(element(by.id('empty-state'))).toBeVisible();
    await device.takeScreenshot('38-search-empty-state');
  });

  it('may show a spell suggestion button', async () => {
    try {
      await waitFor(element(by.id('spell-suggestion-button')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('spell-suggestion-button'))).toBeVisible();
    } catch {
      // Spell suggestions are optional / model-dependent
    }
    await device.takeScreenshot('38-search-empty-final');
  });
});

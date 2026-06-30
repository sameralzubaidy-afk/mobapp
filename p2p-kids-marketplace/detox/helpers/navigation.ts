/// <reference types="detox" />

/**
 * Navigates to the Discover tab and waits for results to load.
 */
export async function goToDiscover(): Promise<void> {
  await element(by.id('tab-discover')).tap();
  await waitFor(element(by.id('discover-results-list')))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Navigates to the Profile (Me) tab.
 */
export async function goToProfile(): Promise<void> {
  await element(by.id('tab-me')).tap();
  await new Promise(r => setTimeout(r, 500));
}

/**
 * Navigates to the Home tab.
 */
export async function goToHome(): Promise<void> {
  await element(by.id('home-tab')).tap();
  await new Promise(r => setTimeout(r, 500));
}

/**
 * Taps the first visible listing in the Discover results list.
 * Requires goToDiscover() to have been called first.
 */
export async function tapFirstListing(): Promise<void> {
  await waitFor(element(by.id('discover-results-list')))
    .toBeVisible()
    .withTimeout(10000);
  // Listings have testID="search-result-{uuid}" — tap first child via atIndex
  await element(by.id('discover-results-list'))
    .atIndex(0)
    .tap()
    .catch(async () => {
      // Fallback: scroll to trigger load then retry
      await element(by.id('discover-results-list')).scroll(100, 'down');
      await new Promise(r => setTimeout(r, 500));
      await element(by.id('discover-results-list')).atIndex(0).tap();
    });
}

/// <reference types="detox" />

import { dismissBadgeCelebration, dismissIfVisible } from './dialogs';

const TAB_IDS: Record<string, string> = {
  discover: 'tab-discover',
  profile: 'tab-me',
  home: 'tab-home',
  inbox: 'tab-inbox',
  sell: 'tab-sell',
};

/**
 * Navigates to a tab by name, dismissing known overlays before tapping.
 * Clears celebration modals, recent searches panels, or any tooltips that
 * could intercept the tab tap.
 */
export async function safeNavigateTo(tab: 'discover' | 'profile' | 'home' | 'inbox' | 'sell'): Promise<void> {
  // Clear any overlays before tapping
  await dismissIfVisible('celebration-close-button');
  await dismissIfVisible('recent-searches-panel');
  await new Promise(r => setTimeout(r, 200));

  await waitFor(element(by.id(TAB_IDS[tab])))
    .toBeVisible()
    .withTimeout(15000);

  // Retry tap up to 3 times to handle UITransitionView overlay
  // (navigation animation layer that blocks taps temporarily)
  let tapped = false;
  for (let i = 0; i < 3 && !tapped; i++) {
    try {
      await element(by.id(TAB_IDS[tab])).tap();
      tapped = true;
    } catch {
      if (i < 2) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // Post-navigation cleanup for specific tabs
  if (tab === 'profile') {
    await new Promise(r => setTimeout(r, 500));
    await dismissBadgeCelebration();
  } else {
    await new Promise(r => setTimeout(r, 500));
  }
}

/**
 * Navigates to the Discover tab and waits for results to load.
 */
export async function goToDiscover(): Promise<void> {
  await safeNavigateTo('discover');
  await waitFor(element(by.id('discover-results-list')))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Navigates to the Profile (Me) tab.
 */
export async function goToProfile(): Promise<void> {
  await safeNavigateTo('profile');
}

/**
 * Navigates to the Home tab.
 */
export async function goToHome(): Promise<void> {
  await safeNavigateTo('home');
}

/**
 * Navigates to a trade list sub-tab (Active or History) with waitFor + retry.
 * The sub-tabs within the Profile > Trades screen use `tab-active` and `tab-history`
 * testIDs. This helper mirrors safeNavigateTo() but for these sub-tabs.
 */
export async function goToTradesTab(tab: 'active' | 'history'): Promise<void> {
  await dismissIfVisible('celebration-close-button');
  await dismissIfVisible('recent-searches-panel');
  await new Promise(r => setTimeout(r, 200));

  await waitFor(element(by.id(`tab-${tab}`)))
    .toBeVisible()
    .withTimeout(15000);

  let tapped = false;
  for (let i = 0; i < 3 && !tapped; i++) {
    try {
      await element(by.id(`tab-${tab}`)).tap();
      tapped = true;
    } catch {
      if (i < 2) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  await new Promise(r => setTimeout(r, 500));
}

/**
 * Safely taps any element by testID after waiting for it to be visible.
 * Use this as a drop-in replacement for raw `element(by.id(x)).tap()` calls
 * that lack a preceding waitFor guard.
 *
 * @param testId  - The testID of the element to tap
 * @param timeout - Optional timeout in ms (default 8000)
 */
export async function safeTap(testId: string, timeout: number = 8000): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
  await element(by.id(testId)).tap();
}

/**
 * Scrolls a scroll view until a target element becomes visible.
 * Uses Detox's built-in whileElement().scroll() which repeatedly scrolls
 * and checks visibility — no need to guess scroll amounts.
 *
 * @param elementId   - The testID of the target element to find
 * @param scrollViewId - The testID of the scroll view container
 * @param direction   - 'down' to reveal content below, 'up' to reveal above
 */
export async function scrollToElement(
  elementId: string,
  scrollViewId: string,
  direction: 'down' | 'up' = 'down'
): Promise<void> {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(300, direction);
}

/**
 * Taps the first visible listing in the Discover results list.
 * Uses the listing card testID pattern search-result-{uuid} to ensure
 * we tap an actual item card, not the FlatList background.
 * Requires goToDiscover() to have been called first.
 */
export async function tapFirstListing(): Promise<void> {
  await waitFor(element(by.id('discover-results-list')))
    .toBeVisible()
    .withTimeout(10000);
  // Listings have testID="search-result-{uuid}" — tap the first one
  await element(by.id(/search-result-.+/))
    .atIndex(0)
    .tap()
    .catch(async () => {
      // Fallback: scroll to trigger load then retry
      await element(by.id('discover-results-list')).scroll(100, 'down');
      await new Promise(r => setTimeout(r, 500));
      await element(by.id(/search-result-.+/)).atIndex(0).tap();
    });
}

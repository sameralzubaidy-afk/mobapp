/// <reference types="detox" />
/**
 * TC-04a: Trade Flow — Initiate (Discover → Item Detail → Offer Screen)
 *
 * Verifies a buyer can discover a listing and reach the Trade Offer screen.
 * Stops at offer screen without submitting — TC-04b covers full submission.
 *
 * Prerequisites: npm run seed:staging has been run (creates test listings).
 *
 * testIDs used:
 *   tab-discover, discover-results-list, item-detail-title, item-detail-price,
 *   request-to-buy-button, send-offer-button, value-stack-row
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover, tapFirstListing, scrollToElement } from '../helpers/navigation';

/**
 * Supabase project config for test cleanup RPC.
 * Uses the staging anon key — safe for test use (public anon key).
 */
const SUPABASE_URL = 'https://drntwgporzabmxdqykrp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.5lj-JNoBItZJCZgMV9DwFslmzud0PxcIjSS78TFRU0E';
// Test buyer UUID (matches seed-staging-data.ts)
const TEST_BUYER_ID = '49243010-f458-4744-add1-a6c84ab95f1f';

/**
 * Calls the fn_cleanup_test_buyer_trades RPC to cancel any stale pending
 * offers from previous test runs, ensuring navigation to TradeOfferScreen
 * is not blocked by the duplicate offer check.
 */
async function cleanupStaleTrades(): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_cleanup_test_buyer_trades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ p_buyer_id: TEST_BUYER_ID }),
    });
    const result = await response.json();
    console.log(`[04a] Cleanup: ${JSON.stringify(result)}`);
  } catch (err) {
    // Non-fatal — if cleanup fails, the test may still work if no stale trades exist
    console.warn('[04a] Cleanup warning (non-fatal):', err);
  }
}

describe('TC-04a: Trade Flow — Initiate', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } });
    await dismissSystemDialogs();
    await loginAsBuyer();
    // Clean up stale pending trades so navigation to offer screen is not blocked
    await cleanupStaleTrades();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('loads the Discover screen with listing results', async () => {
    await goToDiscover();
    await expect(element(by.id('discover-results-list'))).toBeVisible();
    await device.takeScreenshot('04a-discover-results');
  });

  it('opens item detail screen when a listing is tapped', async () => {
    // Tap the first listing card using its search-result-{uuid} testID
    await tapFirstListing();
    await waitFor(element(by.id('item-detail-title')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('item-detail-price'))).toBeVisible();
    await device.takeScreenshot('04a-item-detail');
  });

  it('shows the Trade Offer screen after tapping Request to Buy', async () => {
    // Scroll down to reveal the Request to Buy button (below the fold)
    try {
      await element(by.type('RCTScrollView')).atIndex(0).scroll(200, 'down');
    } catch {}
    await new Promise(r => setTimeout(r, 500));
    await waitFor(element(by.id('request-to-buy-button')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('request-to-buy-button')).tap();

    // Wait for TradeOfferScreen to load completely (data fetch + render)
    await new Promise(r => setTimeout(r, 5000));

    // Scroll the offer screen scroll view until Send Offer button is visible
    await scrollToElement('send-offer-button', 'offer-screen-scroll-view', 'down');

    await device.takeScreenshot('04a-before-send-offer-assert');
    await waitFor(element(by.id('send-offer-button')))
      .toBeVisible()
      .withTimeout(20000);
    await expect(element(by.id('value-stack-row'))).toBeVisible();
    await device.takeScreenshot('04a-offer-screen');
  });
});

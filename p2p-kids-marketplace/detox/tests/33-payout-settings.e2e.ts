/// <reference types="detox" />
/**
 * TC-33: Payout Settings Screen
 *
 * Verifies the Payout Settings screen is accessible from the Home
 * dashboard via the "Payouts" action tile, and that bank management
 * elements are visible.
 *
 * testIDs used:
 *   tab-home, action-tile-payouts, add-bank-row, bank-row
 *
 * Note: PayoutDashboard and SellerEarnings are navigated programmatically
 * from payouts context only. PayoutSettings is the user-facing entry point.
 */
import { loginAsSeller } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToHome } from '../helpers/navigation';

describe('TC-33: Payout Settings Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsSeller();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to Home dashboard', async () => {
    await goToHome();
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(8000);
    await device.takeScreenshot('33-home-dashboard');
  });

  it('taps the Payouts action tile', async () => {
    await waitFor(element(by.id('action-tile-payouts')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('action-tile-payouts')).tap();

    // Wait for the payout screen to render rather than an arbitrary sleep
    // Use try/catch since Detox doesn't support .or() on matchers
    try {
      await waitFor(element(by.id('add-bank-row')))
        .toBeVisible()
        .withTimeout(8000);
    } catch {
      await waitFor(element(by.id('bank-row')))
        .toBeVisible()
        .withTimeout(8000);
    }
    await device.takeScreenshot('33-payout-settings-screen');
  });

  it('shows the add bank row or existing bank row', async () => {
    // Seeded test seller may or may not have a bank connected
    try {
      await waitFor(element(by.id('add-bank-row')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('add-bank-row'))).toBeVisible();
    } catch {
      // If a bank is already configured, the bank-row appears instead
      await waitFor(element(by.id('bank-row')))
        .toBeVisible()
        .withTimeout(8000);
      await expect(element(by.id('bank-row'))).toBeVisible();
    }
    await device.takeScreenshot('33-payout-bank-section');
  });
});

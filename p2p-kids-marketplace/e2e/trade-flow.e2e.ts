import { device, element, by, expect } from 'detox';

describe('Trade Flow V2', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should allow a buyer to initiate a trade', async () => {
    // 1. Login as Buyer
    await element(by.id('login-email-input')).typeText('buyer@example.com');
    await element(by.id('login-password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // 2. Navigate to Browse and select item
    await element(by.id('browse-tab')).tap();
    await element(by.id('item-card-0')).tap(); // Assuming first item

    // 3. Initiate Trade
    await element(by.id('request-trade-button')).tap();
    await expect(element(by.id('trade-initiation-screen'))).toBeVisible();

    // 4. Confirm Trade (Cash Only)
    await element(by.id('confirm-trade-button')).tap();

    // 5. Verify Success
    await expect(element(by.id('trade-success-screen'))).toBeVisible();
    await element(by.id('view-trade-button')).tap();
    await expect(element(by.id('trade-detail-screen'))).toBeVisible();
    await expect(element(by.text('Pending'))).toBeVisible();
  });

  it('should allow a seller to mark trade as completed', async () => {
    // 1. Login as Seller
    await element(by.id('login-email-input')).typeText('seller@example.com');
    await element(by.id('login-password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // 2. Navigate to My Trades
    await element(by.id('profile-tab')).tap();
    await element(by.id('my-trades-button')).tap();

    // 3. Select Active Trade
    await element(by.id('trade-card-0')).tap(); // Assuming first active trade

    // 4. Mark as Completed
    await element(by.id('complete-trade-button')).tap();
    await element(by.text('Confirm')).tap(); // Confirm modal

    // 5. Verify Status Update
    await expect(element(by.text('Awaiting Buyer Confirmation'))).toBeVisible();
  });

  it('should allow a buyer to cancel a trade', async () => {
    // 1. Login as Buyer
    await element(by.id('login-email-input')).typeText('buyer@example.com');
    await element(by.id('login-password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // 2. Navigate to My Trades
    await element(by.id('profile-tab')).tap();
    await element(by.id('my-trades-button')).tap();

    // 3. Select Active Trade
    await element(by.id('trade-card-0')).tap();

    // 4. Cancel Trade
    await element(by.id('cancel-trade-button')).tap();
    await element(by.text('Changed mind')).tap(); // Select reason
    await element(by.text('Confirm Cancellation')).tap();

    // 5. Verify Status Update
    await expect(element(by.text('Cancelled'))).toBeVisible();
  });
});

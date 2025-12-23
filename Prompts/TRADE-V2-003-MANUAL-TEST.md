# Manual Test Case: TRADE-V2-003 Payment Orchestration

## Overview
This test verifies the atomic payment orchestration flow for a trade, including Stripe payment and Swap Points (SP) debit.

## Stripe Account Setup & Configuration
To test or run the payment flow, you must have a Stripe account configured.

### 1. Create a Stripe Account
- Go to [Stripe.com](https://stripe.com) and create an account.
- For development, ensure you are in **Test Mode** (toggle in the top right).

### 2. Required Information for Setup
- **Business Profile**: You can use "Individual" or "Sole Proprietorship" for testing.
- **Bank Account**: Not strictly required for *collecting* payments in test mode, but required for *payouts*.
- **API Keys**: Found under `Developers > API Keys`.
- **Manual Capture**: The app uses a two-step flow (Authorize then Capture). No special configuration is needed in the Stripe Dashboard, but you should be aware that payments will appear as "Uncaptured" if the SP debit fails.

### 3. Environment Configuration
- **Supabase Secret**: The `trade-payment` Edge Function requires the Stripe Secret Key.
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key
  ```
- **Mobile App Env**: The React Native app requires the Stripe Publishable Key.
  - Add to `p2p-kids-marketplace/.env.local`:
    ```
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
    ```

## Prerequisites
1.  **Stripe Publishable Key**: Ensure `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in `p2p-kids-marketplace/.env.local`.
2.  **Supabase Edge Function**: Ensure `trade-payment` Edge Function is deployed to your Supabase project.
3.  **Test User**: A user with a Kids Club+ subscription (to test SP discount) and some SP balance.
4.  **Test Item**: An item available for purchase that accepts Swap Points.

## Test Case 1: Successful Trade with Cash + SP
**Goal**: Verify that a trade can be completed using both cash and SP, and that both are debited correctly.

1.  **Login** as a subscriber with at least 10 SP.
2.  **Browse** to an item priced at $20.00 that accepts SP.
3.  **Tap "Buy Now"** to go to the Trade Initiation screen.
4.  **Select 5 SP** discount using the slider.
    *   Verify: Total Cash Due = $15.00 (Item) + $0.99 (Fee) = $15.99.
5.  **Enter Test Card Details** (e.g., Stripe test card 4242...4242).
6.  **Tap "Confirm & Pay $15.99"**.
7.  **Verify**:
    *   App navigates to `TradeSuccess` screen.
    *   In Supabase Dashboard:
        *   `trades` table: New row with status `in_progress`, `sp_amount = 5`, `cash_amount_cents = 1599`.
        *   `sp_ledger` table: New entry for `-5 SP` linked to the trade.
        *   `sp_wallets` table: User's balance decreased by 5.
        *   Stripe Dashboard: New successful PaymentIntent for $15.99.

## Test Case 2: Payment Failure (Invalid Card)
**Goal**: Verify that if Stripe payment fails, SP is NOT debited and trade is marked as failed.

1.  **Login** as a subscriber with SP.
2.  **Browse** to an item and tap "Buy Now".
3.  **Select some SP** discount.
4.  **Enter an Invalid Test Card** (e.g., Stripe card that triggers a decline).
5.  **Tap "Confirm & Pay"**.
6.  **Verify**:
    *   App shows a "Payment Failed" alert.
    *   In Supabase Dashboard:
        *   `trades` table: Row status is `payment_failed`.
        *   `sp_ledger` table: **NO** new entry for SP debit.
        *   `sp_wallets` table: User's balance remains unchanged.

## Test Case 3: SP Debit Failure (Atomic Rollback)
**Goal**: Verify that if SP debit fails (e.g., balance changed mid-transaction), Stripe payment is cancelled.

*Note: This is harder to test manually without simulating a race condition, but the Edge Function code handles it.*

1.  **Simulate** by temporarily modifying the Edge Function to throw an error during SP debit.
2.  **Perform a trade** with SP.
3.  **Verify**:
    *   App shows "Swap Points debit failed. Payment cancelled."
    *   Stripe Dashboard: PaymentIntent is **Canceled**.
    *   `trades` table: Status is `payment_failed`.

## Verification Checklist (MODULE-06-VERIFICATION-V2.md)
- [x] Edge function `trade-payment` deployed
- [x] Atomicity verified (Stripe capture manual flow)
- [x] Initiate Trade Screen updated with Stripe CardField
- [x] Payment orchestration calls Edge Function correctly

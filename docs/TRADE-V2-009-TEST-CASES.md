# Manual Test Cases: TRADE-V2-009 Admin Tools

## Test Case 1: Trade Search & Filtering
**Objective**: Verify that admins can search and filter trades.
1. Navigate to `/trades` in the admin portal.
2. Verify the list of trades is displayed.
3. Select a status from the dropdown (e.g., "Completed").
4. Verify the list updates to show only completed trades.
5. Enter a Trade ID or User ID in the search box and click "Search".
6. Verify the specific trade or user's trades are displayed.

## Test Case 2: Trade Detail View
**Objective**: Verify that admins can see full trade details.
1. Click "View Details" on any trade in the list.
2. Verify the following information is displayed:
    - Trade ID and Status.
    - Buyer and Seller emails.
    - Monetary breakdown (Item Price, SP Discount, Cash, Fee, Total).
    - Subscription status snapshot vs current status.
    - External IDs (Stripe PI, SP Ledger IDs).
3. Verify the "Admin Audit Trail" section shows any previous admin actions.

## Test Case 3: Force Cancel Trade 4
**Objective**: Verify that admins can force-cancel a trade with a refund.
1. Find a trade in `in_progress` status.
2. Click "View Details".
3. Scroll to "Admin Interventions".
4. Click "Force Cancel Trade".
5. Enter a reason (e.g., "Test cancellation").
6. Click "Confirm Force Cancel".
7. Verify:
    - Trade status changes to `cancelled`.
    - A success message is displayed.
    - The "Admin Audit Trail" shows the cancellation action.
    - (Optional) Check Stripe dashboard for the refund.
    - (Optional) Check SP ledger for the re-credit.

## Test Case 4: Trade Analytics
**Objective**: Verify that trade analytics are displayed on the dashboard.
1. Navigate to the admin portal home page (`/`).
2. Verify the "Trade Analytics" cards are displayed:
    - Total Trades.
    - Fee Revenue.
    - Avg SP Usage.
    - Completed Rate.
3. Verify the "Trades" card is present and links to `/trades`.

# PAY-008 Test Cases: Seller Payouts Admin Page

## Manual Testing Checklist

### 1. Page Load Test
- [ ] Navigate to `http://localhost:3001/payouts/earnings`
- [ ] Page loads without errors
- [ ] No error message: \"Could not find a relationship between 'seller_payouts' and 'user_id'\"
- [ ] All UI elements render correctly (search bar, filters, table, stats)

### 2. Data Load Test
- [ ] Stats display shows total payouts count
- [ ] Payouts table displays (if payouts exist in database)
- [ ] Table columns display correctly:
  - Seller (email + name)
  - Trade ID
  - Status
  - Net Amount
  - Provider
  - Created Date
  - Actions (Retry button for failed payouts)

### 3. Search Functionality
- [ ] Search by **seller email**: Enter any seller email in search box
  - Should filter payouts by that email
- [ ] Search by **user ID**: Enter first 8 characters of user ID
  - Should filter payouts by that user
- [ ] Search by **trade ID**: Enter trade ID or partial trade ID
  - Should filter payouts for that trade
- [ ] Search by **seller name**: Enter seller's full name
  - Should filter payouts by seller name
- [ ] Clear search resets the list

### 4. Status Filter Test
- [ ] Filter by \"All Status\" - shows all payouts
- [ ] Filter by \"Action Required\" - shows only requires_action payouts
- [ ] Filter by \"Pending\" - shows only pending payouts
- [ ] Filter by \"Processing\" - shows only processing payouts
- [ ] Filter by \"Completed\" - shows only completed payouts
- [ ] Filter by \"Failed\" - shows only failed payouts
- [ ] Combining search + filter works correctly

### 5. Stats Card Test
- [ ] \"Total Payouts\" card shows correct count
- [ ] \"Completed\" card shows correct count (green)
- [ ] \"Pending\" card shows correct count (blue)
- [ ] \"Failed\" card shows correct count (red)
- [ ] \"Total Volume\" card shows correct sum of net amounts
- [ ] Stats update when filters are applied

### 6. Refresh Button Test
- [ ] Click \"Refresh\" button
- [ ] Loading spinner appears
- [ ] Data reloads from API
- [ ] Spinner disappears when done
- [ ] Button is disabled during loading

### 7. Export Button Test
- [ ] Click \"Export\" button
- [ ] CSV file download is triggered
- [ ] File is named appropriately
- [ ] CSV contains correct columns and data
- [ ] Export respects current filters/search

### 8. Detail Modal Test
- [ ] Click on a payout row
- [ ] Modal opens showing full details
- [ ] Modal displays:
  - Payout ID
  - Status badge
  - Seller info (email, user ID)
  - Trade ID
  - Amount breakdown (gross, fees, net)
  - Provider information
  - Timestamps
  - Failure reason (if failed)
- [ ] Click X button closes modal
- [ ] Click outside modal closes it
- [ ] Modal is clickable and doesn't close when clicking inside

### 9. Retry Button Test (for failed payouts)
- [ ] Find a failed payout
- [ ] Click \"Retry\" button
- [ ] Confirmation dialog appears
- [ ] Cancel confirmation - retry is cancelled
- [ ] Confirm retry
  - Success message appears
  - List reloads
  - Payout status updates

### 10. Empty State Test
- [ ] Apply filters that return no results
- [ ] Message displays: \"No payouts found matching your criteria\"
- [ ] Clear filters - list reloads with data

### 11. Error Handling Test
- [ ] Simulate network error (DevTools > Network > Offline)
- [ ] Error message displays appropriately
- [ ] Can still interact with UI
- [ ] Click Refresh to retry

### 12. Performance Test
- [ ] Load page with 100+ payouts
- [ ] Table scrolls smoothly
- [ ] Search filters in < 1 second
- [ ] No console errors
- [ ] Memory usage is reasonable

## Automated Test Cases

### API Endpoint Tests
```bash
# Test basic fetch
curl 'http://localhost:3000/api/admin/payouts?limit=10'

# Test with status filter
curl 'http://localhost:3000/api/admin/payouts?status=completed&limit=10'

# Test with search
curl 'http://localhost:3000/api/admin/payouts?search=test@example.com&limit=10'

# Test with all filters
curl 'http://localhost:3000/api/admin/payouts?status=pending&search=user123&limit=20&offset=0'
```

### Expected API Response
```json
{
  "data": [
    {
      "id": "uuid-1",
      "user_id": "uuid-user",
      "trade_id": "uuid-trade",
      "status": "completed",
      "net_amount_cents": 9500,
      "seller_email": "seller@example.com",
      "seller_name": "John Seller",
      "provider": "stripe",
      "created_at": "2025-01-01T12:00:00Z",
      ...
    }
  ],
  "stats": {
    "total_count": 42,
    "total_completed": 35,
    "total_pending": 5,
    "total_failed": 2,
    "total_volume_cents": 425000
  }
}
```

## Database Query Verification

Run these queries in Supabase console to verify the data:

```sql
-- Check if admin_payouts_view exists and has data
SELECT COUNT(*) as total_payouts FROM admin_payouts_view;

-- Check a sample row
SELECT * FROM admin_payouts_view LIMIT 1;

-- Verify seller info is populated
SELECT user_id, seller_email, seller_name, status, net_amount_cents 
FROM admin_payouts_view 
WHERE seller_email IS NOT NULL 
LIMIT 5;

-- Check by status
SELECT status, COUNT(*) as count, SUM(net_amount_cents) as total_cents
FROM admin_payouts_view
GROUP BY status;
```

## Sign-off
- [ ] All manual tests pass
- [ ] No console errors or warnings
- [ ] Performance is acceptable
- [ ] Schema cache error is completely resolved
- [ ] Search functionality enhanced as expected
- [ ] Ready for production deployment

## Notes for QA
- The admin page now uses `admin_payouts_view` which pre-joins seller information
- Previous error about \"relationship between seller_payouts and user_id\" should be completely gone
- Search was enhanced to include seller_email and seller_name in addition to user_id and trade_id
- All existing functionality remains the same, just with more reliable data fetching

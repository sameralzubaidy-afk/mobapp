# Trade Cancellation Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TradeDetailScreen                                             │
│  ├─ Displays trade info                                        │
│  ├─ "Cancel Trade" button (on-press listener)                 │
│  └─ handleCancelTrade(reason) function                         │
│                      │                                          │
│                      ├──────────────┐                          │
│                      │              │                          │
│                      ▼              ▼                          │
│          [Modal]          [Service]                           │
│     CancellationReason   cancelTradeV2()                      │
│     Modal Component      ├─ Auth check                        │
│     ├─ 5 reasons         ├─ Logging                           │
│     ├─ Custom input      ├─ RPC call                          │
│     └─ Reason selection  ├─ Error parsing                     │
│                      │              │                          │
│                      └──────────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                  supabase.rpc() call                           │
│                  with reason parameter                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
         ┌──────────────────┐  ┌──────────────┐
         │  Supabase Auth   │  │  Supabase    │
         │  (User check)    │  │  Database    │
         │                  │  │              │
         │ verify user_id   │  │ RPC Execute  │
         │ matches trade    │  │ - Update     │
         │ buyer/seller     │  │ - Logging    │
         └──────────────────┘  │ - Refunds    │
                                └──────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────┐
                      │   PostgreSQL Database     │
                      ├───────────────────────────┤
                      │ trades table:             │
                      │ ├─ status → 'cancelled'   │
                      │ ├─ cancelled_at → NOW()   │
                      │ └─ cancellation_reason    │
                      │                           │
                      │ items table:              │
                      │ └─ status → 'available'   │
                      │                           │
                      │ sp_ledger table:          │
                      │ └─ refund entry (if SP)   │
                      └───────────────────────────┘
```

---

## Data Flow Sequence

### Successful Cancellation Flow

```
1. User Action
   ├─ Taps "Cancel Trade" button
   └─ showCancellationModal = true

2. Modal Render
   ├─ Displays 5 predefined reasons
   ├─ Shows description for each
   ├─ Enables confirm button only when selection made
   └─ Ready for user input

3. User Selection
   ├─ Selects "Found elsewhere" (or other reason)
   │  OR
   ├─ Selects "Other" and enters custom text
   └─ Taps "Cancel Trade" button

4. Service Function Call
   ├─ cancelTradeV2(tradeId, reason)
   ├─ Verify user is authenticated
   ├─ Log: "Attempting to cancel trade..."
   └─ Call: supabase.rpc('cancel_trade_v2', {...})

5. RPC Execution (Backend)
   ├─ Verify trade exists
   ├─ Verify user is buyer or seller
   ├─ Update trades table:
   │  ├─ status = 'cancelled'
   │  ├─ cancelled_at = NOW()
   │  └─ cancellation_reason = p_reason
   ├─ Update items table:
   │  └─ status = 'available'
   ├─ If trade was in_progress or payment_processing:
   │  └─ Refund SP to buyer (if sp_amount > 0)
   └─ Return: { success: true, sp_refunded: X }

6. Response Handling
   ├─ data.success = true
   ├─ Log: "Trade cancelled successfully..."
   ├─ Close modal
   ├─ Show success alert
   └─ Refresh trade list

7. UI Update
   ├─ Trade status shows as "Cancelled"
   ├─ Cancellation reason displayed (if viewing details)
   ├─ Cancel button removed
   └─ User notified of SP refund (if applicable)

8. Database State
   trades:
   ├─ id: "trade-123"
   ├─ status: "cancelled"  ← CHANGED
   ├─ cancelled_at: "2024-01-15T10:30:00Z"  ← SET
   ├─ cancellation_reason: "Found elsewhere"  ← SET
   └─ updated_at: "2024-01-15T10:30:00Z"  ← UPDATED

   items:
   ├─ id: "item-456"
   └─ status: "available"  ← CHANGED (from sold/in_trade)

   sp_ledger (if SP was used):
   ├─ user_id: "buyer-789"
   ├─ points_before: 50
   ├─ points_after: 150  ← REFUNDED
   ├─ amount: 100
   ├─ reason: "Refund for cancelled trade (Found elsewhere)"
   └─ created_at: "2024-01-15T10:30:00Z"
```

---

## Error Flow

### Error Case: Trade Not Found

```
1. User Action
   └─ Attempts to cancel non-existent trade

2. Service Call
   ├─ cancelTradeV2('invalid-id', 'reason')
   └─ supabase.rpc('cancel_trade_v2', {...})

3. RPC Response
   └─ error: "no rows matched condition"

4. Error Handling
   ├─ Detect error message
   ├─ Map to user-friendly message:
   │  "Trade not found. It may have already been cancelled..."
   ├─ Log error details
   └─ Return: { success: false, error: "Trade not found..." }

5. UI Response
   ├─ Show error alert to user
   ├─ Provide actionable message
   └─ Allow user to dismiss and retry
```

### Error Case: Unauthorized

```
1. User Scenario
   └─ Logged in as User A, tries to cancel User B's trade

2. RPC Validation
   ├─ Check: user_id in (buyer_id, seller_id)
   ├─ Result: FALSE
   └─ error: "permission denied"

3. Error Handling
   ├─ Detect 'permission' in error
   ├─ Map to: "You do not have permission..."
   └─ Log unauthorized attempt

4. UI Response
   ├─ Alert: "You do not have permission..."
   └─ Trade remains unchanged
```

---

## Component States

### Modal Component States

```
Modal States:
├─ Initial/Hidden
│  └─ visible: false
│
├─ Visible/Empty
│  ├─ visible: true
│  ├─ selectedReason: null
│  ├─ customReason: ""
│  └─ confirmButton: DISABLED
│
├─ Reason Selected
│  ├─ visible: true
│  ├─ selectedReason: "found_elsewhere"
│  ├─ customReason: ""
│  └─ confirmButton: ENABLED
│
├─ Custom Input Selected
│  ├─ visible: true
│  ├─ selectedReason: "other"
│  ├─ customReason: ""
│  └─ confirmButton: DISABLED (no text yet)
│
├─ Custom Input Filled
│  ├─ visible: true
│  ├─ selectedReason: "other"
│  ├─ customReason: "Custom reason text..."
│  └─ confirmButton: ENABLED
│
└─ Loading/Processing
   ├─ visible: true
   ├─ isLoading: true
   ├─ allButtons: DISABLED
   ├─ input: DISABLED
   └─ text: "Cancelling..."
```

---

## RPC Function Signature

```typescript
// Supabase RPC Function
cancel_trade_v2(
  p_trade_id: UUID,          // Trade ID to cancel
  p_user_id: UUID,           // Current user (auth check)
  p_reason: TEXT DEFAULT NULL // Cancellation reason
) → TABLE (
  success: BOOLEAN,          // Operation success
  trade_id: UUID,            // Cancelled trade ID
  status: VARCHAR,           // New status ('cancelled')
  sp_refunded: INTEGER,      // SP points refunded (if any)
  error: VARCHAR             // Error message (if failed)
)
```

---

## Service Function Signature

```typescript
async function cancelTradeV2(
  tradeId: string,           // Trade ID
  reason?: string            // Optional cancellation reason
): Promise<{
  success: boolean;          // Did it work?
  error?: string;            // Error message if failed
}>
```

---

## API Request/Response

### Request
```json
{
  "p_trade_id": "550e8400-e29b-41d4-a716-446655440000",
  "p_user_id": "660e8400-e29b-41d4-a716-446655440000",
  "p_reason": "Found elsewhere"
}
```

### Success Response
```json
{
  "success": true,
  "trade_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "sp_refunded": 50,
  "error": null
}
```

### Error Response
```json
{
  "success": false,
  "trade_id": null,
  "status": null,
  "sp_refunded": null,
  "error": "no rows matched condition"
}
```

---

## Database Schema (Relevant Parts)

### trades table
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status trade_status NOT NULL,
  sp_amount INTEGER DEFAULT 0,
  cancellation_reason TEXT,        ← Stores reason
  cancelled_at TIMESTAMP,          ← When cancelled
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- trade_status enum includes: 'cancelled'
-- cancellation_reason is NULL until trade is cancelled
```

### items table
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY,
  status item_status NOT NULL,   ← Changes to 'available'
  ...
);

-- item_status enum includes: 'available', 'sold', 'in_trade'
```

### sp_ledger table
```sql
CREATE TABLE sp_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  points_before INTEGER NOT NULL,
  points_after INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,                    ← "Refund for cancelled trade..."
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Error Mapping Logic

```
RPC Error Message → User-Friendly Message

"no rows matched" 
→ "Trade not found. It may have already been cancelled or deleted."

"permission denied" OR "authorization"
→ "You do not have permission to cancel this trade. Only the buyer or seller can cancel."

"invalid_request_body" OR "invalid"
→ "Invalid trade information. Please try again."

"unique violation"
→ "This trade has already been processed. Cannot cancel."

"timeout"
→ "The request timed out. Please check your connection and try again."

(all others)
→ Original error message from server
```

---

## Logging Points

```
TRACE LEVEL:
├─ Modal opened
├─ Reason selected
└─ Modal closed

DEBUG LEVEL:
├─ Attempting to cancel trade {...}
├─ RPC called with parameters {...}
└─ Response received {...}

INFO LEVEL:
├─ Trade cancelled successfully {...}
└─ Cancellation reason logged: "Found elsewhere"

WARN LEVEL:
├─ Could not parse error response body
└─ SP refund mismatch (expected X, got Y)

ERROR LEVEL:
├─ RPC error received {...}
├─ User not authenticated
├─ Unauthorized access attempt
└─ Exception thrown during cancellation {...}
```

---

## Performance Metrics

```
Component Render Time:
├─ Modal initial render: < 100ms
├─ Reason list render: < 50ms
└─ Custom input render: < 30ms

API Call Duration:
├─ Auth check: < 100ms
├─ Database update: < 500ms
├─ SP refund (if applicable): < 200ms
└─ Total RPC: < 1000ms (goal < 2000ms)

UI Response:
├─ Error message display: < 50ms
├─ Success alert: < 50ms
└─ Modal close: < 100ms
```

---

## State Transition Diagram

```
                    ┌──────────────┐
                    │   PENDING    │
                    │   (initial)  │
                    └──────────────┘
                           │
                (user taps Cancel)
                           │
                           ▼
                    ┌──────────────┐
                    │    MODAL     │
            ┌──────▶│   DISPLAYED  │◀────────┐
            │       └──────────────┘         │
            │              │                  │
            │ (Keep Trade) │ (reason selected)│
            │              │                  │
            │              ▼                  │
            │       ┌──────────────┐          │
            │       │  CANCELLING  │          │
            │       │   (loading)  │          │
            │       └──────────────┘          │
            │              │                  │
    ┌───────┴──────────────┼──────────────────┴──────┐
    │                      │                         │
    │              ┌───────┴────────┐                │
    │              │                │                │
    ▼              ▼                ▼                ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐
│CANCELLED│ │ERROR MSG │ │TIMEOUT   │ │UNAUTHORIZED │
│SUCCESS  │ │DISPLAYED │ │RETRY OPT │ │ERROR MSG    │
└────────┘ └──────────┘ └──────────┘ └─────────────┘
    │          │           │            │
    └──────┬───┴───────────┴────────────┘
           │
    (if keep trying or dismiss)
           │
           ▼
    ┌─────────────┐
    │MODAL CLOSED │
    └─────────────┘
```

---

## Key Integration Points

1. **Authentication** - Verify user before allowing cancellation
2. **Authorization** - Verify user is buyer or seller
3. **SP Refunds** - Automatic processing if SP was used
4. **Item Status** - Reset item to 'available' on cancellation
5. **Notifications** - (Optional) Notify other party of cancellation
6. **Analytics** - Track cancellation reasons for business insights

---

## Testing Checkpoints

```
┌─────────────────────────────────────────────────────┐
│ 1. Component Render                                 │
│    ├─ Modal appears                                │
│    ├─ All reasons displayed                        │
│    └─ Buttons properly styled                      │
├─────────────────────────────────────────────────────┤
│ 2. User Interaction                                 │
│    ├─ Selection works                              │
│    ├─ Custom input appears for "Other"            │
│    └─ Confirm button toggles disabled state       │
├─────────────────────────────────────────────────────┤
│ 3. API Call                                         │
│    ├─ Request sent with correct parameters        │
│    ├─ Auth included                                │
│    └─ Reason parameter transmitted                │
├─────────────────────────────────────────────────────┤
│ 4. Database Update                                  │
│    ├─ Trade marked cancelled                       │
│    ├─ Reason saved                                 │
│    ├─ Timestamp recorded                           │
│    └─ Item status updated                          │
├─────────────────────────────────────────────────────┤
│ 5. UI Update                                        │
│    ├─ Success shown                                │
│    ├─ Modal closed                                 │
│    ├─ List refreshed                               │
│    └─ New status visible                           │
├─────────────────────────────────────────────────────┤
│ 6. Error Handling                                   │
│    ├─ Friendly error shown                         │
│    ├─ User can retry                               │
│    └─ No crashes                                   │
└─────────────────────────────────────────────────────┘
```

This architecture ensures a smooth, reliable trade cancellation experience with proper error handling and data persistence.

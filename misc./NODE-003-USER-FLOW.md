# NODE-003 User Experience Flow

**What happens when a user signs up and enters ZIP 60131 (inactive)?**

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ SIGNUP FLOW                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. User creates account + verifies phone                         │
│ 2. Reaches "Location Picker" screen                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LOCATION PICKER SCREEN                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Where are you located?                                         │
│  We'll connect you with nearby traders                          │
│                                                                  │
│  ZIP Code:  [   60131    ]                                       │
│            📍 Chicago, IL                                       │
│                                                                  │
│  ┌─────────────────────────────┐                               │
│  │     Continue                 │  ← Click this                │
│  └─────────────────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         [System] Calling RPC resolve_active_node_for_signup()
         ZIP 60131 → Chicago coords (41.8781, -87.6298)
         
         Result:
         - matchType = "nearest" (NOT active in 60131)
         - Assigned node = "Norwalk CT Community"
         - Distance = 823.5 miles
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ WAITLIST POPUP APPEARS                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│              We're Coming Soon! 🎉                              │
│                                                                  │
│  We're not quite active in 60131 yet, but we're coming         │
│  soon! In the meantime, we've connected you with               │
│  traders in Norwalk CT Community.                              │
│                                                                  │
│  Get notified when we launch:                                  │
│  ┌─────────────────────────────┐                               │
│  │ ✓ Early access to 60131      │                               │
│  │ ✓ Exclusive launch-day rewards                             │
│  │ ✓ Special founder pricing    │                               │
│  └─────────────────────────────┘                               │
│                                                                  │
│  ┌────────────────────────────────┐  ┌──────────────────────┐   │
│  │   Join Waitlist                 │  │ Continue Trading     │   │
│  └────────────────────────────────┘  └──────────────────────┘   │
│         ↓                                      ↓                 │
│    (Scenario A)                          (Scenario B)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scenario A: User Joins Waitlist ✅

```
USER TAPS: "Join Waitlist"
                  ↓
    ⏳ Loading spinner shows...
                  ↓
    [System] Inserting into zip_waitlist table:
    {
      user_id: "abc123...",
      email: "user@example.com",
      requested_zip: "60131",
      assigned_node_id: "node-norwalk-id",
      status: "pending"
    }
                  ↓
    ✅ Entry created successfully
                  ↓
┌───────────────────────────────────────────────┐
│ CONFIRMATION ALERT                            │
├───────────────────────────────────────────────┤
│                                                │
│  Waitlist Confirmed                           │
│                                                │
│  Thank you! We've added you to the            │
│  waitlist for 60131. We'll notify you as      │
│  soon as we launch in your area.              │
│                                                │
│  In the meantime, you can trade items with    │
│  users in Norwalk CT Community.               │
│                                                │
│          ┌─────────────┐                       │
│          │   Got it    │                       │
│          └─────────────┘                       │
│                                                │
└───────────────────────────────────────────────┘
                  ↓
            USER TAPS: "Got it"
                  ↓
┌────────────────────────────────────────────────────────┐
│ NODE SELECTION SCREEN                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Choose your trading community                        │
│                                                        │
│  ○ Norwalk CT Community (PRE-SELECTED)               │
│  ○ Other nearby nodes...                             │
│                                                        │
│  [Continue to Browse Items]                          │
│                                                        │
└────────────────────────────────────────────────────────┘
                  ↓
          ✅ Registration complete!
          ✅ User can start trading
          ✅ Added to waitlist for ZIP 60131
```

---

## Scenario B: User Skips Waitlist ⏩

```
USER TAPS: "Continue Trading"
                  ↓
    Popup closes immediately
    (NO loading spinner)
    (NO alert)
                  ↓
┌────────────────────────────────────────────────────────┐
│ NODE SELECTION SCREEN                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Choose your trading community                        │
│                                                        │
│  ○ Norwalk CT Community (PRE-SELECTED)               │
│  ○ Other nearby nodes...                             │
│                                                        │
│  [Continue to Browse Items]                          │
│                                                        │
└────────────────────────────────────────────────────────┘
                  ↓
          ✅ Registration complete!
          ✅ User can start trading
          ⚠️ NOT added to waitlist for 60131
```

---

## Scenario C: No Active Nodes (Edge Case) ❌

```
USER ENTERS: Any ZIP
              ↓
    [System] Calls resolve_active_node_for_signup()
              ↓
    ❌ Result: No active nodes anywhere!
              ↓
┌─────────────────────────────────────────────────┐
│ ERROR ALERT                                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  Error                                          │
│                                                 │
│  We are not currently active in your area      │
│  yet. Would you like to join our waitlist?    │
│                                                 │
│              ┌──────────┐                       │
│              │    OK    │                       │
│              └──────────┘                       │
│                                                 │
└─────────────────────────────────────────────────┘
              ↓
        USER TAPS: "OK"
              ↓
    Returns to Location Picker
    (Can try different ZIP or cancel)
```

---

## What Happens in the Database

### When User Joins Waitlist (Scenario A):

```sql
-- 1. User profile updated
UPDATE profiles 
SET zip_code='60131', node_id='node-norwalk-id'
WHERE user_id='abc123';

-- 2. Node member count incremented
UPDATE nodes 
SET member_count = member_count + 1
WHERE id='node-norwalk-id';

-- 3. Waitlist entry created
INSERT INTO zip_waitlist (
  user_id, email, requested_zip, 
  assigned_node_id, status
) VALUES (
  'abc123',
  'user@example.com',
  '60131',
  'node-norwalk-id',
  'pending'
);
```

### When User Skips Waitlist (Scenario B):

```sql
-- 1. User profile updated
UPDATE profiles 
SET zip_code='60131', node_id='node-norwalk-id'
WHERE user_id='abc123';

-- 2. Node member count incremented
UPDATE nodes 
SET member_count = member_count + 1
WHERE id='node-norwalk-id';

-- 3. NO waitlist entry created
-- (zip_waitlist table unchanged)
```

---

## What Gets Tracked (Analytics)

### Scenario A: Join Waitlist
```javascript
{
  event: "waitlist_opt_in",
  properties: {
    user_id: "abc123...",
    requested_zip: "60131",
    assigned_node_id: "node-norwalk-id",
    was_new_entry: true
  }
}

{
  event: "onboarding_location_set",
  properties: {
    user_id: "abc123...",
    zip_code: "60131",
    node_id: "node-norwalk-id",
    match_type: "nearest"
  }
}
```

### Scenario B: Skip Waitlist
```javascript
{
  event: "waitlist_skipped",
  properties: {
    user_id: "abc123...",
    requested_zip: "60131",
    assigned_node_id: "node-norwalk-id"
  }
}

{
  event: "onboarding_location_set",
  properties: {
    user_id: "abc123...",
    zip_code: "60131",
    node_id: "node-norwalk-id",
    match_type: "nearest"
  }
}
```

---

## Admin View (Future)

When NODE-003 is complete, admins will see in admin panel:

```
┌─────────────────────────────────────────────┐
│ ZIP CODE WAITLIST QUEUE                     │
├─────────────────────────────────────────────┤
│                                             │
│ ZIP 60131 (Chicago):                        │
│ ├─ user_1@example.com    [pending]  ✉      │
│ ├─ user_2@example.com    [pending]  ✉      │
│ ├─ user_3@example.com    [notified] ✓      │
│ └─ user_4@example.com    [joined]   ✓✓     │
│                                             │
│ Total: 4 users waiting for 60131            │
│                                             │
│ [When 60131 is active, click here]          │
│ [Notify all waitlist users]                 │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Key Points

✅ **User is ALWAYS assigned to a node** (exact match OR nearest)  
✅ **User can trade IMMEDIATELY** (no waiting for ZIP approval)  
✅ **Waitlist is OPTIONAL** (user chooses to join or skip)  
✅ **No ZIP code is left behind** (even if not active yet)  
✅ **Analytics ALWAYS tracked** (opt-in or skip)  
✅ **Member count is ACCURATE** (incremented on signup)  


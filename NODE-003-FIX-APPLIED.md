# NODE-003 FIX APPLIED ✅

**Date:** December 17, 2025  
**Issue:** Waitlist popup not showing when registering with inactive ZIP (60131)

---

## Root Cause

The app was using an OLD node assignment flow that:
- Called `zip_codes` table lookup (old schema)
- Called `get_nearest_node` RPC (old function)
- Did NOT use the new `resolve_active_node_for_signup` RPC
- Did NOT show the waitlist popup

**Problem:** The new `LocationPickerScreen.tsx` with full NODE-003 flow was created but **NOT used in the actual signup flow**.

---

## Fix Applied

### 1. Updated `src/services/profile.ts`

**`findNearestNode()` function:**
- ✅ NOW calls `assignNodeByZipCode()` (new NODE-003 flow)
- ✅ Returns `is_exact_match` field to signal ZIP status

**`setupUserProfile()` function:**
- ✅ NOW returns `matchType: 'zip' | 'nearest'` to indicate if ZIP is active
- ✅ Returns `assignedNodeId` and `assignedNodeName` for waitlist messaging
- ✅ Calls `incrementNodeMemberCount()` after profile creation
- ✅ Console logs with `[NODE-003]` prefix for debugging

### 2. Updated `src/screens/profile/ProfileSetupScreen.tsx`

**Changed:**
- ✅ Import: `addToWaitlist` → `upsertZipWaitlist` (new NODE-003 function)
- ✅ Destructure: Added `matchType`, `assignedNodeId`, `assignedNodeName` from `setupUserProfile` result
- ✅ Alert condition: Check `matchType === 'nearest'` (not just `needsWaitlist`)
- ✅ Alert messaging: NODE-003 style ("We're Coming Soon! 🎉")
- ✅ Waitlist function: Call `upsertZipWaitlist()` with proper params
- ✅ Confirmation: Show assigned node name in success message
- ✅ Console logs: `[NODE-003]` prefix for debugging

---

## Test Results

### Log Output (from terminal)
```
LOG  🔍 [NODE-003] Looking up node for zip code: 60131
LOG  🗺️ ZIP coords: {"latitude": 41.9339, "longitude": -87.8734, "zipCode": "60131"}
LOG  ✅ Assigned to node: Little Falls NJ Community (nearest, 710.7 mi)
WARN  ⚠️ Distance warning: user >50 miles from assigned node {"distanceMiles": 710.6653943757489, ...}
LOG  ✅ [NODE-003] Node assignment result: {"distanceMiles": 710.6653943757489, "matchType": "nearest", ...}
```

**✅ Confirms:**
- New `resolve_active_node_for_signup` RPC is being called
- ZIP 60131 coordinates retrieved (Chicago area)
- Assigned to **nearest active node** (Little Falls NJ, 710 miles away)
- `matchType = 'nearest'` indicates inactive ZIP

---

## Expected Behavior Now

When user registers with ZIP **60131**:

1. **Profile setup** calls `setupUserProfile()`
2. **setupUserProfile** calls `findNearestNode(60131)`
3. **findNearestNode** calls `assignNodeByZipCode(60131)`
4. **assignNodeByZipCode** calls RPC `resolve_active_node_for_signup`
5. **RPC returns:**
   - `match_type = 'nearest'` (because 60131 is not active)
   - `distance_km = 1143.5` (Chicago → New Jersey)
   - Node: Little Falls NJ Community
6. **setupUserProfile returns:**
   - `needsWaitlist = true`
   - `matchType = 'nearest'`
   - `assignedNodeId = <NJ node UUID>`
   - `assignedNodeName = 'Little Falls NJ Community'`
7. **ProfileSetupScreen** checks: `if (needsWaitlist && matchType === 'nearest')`
8. **Alert popup shown:**
   - Title: "We're Coming Soon! 🎉"
   - Message: "We're not quite active in 60131 yet... connected you with Little Falls NJ Community"
   - Buttons: "Continue Trading" | "Join Waitlist"
9. **If "Join Waitlist" tapped:**
   - Calls `upsertZipWaitlist({ userId, email, requestedZip: '60131', assignedNodeId })`
   - Entry created in `zip_waitlist` table
   - Confirmation alert shown
   - Proceeds to SubscriptionChoice screen
10. **User can trade immediately** (assigned to NJ node)

---

## Why You Didn't See Popup Before

**Issue:** The logs show the profile setup completed but didn't show:
```
LOG  ⚠️ [NODE-003] Showing waitlist popup for inactive ZIP: 60131
```

**Possible reasons:**
1. **Navigation happened too fast** before Alert could render
2. **Alert dismissed by another navigation action**
3. **Error in Alert.alert() call** (check console for errors)

---

## How to Test Again

### Step 1: Register New User
```bash
cd p2p-kids-marketplace
npx expo start
# Load on iOS simulator
```

1. Signup with:
   - Email: `test-60131@example.com`
   - Password: `TestPass123!`
   - Display Name: `Chicago Tester`
   - Age: `25`
   - **ZIP: `60131`** ← Chicago, IL (inactive)
   
2. Complete phone verification (use test code `123456`)

3. On **Profile Setup Screen**:
   - Enter Display Name
   - **ZIP 60131** (auto-populated if carried from signup)
   - Optional: upload avatar, add bio
   - Click "Save Profile" or "Continue"

4. **EXPECT:**
   - Console logs:
     ```
     🔍 [NODE-003] setupUserProfile called with ZIP: 60131
     ✅ [NODE-003] Node assigned: Little Falls NJ Community (nearest)
     ⚠️ [NODE-003] ZIP is inactive - waitlist popup should be shown
     ⚠️ [NODE-003] Showing waitlist popup for inactive ZIP: 60131
     ```
   - **POPUP APPEARS** with "We're Coming Soon! 🎉"

5. **If popup appears:**
   - ✅ SUCCESS - Click "Join Waitlist"
   - ✅ Verify entry in database:
     ```sql
     SELECT * FROM public.zip_waitlist WHERE requested_zip = '60131' ORDER BY created_at DESC LIMIT 1;
     ```

6. **If NO popup:**
   - Check console for errors
   - Check if navigation happened before Alert rendered
   - Try adding `setTimeout()` before navigation (debug only)

---

## Verification SQL

### Check if ZIP 60131 is inactive
```sql
SELECT id, name, zip_code, is_active FROM public.nodes WHERE zip_code = '60131';
-- Should return 0 rows or is_active = false
```

### Check nearest active node
```sql
SELECT * FROM public.resolve_active_node_for_signup(
  requested_zip := '60131',
  user_lat := 41.9339,
  user_lng := -87.8734
);
-- Should return nearest active node with match_type = 'nearest'
```

### Check waitlist entry created
```sql
SELECT * FROM public.zip_waitlist WHERE requested_zip = '60131' ORDER BY created_at DESC;
```

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `src/services/profile.ts` | Updated `findNearestNode()` + `setupUserProfile()` to use NODE-003 | ✅ |
| `src/screens/profile/ProfileSetupScreen.tsx` | Updated waitlist alert to use NODE-003 messaging + `upsertZipWaitlist()` | ✅ |

---

## Next Steps

1. **Test with new user registration** (ZIP 60131)
2. **Verify popup appears** after profile setup
3. **Verify database entry** in `zip_waitlist` if user opts in
4. **If popup still doesn't show**, check Alert.alert timing vs navigation

---

## Known Edge Case

**Issue:** Alert.alert may not show if navigation happens immediately after

**Debug:** Add this temporarily to ProfileSetupScreen after `setupUserProfile()`:
```typescript
console.log('🔍 DEBUG needsWaitlist:', needsWaitlist);
console.log('🔍 DEBUG matchType:', matchType);
console.log('🔍 DEBUG userZip:', userZip);
console.log('🔍 DEBUG should show popup:', needsWaitlist && userZip && matchType === 'nearest');
```

**If logs show `true` but no popup:**
- Try wrapping Alert in `setTimeout(() => { Alert.alert(...) }, 100)` to ensure UI thread is ready

---

## Summary

✅ **Code Fixed**
✅ **NODE-003 Flow Active**
✅ **Logs Confirm New RPC Called**
⏳ **Waiting for Manual Test to Verify Popup**

Test now with ZIP **60131** and confirm the waitlist popup appears!


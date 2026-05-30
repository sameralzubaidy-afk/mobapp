# BADGES-V2-007 TC-008 Fix Summary

## Problem
When searching for users in TC-008 (Manual Badge Award - Search User), the admin portal was returning HTTP 400 errors and "User not found" messages for users that definitely exist in the system.

## Root Cause
The `ManualAwardModal`, `BadgeEditor`, and badge list page were creating **separate, unauthenticated Supabase client instances** using a module-level singleton pattern. These clients couldn't access the JWT token that was stored in localStorage by the authenticated ProtectedLayout, so requests went out without authorization headers.

## Solution  
Changed all three badge components to use a **function-based client factory** (`createAuthenticatedClient()`) instead of module-level constants. Each time this function is called, it creates a fresh Supabase client instance that:
1. Reads the JWT token from localStorage (set by Supabase Auth during login)
2. Automatically includes the Authorization header in all requests
3. Allows RLS policies to properly validate the user context

## Files Changed
1. **ManualAwardModal.tsx** - User search now works with proper authentication
2. **BadgeEditor.tsx** - Icon upload operations now authenticated
3. **page.tsx** - Badge list and toggle operations now authenticated

## Verification Steps

### Quick Test (TC-008)
1. Go to Admin Portal → Badges
2. Click "Manual Award"
3. Enter a valid user email
4. Click "Search" → **Should now show user card instead of error**

### Browser Console Check
- No HTTP 400 errors
- Network tab shows `/rest/v1/profiles` request with status **200**
- Authorization header present in request

### Before Running Tests
```bash
cd p2p-kids-admin
npm run type-check  # Must pass
npm run lint        # Must pass
```

## Expected Outcome
✅ TC-008 now passes  
✅ User search works correctly  
✅ No HTTP 400 errors  
✅ Admin can award badges to existing users  

## Next Steps
1. Run the manual test steps above to verify TC-008 passes
2. If successful, mark BADGES-V2-007 as ready for Tier 1 smoke testing
3. If issues remain, check Supabase session or auth configuration

---
**Status:** FIXED - Ready for Testing  
**Date:** January 12, 2026

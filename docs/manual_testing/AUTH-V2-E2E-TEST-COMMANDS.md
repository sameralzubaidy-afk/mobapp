# Quick E2E Test Commands

## Start Dev Server
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
yarn start --clear
```

Then in the simulator:
- Press `r` to reload
- Or press `i` to open iOS simulator

## Test Signup Flow (Manual Steps)
1. Tap "Create Account" button
2. Scroll down to find "Dev: Autofill" section
3. Click "Fill Random" or "Alice" button
4. Form should auto-populate
5. Tap "Create Account"
6. Should navigate to Phone Verification (NOT error about signupWithTrial)

## Database Verification Queries

Copy/paste into Supabase SQL Editor:

### Get latest signup user
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC 
LIMIT 1;
```

### Verify profile auto-created
```sql
SELECT p.user_id, p.name, p.dob, p.subscription_id, p.sp_wallet_id, p.created_at
FROM profiles p
WHERE p.user_id = 'PASTE_USER_ID_HERE'
LIMIT 1;
```

### Check subscription enrolled
```sql
SELECT user_id, status, trial_start_date, trial_end_date, created_at
FROM subscriptions
WHERE user_id = 'PASTE_USER_ID_HERE'
LIMIT 1;
```

### Check SP wallet initialized
```sql
SELECT user_id, status, available_balance, pending_balance, created_at
FROM sp_wallets
WHERE user_id = 'PASTE_USER_ID_HERE'
LIMIT 1;
```

## Files Changed
- `src/services/auth.ts` - Added signupWithTrial() function
- `src/screens/auth/SignupScreen.tsx` - Updated imports and calls
- `src/utils/testUsers.ts` - NEW test user fixtures
- (This file) `AUTH-V2-SIGNUP-FIX-SUMMARY.md` - Documentation

## Success Indicators
✅ App loads without errors  
✅ Signup form can be autofilled with test data  
✅ Clicking "Create Account" triggers no errors  
✅ Navigation to Phone Verification occurs  
✅ User record exists in auth.users  
✅ Profile created in profiles table  
✅ Subscription row exists (status='trial')  
✅ SP wallet row exists (status='active')  

## Troubleshooting

### Still seeing "signupWithTrial is not a function"?
1. Kill Metro bundler: `pkill -f "yarn start"`
2. Clear cache: `rm -rf .expo node_modules/.cache`
3. Restart: `yarn start --clear`
4. Hard reload in simulator: Cmd+D > "Hard Reload"

### App crashes on form submission?
Check phone - may be an actual network error
Look at logs: `yarn start` output will show errors

### Profile not created?
Check if `handle_new_user()` trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%new_user%';
```

Should see `on_auth_user_created` trigger enabled

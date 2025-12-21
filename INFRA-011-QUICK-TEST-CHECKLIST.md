## Quick Testing Checklist - Simulators

### Before You Start
```bash
# 1. Navigate to app
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# 2. Install dependencies (if needed)
npm install

# 3. Verify files exist
ls src/services/notifications.ts          # Should exist ✓
ls src/components/NotificationSetup.tsx   # Should exist ✓
ls src/utils/testNotifications.ts         # Should exist ✓
ls src/config/supabase.ts                 # Should exist ✓
```

---

### iOS Simulator (5 min test)

**Start:** `npx expo start --ios`

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 1 | App launches | No crashes | [ ] |
| 2 | NotificationSetup shows | Component renders | [ ] |
| 3 | Tap "Enable Notifications" | Permission dialog | [ ] |
| 4 | Grant permissions | Success screen | [ ] |
| 5 | See test notification | Notification appears | [ ] |
| 6 | Tap notification | Console logs handler | [ ] |

**✅ If all pass:** Local notifications working!  
**❌ If fails:** Check console for error messages

---

### Android Emulator (5 min test)

**Start:** `npx expo start --android`

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 1 | App launches | No crashes | [ ] |
| 2 | NotificationSetup shows | Component renders | [ ] |
| 3 | Tap "Enable Notifications" | Permission dialog (Android 13+) | [ ] |
| 4 | Grant permissions | Success screen | [ ] |
| 5 | Pull down notification bar | Notification visible | [ ] |
| 6 | Tap notification | Console logs handler | [ ] |

**✅ If all pass:** Local notifications working!  
**❌ If fails:** Check console for error messages

---

### Test All Scenarios (10 min test)

**In any screen, add test button:**
```typescript
import { testAllNotifications } from '@/utils/testNotifications';

<Button 
  title="Test All Notifications" 
  onPress={() => testAllNotifications()}
/>
```

**Expected output in console:**
```
🧪 Starting comprehensive notification tests...

1. Testing basic local notification...
✅ Test notification sent

2. Testing message notification...
✅ Message notification test sent

3. Testing trade request notification...
✅ Trade request notification test sent

4. Testing item update notification...
✅ Item update notification test sent

5. Testing Swap Points notification...
✅ Swap Points notification test sent

6. Testing review notification...
✅ Review notification test sent

7. Testing scheduled notification...
✅ Scheduled notification test sent (will appear in 5 seconds)

✅ Tests complete: 7/7 passed
```

Then wait 5 seconds for scheduled notification to appear.

---

### Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| "Cannot find module" | Run `npm install` |
| Permission dialog won't appear | Reset simulator: `xcrun simctl erase all` |
| Notification doesn't appear | Keep app in foreground during test |
| Console shows errors | Check import paths (use `@/` alias) |
| App crashes on start | Check TypeScript: `npm run type-check` |
| Scheduled notification doesn't appear | Don't close app during 5-second delay |

---

### Verify Installation (Pre-Test)

```bash
# Check TypeScript
npm run type-check
# Should output: ✅ PASSED

# Check Linting  
npm run lint
# Should output: 0 errors (may have warnings)

# Check imports work
node -e "require('expo-notifications'); console.log('✅ expo-notifications found')"
```

---

### When Tests Pass ✅

You can be confident that:
- ✅ Service is properly integrated
- ✅ Components render correctly
- ✅ Local notifications work
- ✅ Permission flow works
- ✅ Notification listeners work

### When Tests Fail ❌

1. **Check console output** - Look for error messages
2. **Verify file paths** - All 6 core files must exist
3. **Run type-check** - `npm run type-check`
4. **Clear cache** - `npm run clean`
5. **Reinstall** - `npm install`

---

### Physical Device Testing (Next)

Once simulator tests pass:
1. Build app for device: `eas build --platform ios --local`
2. Install on physical device
3. Get real push token (appears in console)
4. Test remote notifications via Edge Function

But that requires:
- Physical iOS/Android device
- Apple/Google developer accounts
- EAS build configured

**For now:** Simulator testing proves the service works! ✅

---

### Time Estimates

| Test | Time |
|------|------|
| iOS local notifications | 5 min |
| Android local notifications | 5 min |
| All 7 notification scenarios | 10 min |
| Full end-to-end flow | 15 min |
| Physical device setup | 30-60 min |

**Total simulator validation: ~15 minutes**

---

**Ready to test? Run this:**
```bash
npx expo start --ios    # iOS Simulator
# or
npx expo start --android  # Android Emulator
```

Then follow the checklist above!

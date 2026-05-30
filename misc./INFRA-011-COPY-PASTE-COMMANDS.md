## Copy-Paste Testing Commands

Use these exact commands to test INFRA-011 on simulators.

---

## 🍎 iOS Simulator - Full Test

```bash
# 1. Navigate to app directory
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# 2. Start iOS simulator
npx expo start --ios

# Wait 30-60 seconds for app to load...

# 3. Grant notification permissions when prompted
# Look for: "P2P Kids Marketplace" wants to send notifications
# Tap: Allow

# 4. Tap "Enable Notifications" button
# Expected: Success message + test notification pops up

# 5. In console, run test to verify it works:
# (Press Shift+Cmd+Z or Cmd+I if using React Native Debugger)
import { testLocalNotification } from '@/utils/testNotifications';
testLocalNotification();

# Expected console output:
# ✅ Test notification sent

# Expected UI: Notification appears immediately
```

---

## 🤖 Android Emulator - Full Test

```bash
# 1. Navigate to app directory
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# 2. Start Android emulator
npx expo start --android

# Wait 60-90 seconds for app to load (emulator is slower)...

# 3. Grant notification permissions when prompted
# For Android 13+:
#   - Look for: "Allow 'P2P Kids Marketplace' to send notifications?"
#   - Tap: Allow
# For older Android:
#   - May need to manually enable in Settings > Apps > Notifications

# 4. Tap "Enable Notifications" button
# Expected: Success message + test notification appears in notification bar

# 5. Pull down notification drawer to see full notification
# Expected: Title + body visible in notification center

# 6. In console, run test:
# (Press 'o' in Expo CLI to open React Native Debugger)
import { testLocalNotification } from '@/utils/testNotifications';
testLocalNotification();

# Expected console output:
# ✅ Test notification sent

# Expected UI: Notification appears in notification bar
```

---

## 🧪 Run All 7 Notification Tests

**Add this button to any screen:**
```typescript
import { testAllNotifications } from '@/utils/testNotifications';

<Button 
  title="Run All Tests" 
  onPress={async () => {
    const result = await testAllNotifications();
    console.log('Test results:', result);
  }}
/>
```

**Tap the button and watch console:**

```
Expected output:
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

7. Testing scheduled notification (will appear in 5 seconds)...
✅ Scheduled notification test sent (will appear in 5 seconds)

✅ Tests complete: 7/7 passed

Then wait 5 seconds for the 7th notification to appear.
```

---

## 🔄 Reset & Clean Test (if needed)

```bash
# If something breaks, run this complete reset:

# 1. Stop Expo (Ctrl+C in terminal)

# 2. Clear cache
npm run clean

# 3. Reinstall
npm install

# 4. Type check (verify code is valid)
npm run type-check

# Expected output: 
# ✅ (no errors printed means success)

# 5. Start fresh
npx expo start --ios    # or --android
```

---

## ✅ Pre-Test Verification

```bash
# Run these BEFORE testing to make sure everything is ready:

cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# 1. Verify files exist
echo "Checking files..." && \
  [ -f src/services/notifications.ts ] && echo "✅ notifications.ts" || echo "❌ notifications.ts missing" && \
  [ -f src/components/NotificationSetup.tsx ] && echo "✅ NotificationSetup.tsx" || echo "❌ NotificationSetup.tsx missing" && \
  [ -f src/utils/testNotifications.ts ] && echo "✅ testNotifications.ts" || echo "❌ testNotifications.ts missing" && \
  [ -f src/config/supabase.ts ] && echo "✅ supabase.ts" || echo "❌ supabase.ts missing"

# 2. Type check
npm run type-check

# 3. Lint check
npm run lint | grep "error"

# If no errors appear, you're ready to test!
```

---

## 📊 Test Results Template

**Use this to record your test results:**

```
=== iOS SIMULATOR TEST ===
Date: ___________
Device: iPhone ___ (Simulator)
iOS Version: _____

Permission Dialog: [ ] Pass [ ] Fail
Enable Button: [ ] Pass [ ] Fail
Success Message: [ ] Pass [ ] Fail
Test Notification: [ ] Pass [ ] Fail
Notification Tap: [ ] Pass [ ] Fail
Overall: [ ] PASS [ ] FAIL

Notes:
_________________________________

=== ANDROID EMULATOR TEST ===
Date: ___________
Device: Android Emulator
Android Version: _____

Permission Dialog: [ ] Pass [ ] Fail
Enable Button: [ ] Pass [ ] Fail
Success Message: [ ] Pass [ ] Fail
Notification in Bar: [ ] Pass [ ] Fail
Notification Details: [ ] Pass [ ] Fail
Notification Tap: [ ] Pass [ ] Fail
Overall: [ ] PASS [ ] FAIL

Notes:
_________________________________
```

---

## 🚨 If Tests Fail

```bash
# 1. Check console for errors
# Look for red text with "Error:" or "Cannot find module"

# 2. If it's an import error, verify config file exists:
cat src/config/supabase.ts
# Should output 2 lines

# 3. If missing, create it:
cat > src/config/supabase.ts << 'EOF'
export { supabase } from '@/services/supabase';
EOF

# 4. Try type-check again
npm run type-check

# 5. Restart Expo
# Stop Expo (Ctrl+C) and run again:
npx expo start --ios    # or --android
```

---

## 🎯 Success Checklist

After testing, you should have confirmed:

- [ ] iOS simulator test passed
- [ ] Android emulator test passed
- [ ] All 7 notification scenarios work
- [ ] Notification tap handlers work (logged to console)
- [ ] Scheduled notifications appear on time
- [ ] No console errors
- [ ] Code passes type-check
- [ ] Code passes linting

**If all checked:** INFRA-011 is working perfectly! ✅

---

## 📱 Next: Physical Device Testing

Once simulator tests pass, test on real device:

```bash
# Build for device (requires EAS account)
eas build --platform ios --local      # iOS
eas build --platform android --local  # Android

# Install on device from QR code or download APK

# Then test remote notifications via Edge Function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "USER_ID",
    "title": "Real Push",
    "body": "From backend!",
    "data": { "type": "test" }
  }'
```

But that's for later - **simulators are perfect for validating the service first!** ✅

---

## 💡 Pro Tips

```bash
# Tip 1: Keep terminal open while testing
# You'll see real-time logs from the app

# Tip 2: Use keyboard shortcuts in Expo
# iOS Simulator:
#   Cmd+D = Developer menu
#   Cmd+R = Reload app
#   Cmd+K = Clear console

# Android Emulator:
#   Ctrl+M = Developer menu
#   R+R = Reload (double-tap R)

# Tip 3: Zoom out in simulator if UI is too big
# Use Cmd+Minus (iOS) or Ctrl+Minus (Android)

# Tip 4: Test in airplane mode
# Notifications work even without internet (local only)
```

---

**Ready? Start here:**
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npx expo start --ios
# or
npx expo start --android
```

Then follow the checklist above! 🚀

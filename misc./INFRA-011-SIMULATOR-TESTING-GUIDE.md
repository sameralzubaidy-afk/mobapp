## Manual Testing: Expo Push Notifications on iOS & Android Simulators

**Note:** Limitations exist for simulators - see "Important Simulator Limitations" below.

---

## 📋 Prerequisites

```bash
# 1. Install Expo CLI
npm install -g expo-cli

# 2. Install iOS/Android tools (if not already installed)
# For iOS: Xcode Command Line Tools
xcode-select --install

# For Android: Android Studio + SDK tools
# https://developer.android.com/studio

# 3. Navigate to app directory
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# 4. Install dependencies (if needed)
npm install
```

---

## 🚨 Important Simulator Limitations

### Push Notifications Reality
- ❌ **Remote push notifications** do NOT work on iOS Simulator or Android Emulator
- ✅ **Local notifications** work fine on both simulators
- ⚠️ **Physical device required** for testing remote notifications

**Why?** Expo push tokens are only generated and work on real devices. Simulators/emulators don't support the underlying platform capabilities.

### What You CAN Test on Simulators
- ✅ Permission request flow
- ✅ Local notifications (immediate)
- ✅ Scheduled notifications
- ✅ Notification tap handlers
- ✅ UI component rendering

### What Requires Physical Device
- ❌ Remote notifications (from Edge Function)
- ❌ Real Expo push tokens
- ❌ Background notification handling

---

## 🍎 iOS Simulator Testing

### Step 1: Start iOS Simulator
```bash
# Option A: Let Expo handle it
npx expo start --ios

# Option B: Manual control
open -a Simulator
# Then from Expo CLI: press 'i'
```

### Step 2: Grant Notification Permissions
1. App will launch in simulator
2. First screen should show "Allow notifications?" prompt
3. Tap **"Allow"** (or app will still work, just won't show permissions dialog)
4. Tap **"Enable Notifications"** button

**Expected Result:**
- ✅ Success screen appears
- ✅ Test notification pops up immediately after success
- ✅ No error messages

### Step 3: Test Local Notifications (Simulator-Compatible)

#### Option A: Add Test Button to Component
Edit any screen and add this button:

```typescript
import { testLocalNotification } from '@/utils/testNotifications';

// In your component:
<Button 
  title="Test Local Notification" 
  onPress={() => testLocalNotification()}
  color="#4CAF50"
/>
```

Then tap the button in the simulator.

#### Option B: Use Console to Trigger Tests
In simulator terminal (or React Native debugger):

```typescript
// Import in development mode
import { 
  testLocalNotification,
  testMessageNotification,
  testTradeRequestNotification,
  testAllNotifications 
} from '@/utils/testNotifications';

// Call from console
testLocalNotification();
testMessageNotification();
testTradeRequestNotification();
testAllNotifications();
```

**Expected Results:**
- ✅ Notification appears with title + body
- ✅ Notification badge shows on app icon
- ✅ Sound/vibration feedback (if enabled)
- ✅ Notification disappears after timeout

### Step 4: Test Scheduled Notifications

```typescript
import { scheduleNotification } from '@/services/notifications';

// Schedule for 5 seconds from now
await scheduleNotification(
  'Scheduled Test',
  'This notification appears in 5 seconds',
  5,
  { type: 'test' }
);
```

Wait 5 seconds and verify notification appears.

### Step 5: Test Notification Tap Handler

```typescript
import { useNotificationObserver } from '@/services/notifications';

// In your component useEffect:
useEffect(() => {
  const cleanup = useNotificationObserver();
  return cleanup;
}, []);
```

Then:
1. Send a test notification
2. Tap it in the notification center
3. Check console for `console.log('User tapped notification:', response)`

---

## 🤖 Android Emulator Testing

### Step 1: Start Android Emulator
```bash
# Option A: Let Expo handle it
npx expo start --android

# Option B: Manual - Open Android Studio
# Device Manager → Select emulator → Start

# Then from Expo CLI: press 'a'
```

Wait for emulator to fully boot (1-2 minutes).

### Step 2: Grant Notification Permissions

1. App will launch in emulator
2. Look for permissions dialog or go to Settings
3. Navigate to: **Settings → Apps → P2P Kids Marketplace → Notifications**
4. Enable "Allow notifications"

**For Android 13+:**
- Permission request happens during signup
- Tap **"Allow"** when prompted

### Step 3: Test Local Notifications

Same as iOS - use test buttons or console:

```typescript
import { testLocalNotification } from '@/utils/testNotifications';

// Tap button or call from console
testLocalNotification();
```

**Expected Results:**
- ✅ Notification appears in notification bar at top
- ✅ Pull down notification drawer to see full notification
- ✅ Notification body and title visible

### Step 4: Check Notification Channel (Android)

Verify notification channel was created:

```bash
# In adb shell
adb shell settings get global notification_channel_default_sound

# Or check in app settings:
# Settings → Apps → P2P Kids Marketplace → Notifications
```

You should see our custom channel: **"default"** with:
- Importance: High
- Sound: Enabled
- Vibration: Enabled

### Step 5: Test Notification Gestures

In Android emulator notification drawer:
- Swipe left/right to dismiss
- Tap notification to trigger tap handler
- Long-press to see notification details

---

## 🧪 Full Test Scenario (Both Platforms)

### Complete Testing Flow

```bash
# 1. Start app
npx expo start

# 2. Choose platform
# iOS: press 'i'
# Android: press 'a'

# 3. Wait for app to launch
# (Takes 30-60 seconds first time)

# 4. Go through NotificationSetup component
# - See benefits list
# - See permission request
# - Tap "Enable Notifications"
# - See success screen + test notification

# 5. Test local notifications
# Option A: Add test button and tap it
# Option B: Run from console:
import { testAllNotifications } from '@/utils/testNotifications';
await testAllNotifications();

# 6. Verify all 7 notifications appear:
# - Basic test
# - Message notification
# - Trade request notification
# - Item update notification
# - Swap Points notification
# - Review notification
# - Scheduled notification (appears 5 seconds later)

# 7. Tap notifications to verify handlers work
# - Check console for: "User tapped notification: {response}"
```

---

## 📊 Expected Behavior Checklist

### iOS Simulator
- [ ] App launches without crashes
- [ ] NotificationSetup component shows
- [ ] Permission request dialog appears
- [ ] "Enable Notifications" button works
- [ ] Success message appears
- [ ] Test notification pops up
- [ ] Test button triggers local notifications
- [ ] Multiple notifications stack/queue
- [ ] Tapping notification logs handler call
- [ ] Scheduled notifications appear after delay

### Android Emulator
- [ ] App launches without crashes
- [ ] NotificationSetup component shows
- [ ] Permission request dialog appears (Android 13+)
- [ ] "Enable Notifications" button works
- [ ] Success message appears
- [ ] Test notification appears in notification bar
- [ ] Pull down drawer shows notification
- [ ] Test button triggers local notifications
- [ ] Multiple notifications stack in drawer
- [ ] Tapping notification logs handler call
- [ ] Scheduled notifications appear after delay

---

## 🔍 Console Logging & Debugging

### Check Console Output

```bash
# From Expo CLI, you see console logs like:
# ✅ indicates successful operations
# ⚠️ indicates warnings (usually safe)
# ❌ indicates errors (must investigate)

# Look for these success logs:
# "Push token saved successfully"
# "Local notification sent: Test Notification"
# "Notification received while app open: {notification}"
# "User tapped notification: {response}"
```

### Enable React Native Debugger (Optional)

```bash
# While app is running with Expo:
# Press 'j' in terminal to open debugger
# Or go to: http://localhost:19002

# In debugger console:
import { testLocalNotification } from '@/utils/testNotifications';
testLocalNotification();
```

### Check Logs in Terminal

```bash
# iOS Simulator logs
xcrun simctl spawn booted log stream --predicate 'process == "p2p-kids-marketplace"'

# Android Emulator logs
adb logcat | grep "p2p-kids-marketplace"
```

---

## ❌ Common Issues & Fixes

### Issue: "Push notifications only work on physical devices"
**Cause:** Trying to register for remote notifications on simulator  
**Fix:** This is expected - only test LOCAL notifications on simulators  
**Testing:** Use `testLocalNotification()` instead

### Issue: Permission dialog doesn't appear
**Cause:** Already granted/denied in a previous test  
**Fix:** Reset app data:
```bash
# iOS
xcrun simctl erase all

# Android
adb shell pm reset-permissions
```

### Issue: Notification doesn't appear
**Cause:** App is in foreground and handler didn't process it  
**Fix:** Check console for handler logs, verify RLS policies aren't blocking

### Issue: Scheduled notification never appears
**Cause:** Notification scheduled but app is killed before delay expires  
**Fix:** Keep app running, don't close/minimize during delay

### Issue: Can't find test utilities
**Cause:** Import path is wrong  
**Fix:** Use exact path:
```typescript
import { testLocalNotification } from '@/utils/testNotifications';
// NOT: from 'utils/testNotifications'
// NOT: from './testNotifications'
```

### Issue: "Cannot find module '@/config/supabase'"
**Cause:** Config file not created  
**Fix:** Create it:
```bash
cat > src/config/supabase.ts << 'EOF'
export { supabase } from '@/services/supabase';
EOF
```

---

## 📱 Physical Device Testing (When Ready)

When you want to test REMOTE notifications:

```bash
# 1. Build for physical device
eas build --platform ios --local
# or
eas build --platform android --local

# 2. Install on device
# iOS: scan QR code with camera or TestFlight
# Android: download + install APK

# 3. Open app on device
# You'll get real Expo push token
# Token saved to push_tokens database

# 4. Test remote notifications via Edge Function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "USER_ID_FROM_DB",
    "title": "Real Push Notification",
    "body": "This came from backend!",
    "data": { "type": "test" }
  }'
```

---

## ✅ Success Criteria

**Simulator Testing Passing When:**
- ✅ App launches without errors
- ✅ Permission request shows and can be granted
- ✅ LocalNotifications appear immediately
- ✅ Scheduled notifications appear after delay
- ✅ Notification tap handlers log to console
- ✅ Multiple notifications queue/stack properly
- ✅ No console errors in Expo output

**Ready for Physical Device When:**
- ✅ All simulator tests pass
- ✅ Backend Edge Function deployed
- ✅ Database migration applied
- ✅ Environment variables configured
- ✅ App builds successfully for iOS/Android

---

## 📚 Reference Commands

```bash
# Start app
npx expo start

# Start with specific platform
npx expo start --ios        # iOS only
npx expo start --android    # Android only
npx expo start --web        # Web (no notifications)

# Reset simulator
xcrun simctl erase all      # iOS

# Reset emulator
adb shell pm reset-permissions  # Android

# View logs
adb logcat              # Android real-time

# Clear app cache
npx expo prebuild --clean

# Test in headless mode
npm run test:ci
```

---

**Remember:** Physical device testing is required for remote notifications, but simulators are great for testing the UI flow and local notifications!

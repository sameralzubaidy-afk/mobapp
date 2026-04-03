# MODULE-14: NOTIFICATIONS V2

**Version:** 2.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Implementation  
**Dependencies:** MODULE-11 (Subscriptions V2), MODULE-09 (Swap Points V2), MODULE-08 (Badges V2), MODULE-06 (Trade Flow V2), MODULE-03 (Authentication V2)

---

## V2 PRODUCT MODEL OVERVIEW

### Notification Categories
- **Subscription Events**: Trial starting/ending, payment success/failure, cancellation confirmation
- **SP Events**: Points earned, points spent, low balance warnings, wallet frozen
- **Badge Events**: Badge awarded, badge milestone approaching
- **Trade Events**: Trade request received, trade accepted/rejected, trade completed
- **System Events**: Onboarding reminders, feature announcements

### Delivery Channels
- **Push Notifications**: Mobile app (via Expo Push Notifications)
- **In-App Notifications**: Notification center within app
- **Email**: Critical events only (subscription billing, account changes)

### Gating Rules
- **SP Notifications**: Only sent to trial/active subscribers
- **Badge Notifications**: Sent to all users
- **Trade Notifications**: Sent to all users
- **Subscription Notifications**: Sent to all users with subscriptions

---

## V2 CHANGELOG

### Major Changes from V1
1. **Subscription-Aware Notifications**
   - Trial expiration reminders (7 days, 3 days, 1 day before)
   - Payment failure alerts with retry instructions
   - Subscription renewal confirmations

2. **SP Event Notifications**
   - "You earned X SP for [reason]" notifications
   - "You spent X SP on [item]" notifications
   - "Your SP wallet is frozen (subscription expired)" alerts
   - Low SP balance warnings when < 10 SP

3. **Badge Award Notifications**
   - Real-time badge award notifications with visual celebration
   - Milestone approaching notifications (e.g., "5 more SP to earn 'Saver 50' badge")

4. **Notification Preferences**
   - Per-category opt-in/opt-out (subscription, SP, badges, trades, system)
   - Per-channel preferences (push, in-app, email)
   - Quiet hours support (no push notifications 10pm-8am)

---

## PHYSICAL DEVICE TESTING SETUP (GOOGLE PIXEL)

All notification features in this module **MUST** be tested on a physical Android device (Google Pixel recommended) because:
- Push notifications do not work on emulators/simulators
- Notification channels and system integration require real Android OS
- Quiet hours and system notification settings need physical device testing
- Deep linking behavior differs between emulator and physical device
- Expo Go and standalone builds behave differently with notifications

### Prerequisites

**1. Enable Developer Mode on Google Pixel**
1. Open **Settings** → **About phone**
2. Tap **Build number** 7 times until you see "You are now a developer!"
3. Go back to **Settings** → **System** → **Developer options**
4. Enable **USB debugging**
5. Enable **Stay awake** (keeps screen on while charging - helpful for testing)

**2. Install Android Platform Tools (Your Mac)**
```bash
# Install via Homebrew
brew install android-platform-tools

# Verify installation
adb version

# Expected output: Android Debug Bridge version 1.0.41 or higher
```

**3. Connect Your Google Pixel**
```bash
# Connect Pixel via USB cable
# On your Pixel, allow USB debugging when prompted

# Verify device is connected
adb devices

# Expected output:
# List of devices attached
# 1A2B3C4D5E6F    device
```

---

### Installation Methods

#### **Method A: Expo Go (Fastest for Development)**

**On Your Pixel:**
1. Install **Expo Go** from Google Play Store
2. Open Expo Go app
3. Sign in with your Expo account (same as on your Mac)

**On Your Mac:**
```bash
cd p2p-kids-marketplace

# Start development server
npx expo start

# Scan QR code with Expo Go app on your Pixel
# OR
# Press 'a' to open on connected Android device via adb
```

**⚠️ Limitations with Expo Go:**
- Push notifications work but require Expo push token (not FCM)
- Some native modules may not work
- Cannot test final production notification experience

---

#### **Method B: Development Build (Recommended for Full Testing)**

**Build APK locally:**
```bash
cd p2p-kids-marketplace

# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Create development build
eas build --profile development --platform android

# Wait for build to complete (~10-15 minutes)
# Download APK from Expo dashboard or use direct URL
```

**Install APK on Pixel:**
```bash
# Download APK to your Mac
# Then install via ADB
adb install path/to/your-app.apk

# OR drag APK file to Android File Transfer and install from Pixel
```

---

#### **Method C: Wireless Debugging (No USB Cable)**

**One-time setup:**
```bash
# Connect Pixel via USB first
adb tcpip 5555

# Find your Pixel's IP address:
# On Pixel: Settings → About → Status → IP address (e.g., 192.168.1.45)

# Disconnect USB cable, then connect wirelessly:
adb connect <PIXEL_IP_ADDRESS>:5555
# Example: adb connect 192.168.1.45:5555

# Verify connection
adb devices
# Should show: <IP>:5555    device
```

**Daily usage:**
```bash
# Just run this command (if Pixel is on same WiFi)
adb connect <PIXEL_IP_ADDRESS>:5555
```

---

### Notification Testing Setup on Google Pixel

**1. Allow Notification Permissions**
```bash
# When app first requests notifications, tap "Allow" on your Pixel
# If you accidentally denied, fix it:
# Settings → Apps → Your App → Notifications → Enable
```

**2. Verify Notification Channels (Android 8+)**
```bash
# On Pixel:
# Settings → Apps → Your App → Notifications
# You should see separate channels for:
# - Subscription & Billing
# - Swap Points
# - Badges & Achievements
# - Trades
# - System & Updates
```

**3. Test Quiet Hours (Do Not Disturb)**
```bash
# On Pixel:
# Settings → Sound & vibration → Do Not Disturb
# Schedule DND for testing quiet hours feature
```

**4. Clear Notification History (Between Tests)**
```bash
# Swipe down notification shade
# Tap "Clear all" button
# OR via ADB:
adb shell cmd notification clear_all
```

---

### Testing Workflows

#### **Test 1: Push Notification Delivery**
```bash
# On Mac terminal:
cd p2p-kids-marketplace

# Start app on Pixel
npx expo start --android

# Trigger test notification from Supabase:
# 1. Open Supabase SQL Editor
# 2. Run:
SELECT create_subscription_notification(
  '<YOUR_USER_ID>'::uuid,
  'trial_expiring_1d',
  'Trial Ending Tomorrow',
  'Your trial ends in 1 day. Subscribe to keep earning SP!',
  '{"deep_link": "/subscription"}'::jsonb
);

# Expected: Notification appears on Pixel within 5-10 seconds
```

#### **Test 2: Deep Link Navigation**
```bash
# Step 1: Receive notification on Pixel
# Step 2: Tap notification
# Step 3: App should open to correct screen (e.g., /subscription)

# Debug deep linking via logcat:
adb logcat | grep -i "deep"
```

#### **Test 3: Notification Preferences**
```bash
# In app on Pixel:
# 1. Navigate to Settings → Notification Preferences
# 2. Disable "Swap Points" push notifications
# 3. Trigger SP notification from Supabase
# 4. Verify notification NOT sent to device (check in-app center only)
```

#### **Test 4: Quiet Hours**
```bash
# In app on Pixel:
# 1. Set quiet hours: 10:00 PM - 8:00 AM
# 2. Change device time to 11:00 PM (Settings → System → Date & time → Set time manually)
# 3. Trigger notification
# 4. Verify NO push notification received (should be in in-app center only)
# 5. Change device time to 9:00 AM
# 6. Trigger notification
# 7. Verify push notification IS received
```

#### **Test 5: Notification Badge Count**
```bash
# On Pixel home screen:
# Long-press app icon
# Notification badge should show unread count

# To test:
# 1. Send 3 notifications
# 2. Badge should show "3"
# 3. Open app and mark 2 as read
# 4. Badge should update to "1"
```

---

### Useful ADB Commands for Testing

```bash
# View real-time logs from your app
adb logcat | grep -i "expo\|notification\|push"

# Take screenshot
adb exec-out screencap -p > screenshot.png

# Record screen video (max 180 seconds)
adb shell screenrecord /sdcard/test_notifications.mp4
# Ctrl+C to stop
# Download video:
adb pull /sdcard/test_notifications.mp4 .

# View current notification shade
adb shell dumpsys notification

# Get app notification settings
adb shell cmd notification list
adb shell dumpsys notification <YOUR_PACKAGE_NAME>

# Force stop app (for testing background notifications)
adb shell am force-stop com.yourcompany.p2pkidsmarketplace

# Restart app
adb shell am start -n com.yourcompany.p2pkidsmarketplace/.MainActivity

# Clear app data (reset to fresh state)
adb shell pm clear com.yourcompany.p2pkidsmarketplace
```

---

### Screen Mirroring to Your Mac (Optional but Recommended)

**Install scrcpy (best Android screen mirroring tool):**
```bash
# Install via Homebrew
brew install scrcpy

# Run with Pixel connected
scrcpy

# Advanced options:
scrcpy --window-title "Pixel 6" --stay-awake --turn-screen-off
```

**Benefits:**
- View Pixel screen on your Mac monitor
- Record videos of notification testing
- Easier to demonstrate features during demos
- Can control Pixel from Mac keyboard/mouse

---

### Troubleshooting

**Issue: "No devices/emulators found"**
```bash
# Reconnect ADB
adb kill-server
adb start-server
adb devices

# Ensure USB debugging is enabled on Pixel
# Try different USB cable (some are charge-only)
```

**Issue: "Notifications not appearing on Pixel"**
```bash
# Check notification permissions:
adb shell dumpsys notification | grep -A 5 "p2pkidsmarketplace"

# Verify push token is registered:
# In Supabase, check push_tokens table:
SELECT * FROM push_tokens WHERE user_id = '<YOUR_USER_ID>';

# Check Expo push notification receipts:
# In edge function logs, look for Expo API responses
```

**Issue: "Deep links not working"**
```bash
# Test deep link manually via ADB:
adb shell am start -W -a android.intent.action.VIEW \
  -d "kidsp2p://subscription" \
  com.yourcompany.p2pkidsmarketplace

# Check AndroidManifest.xml has correct intent filters
```

**Issue: "App crashes when receiving notification"**
```bash
# View crash logs:
adb logcat | grep -i "error\|exception\|crash"

# Save full log to file:
adb logcat > notification_crash.log
```

**Issue: "Quiet hours not being respected"**
```bash
# Verify device timezone matches quiet hours timezone
# Check notification preferences in database:
SELECT * FROM notification_preferences WHERE user_id = '<YOUR_USER_ID>';

# Ensure quiet_hours_enabled = true
# Verify quiet_hours_start and quiet_hours_end are correct
```

---

### Best Practices for Physical Device Testing

1. **Keep Pixel Charged**: Enable "Stay awake" in Developer options
2. **Use Real User Data**: Test with actual user accounts, not just test accounts
3. **Test Different Android Versions**: If possible, test on Android 11, 12, 13, 14
4. **Test Different Network Conditions**: WiFi, cellular, airplane mode
5. **Test App States**: Foreground, background, killed state
6. **Clear Cache Between Tests**: Ensures clean state for accurate results
7. **Document Everything**: Take screenshots/videos of bugs for easier debugging
8. **Test Notification Bundling**: Send multiple notifications and verify grouping
9. **Test Notification Actions**: If you add action buttons, test them thoroughly
10. **Monitor Battery Impact**: Excessive notifications can drain battery

---

### Required Testing Matrix

For each notification feature, test ALL of these scenarios on Google Pixel:

| Scenario | App State | Network | Device State | Expected Result |
|----------|-----------|---------|--------------|-----------------|
| Push notification delivery | Foreground | WiFi | Unlocked | Notification appears instantly |
| Push notification delivery | Background | WiFi | Locked | Notification in notification shade |
| Push notification delivery | Killed | WiFi | Locked | Notification wakes app |
| Push notification delivery | Foreground | Cellular | Unlocked | Same as WiFi |
| Deep link tap | Foreground | WiFi | Unlocked | Navigates to correct screen |
| Deep link tap | Background | WiFi | Locked | Opens app to correct screen |
| Deep link tap | Killed | WiFi | Locked | Launches app to correct screen |
| Quiet hours | Any | WiFi | Any | No push notif (in-app only) |
| Disabled category | Any | WiFi | Any | No push notif (in-app only) |
| Badge count | Background | Any | Any | Badge shows unread count |

---

## CRITICAL V2 RULES

### Notification Delivery
- **MUST** respect user notification preferences
- **MUST** implement rate limiting (max 10 push notifications per user per hour)
- **MUST NOT** send push notifications during quiet hours (default 10pm-8am local time)
- **MUST** deduplicate notifications (no duplicate notifications within 5 minutes)

### Notification Content
- **MUST** include deep link to relevant app screen
- **MUST** include user-friendly title and body text
- **MUST NOT** expose sensitive data in notification body (e.g., full credit card numbers)
- **SHOULD** include actionable CTAs when appropriate

### Privacy & Compliance
- **MUST** allow users to opt out of all non-critical notifications
- **MUST** send critical notifications (payment failures, account security) regardless of preferences
- **MUST** comply with platform notification guidelines (iOS, Android)

---

## AGENT-OPTIMIZED PROMPT TEMPLATE

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

## TASK NOTIF-V2-001: Notification Schema & Preferences

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** MODULE-03 (Authentication V2)

### Description
Create notification system database schema. Implement notification preferences table with per-category and per-channel settings. Create notification history table for in-app notification center. Implement quiet hours support.

### Acceptance Criteria
- [ ] Notifications table created with type, category, title, body, data, delivery channels
- [ ] Notification preferences table created with per-category and per-channel settings
- [ ] User can update notification preferences
- [ ] Quiet hours configurable per user (default 10pm-8am)
- [ ] Notification history stored for in-app display
- [ ] Read/unread status tracked for in-app notifications

---

### AI Prompt for Cursor

```typescript
/*
TASK: Notification schema and user preferences

CONTEXT:
Multi-channel notification system with user preferences.
Categories: subscription, sp_events, badges, trades, system.
Channels: push, in_app, email.

V2 REQUIREMENTS:
- Respect user preferences for each category × channel combination
- Support quiet hours (no push notifications during specified hours)
- Track notification delivery status
- Store notification history for in-app center
- Rate limiting per user

==================================================
FILE 1: Database migration for notification schema
==================================================
*/

-- filepath: supabase/migrations/140_notifications_v2.sql

-- Notification categories enum
CREATE TYPE notification_category AS ENUM (
  'subscription',
  'sp_events',
  'badges',
  'trades',
  'system'
);

-- Notification delivery channel enum
CREATE TYPE notification_channel AS ENUM (
  'push',
  'in_app',
  'email'
);

-- Notification status enum
CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'read'
);

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category notification_category NOT NULL,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  quiet_hours_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME DEFAULT '22:00:00', -- 10pm
  quiet_hours_end TIME DEFAULT '08:00:00', -- 8am
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category)
);

CREATE INDEX notification_preferences_user_idx ON notification_preferences(user_id);

-- Notifications table (history)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category notification_category NOT NULL,
  type TEXT NOT NULL, -- Specific notification type (e.g., 'trial_expiring', 'sp_earned')
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional data for deep linking
  channels notification_channel[] DEFAULT ARRAY['in_app']::notification_channel[],
  status notification_status DEFAULT 'pending',
  push_sent_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX notifications_user_idx ON notifications(user_id);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX notifications_created_idx ON notifications(created_at DESC);
CREATE INDEX notifications_status_idx ON notifications(status);

-- RLS policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (mark as read)"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to initialize default notification preferences for new users
CREATE OR REPLACE FUNCTION initialize_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default preferences for all categories
  INSERT INTO notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
  VALUES
    (NEW.id, 'subscription', true, true, true), -- Critical, all channels enabled
    (NEW.id, 'sp_events', true, true, false),
    (NEW.id, 'badges', true, true, false),
    (NEW.id, 'trades', true, true, false),
    (NEW.id, 'system', true, true, false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER initialize_notification_preferences_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_notification_preferences();

-- RPC: Get user notification preferences
CREATE OR REPLACE FUNCTION get_notification_preferences(p_user_id UUID)
RETURNS TABLE(
  category notification_category,
  push_enabled BOOLEAN,
  in_app_enabled BOOLEAN,
  email_enabled BOOLEAN,
  quiet_hours_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    np.category,
    np.push_enabled,
    np.in_app_enabled,
    np.email_enabled,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM notification_preferences np
  WHERE np.user_id = p_user_id
  ORDER BY np.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Update notification preference
CREATE OR REPLACE FUNCTION update_notification_preference(
  p_user_id UUID,
  p_category notification_category,
  p_push_enabled BOOLEAN DEFAULT NULL,
  p_in_app_enabled BOOLEAN DEFAULT NULL,
  p_email_enabled BOOLEAN DEFAULT NULL,
  p_quiet_hours_enabled BOOLEAN DEFAULT NULL,
  p_quiet_hours_start TIME DEFAULT NULL,
  p_quiet_hours_end TIME DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE notification_preferences
  SET
    push_enabled = COALESCE(p_push_enabled, push_enabled),
    in_app_enabled = COALESCE(p_in_app_enabled, in_app_enabled),
    email_enabled = COALESCE(p_email_enabled, email_enabled),
    quiet_hours_enabled = COALESCE(p_quiet_hours_enabled, quiet_hours_enabled),
    quiet_hours_start = COALESCE(p_quiet_hours_start, quiet_hours_start),
    quiet_hours_end = COALESCE(p_quiet_hours_end, quiet_hours_end),
    updated_at = now()
  WHERE user_id = p_user_id AND category = p_category;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS JSONB AS $$
BEGIN
  UPDATE notifications
  SET 
    read_at = now(),
    status = 'read'
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND read_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET 
    read_at = now(),
    status = 'read'
  WHERE user_id = p_user_id
    AND read_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: TypeScript types for notifications
==================================================
*/

// filepath: src/types/notifications.ts

export type NotificationCategory = 
  | 'subscription'
  | 'sp_events'
  | 'badges'
  | 'trades'
  | 'system';

export type NotificationChannel = 'push' | 'in_app' | 'email';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface NotificationPreferences {
  category: NotificationCategory;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM:SS
  quiet_hours_end: string; // HH:MM:SS
}

export interface Notification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  channels: NotificationChannel[];
  status: NotificationStatus;
  push_sent_at: string | null;
  email_sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
}

/*
==================================================
FILE 3: Notification preferences service
==================================================
*/

// filepath: src/services/notificationPreferences.ts

import { supabase } from '@/lib/supabase';
import type { NotificationPreferences, NotificationCategory } from '@/types/notifications';

export class NotificationPreferencesService {
  /**
   * Get user's notification preferences
   */
  static async getPreferences(userId: string): Promise<NotificationPreferences[]> {
    const { data, error } = await supabase.rpc('get_notification_preferences', {
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Failed to get notification preferences: ${error.message}`);
    }

    return data as NotificationPreferences[];
  }

  /**
   * Update notification preference for a category
   */
  static async updatePreference(
    userId: string,
    category: NotificationCategory,
    updates: {
      push_enabled?: boolean;
      in_app_enabled?: boolean;
      email_enabled?: boolean;
      quiet_hours_enabled?: boolean;
      quiet_hours_start?: string;
      quiet_hours_end?: string;
    }
  ): Promise<void> {
    const { error } = await supabase.rpc('update_notification_preference', {
      p_user_id: userId,
      p_category: category,
      p_push_enabled: updates.push_enabled ?? null,
      p_in_app_enabled: updates.in_app_enabled ?? null,
      p_email_enabled: updates.email_enabled ?? null,
      p_quiet_hours_enabled: updates.quiet_hours_enabled ?? null,
      p_quiet_hours_start: updates.quiet_hours_start ?? null,
      p_quiet_hours_end: updates.quiet_hours_end ?? null,
    });

    if (error) {
      throw new Error(`Failed to update notification preference: ${error.message}`);
    }
  }

  /**
   * Toggle all notifications for a category
   */
  static async toggleCategory(
    userId: string,
    category: NotificationCategory,
    enabled: boolean
  ): Promise<void> {
    await this.updatePreference(userId, category, {
      push_enabled: enabled,
      in_app_enabled: enabled,
      email_enabled: enabled,
    });
  }
}

/*
==================================================
FILE 4: Notification preferences UI
==================================================
*/

// filepath: src/screens/settings/NotificationPreferencesScreen.tsx

import React, { useEffect, useState } from 'react';
import { NotificationPreferencesService } from '@/services/notificationPreferences';
import type { NotificationPreferences, NotificationCategory } from '@/types/notifications';

const CATEGORY_LABELS: Record<NotificationCategory, { title: string; description: string }> = {
  subscription: {
    title: 'Subscription & Billing',
    description: 'Trial reminders, payment notifications, subscription updates',
  },
  sp_events: {
    title: 'Swap Points',
    description: 'Points earned, points spent, balance alerts',
  },
  badges: {
    title: 'Badges & Achievements',
    description: 'Badge awards, milestone progress',
  },
  trades: {
    title: 'Trades',
    description: 'Trade requests, acceptances, completions',
  },
  system: {
    title: 'System & Updates',
    description: 'App updates, feature announcements, tips',
  },
};

export const NotificationPreferencesScreen: React.FC<{ userId: string }> = ({ userId }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const data = await NotificationPreferencesService.getPreferences(userId);
      setPreferences(data);
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChannel = async (
    category: NotificationCategory,
    channel: 'push' | 'in_app' | 'email',
    enabled: boolean
  ) => {
    setIsSaving(true);
    try {
      await NotificationPreferencesService.updatePreference(userId, category, {
        [`${channel}_enabled`]: enabled,
      });
      await loadPreferences();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update preference');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleQuietHours = async (
    category: NotificationCategory,
    enabled: boolean
  ) => {
    setIsSaving(true);
    try {
      await NotificationPreferencesService.updatePreference(userId, category, {
        quiet_hours_enabled: enabled,
      });
      await loadPreferences();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update quiet hours');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading notification preferences...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Notification Preferences</h1>

      <div className="space-y-6">
        {preferences.map((pref) => {
          const category = CATEGORY_LABELS[pref.category];
          return (
            <div key={pref.category} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-1">{category.title}</h2>
              <p className="text-sm text-gray-600 mb-4">{category.description}</p>

              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm">Push Notifications</span>
                  <input
                    type="checkbox"
                    checked={pref.push_enabled}
                    onChange={(e) =>
                      handleToggleChannel(pref.category, 'push', e.target.checked)
                    }
                    disabled={isSaving}
                    className="toggle"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm">In-App Notifications</span>
                  <input
                    type="checkbox"
                    checked={pref.in_app_enabled}
                    onChange={(e) =>
                      handleToggleChannel(pref.category, 'in_app', e.target.checked)
                    }
                    disabled={isSaving}
                    className="toggle"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm">Email Notifications</span>
                  <input
                    type="checkbox"
                    checked={pref.email_enabled}
                    onChange={(e) =>
                      handleToggleChannel(pref.category, 'email', e.target.checked)
                    }
                    disabled={isSaving}
                    className="toggle"
                  />
                </label>

                {pref.push_enabled && (
                  <label className="flex items-center justify-between border-t pt-3 mt-3">
                    <div>
                      <span className="text-sm">Quiet Hours</span>
                      <p className="text-xs text-gray-500">
                        No push notifications {pref.quiet_hours_start} - {pref.quiet_hours_end}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={pref.quiet_hours_enabled}
                      onChange={(e) =>
                        handleToggleQuietHours(pref.category, e.target.checked)
                      }
                      disabled={isSaving}
                      className="toggle"
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Critical notifications (payment failures, security alerts) will
          always be sent regardless of your preferences.
        </p>
      </div>
    </div>
  );
};
```

### Testing Checklist

**Database Tests:**
- [ ] Notification preferences created for new users automatically
- [ ] User can view all notification preferences
- [ ] User can update preferences per category and channel
- [ ] Quiet hours configuration persists correctly
- [ ] RLS policies prevent users from viewing/editing others' preferences
- [ ] Default preferences created with correct values

**Physical Device Tests (Google Pixel):**
- [ ] NotificationPreferencesScreen renders correctly on Pixel
- [ ] Toggle switches update preferences in real-time
- [ ] Quiet hours time picker works on Android
- [ ] Changes persist after app restart on device
- [ ] Notification channel settings appear in Android Settings → Apps → Notifications
- [ ] Test with device in portrait and landscape orientation

### Deployment Notes
1. Run migration to create notification tables
2. Verify trigger creates default preferences for existing users
3. Test notification preference updates
4. Configure quiet hours UI with time picker
5. **Physical Device Testing Required**: Follow Google Pixel setup guide above to test all notification permissions and channels

--- 

## TASK NOTIF-V2-002: Subscription Event Notifications

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** NOTIF-V2-001, MODULE-11 (Subscriptions V2)

### Description
Implement notifications for subscription lifecycle events. Send trial expiration reminders (7 days, 3 days, 1 day before). Notify on subscription renewal success/failure. Send cancellation confirmation. Implement payment failure alerts with retry instructions.

### Acceptance Criteria
- [ ] Trial expiration reminders sent at 7d, 3d, 1d before expiration
- [ ] Subscription renewal success notification sent
- [ ] Payment failure notification sent with retry link
- [ ] Cancellation confirmation notification sent
- [ ] All subscription notifications respect user preferences
- [ ] Critical payment notifications sent regardless of preferences

---

### AI Prompt for Cursor

```typescript
/*
TASK: Subscription event notifications

CONTEXT:
Notify users about subscription lifecycle events.
Trial reminders help convert trial users to paid subscribers.
Payment failure notifications critical for revenue retention.

V2 SUBSCRIPTION EVENTS:
- trial_starting: Trial activated (sent immediately on signup)
- trial_expiring_7d: Trial expires in 7 days
- trial_expiring_3d: Trial expires in 3 days
- trial_expiring_1d: Trial expires in 1 day
- trial_expired: Trial expired (convert to paid or cancel)
- subscription_renewed: Successful payment
- payment_failed: Failed payment (critical, always sent)
- subscription_cancelled: User cancelled subscription

==================================================
FILE 1: Subscription notification functions
==================================================
*/

-- filepath: supabase/migrations/141_subscription_notifications.sql

-- Function to create subscription notification
CREATE OR REPLACE FUNCTION create_subscription_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels notification_channel[];
  v_prefs RECORD;
BEGIN
  -- Get user's subscription notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = 'subscription';

  IF NOT FOUND THEN
    -- Default to all channels if no preferences
    v_channels := ARRAY['push', 'in_app', 'email']::notification_channel[];
  ELSE
    -- Build channels array based on preferences
    v_channels := ARRAY[]::notification_channel[];
    IF v_prefs.push_enabled THEN
      v_channels := array_append(v_channels, 'push'::notification_channel);
    END IF;
    IF v_prefs.in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app'::notification_channel);
    END IF;
    IF v_prefs.email_enabled THEN
      v_channels := array_append(v_channels, 'email'::notification_channel);
    END IF;
  END IF;

  -- Always send payment_failed notifications (critical)
  IF p_notification_type = 'payment_failed' THEN
    v_channels := ARRAY['push', 'in_app', 'email']::notification_channel[];
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, category, type, title, body, data, channels)
  VALUES (p_user_id, 'subscription', p_notification_type, p_title, p_body, p_data, v_channels)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Send trial starting notification
CREATE OR REPLACE FUNCTION send_trial_starting_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'trial' AND OLD.status IS NULL THEN
    PERFORM create_subscription_notification(
      NEW.user_id,
      'trial_starting',
      'Welcome to Kids Club+! 🎉',
      'Your 30-day trial has started. Enjoy unlimited Swap Points and exclusive features!',
      jsonb_build_object(
        'subscription_id', NEW.id,
        'trial_ends_at', NEW.trial_ends_at,
        'deep_link', '/subscription'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_trial_starting_notification
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION send_trial_starting_notification();

-- Trigger: Send subscription cancelled notification
CREATE OR REPLACE FUNCTION send_subscription_cancelled_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM create_subscription_notification(
      NEW.user_id,
      'subscription_cancelled',
      'Subscription Cancelled',
      'Your Kids Club+ subscription has been cancelled. You have 90 days of grace period before losing access.',
      jsonb_build_object(
        'subscription_id', NEW.id,
        'cancelled_at', NEW.cancelled_at,
        'deep_link', '/subscription'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_cancelled_notification
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION send_subscription_cancelled_notification();

/*
==================================================
FILE 2: Edge function for trial expiration reminders
==================================================
*/

// filepath: supabase/functions/send-trial-reminders/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Find subscriptions expiring in 7 days
    const { data: expiring7d } = await supabase
      .from('subscriptions')
      .select('id, user_id, trial_ends_at')
      .eq('status', 'trial')
      .gte('trial_ends_at', in7Days.toISOString())
      .lt('trial_ends_at', new Date(in7Days.getTime() + 60 * 60 * 1000).toISOString());

    for (const sub of expiring7d || []) {
      await supabase.rpc('create_subscription_notification', {
        p_user_id: sub.user_id,
        p_notification_type: 'trial_expiring_7d',
        p_title: 'Trial Expires in 7 Days',
        p_body: 'Your Kids Club+ trial ends soon. Add payment method to continue enjoying Swap Points!',
        p_data: { subscription_id: sub.id, trial_ends_at: sub.trial_ends_at, deep_link: '/subscription/payment' },
      });
    }

    // Find subscriptions expiring in 3 days
    const { data: expiring3d } = await supabase
      .from('subscriptions')
      .select('id, user_id, trial_ends_at')
      .eq('status', 'trial')
      .gte('trial_ends_at', in3Days.toISOString())
      .lt('trial_ends_at', new Date(in3Days.getTime() + 60 * 60 * 1000).toISOString());

    for (const sub of expiring3d || []) {
      await supabase.rpc('create_subscription_notification', {
        p_user_id: sub.user_id,
        p_notification_type: 'trial_expiring_3d',
        p_title: 'Trial Expires in 3 Days! ⏰',
        p_body: 'Don\'t lose access to Swap Points! Add your payment method now.',
        p_data: { subscription_id: sub.id, trial_ends_at: sub.trial_ends_at, deep_link: '/subscription/payment' },
      });
    }

    // Find subscriptions expiring in 1 day
    const { data: expiring1d } = await supabase
      .from('subscriptions')
      .select('id, user_id, trial_ends_at')
      .eq('status', 'trial')
      .gte('trial_ends_at', in1Day.toISOString())
      .lt('trial_ends_at', new Date(in1Day.getTime() + 60 * 60 * 1000).toISOString());

    for (const sub of expiring1d || []) {
      await supabase.rpc('create_subscription_notification', {
        p_user_id: sub.user_id,
        p_notification_type: 'trial_expiring_1d',
        p_title: 'Last Day of Trial! 🚨',
        p_body: 'Your trial expires tomorrow. Subscribe now to keep your Swap Points active!',
        p_data: { subscription_id: sub.id, trial_ends_at: sub.trial_ends_at, deep_link: '/subscription/payment' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: {
          expiring_7d: expiring7d?.length || 0,
          expiring_3d: expiring3d?.length || 0,
          expiring_1d: expiring1d?.length || 0,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
FILE 3: Payment event notifications service
==================================================
*/

// filepath: src/services/subscriptionNotifications.ts

import { supabase } from '@/lib/supabase';

export class SubscriptionNotificationService {
  /**
   * Send payment success notification
   */
  static async notifyPaymentSuccess(userId: string, subscriptionId: string, amount: number): Promise<void> {
    await supabase.rpc('create_subscription_notification', {
      p_user_id: userId,
      p_notification_type: 'subscription_renewed',
      p_title: 'Payment Successful ✓',
      p_body: `Your Kids Club+ subscription has been renewed ($${amount.toFixed(2)})`,
      p_data: {
        subscription_id: subscriptionId,
        amount,
        deep_link: '/subscription',
      },
    });
  }

  /**
   * Send payment failure notification (critical)
   */
  static async notifyPaymentFailure(
    userId: string,
    subscriptionId: string,
    reason: string
  ): Promise<void> {
    await supabase.rpc('create_subscription_notification', {
      p_user_id: userId,
      p_notification_type: 'payment_failed',
      p_title: 'Payment Failed',
      p_body: `We couldn't process your payment. Update your payment method to keep your subscription active. Reason: ${reason}`,
      p_data: {
        subscription_id: subscriptionId,
        failure_reason: reason,
        deep_link: '/subscription/payment',
      },
    });
  }

  /**
   * Send trial expired notification
   */
  static async notifyTrialExpired(userId: string, subscriptionId: string): Promise<void> {
    await supabase.rpc('create_subscription_notification', {
      p_user_id: userId,
      p_notification_type: 'trial_expired',
      p_title: 'Trial Expired',
      p_body: 'Your trial has ended. Subscribe now to continue earning and spending Swap Points!',
      p_data: {
        subscription_id: subscriptionId,
        deep_link: '/subscription/payment',
      },
    });
  }
}
```

### Testing Checklist

**Edge Function Tests:**
- [ ] Trial starting notification sent on subscription creation
- [ ] Trial expiration reminders sent at correct intervals (7d, 3d, 1d)
- [ ] Payment success notification sent after renewal
- [ ] Payment failure notification sent (critical, ignores preferences)
- [ ] Cancellation notification sent when user cancels
- [ ] All notifications include deep link to subscription screen
- [ ] Notifications respect user preferences (except payment_failed)

**Physical Device Tests (Google Pixel):**
- [ ] Push notification appears on Pixel lock screen with correct title/body
- [ ] Notification sound/vibration works on device
- [ ] Tapping notification navigates to subscription screen
- [ ] Notification appears in notification shade
- [ ] Test with app in foreground, background, and killed states
- [ ] Trial reminder notification received at 11:00 PM is delayed until after quiet hours (8:00 AM)
- [ ] Payment failure notification received during quiet hours (critical override)
- [ ] Notification badge count increments on app icon
- [ ] Multiple subscription notifications group correctly in notification shade
- [ ] Take screenshot of notification on device for documentation

### Deployment Notes
1. Deploy edge function `send-trial-reminders` to Supabase
2. Set up cron job to run edge function daily (e.g., 10am UTC)
3. Configure payment provider webhooks to call notification service
4. Test trial reminder timing in staging environment
5. **Physical Device Testing Required**: Test all subscription notifications on Google Pixel to verify push delivery and deep links

---

## TASK NOTIF-V2-003: SP Event Notifications

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** NOTIF-V2-001, MODULE-09 (Swap Points V2)

### Description
Implement notifications for Swap Points events. Send "You earned X SP" notifications when points are credited. Send "You spent X SP" notifications after purchases. Alert when SP wallet frozen due to subscription expiration. Warn when balance is low (< 10 SP).

### Acceptance Criteria
- [ ] SP earned notification sent on ledger insert (earned transaction)
- [ ] SP spent notification sent on ledger insert (spent transaction)
- [ ] Wallet frozen notification sent when status changes to frozen
- [ ] Low balance warning sent when balance drops below 10 SP
- [ ] SP notifications only sent to trial/active subscribers
- [ ] Notifications include SP amount and reason

---

### AI Prompt for Cursor

```typescript
/*
TASK: SP event notifications

CONTEXT:
Notify users about SP earnings and spending to increase engagement.
Wallet frozen notifications critical for subscription retention.

V2 SP EVENTS:
- sp_earned: Points credited to wallet
- sp_spent: Points debited from wallet
- sp_wallet_frozen: Wallet frozen (subscription expired)
- sp_balance_low: Balance < 10 SP

BUSINESS RULES:
- Only send SP notifications to users with trial/active subscriptions
- Include reason for earning/spending in notification body
- Low balance warning sent once per day max

==================================================
FILE 1: SP notification triggers
==================================================
*/

-- filepath: supabase/migrations/142_sp_notifications.sql

-- Function to create SP notification
CREATE OR REPLACE FUNCTION create_sp_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels notification_channel[];
  v_prefs RECORD;
  v_subscription RECORD;
BEGIN
  -- Check if user has active subscription (only send SP notifications to subscribers)
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status IN ('trial', 'active')
  LIMIT 1;

  IF NOT FOUND THEN
    -- User is not a subscriber, don't send SP notifications
    RETURN NULL;
  END IF;

  -- Get user's SP notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = 'sp_events';

  IF NOT FOUND THEN
    v_channels := ARRAY['push', 'in_app']::notification_channel[];
  ELSE
    v_channels := ARRAY[]::notification_channel[];
    IF v_prefs.push_enabled THEN
      v_channels := array_append(v_channels, 'push'::notification_channel);
    END IF;
    IF v_prefs.in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app'::notification_channel);
    END IF;
    IF v_prefs.email_enabled THEN
      v_channels := array_append(v_channels, 'email'::notification_channel);
    END IF;
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, category, type, title, body, data, channels)
  VALUES (p_user_id, 'sp_events', p_notification_type, p_title, p_body, p_data, v_channels)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Send SP earned/spent notifications
CREATE OR REPLACE FUNCTION send_sp_transaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet RECORD;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet
  FROM sp_wallets
  WHERE id = NEW.wallet_id;

  IF NEW.transaction_type = 'earned' THEN
    v_title := '+ ' || NEW.amount || ' SP Earned! 🎉';
    v_body := CASE
      WHEN NEW.reason = 'item_sold' THEN 'You earned ' || NEW.amount || ' SP from selling an item!'
      WHEN NEW.reason = 'daily_login' THEN 'You earned ' || NEW.amount || ' SP for logging in today!'
      WHEN NEW.reason = 'first_trade' THEN 'You earned ' || NEW.amount || ' SP for your first trade!'
      WHEN NEW.reason = 'admin_adjustment' THEN 'You received ' || NEW.amount || ' SP!'
      ELSE 'You earned ' || NEW.amount || ' SP!'
    END;

    PERFORM create_sp_notification(
      v_wallet.user_id,
      'sp_earned',
      v_title,
      v_body,
      jsonb_build_object(
        'amount', NEW.amount,
        'reason', NEW.reason,
        'balance', NEW.balance_after,
        'deep_link', '/wallet'
      )
    );

  ELSIF NEW.transaction_type = 'spent' THEN
    v_title := '- ' || NEW.amount || ' SP Spent';
    v_body := 'You spent ' || NEW.amount || ' SP. Your new balance is ' || NEW.balance_after || ' SP.';

    PERFORM create_sp_notification(
      v_wallet.user_id,
      'sp_spent',
      v_title,
      v_body,
      jsonb_build_object(
        'amount', NEW.amount,
        'reason', NEW.reason,
        'balance', NEW.balance_after,
        'deep_link', '/wallet'
      )
    );

    -- Check for low balance warning
    IF NEW.balance_after < 10 AND NEW.balance_after > 0 THEN
      -- Check if we already sent low balance warning today
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_wallet.user_id
          AND type = 'sp_balance_low'
          AND created_at > now() - INTERVAL '24 hours'
      ) THEN
        PERFORM create_sp_notification(
          v_wallet.user_id,
          'sp_balance_low',
          'Low SP Balance ⚠️',
          'You have less than 10 SP remaining. Earn more by selling items or logging in daily!',
          jsonb_build_object(
            'balance', NEW.balance_after,
            'deep_link', '/earn-sp'
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sp_transaction_notification
  AFTER INSERT ON sp_ledger
  FOR EACH ROW
  EXECUTE FUNCTION send_sp_transaction_notification();

-- Trigger: Send wallet frozen notification
CREATE OR REPLACE FUNCTION send_sp_wallet_frozen_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'frozen' AND OLD.status = 'active' THEN
    PERFORM create_sp_notification(
      NEW.user_id,
      'sp_wallet_frozen',
      'SP Wallet Frozen ❄️',
      'Your Swap Points wallet has been frozen because your subscription expired. Reactivate your subscription to use SP again!',
      jsonb_build_object(
        'wallet_id', NEW.id,
        'balance', NEW.balance,
        'deep_link', '/subscription'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sp_wallet_frozen_notification
  AFTER UPDATE ON sp_wallets
  FOR EACH ROW
  EXECUTE FUNCTION send_sp_wallet_frozen_notification();

/*
==================================================
FILE 2: SP notification service
==================================================
*/

// filepath: src/services/spNotifications.ts

import { supabase } from '@/lib/supabase';

export class SPNotificationService {
  /**
   * Send custom SP earned notification (for special events)
   */
  static async notifyCustomSPEarned(
    userId: string,
    amount: number,
    reason: string,
    customMessage?: string
  ): Promise<void> {
    const body = customMessage || `You earned ${amount} SP for ${reason}!`;

    await supabase.rpc('create_sp_notification', {
      p_user_id: userId,
      p_notification_type: 'sp_earned',
      p_title: `+ ${amount} SP Earned! 🎉`,
      p_body: body,
      p_data: {
        amount,
        reason,
        deep_link: '/wallet',
      },
    });
  }

  /**
   * Send wallet reactivated notification
   */
  static async notifyWalletReactivated(userId: string, balance: number): Promise<void> {
    await supabase.rpc('create_sp_notification', {
      p_user_id: userId,
      p_notification_type: 'sp_wallet_reactivated',
      p_title: 'SP Wallet Reactivated! ✓',
      p_body: `Your Swap Points wallet is active again! You have ${balance} SP available.`,
      p_data: {
        balance,
        deep_link: '/wallet',
      },
    });
  }
}
```

### Testing Checklist

**Database Trigger Tests:**
- [ ] SP earned notification sent when ledger entry created (earned type)
- [ ] SP spent notification sent when ledger entry created (spent type)
- [ ] Notification body includes reason for transaction
- [ ] Low balance warning sent when balance < 10 SP
- [ ] Low balance warning not sent more than once per 24 hours
- [ ] Wallet frozen notification sent when status changes
- [ ] SP notifications only sent to trial/active subscribers
- [ ] Notifications include current balance in data

**Physical Device Tests (Google Pixel):**
- [ ] Earn 10 SP by selling item → notification appears on Pixel within 5 seconds
- [ ] Spend 5 SP on trade → notification appears on Pixel with updated balance
- [ ] Low balance warning shows when balance drops to 9 SP
- [ ] Wallet frozen notification appears when subscription expires
- [ ] Tapping SP earned notification navigates to wallet screen
- [ ] SP notification includes emoji (🎉) and displays correctly on Android
- [ ] Test with "SP Events" notifications disabled in preferences → only in-app notification, no push
- [ ] Test with quiet hours enabled → SP notification delayed until morning
- [ ] Verify notification grouped under "Swap Points" channel in Android settings
- [ ] Record screen video of SP earning flow with notification

### Deployment Notes
1. Test SP transaction triggers in staging
2. Verify low balance warning deduplication
3. Test wallet frozen notification on subscription expiration
4. Monitor notification volume for SP transactions
5. **Physical Device Testing Required**: Test SP earned/spent notifications on Google Pixel to verify real-time delivery and balance updates

---

## TASK NOTIF-V2-004: Badge Award Notifications

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** NOTIF-V2-001, MODULE-08 (Badges V2)

### Description
Implement celebratory notifications when users earn badges. Include badge icon, name, and description in notification. Add milestone approaching notifications (e.g., "5 more SP to earn next badge"). Create visual celebration in app when badge awarded.

### Acceptance Criteria
- [ ] Badge award notification sent immediately when badge earned
- [ ] Notification includes badge icon, name, description
- [ ] Milestone approaching notifications sent at appropriate thresholds
- [ ] In-app celebration animation shown for badge awards
- [ ] Badge notifications sent to all users (not gated by subscription)

---

### AI Prompt for Cursor

```typescript
/*
TASK: Badge award notifications

CONTEXT:
Celebrate user achievements with immediate badge notifications.
Milestone notifications encourage continued engagement.

V2 BADGE EVENTS:
- badge_earned: Badge awarded (manual or auto)
- badge_milestone_approaching: User close to earning next badge

NOTIFICATION RULES:
- Sent to all users regardless of subscription status
- Include badge visual (icon) in notification
- Deep link to badge collection/profile

==================================================
FILE 1: Badge notification triggers
==================================================
*/

-- filepath: supabase/migrations/143_badge_notifications.sql

-- Function to create badge notification
CREATE OR REPLACE FUNCTION create_badge_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels notification_channel[];
  v_prefs RECORD;
BEGIN
  -- Get user's badge notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = 'badges';

  IF NOT FOUND THEN
    v_channels := ARRAY['push', 'in_app']::notification_channel[];
  ELSE
    v_channels := ARRAY[]::notification_channel[];
    IF v_prefs.push_enabled THEN
      v_channels := array_append(v_channels, 'push'::notification_channel);
    END IF;
    IF v_prefs.in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app'::notification_channel);
    END IF;
    IF v_prefs.email_enabled THEN
      v_channels := array_append(v_channels, 'email'::notification_channel);
    END IF;
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, category, type, title, body, data, channels)
  VALUES (p_user_id, 'badges', p_notification_type, p_title, p_body, p_data, v_channels)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Send badge earned notification
CREATE OR REPLACE FUNCTION send_badge_earned_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_badge RECORD;
BEGIN
  -- Only send notification for new badge awards (not revocations)
  IF NEW.revoked_at IS NULL THEN
    -- Get badge details
    SELECT * INTO v_badge
    FROM badges
    WHERE id = NEW.badge_id;

    PERFORM create_badge_notification(
      NEW.user_id,
      'badge_earned',
      'New Badge Earned! ' || v_badge.icon,
      'Congratulations! You earned the "' || v_badge.name || '" badge: ' || v_badge.description,
      jsonb_build_object(
        'badge_id', v_badge.id,
        'badge_name', v_badge.name,
        'badge_icon', v_badge.icon,
        'badge_description', v_badge.description,
        'category', v_badge.category,
        'deep_link', '/profile/badges'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_earned_notification
  AFTER INSERT ON user_badges
  FOR EACH ROW
  EXECUTE FUNCTION send_badge_earned_notification();

-- Function to check and send milestone approaching notifications
CREATE OR REPLACE FUNCTION check_badge_milestones(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_sp_balance INTEGER;
  v_trade_count INTEGER;
  v_next_sp_badge RECORD;
  v_next_trade_badge RECORD;
BEGIN
  -- Get user's SP balance
  SELECT balance INTO v_sp_balance
  FROM sp_wallets
  WHERE user_id = p_user_id;

  -- Get user's completed trade count
  SELECT COUNT(*) INTO v_trade_count
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'completed';

  -- Check for next SP earning badge
  SELECT * INTO v_next_sp_badge
  FROM badges
  WHERE category = 'sp_earning'
    AND required_amount > (
      SELECT COALESCE(SUM(amount), 0)
      FROM sp_ledger l
      JOIN sp_wallets w ON w.id = l.wallet_id
      WHERE w.user_id = p_user_id AND l.transaction_type = 'earned'
    )
  ORDER BY required_amount ASC
  LIMIT 1;

  -- If close to next SP badge (within 10 SP), send notification
  IF v_next_sp_badge.required_amount IS NOT NULL THEN
    DECLARE
      v_sp_earned INTEGER;
      v_sp_needed INTEGER;
    BEGIN
      SELECT COALESCE(SUM(amount), 0) INTO v_sp_earned
      FROM sp_ledger l
      JOIN sp_wallets w ON w.id = l.wallet_id
      WHERE w.user_id = p_user_id AND l.transaction_type = 'earned';

      v_sp_needed := v_next_sp_badge.required_amount - v_sp_earned;

      IF v_sp_needed > 0 AND v_sp_needed <= 10 THEN
        -- Check if we already sent this milestone notification
        IF NOT EXISTS (
          SELECT 1 FROM notifications
          WHERE user_id = p_user_id
            AND type = 'badge_milestone_approaching'
            AND data->>'badge_id' = v_next_sp_badge.id::text
            AND created_at > now() - INTERVAL '7 days'
        ) THEN
          PERFORM create_badge_notification(
            p_user_id,
            'badge_milestone_approaching',
            'Badge Almost Unlocked! ' || v_next_sp_badge.icon,
            'Earn ' || v_sp_needed || ' more SP to unlock the "' || v_next_sp_badge.name || '" badge!',
            jsonb_build_object(
              'badge_id', v_next_sp_badge.id,
              'badge_name', v_next_sp_badge.name,
              'badge_icon', v_next_sp_badge.icon,
              'sp_needed', v_sp_needed,
              'deep_link', '/earn-sp'
            )
          );
        END IF;
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Badge notification service
==================================================
*/

// filepath: src/services/badgeNotifications.ts

import { supabase } from '@/lib/supabase';

export class BadgeNotificationService {
  /**
   * Check and send milestone approaching notifications
   */
  static async checkMilestones(userId: string): Promise<void> {
    await supabase.rpc('check_badge_milestones', {
      p_user_id: userId,
    });
  }

  /**
   * Send custom badge celebration (for special events)
   */
  static async celebrateCustomBadge(
    userId: string,
    badgeName: string,
    badgeIcon: string,
    message: string
  ): Promise<void> {
    await supabase.rpc('create_badge_notification', {
      p_user_id: userId,
      p_notification_type: 'badge_earned',
      p_title: `Special Badge Earned! ${badgeIcon}`,
      p_body: message,
      p_data: {
        badge_name: badgeName,
        badge_icon: badgeIcon,
        is_special: true,
        deep_link: '/profile/badges',
      },
    });
  }
}

/*
==================================================
FILE 3: Badge celebration modal (React)
==================================================
*/

// filepath: src/components/badges/BadgeCelebrationModal.tsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface BadgeCelebrationModalProps {
  badge: {
    name: string;
    icon: string;
    description: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export const BadgeCelebrationModal: React.FC<BadgeCelebrationModalProps> = ({
  badge,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti animation
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-8xl mb-4"
            >
              {badge.icon}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold mb-2 text-gray-800"
            >
              Badge Unlocked!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-xl font-semibold mb-2 text-blue-600"
            >
              {badge.name}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="text-gray-600 mb-6"
            >
              {badge.description}
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={onClose}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Awesome!
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
```

### Testing Checklist

**Database & UI Tests:**
- [ ] Badge earned notification sent immediately on badge award
- [ ] Notification includes badge icon, name, description
- [ ] Milestone approaching notification sent when close to next badge
- [ ] Milestone notification not sent more than once per week
- [ ] Badge celebration modal shows with confetti animation
- [ ] Badge notifications sent regardless of subscription status
- [ ] Deep link navigates to badge collection

**Physical Device Tests (Google Pixel):**
- [ ] Award badge manually → notification appears on Pixel immediately
- [ ] Badge icon (emoji) displays correctly in push notification
- [ ] Tapping badge notification opens app and shows celebration modal with confetti
- [ ] Confetti animation plays smoothly on Pixel (60 fps)
- [ ] Badge celebration modal auto-closes after 5 seconds
- [ ] Test milestone notification when 5 SP away from next badge
- [ ] Badge notification appears for free users (not subscription-gated)
- [ ] Test with app killed → tapping notification launches app and shows celebration
- [ ] Test badge notification grouping with multiple badges earned
- [ ] Verify "Badges & Achievements" notification channel exists in Android settings
- [ ] Record screen video of badge earning with celebration animation

### Deployment Notes
1. Install canvas-confetti and framer-motion packages
2. Test badge celebration animations on mobile devices
3. Verify milestone calculation accuracy
4. Test notification delivery for auto and manual badge awards
5. **Physical Device Testing Required**: Test badge celebration modal and confetti animation on Google Pixel to ensure smooth performance

---

## TASK NOTIF-V2-005: Push Notification Delivery Engine

**Duration:** 3.5 hours  
**Priority:** Critical  
**Dependencies:** NOTIF-V2-001

### Description
Implement push notification delivery using Expo Push Notifications. Store user push tokens. Implement rate limiting (max 10 notifications per hour). Add quiet hours enforcement. Create deduplication logic. Build retry mechanism for failed deliveries.

### Acceptance Criteria
- [ ] Push tokens stored and updated on login
- [ ] Rate limiting enforced (10 notifications/hour per user)
- [ ] Quiet hours respected (no push notifications 10pm-8am)
- [ ] Duplicate notifications prevented (5-minute window)
- [ ] Failed push deliveries retried up to 3 times
- [ ] Push notification receipts tracked

---

### AI Prompt for Cursor

```typescript
/*
TASK: Push notification delivery engine

CONTEXT:
Expo Push Notifications for React Native mobile app.
Must respect rate limits, quiet hours, and user preferences.

DELIVERY RULES:
- Max 10 push notifications per user per hour
- No push during quiet hours (configurable per user)
- Deduplicate identical notifications within 5 minutes
- Retry failed deliveries up to 3 times
- Track delivery receipts

==================================================
FILE 1: Push token storage
==================================================
*/

-- filepath: supabase/migrations/144_push_tokens.sql

-- Push tokens table
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  device_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX push_tokens_user_idx ON push_tokens(user_id);
CREATE INDEX push_tokens_active_idx ON push_tokens(is_active) WHERE is_active = true;

-- RLS policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- RPC: Register push token
CREATE OR REPLACE FUNCTION register_push_token(
  p_user_id UUID,
  p_token TEXT,
  p_platform TEXT,
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Deactivate old tokens for this device
  IF p_device_id IS NOT NULL THEN
    UPDATE push_tokens
    SET is_active = false
    WHERE user_id = p_user_id
      AND device_id = p_device_id
      AND token != p_token;
  END IF;

  -- Insert or update token
  INSERT INTO push_tokens (user_id, token, platform, device_id)
  VALUES (p_user_id, p_token, p_platform, p_device_id)
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    is_active = true,
    last_used_at = now(),
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Edge function for push notification delivery
==================================================
*/

// filepath: supabase/functions/send-push-notifications/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Expo, ExpoPushMessage } from 'https://esm.sh/expo-server-sdk@3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const expo = new Expo();

interface NotificationToSend {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: any;
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending notifications that need push delivery
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .contains('channels', ['push'])
      .eq('status', 'pending')
      .is('push_sent_at', null)
      .limit(100);

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const sentNotifications: string[] = [];
    const failedNotifications: string[] = [];

    for (const notification of notifications as NotificationToSend[]) {
      try {
        // Check rate limiting (10 per hour)
        const { data: recentPushes } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', notification.user_id)
          .not('push_sent_at', 'is', null)
          .gte('push_sent_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString());

        if (recentPushes && recentPushes.length >= 10) {
          console.log(`Rate limit exceeded for user ${notification.user_id}`);
          continue;
        }

        // Check quiet hours
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
          .eq('user_id', notification.user_id)
          .limit(1)
          .single();

        if (prefs && prefs.quiet_hours_enabled) {
          const currentHour = now.getHours();
          const quietStart = parseInt(prefs.quiet_hours_start.split(':')[0]);
          const quietEnd = parseInt(prefs.quiet_hours_end.split(':')[0]);

          // Check if current time is in quiet hours
          const isQuietHours = quietStart > quietEnd
            ? currentHour >= quietStart || currentHour < quietEnd
            : currentHour >= quietStart && currentHour < quietEnd;

          if (isQuietHours) {
            console.log(`Quiet hours for user ${notification.user_id}`);
            continue;
          }
        }

        // Check for duplicates in last 5 minutes
        const { data: duplicates } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', notification.user_id)
          .eq('type', notification.type)
          .gte('created_at', new Date(now.getTime() - 5 * 60 * 1000).toISOString())
          .neq('id', notification.id);

        if (duplicates && duplicates.length > 0) {
          console.log(`Duplicate notification for user ${notification.user_id}`);
          // Mark as sent without actually sending
          await supabase
            .from('notifications')
            .update({ status: 'sent', push_sent_at: now.toISOString() })
            .eq('id', notification.id);
          continue;
        }

        // Get user's push tokens
        const { data: tokens } = await supabase
          .from('push_tokens')
          .select('token')
          .eq('user_id', notification.user_id)
          .eq('is_active', true);

        if (!tokens || tokens.length === 0) {
          console.log(`No push tokens for user ${notification.user_id}`);
          continue;
        }

        // Send push notification to all tokens
        const messages: ExpoPushMessage[] = tokens.map((t) => ({
          to: t.token,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
        }));

        const chunks = expo.chunkPushNotifications(messages);
        
        for (const chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('Push tickets:', ticketChunk);
          } catch (error) {
            console.error('Error sending push chunk:', error);
          }
        }

        // Mark notification as sent
        await supabase
          .from('notifications')
          .update({
            status: 'sent',
            push_sent_at: now.toISOString(),
          })
          .eq('id', notification.id);

        sentNotifications.push(notification.id);
      } catch (error) {
        console.error(`Failed to send notification ${notification.id}:`, error);
        failedNotifications.push(notification.id);

        // Mark as failed
        await supabase
          .from('notifications')
          .update({ status: 'failed' })
          .eq('id', notification.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentNotifications.length,
        failed: failedNotifications.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
FILE 3: Push token registration service
==================================================
*/

// filepath: src/services/pushTokens.ts

import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export class PushTokenService {
  /**
   * Register push token for current device
   */
  static async registerPushToken(userId: string): Promise<void> {
    try {
      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return;
      }

      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

### Testing Checklist

**Edge Function Tests:**
- [ ] Push tokens stored and updated on login
- [ ] Rate limiting enforced (10 notifications/hour per user)
- [ ] Quiet hours respected (no push notifications 10pm-8am)
- [ ] Duplicate notifications prevented (5-minute window)
- [ ] Failed push deliveries retried up to 3 times
- [ ] Push notification receipts tracked

**Physical Device Tests (Google Pixel):**
- [ ] Install app on Pixel → notification permission prompt appears
- [ ] Grant permission → push token saved to push_tokens table in Supabase
- [ ] Verify push token format is Expo token (ExponentPushToken[...])
- [ ] Send 11 notifications within 1 hour → 11th notification not delivered (rate limit)
- [ ] Set quiet hours 10pm-8am, send notification at 11pm → no push received
- [ ] Send same notification twice within 5 minutes → second notification deduplicated
- [ ] Force-stop app, send notification → notification appears on lock screen
- [ ] Turn on airplane mode, send notification, turn off airplane mode → notification delivered when online
- [ ] Uninstall and reinstall app → new push token registered
- [ ] Test push notification with large body text (>200 chars) → text truncated correctly
- [ ] Use adb logcat to monitor push notification delivery in real-time
- [ ] Verify push notification receipt tracking in database (push_sent_at timestamp)
- [ ] Test with multiple devices for same user → all devices receive push
- [ ] Record screen video of rate limiting test (10 notifications delivered, 11th blocked)

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      // Get device ID
      const deviceId = Device.deviceName || Device.modelName || 'unknown';

      // Register token with backend
      await supabase.rpc('register_push_token', {
        p_user_id: userId,
        p_token: token,
        p_platform: Platform.OS,
        p_device_id: deviceId,
      });

      console.log('Push token registered:', token);
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  /**
   * Configure notification handlers
   */
  static configurePushHandlers(): void {
    // Handle foreground notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);

      // Handle deep linking based on notification data
      if (data.deep_link) {
        // Navigate to deep link screen
        // navigation.navigate(data.deep_link);
      }
    });
  }
}
```

### Testing Checklist
- [ ] Push tokens registered on user login
- [ ] Rate limiting prevents more than 10 notifications/hour
- [ ] Quiet hours prevent push notifications during configured times
- [ ] Duplicate notifications prevented within 5-minute window
- [ ] Failed push deliveries marked as failed
- [ ] Push notification deep links work correctly
- [ ] Multiple devices per user supported

### Deployment Notes
1. Deploy edge function `send-push-notifications` to Supabase
2. Set up cron job to run edge function every 1 minute
3. Install expo-notifications and expo-device packages
4. Configure Expo push notification credentials (FCM for Android, APNs for iOS)
5. Test push notifications on physical devices (iOS & Android)
6. **Physical Device Testing Required**: Test rate limiting, quiet hours, and deduplication on Google Pixel using the testing workflows in the setup guide above

---

## TASK NOTIF-V2-006: In-App Notification Center

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** NOTIF-V2-001

### Description
Create in-app notification center UI. Display notification history with read/unread status. Implement mark as read functionality. Add notification badge count. Support pull-to-refresh and infinite scroll.

### Acceptance Criteria
- [ ] Notification center displays all user notifications
- [ ] Unread notifications visually distinct from read notifications
- [ ] Badge count shows number of unread notifications
- [ ] User can mark individual notification as read
- [ ] User can mark all notifications as read
- [ ] Pull-to-refresh reloads notifications
- [ ] Infinite scroll loads older notifications

---

### AI Prompt for Cursor

```typescript
/*
TASK: In-app notification center

CONTEXT:
Central location for users to view all notifications.
Similar to mobile notification tray.

FEATURES:
- List all notifications (newest first)
- Visual distinction for unread notifications
- Badge count in tab bar
- Mark as read functionality
- Pull-to-refresh and infinite scroll

==================================================
FILE 1: Notification center service
==================================================
*/

// filepath: src/services/notificationCenter.ts

import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/notifications';

export class NotificationCenterService {
  /**
   * Get user's notifications with pagination
   */
  static async getNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    }
  ): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.is('read_at', null);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 20) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get notifications: ${error.message}`);
    }

    return data as Notification[];
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }

    return count || 0;
  }

### Testing Checklist

**UI Component Tests:**
- [ ] Notification center screen renders with empty state
- [ ] Notifications displayed in reverse chronological order
- [ ] Unread notifications highlighted visually
- [ ] Pull-to-refresh updates notification list
- [ ] Mark as read works (tap notification)
- [ ] Mark all as read works (button)
- [ ] Badge count decrements when notification marked as read
- [ ] Deep link navigation works from notification center
- [ ] Pagination works for large notification history
- [ ] Real-time updates when new notification received

**Physical Device Tests (Google Pixel):**
- [ ] Open notification center on Pixel → all notifications load correctly
- [ ] Pull down to refresh → spinner appears and list updates
- [ ] Tap unread notification → marked as read, background color changes
- [ ] Verify unread notifications have blue indicator/bold text
- [ ] Tap "Mark all as read" → all notifications change to read state
- [ ] App icon badge count updates immediately when marking as read
- [ ] Tap notification with deep link → navigates to correct screen
- [ ] Scroll to bottom of 100+ notifications → pagination loads more smoothly
- [ ] Receive new notification while viewing center → appears at top of list in real-time
- [ ] Test with slow 3G network → loading indicator appears
- [ ] Test empty state when no notifications exist → shows friendly message
- [ ] Test notification center icon in tab bar shows badge count
- [ ] Test notification categories filter (if implemented)
- [ ] Record screen video of full notification center flow

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    });

    if (error) {
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  }

  /**
   * Subscribe to new notifications
   */
  static subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

/*
==================================================
FILE 2: Notification center UI (React Native)
==================================================
*/

// filepath: src/screens/NotificationCenterScreen.tsx

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NotificationCenterService } from '@/services/notificationCenter';
import type { Notification } from '@/types/notifications';

const NOTIFICATION_ICONS = {
  subscription: '💳',
  sp_events: '✨',
  badges: '🏆',
  trades: '🔄',
  system: '📢',
};

export const NotificationCenterScreen: React.FC<{ userId: string }> = ({ userId }) => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications
    const unsubscribe = NotificationCenterService.subscribeToNotifications(
      userId,
      (newNotification) => {
        setNotifications((prev) => [newNotification, ...prev]);
      }
    );

    return unsubscribe;
  }, [userId]);

  const loadNotifications = async (offset = 0) => {
    try {
      const data = await NotificationCenterService.getNotifications(userId, {
        limit: 20,
        offset,
      });

      if (offset === 0) {
        setNotifications(data);
      } else {
        setNotifications((prev) => [...prev, ...data]);
      }

      setHasMore(data.length === 20);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadNotifications(0);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadNotifications(notifications.length);
    }
  }, [isLoading, hasMore, notifications.length]);

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.read_at) {
      await NotificationCenterService.markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    }

    // Handle deep link
    if (notification.data?.deep_link) {
      navigation.navigate(notification.data.deep_link as any);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await NotificationCenterService.markAllAsRead(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isUnread = !item.read_at;
    const icon = NOTIFICATION_ICONS[item.category] || '📬';

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationIcon}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationTitle, isUnread && styles.unreadText]}>
            {item.title}
          </Text>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimestamp(item.created_at)}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markAllRead}>Mark All Read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  markAllRead: {
    color: '#2196F3',
    fontSize: 14,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  notificationUnread: {
    backgroundColor: '#f0f8ff',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginLeft: 8,
    alignSelf: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

/*
==================================================
FILE 3: Notification badge component
==================================================
*/

// filepath: src/components/NotificationBadge.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NotificationCenterService } from '@/services/notificationCenter';

export const NotificationBadge: React.FC<{ userId: string }> = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();

    // Subscribe to notification changes
    const unsubscribe = NotificationCenterService.subscribeToNotifications(
      userId,
      () => {
        loadUnreadCount();
      }
    );

    return unsubscribe;
  }, [userId]);

  const loadUnreadCount = async () => {
    try {
      const count = await NotificationCenterService.getUnreadCount(userId);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  if (unreadCount === 0) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
```

### Testing Checklist
- [ ] Notification center displays all notifications in reverse chronological order
- [ ] Unread notifications visually distinct (highlighted background)
- [ ] Mark as read works for individual notifications
- [ ] Mark all as read updates all unread notifications
- [ ] Badge count displays correct unread count
- [ ] Badge count updates in real-time when new notifications arrive
- [ ] Pull-to-refresh reloads notifications
- [ ] Infinite scroll loads older notifications
- [ ] Deep links navigate to correct screens

### Deployment Notes
1. Test notification center on iOS and Android
2. Verify real-time subscription for new notifications
3. Test mark as read functionality
4. Ensure badge count updates across app tabs
5. **Physical Device Testing Required**: Test pull-to-refresh, pagination, and real-time updates on Google Pixel

---

## TASK NOTIF-V2-007: Trade Event Notifications

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** NOTIF-V2-001, MODULE-06 (Trade Flow V2)

### Description
Implement notifications for trade lifecycle events. Send trade request received notification to seller. Notify buyer when trade accepted/rejected. Alert both parties when trade completed. Send trade cancelled notification.

### Acceptance Criteria
- [ ] Trade request notification sent to seller when trade created
- [ ] Trade accepted notification sent to buyer
- [ ] Trade rejected notification sent to buyer
- [ ] Trade completed notification sent to both buyer and seller
- [ ] Trade cancelled notification sent to both parties
- [ ] Trade notifications respect user preferences
- [ ] Notifications include item details and deep link to trade screen

---

### AI Prompt for Cursor

```typescript
/*
TASK: Trade event notifications

CONTEXT:
Notify buyers and sellers about trade state changes.
Critical for trade flow transparency and user engagement.

V2 TRADE EVENTS:
- trade_request: New trade request received (seller)
- trade_accepted: Trade accepted (buyer)
- trade_rejected: Trade rejected (buyer)
- trade_completed: Trade completed (both parties)
- trade_cancelled: Trade cancelled (both parties)

==================================================
FILE 1: Trade notification triggers
==================================================
*/

-- filepath: supabase/migrations/145_trade_notifications.sql

-- Function to create trade notification
CREATE OR REPLACE FUNCTION create_trade_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels notification_channel[];
  v_prefs RECORD;
BEGIN
  -- Get user's trade notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = 'trades';

  IF NOT FOUND THEN
    v_channels := ARRAY['push', 'in_app']::notification_channel[];
  ELSE
    v_channels := ARRAY[]::notification_channel[];
    IF v_prefs.push_enabled THEN
      v_channels := array_append(v_channels, 'push'::notification_channel);
    END IF;
    IF v_prefs.in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app'::notification_channel);
    END IF;
    IF v_prefs.email_enabled THEN
      v_channels := array_append(v_channels, 'email'::notification_channel);
    END IF;
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, category, type, title, body, data, channels)
  VALUES (p_user_id, 'trades', p_notification_type, p_title, p_body, p_data, v_channels)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Send trade request notification
CREATE OR REPLACE FUNCTION send_trade_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_buyer RECORD;
BEGIN
  -- Only notify on new trades
  IF TG_OP = 'INSERT' THEN
    -- Get item and buyer details
    SELECT * INTO v_item FROM items WHERE id = NEW.item_id;
    SELECT full_name INTO v_buyer FROM profiles WHERE user_id = NEW.buyer_id;

    -- Notify seller
    PERFORM create_trade_notification(
      NEW.seller_id,
      'trade_request',
      'New Trade Request! 💬',
      v_buyer.full_name || ' wants to trade for your "' || v_item.title || '"',
      jsonb_build_object(
        'trade_id', NEW.id,
        'item_id', NEW.item_id,
        'item_title', v_item.title,
        'buyer_id', NEW.buyer_id,
        'buyer_name', v_buyer.full_name,
        'deep_link', '/trades/' || NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_request_notification ON trades;
CREATE TRIGGER trade_request_notification
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION send_trade_request_notification();

-- Trigger: Send trade status change notifications
CREATE OR REPLACE FUNCTION send_trade_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_buyer_name TEXT;
  v_seller_name TEXT;
BEGIN
  -- Get item and user names
  SELECT * INTO v_item FROM items WHERE id = NEW.item_id;
  SELECT full_name INTO v_buyer_name FROM profiles WHERE user_id = NEW.buyer_id;
  SELECT full_name INTO v_seller_name FROM profiles WHERE user_id = NEW.seller_id;

  -- Trade accepted
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM create_trade_notification(
      NEW.buyer_id,
      'trade_accepted',
      'Trade Accepted! ✅',
      v_seller_name || ' accepted your trade request for "' || v_item.title || '"',
      jsonb_build_object(
        'trade_id', NEW.id,
        'item_id', NEW.item_id,
        'item_title', v_item.title,
        'deep_link', '/trades/' || NEW.id
      )
    );

  -- Trade rejected
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    PERFORM create_trade_notification(
      NEW.buyer_id,
      'trade_rejected',
      'Trade Declined',
      v_seller_name || ' declined your trade request for "' || v_item.title || '"',
      jsonb_build_object(
        'trade_id', NEW.id,
        'item_id', NEW.item_id,
        'item_title', v_item.title,
        'deep_link', '/browse'
      )
    );

  -- Trade completed
  ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Notify buyer
    PERFORM create_trade_notification(
      NEW.buyer_id,
      'trade_completed',
      'Trade Complete! 🎉',
      'Your trade for "' || v_item.title || '" is complete! Don\'t forget to leave a review.',
      jsonb_build_object(
        'trade_id', NEW.id,
        'item_id', NEW.item_id,
        'item_title', v_item.title,
        'deep_link', '/trades/' || NEW.id || '/review'
      )
    );

    -- Notify seller
    PERFORM create_trade_notification(
      NEW.seller_id,
      'trade_completed',
      'Trade Complete! 🎉',
      'Your trade with ' || v_buyer_name || ' for "' || v_item.title || '" is complete!',
      jsonb_build_object(
        'trade_id', NEW.id,
        'item_id', NEW.item_id,
        'item_title', v_item.title,
        'deep_link', '/trades/' || NEW.id || '/review'
      )
    );

  -- Trade cancelled
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Notify both parties
    PERFORM create_trade_notification(
      NEW.buyer_id,
      'trade_cancelled',
      'Trade Cancelled',
      'The trade for "' || v_item.title || '" has been cancelled.',
      jsonb_build_object(
        'trade_id', NEW.id,
        'item_id', NEW.item_id,
        'item_title', v_item.title,
        'deep_link', '/trades'
      )
    );

    IF NEW.buyer_id != NEW.seller_id THEN
      PERFORM create_trade_notification(
        NEW.seller_id,
        'trade_cancelled',
        'Trade Cancelled',
        'The trade for "' || v_item.title || '" has been cancelled.',
        jsonb_build_object(
          'trade_id', NEW.id,
          'item_id', NEW.item_id,
          'item_title', v_item.title,
          'deep_link', '/trades'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_status_notification ON trades;
CREATE TRIGGER trade_status_notification
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION send_trade_status_notification();
```

### Testing Checklist

**Database Trigger Tests:**
- [ ] Trade request notification sent to seller on trade creation
- [ ] Trade accepted notification sent to buyer
- [ ] Trade rejected notification sent to buyer
- [ ] Trade completed notification sent to both parties
- [ ] Trade cancelled notification sent to both parties
- [ ] Notifications include item details and deep links
- [ ] Trade notifications respect user preferences
- [ ] Notifications not sent for trades in same status

**Physical Device Tests (Google Pixel - 2 Devices):**
- [ ] Device A (buyer): Create trade request → Device B (seller) receives notification
- [ ] Device B: Accept trade → Device A receives "Trade Accepted ✅" notification
- [ ] Device B: Reject trade → Device A receives "Trade Declined" notification
- [ ] Device A & B: Complete trade → both devices receive "Trade Complete 🎉" notification
- [ ] Tap trade notification → navigates to trade detail screen
- [ ] Test trade cancelled notification sent to both parties
- [ ] Verify trade notifications include item title and thumbnail
- [ ] Test with "Trades" notifications disabled → only in-app, no push
- [ ] Test rapid trade actions (create, accept, complete) → all notifications delivered in order
- [ ] Verify notification grouping: multiple trade notifications group under "Trades" channel
- [ ] Test with one device offline → receives notification when back online
- [ ] Record screen video of full trade flow with notifications on both devices

### Deployment Notes
1. Test trade notification triggers with various trade states
2. Verify buyer and seller receive correct notifications
3. Test deep links navigate to trade detail screen
4. Monitor notification volume for high-activity users
5. **Physical Device Testing Required**: Test trade flow with 2 Google Pixels to verify both buyer and seller receive notifications correctly

---

## TASK NOTIF-V2-008: Notification Deep Linking

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** NOTIF-V2-001 through NOTIF-V2-007

### Description
Implement deep linking for all notifications. Parse notification data to determine target screen. Handle notification taps from background, foreground, and killed app states. Implement navigation stack management for deep links. Add deep link testing utilities.

### Acceptance Criteria
- [ ] Notification taps navigate to correct screen
- [ ] Deep links work from all app states (foreground, background, killed)
- [ ] Navigation stack properly managed (back button works correctly)
- [ ] Deep link parsing handles all notification types
- [ ] Invalid deep links gracefully fallback to home screen
- [ ] Deep link testing utility available

---

### AI Prompt for Cursor

```typescript
/*
TASK: Notification deep linking

CONTEXT:
When users tap notifications, navigate them to the relevant screen.
Must handle all app states and manage navigation stack properly.

DEEP LINK PATTERNS:
- /subscription - Subscription management screen
- /wallet - SP wallet screen
- /profile/badges - Badge collection
- /trades/:tradeId - Trade detail screen
- /trades/:tradeId/review - Review submission
- /items/:itemId - Item detail screen

==================================================
FILE 1: Deep link navigation service
==================================================
*/

// filepath: src/services/deepLinkNavigation.ts

import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRef } from '@react-navigation/native';

export class DeepLinkNavigationService {
  private static navigationRef: NavigationContainerRef<any> | null = null;

  /**
   * Set navigation reference for deep linking
   */
  static setNavigationRef(ref: NavigationContainerRef<any>) {
    this.navigationRef = ref;
  }

  /**
   * Initialize notification response listener
   */
  static initialize() {
    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      
      if (data.deep_link) {
        this.navigateToDeepLink(data.deep_link as string);
      }
    });

    // Handle URL scheme deep links (iOS/Android)
    Linking.addEventListener('url', (event) => {
      this.handleURL(event.url);
    });

    // Handle initial URL (app opened from killed state)
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleURL(url);
      }
    });

    // Handle initial notification (app opened from killed state by tapping notification)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data.deep_link) {
        this.navigateToDeepLink(
          response.notification.request.content.data.deep_link as string
        );
      }
    });
  }

  /**
   * Handle URL deep link
   */
  private static handleURL(url: string) {
    // Parse URL (e.g., "kidsp2p://trades/123")
    const path = url.replace(/.*?:\/\//g, '');
    this.navigateToDeepLink(path);
  }

  /**
   * Navigate to deep link path
   */
  static navigateToDeepLink(path: string) {
    if (!this.navigationRef) {
      console.warn('Navigation ref not set, cannot navigate to deep link:', path);
      return;
    }

    // Wait for navigation to be ready
    if (!this.navigationRef.isReady()) {
      setTimeout(() => this.navigateToDeepLink(path), 100);
      return;
    }

    try {
      const route = this.parseDeepLink(path);
      
      if (route) {
        this.navigationRef.navigate(route.screen, route.params);
      } else {
        // Fallback to home screen for invalid links
        this.navigationRef.navigate('Home');
      }
    } catch (error) {
      console.error('Deep link navigation error:', error);
      this.navigationRef.navigate('Home');
    }
  }

  /**
   * Parse deep link path to navigation route
   */
  private static parseDeepLink(path: string): { screen: string; params?: any } | null {
    // Remove leading slash
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = cleanPath.split('/');

    // Subscription screen
    if (cleanPath === 'subscription' || cleanPath === 'subscription/payment') {
      return { screen: 'Subscription' };
    }

    // SP Wallet screen
    if (cleanPath === 'wallet' || cleanPath === 'earn-sp') {
      return { screen: 'Wallet' };
    }

    // Badge collection
    if (cleanPath === 'profile/badges') {
      return { screen: 'Badges' };
    }

    // Trade detail
    if (segments[0] === 'trades' && segments[1]) {
      const tradeId = segments[1];
      
      // Review submission
      if (segments[2] === 'review') {
        return { screen: 'TradeReview', params: { tradeId } };
      }
      
      // Trade detail
      return { screen: 'TradeDetail', params: { tradeId } };

### Testing Checklist

**Deep Link Logic Tests:**
- [ ] Notification taps navigate to correct screen
- [ ] Deep links work from all app states (foreground, background, killed)
- [ ] Navigation stack properly managed (back button works correctly)
- [ ] Deep link parsing handles all notification types
- [ ] Invalid deep links gracefully fallback to home screen
- [ ] Deep link testing utility available

**Physical Device Tests (Google Pixel):**
- [ ] App in FOREGROUND → tap subscription notification → navigates to subscription screen
- [ ] App in BACKGROUND → tap wallet notification → app comes to foreground on wallet screen
- [ ] App KILLED → tap trade notification → app launches directly to trade detail screen
- [ ] Test back button after deep link → navigates to previous screen in stack (not app close)
- [ ] Test deep link with parameters: /trades/abc123 → loads correct trade
- [ ] Test invalid deep link /invalid/path → app opens to home screen
- [ ] Test deep link with special characters in URL → parses correctly
- [ ] Use adb to send test deep link manually:
  ```bash
  adb shell am start -W -a android.intent.action.VIEW \
    -d "kidsp2p://wallet" com.yourcompany.p2pkidsmarketplace
  ```
- [ ] Test URL scheme deep link from browser (Chrome)
- [ ] Test universal link (https://p2pkids.app/subscription) if configured
- [ ] Test deep link navigation with back button: Trade Detail → Back → Home (correct stack)
- [ ] Record screen video of deep links from all 3 app states (foreground/background/killed)
    }

    // Item detail
    if (segments[0] === 'items' && segments[1]) {
      return { screen: 'ItemDetail', params: { itemId: segments[1] } };
    }

    // Profile screen
    if (cleanPath === 'profile') {
      return { screen: 'Profile' };
    }

    // Notification center
    if (cleanPath === 'notifications') {
      return { screen: 'NotificationCenter' };
    }

    // Unknown path
    console.warn('Unknown deep link path:', path);
    return null;
  }

  /**
   * Test deep link (development only)
   */
  static testDeepLink(path: string) {
    console.log('Testing deep link:', path);
    this.navigateToDeepLink(path);
  }
}

/*
==================================================
FILE 2: Root navigation setup with deep linking
==================================================
*/

// filepath: src/navigation/RootNavigator.tsx

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DeepLinkNavigationService } from '@/services/deepLinkNavigation';

const Stack = createNativeStackNavigator();

export const RootNavigator: React.FC = () => {
  const navigationRef = useRef(null);

  useEffect(() => {
    if (navigationRef.current) {
      DeepLinkNavigationService.setNavigationRef(navigationRef.current);
      DeepLinkNavigationService.initialize();
    }
  }, []);

  // Define deep link configuration for React Navigation
  const linking = {
    prefixes: ['kidsp2p://', 'https://kidsp2p.com'],
    config: {
      screens: {
        Home: '',
        Subscription: 'subscription',
        Wallet: 'wallet',
        Badges: 'profile/badges',
        TradeDetail: 'trades/:tradeId',
        TradeReview: 'trades/:tradeId/review',
        ItemDetail: 'items/:itemId',
        Profile: 'profile',
        NotificationCenter: 'notifications',
      },
    },
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator>
        {/* Define all your screens here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/*
==================================================
FILE 3: Deep link testing utility
==================================================
*/

// filepath: src/utils/testDeepLinks.ts

import { DeepLinkNavigationService } from '@/services/deepLinkNavigation';

/**
 * Test suite for deep link navigation
 * Run in development mode to verify all deep links work
 */
export const testDeepLinks = () => {
  const testCases = [
    { name: 'Subscription', path: '/subscription' },
    { name: 'Wallet', path: '/wallet' },
    { name: 'Badges', path: '/profile/badges' },
    { name: 'Trade Detail', path: '/trades/test-trade-id-123' },
    { name: 'Trade Review', path: '/trades/test-trade-id-123/review' },
    { name: 'Item Detail', path: '/items/test-item-id-456' },
    { name: 'Profile', path: '/profile' },
    { name: 'Notifications', path: '/notifications' },
    { name: 'Invalid Link', path: '/invalid/path/here' },
  ];

  console.log('=== Deep Link Test Suite ===');
  
  testCases.forEach((testCase, index) => {
    setTimeout(() => {
      console.log(`\n[${index + 1}/${testCases.length}] Testing: ${testCase.name}`);
      console.log(`Path: ${testCase.path}`);
      DeepLinkNavigationService.testDeepLink(testCase.path);
    }, index * 2000); // 2 second delay between tests
  });
};

// Export individual test functions for manual testing
export const testSubscriptionLink = () => {
  DeepLinkNavigationService.testDeepLink('/subscription');
};

export const testWalletLink = () => {
  DeepLinkNavigationService.testDeepLink('/wallet');
};

export const testTradeLink = (tradeId: string) => {
  DeepLinkNavigationService.testDeepLink(`/trades/${tradeId}`);
};
```

### Testing Checklist
- [ ] Notification tap navigates to correct screen from foreground
- [ ] Notification tap navigates to correct screen from background
- [ ] Notification tap navigates to correct screen from killed app
- [ ] Back button works correctly after deep link navigation
- [ ] Invalid deep links fallback to home screen gracefully
- [ ] Deep link testing utility runs all test cases
- [ ] All notification types have correct deep link paths
- [ ] Deep links include necessary parameters (IDs, etc.)

### Deployment Notes
1. Configure URL scheme in app.json (Expo) or Info.plist/AndroidManifest.xml
2. Test deep links on both iOS and Android
3. Verify universal links (https://) work correctly
4. Test deep link navigation from all app states
5. Add deep link testing to CI/CD pipeline
6. **Physical Device Testing Required**: Test deep links from all app states on Google Pixel using adb commands from setup guide

---

## TASK NOTIF-V2-009: Email Notifications

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** NOTIF-V2-001, NOTIF-V2-002

### Description
Implement email notification delivery for critical events. Create email templates for subscription events, payment failures, account security. Integrate with SendGrid or similar service. Implement email tracking (sent, opened, clicked). Add email notification settings.

### Acceptance Criteria
- [ ] Email notifications sent for critical events (payment failures, security alerts)
- [ ] Email templates created for subscription events
- [ ] Email delivery tracked (sent, bounced, failed)
- [ ] Users can opt-out of non-critical emails
- [ ] Email includes unsubscribe link
- [ ] Email templates are mobile-responsive

---

### AI Prompt for Cursor

```typescript
/*
TASK: Email notifications

CONTEXT:
Send transactional emails for critical events using SendGrid.
Must respect user preferences and comply with email best practices.

CRITICAL EMAIL EVENTS:
- subscription_payment_failed
- subscription_cancelled
- account_security_alert
- password_reset
- email_verification

NON-CRITICAL EMAIL EVENTS (opt-in):
- subscription_trial_expiring
- subscription_renewed
- weekly_digest

==================================================
FILE 1: Email notification service
==================================================
*/

// filepath: src/services/emailNotifications.ts

import { supabase } from '@/lib/supabase';

interface SendEmailParams {
  to: string;
  template: string;
  data: Record<string, any>;
  isCritical?: boolean;
}

export class EmailNotificationService {
  /**
   * Send email via edge function
   */
  static async sendEmail(params: SendEmailParams): Promise<void> {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  }

  /**
   * Send payment failure email (critical, always sent)
   */
  static async sendPaymentFailureEmail(
    userId: string,
    email: string,
    subscriptionId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'payment_failed',
      data: {
        subscription_id: subscriptionId,
        amount,
        reason,
        retry_link: `https://app.kidsp2p.com/subscription/payment`,
      },
      isCritical: true,
    });
  }

  /**
   * Send trial expiring reminder email (non-critical)
   */
  static async sendTrialExpiringEmail(
    userId: string,
    email: string,
    daysRemaining: number,
    trialEndsAt: string
  ): Promise<void> {
    // Check if user has email notifications enabled for subscriptions
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_enabled')
      .eq('user_id', userId)
      .eq('category', 'subscription')
      .single();

    if (!prefs?.email_enabled) {
      console.log('User has email notifications disabled for subscriptions');
      return;
    }

    await this.sendEmail({
      to: email,
      template: 'trial_expiring',
      data: {
        days_remaining: daysRemaining,
        trial_ends_at: new Date(trialEndsAt).toLocaleDateString(),
        subscribe_link: `https://app.kidsp2p.com/subscription/payment`,
      },
      isCritical: false,
    });
  }

  /**
   * Send subscription cancelled confirmation email
   */
  static async sendSubscriptionCancelledEmail(
    userId: string,
    email: string,
    gracePeriodEndsAt: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'subscription_cancelled',
      data: {
        grace_period_ends_at: new Date(gracePeriodEndsAt).toLocaleDateString(),
        reactivate_link: `https://app.kidsp2p.com/subscription`,
      },
      isCritical: true,
    });
  }
}

/*
==================================================
FILE 2: Edge function for email delivery
==================================================
*/

// filepath: supabase/functions/send-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!;
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@kidsp2p.com';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const templates: Record<string, (data: any) => EmailTemplate> = {
  payment_failed: (data) => ({
    subject: 'Payment Failed - Kids Club+ Subscription',
    html: `
      <h1>Payment Failed</h1>
      <p>We couldn't process your payment for Kids Club+ subscription.</p>
      <p><strong>Amount:</strong> $${data.amount}</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p><a href="${data.retry_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Update Payment Method</a></p>
      <p>If you don't update your payment method, your subscription will be cancelled.</p>
    `,
    text: `Payment Failed\n\nWe couldn't process your payment for Kids Club+ subscription.\nAmount: $${data.amount}\nReason: ${data.reason}\n\nUpdate payment method: ${data.retry_link}`,
  }),
  
  trial_expiring: (data) => ({
    subject: `Trial Expires in ${data.days_remaining} Days - Kids Club+`,
    html: `
      <h1>Your Trial is Expiring Soon</h1>
      <p>Your Kids Club+ trial ends in <strong>${data.days_remaining} days</strong> on ${data.trial_ends_at}.</p>
      <p>Subscribe now to keep your Swap Points active and continue enjoying premium features!</p>
      <p><a href="${data.subscribe_link}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Subscribe Now</a></p>
    `,
    text: `Your Trial is Expiring Soon\n\nYour Kids Club+ trial ends in ${data.days_remaining} days on ${data.trial_ends_at}.\n\nSubscribe now: ${data.subscribe_link}`,
  }),
  
  subscription_cancelled: (data) => ({
    subject: 'Subscription Cancelled - Kids Club+',
    html: `
      <h1>Subscription Cancelled</h1>
      <p>Your Kids Club+ subscription has been cancelled.</p>
      <p>You have until <strong>${data.grace_period_ends_at}</strong> to reactivate your subscription and keep your Swap Points.</p>
      <p><a href="${data.reactivate_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reactivate Subscription</a></p>
    `,
    text: `Subscription Cancelled\n\nYour Kids Club+ subscription has been cancelled.\nGrace period ends: ${data.grace_period_ends_at}\n\nReactivate: ${data.reactivate_link}`,
  }),
};

serve(async (req: Request) => {
  try {
    const { to, template, data, isCritical } = await req.json();

    if (!to || !template) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, template' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get email template
    const emailTemplate = templates[template];
    if (!emailTemplate) {
      return new Response(
        JSON.stringify({ error: `Unknown template: ${template}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

### Testing Checklist

**SendGrid Integration Tests:**
- [ ] Email templates created for critical notifications
- [ ] SendGrid integration configured correctly
- [ ] Payment failure emails sent with correct data
- [ ] Trial expiring emails sent at correct intervals
- [ ] Email deep links navigate to correct app screens
- [ ] Email templates render correctly across email clients
- [ ] Unsubscribe link works (for non-critical emails)
- [ ] Email sending respects user preferences

**Physical Device Tests (Google Pixel + Email):**
- [ ] Trigger payment failure → check email on Gmail app on Pixel
- [ ] Email renders correctly in Gmail app (images, formatting, buttons)
- [ ] Tap "Update Payment Method" button in email → opens app to subscription screen
- [ ] Test email deep link from Gmail on Pixel → app launches correctly
- [ ] Test HTML email in Dark Mode on Android → still readable
- [ ] Test trial expiring email with countdown timer → renders correctly
- [ ] Tap unsubscribe link in email → opens browser with preference update
- [ ] Verify email also sent to desktop Gmail for cross-platform check
- [ ] Test email with attachment (if applicable) opens on Android
- [ ] Test email from notification shade → opens in Gmail app
- [ ] Verify email subject line not truncated on mobile
- [ ] Test email on different Android email clients: Gmail, Outlook, Samsung Email

    const { subject, html, text } = emailTemplate(data);

    // Send via SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
          subject,
        }],
        from: { email: SENDGRID_FROM_EMAIL, name: 'Kids P2P Marketplace' },
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${errorText}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email send error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Testing Checklist
- [ ] Payment failure email sent and received
- [ ] Trial expiring email sent only if user has email notifications enabled
- [ ] Subscription cancelled email sent
- [ ] Email templates render correctly on mobile and desktop
- [ ] Unsubscribe link works (if implemented)
- [ ] Email tracking records sent/opened/clicked events
- [ ] Critical emails sent regardless of user preferences
- [ ] Email delivery failures logged and retried

### Deployment Notes
1. Configure SendGrid API key in Supabase secrets
2. Verify sender email address in SendGrid
3. Set up email domain authentication (SPF, DKIM, DMARC)
4. Test emails in staging environment
5. Monitor email delivery rates and bounce rates
6. Set up webhook for SendGrid events (bounces, opens, clicks)
7. **Physical Device Testing Required**: Test email rendering and deep links on Gmail app on Google Pixel

---

## TASK NOTIF-V2-010: Notification Analytics & Metrics

**Duration:** 2.5 hours  
**Priority:** Low (Nice to have)
**Dependencies:** NOTIF-V2-001 through NOTIF-V2-009

### Description
Implement notification analytics tracking. Track notification delivery rates, open rates, click rates. Create admin dashboard for notification metrics. Add A/B testing framework for notification copy. Monitor notification performance by category.

### Acceptance Criteria
- [ ] Notification delivery tracked (pending/sent/failed)
- [ ] Push notification open rates tracked
- [ ] Deep link click rates tracked
- [ ] Admin dashboard displays notification metrics
- [ ] A/B testing framework for notification copy
- [ ] Metrics segmented by category and notification type

---

### AI Prompt for Cursor

```typescript
/*
TASK: Notification analytics & metrics

CONTEXT:
Track notification performance to optimize engagement.
Help admins understand which notifications are effective.

METRICS TO TRACK:
- Delivery rate: % of notifications sent successfully
- Open rate: % of push notifications opened
- Click rate: % of notifications with deep link clicked
- Category performance: Metrics by notification category
- User engagement: Notifications per user, frequency

==================================================
FILE 1: Notification analytics schema
==================================================
*/

-- filepath: supabase/migrations/146_notification_analytics.sql

-- Notification events tracking table
CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('delivered', 'opened', 'clicked', 'failed')),
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX notification_events_notification_idx ON notification_events(notification_id);
CREATE INDEX notification_events_type_idx ON notification_events(event_type);
CREATE INDEX notification_events_created_idx ON notification_events(created_at DESC);

-- RLS policies
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage notification events"
  ON notification_events FOR ALL
  TO service_role
  USING (true);

-- Analytics view: Notification metrics by category
CREATE OR REPLACE VIEW notification_metrics_by_category AS
SELECT
  n.category,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as delivered_count,
  COUNT(CASE WHEN n.status = 'failed' THEN 1 END) as failed_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) as opened_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) as clicked_count,
  ROUND(100.0 * COUNT(CASE WHEN n.status = 'sent' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as delivery_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) / NULLIF(COUNT(CASE WHEN n.status = 'sent' THEN 1 END), 0), 2) as open_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) / NULLIF(COUNT(CASE WHEN n.status = 'sent' THEN 1 END), 0), 2) as click_rate
FROM notifications n
LEFT JOIN notification_events ne ON ne.notification_id = n.id
GROUP BY n.category;

-- RPC: Get notification analytics
CREATE OR REPLACE FUNCTION get_notification_analytics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sent', COUNT(*),
    'by_category', jsonb_agg(category_stats)
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'category', category,
      'total', total_notifications,
      'delivered', delivered_count,
      'failed', failed_count,
      'opened', opened_count,
      'clicked', clicked_count,
      'delivery_rate', delivery_rate,
      'open_rate', open_rate,
      'click_rate', click_rate
    ) as category_stats
    FROM notification_metrics_by_category
  ) stats;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Notification event tracking service
==================================================
*/

// filepath: src/services/notificationAnalytics.ts

import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';

export class NotificationAnalyticsService {
  /**
   * Track notification opened event
   */
  static async trackOpened(notificationId: string): Promise<void> {
    await supabase.from('notification_events').insert({
      notification_id: notificationId,
      event_type: 'opened',
      event_data: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track notification clicked event (deep link)
   */
  static async trackClicked(notificationId: string, deepLink: string): Promise<void> {
    await supabase.from('notification_events').insert({
      notification_id: notificationId,
      event_type: 'clicked',
      event_data: {
        deep_link: deepLink,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track notification delivery event
   */
  static async trackDelivered(notificationId: string): Promise<void> {
    await supabase.from('notification_events').insert({
      notification_id: notificationId,
      event_type: 'delivered',
      event_data: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track notification failure event
   */
  static async trackFailed(notificationId: string, error: string): Promise<void> {
    await supabase.from('notification_events').insert({
      notification_id: notificationId,
      event_type: 'failed',
      event_data: {
        error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Initialize analytics tracking
   */
  static initialize() {
    // Track notification opens
    Notifications.addNotificationResponseReceivedListener((response) => {
      const notificationId = response.notification.request.content.data.notification_id;
      if (notificationId) {
        this.trackOpened(notificationId as string);

        // Track click if deep link present
        const deepLink = response.notification.request.content.data.deep_link;
        if (deepLink) {
          this.trackClicked(notificationId as string, deepLink as string);
        }
      }
    });
  }
}

/*
==================================================
FILE 3: Admin analytics dashboard component
==================================================
*/

// filepath: p2p-kids-admin/src/app/analytics/notifications/page.tsx

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface NotificationMetrics {
  total_sent: number;
  by_category: Array<{
    category: string;
    total: number;
    delivered: number;
    failed: number;
    opened: number;
    clicked: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
  }>;
}

export default function NotificationAnalyticsPage() {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30); // days

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const { data, error } = await supabase.rpc('get_notification_analytics', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
    });

    if (!error && data) {
      setMetrics(data);
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="p-8">Loading analytics...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notification Analytics</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setDateRange(7)}
            className={`px-4 py-2 rounded ${dateRange === 7 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange(30)}
            className={`px-4 py-2 rounded ${dateRange === 30 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateRange(90)}
            className={`px-4 py-2 rounded ${dateRange === 90 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Last 90 Days
          </button>
        </div>
      </div>

      {metrics && (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Overview</h2>
            <div className="text-4xl font-bold text-blue-600">
              {metrics.total_sent.toLocaleString()}
            </div>
            <div className="text-gray-600">Total Notifications Sent</div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivered</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Click Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.by_category.map((cat) => (
                  <tr key={cat.category}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{cat.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{cat.total}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{cat.delivered}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{cat.delivery_rate.toFixed(1)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">{cat.open_rate.toFixed(1)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">{cat.click_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

### Testing Checklist

**Analytics Tracking Tests:**
- [ ] Notification opened events tracked correctly
- [ ] Deep link click events tracked correctly
- [ ] Delivery/failure events tracked correctly
- [ ] Analytics dashboard displays accurate metrics
- [ ] Metrics update in real-time or near real-time
- [ ] Date range filters work correctly
- [ ] Performance acceptable with large dataset

**Physical Device Tests (Google Pixel + Analytics):**
- [ ] Send notification to Pixel → verify delivery event tracked in database
- [ ] Tap notification on Pixel → verify "opened" event tracked with timestamp
- [ ] Tap deep link in notification → verify click event tracked with target screen
- [ ] Test failed notification (invalid token) → verify failure event tracked
- [ ] Open analytics dashboard → verify metrics match actual test notifications
- [ ] Send 10 notifications, open 7 → dashboard shows 70% open rate
- [ ] Test analytics with different categories → each category tracked separately
- [ ] Test real-time metrics update: send notification → dashboard updates within 10 seconds
- [ ] Test date range filter: Last 7 Days → shows only notifications from last week
- [ ] Test analytics export (if implemented): export data to CSV and verify
- [ ] Verify analytics tracking works with app in background and killed states
- [ ] Test analytics dashboard on mobile browser (responsive design)

### Deployment Notes
1. Test notification event tracking on mobile devices
2. Verify analytics queries perform well with production data
3. Set up monitoring for analytics data collection
4. Create alerts for low delivery rates or high failure rates
5. Document how to interpret metrics for stakeholders
6. **Physical Device Testing Required**: Test analytics tracking on Google Pixel to ensure all notification events are captured correctly

---

## MODULE SUMMARY

### Total Tasks: 10
1. **NOTIF-V2-001**: Notification schema & preferences ✅
2. **NOTIF-V2-002**: Subscription event notifications ✅
3. **NOTIF-V2-003**: SP event notifications ✅
4. **NOTIF-V2-004**: Badge award notifications ✅
5. **NOTIF-V2-005**: Push notification delivery engine ✅
6. **NOTIF-V2-006**: In-app notification center ✅
7. **NOTIF-V2-007**: Trade event notifications 🆕
8. **NOTIF-V2-008**: Notification deep linking 🆕
9. **NOTIF-V2-009**: Email notifications 🆕
10. **NOTIF-V2-010**: Notification analytics & metrics 🆕

### Key Features Delivered
- **Multi-Channel Notifications**: Push, in-app, email with per-category preferences
- **Subscription Lifecycle**: Trial reminders, payment success/failure, cancellation confirmations
- **SP Events**: Earned/spent notifications, wallet frozen alerts, low balance warnings
- **Badge Celebrations**: Immediate award notifications with confetti animation, milestone reminders
- **Push Delivery Engine**: Rate limiting, quiet hours, deduplication, retry logic
- **In-App Center**: Notification history, read/unread tracking, badge count
- **Trade Notifications**: Request/accepted/rejected/completed/cancelled notifications
- **Deep Linking**: Full navigation support from all notification types
- **Email Delivery**: Transactional emails for critical events via SendGrid
- **Analytics Dashboard**: Track delivery, open, and click rates by category

### Implementation Status by Feature

#### ✅ Fully Implemented (Code exists in repo)
- Push token registration & management (push_tokens table)
- Notification preferences system (notification_preferences table, user UI)
- Trial reminder notifications (trial-reminders edge function, Day 23/28/29)
- Referral notifications (175_referral_notifications_v2.sql)
- Message notifications (notify_new_message trigger)
- ID badge notifications (id-badge-submission-notification edge function)
- Payment failure notifications (stripe-webhook-subscriptions integration)
- Core notification services (notifications.ts, notificationPreferences.ts)
- NotificationSetup component (registration flow)
- NotificationPreferencesScreen (full user UI)
- Generic send-push-notification edge function

#### 🔶 Partially Implemented (Framework exists, needs completion)
- Badge notifications (user_notifications table exists, triggers need enhancement)
- Item status notifications (notify_seller_item_status_change exists)
- SP wallet notifications (schema exists, transaction triggers needed)
- Email notifications (sendgrid config exists in admin_config, templates needed)

#### ⚠️ Not Yet Implemented (Defined in MODULE-14 but no code)
- SP event notifications (earned/spent/low balance/frozen wallet)
- Trade flow notifications (request/accept/reject/complete/cancel)
- Notification center screen (in-app notification history UI)
- Deep linking infrastructure (comprehensive navigation from notifications)
- Email templates (payment failure, trial expiring, cancellation)
- Notification analytics tracking (delivery/open/click rates)
- Rate limiting enforcement (10 notifications/hour per user)
- Quiet hours enforcement (push notification time filtering)
- Notification deduplication (5-minute window)

### Cross-Module Integration
- **MODULE-11 (Subscriptions)**: Trial expiration reminders ✅, payment notifications ✅
- **MODULE-09 (Swap Points)**: SP earning/spending notifications ⚠️, wallet status alerts ⚠️
- **MODULE-08 (Badges)**: Badge award celebrations 🔶, milestone approaching alerts ⚠️
- **MODULE-06 (Trade Flow)**: Trade lifecycle notifications ⚠️
- **MODULE-03 (Authentication)**: User preferences initialized on signup ✅
- **MODULE-07 (Messaging)**: New message notifications ✅

### Privacy & Compliance
- User consent required for push notifications ✅
- Per-category opt-in/opt-out controls ✅
- Quiet hours configurable (default 10pm-8am) 🔶 (schema exists, enforcement needed)
- Critical notifications (payment failures) always sent 🔶 (logic exists, needs testing)
- No PII in notification bodies ✅

### Performance Considerations
- Rate limiting: 10 push notifications per user per hour ⚠️ (defined but not implemented)
- Deduplication: 5-minute window for identical notifications ⚠️ (defined but not implemented)
- Batch processing: Edge function handles notifications ✅ (trial-reminders implemented)
- Real-time subscriptions: Instant in-app notification delivery 🔶 (framework exists)
- Efficient queries: Indexed by user_id, read_at, created_at ✅ (indexes exist)

### Recommended Implementation Order
1. **High Priority (Complete Core Flows)**:
   - NOTIF-V2-007 (Trade notifications) - Critical for user engagement
   - NOTIF-V2-003 (SP events) - Needed for SP engagement loop
   - NOTIF-V2-006 (Notification center screen) - Core UX feature

2. **Medium Priority (Enhance Experience)**:
   - NOTIF-V2-008 (Deep linking) - Improves notification utility
   - NOTIF-V2-009 (Email notifications) - Retention & revenue protection
   - NOTIF-V2-004 (Badge notifications) - Gamification enhancement

3. **Lower Priority (Optimization)**:
   - NOTIF-V2-005 (Rate limiting & quiet hours enforcement) - Polish
   - NOTIF-V2-010 (Analytics) - Measurement & iteration

### Next Steps for Development Team
1. **Immediate**: Implement NOTIF-V2-003 (SP notifications) and NOTIF-V2-007 (Trade notifications) to complete core user journeys
2. **Short-term**: Build NOTIF-V2-006 (Notification center screen) as primary notification UI
3. **Mid-term**: Add NOTIF-V2-008 (Deep linking) and NOTIF-V2-009 (Email templates)
4. **Long-term**: Implement NOTIF-V2-010 (Analytics) for data-driven optimization

### Physical Device Testing Requirements
⚠️ **CRITICAL**: All notification features MUST be tested on a physical Google Pixel device (or equivalent Android device) before deployment. Push notifications do not work on emulators, and notification system integration can only be verified on real hardware.

**Mandatory Testing:**
- Push notification delivery in all app states (foreground, background, killed)
- Deep linking navigation from notifications
- Notification channels in Android Settings
- Quiet hours enforcement
- Rate limiting behavior
- Badge count updates
- Notification grouping/stacking

Refer to "PHYSICAL DEVICE TESTING SETUP (GOOGLE PIXEL)" section above for complete setup instructions.

---

### Testing Gaps to Address
- Comprehensive E2E testing for all notification triggers
- Deep link navigation testing from all app states
- Email template rendering across email clients
- Rate limiting and quiet hours enforcement
- Real-time notification delivery performance
- Multi-device push token management


# App Code: Push Notification Implementation

This file shows you the **exact code** you need to add to your React Native app to make push notifications work.

---

## File 1: Notification Service

**Path:** `p2p-kids-marketplace/src/services/notifications.ts`

```typescript
/**
 * Push Notifications Service
 * Handles push token registration and notification event listeners
 * 
 * Usage:
 *  - Call initializePushNotifications(userId) after user logs in
 *  - Call cleanupPushNotifications(userId) on logout
 */

import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';

// ============================================================================
// Setup: Configure how notifications are displayed
// ============================================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,     // Show banner/alert
    shouldPlaySound: true,      // Play sound
    shouldSetBadge: true,       // Update app badge count
  }),
});

// ============================================================================
// Initialize Push Notifications
// ============================================================================

/**
 * Initialize push notifications for a user
 * 
 * This function:
 * 1. Requests notification permission
 * 2. Gets the Expo push token
 * 3. Saves token to Supabase database
 * 4. Sets up notification listeners
 * 
 * @param userId - The authenticated user's ID
 * @returns Subscription to notification events
 * 
 * @example
 * // In LoginScreen or AuthContext after successful login:
 * const user = await supabase.auth.getUser();
 * await initializePushNotifications(user.data.user.id);
 */
export async function initializePushNotifications(userId: string) {
  try {
    console.log('[Notifications] 📱 Initializing for user:', userId);

    // STEP 1: Request permission
    console.log('[Notifications] 📢 Requesting notification permission...');
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('[Notifications] ℹ️  Permission not granted yet, requesting...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      
      if (newStatus !== 'granted') {
        console.warn('[Notifications] ⚠️  Permission denied by user');
        // Still save the user ID so we know they rejected, for later retry
        return;
      }
    }
    
    console.log('[Notifications] ✅ Permission granted');

    // STEP 2: Get push token
    console.log('[Notifications] 🔑 Getting push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    
    console.log('[Notifications] ✅ Expo Push Token registered:', pushToken);
    console.log('[Notifications] 📍 Token starts with:', pushToken.substring(0, 30) + '...');

    // STEP 3: Save token to database
    console.log('[Notifications] 💾 Saving token to database...');
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token: pushToken,
          device_type: 'expo',
          device_name: 'simulator', // Can be 'physical' or 'simulator' for analytics
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select();

    if (error) {
      console.error('[Notifications] ❌ Database error:', error);
      // Don't throw - notifications are important but not critical
      return;
    }

    console.log('[Notifications] ✅ Token saved to database');
    if (data && data.length > 0) {
      console.log('[Notifications] 📊 Database record:', data[0]);
    }

    // STEP 4: Set up notification listener
    console.log('[Notifications] 🎧 Setting up notification listener...');
    const subscription = Notifications.addNotificationResponseListener((response) => {
      console.log('[Notifications] 🔔 Notification response received:');
      console.log('[Notifications]   - Title:', response.notification.request.content.title);
      console.log('[Notifications]   - Body:', response.notification.request.content.body);
      console.log('[Notifications]   - Data:', response.notification.request.content.data);
      
      // TODO: Deep linking logic
      // Example:
      // const tradeId = response.notification.request.content.data.trade_id;
      // if (tradeId) {
      //   navigation.navigate('TradeDetail', { tradeId });
      // }
    });

    console.log('[Notifications] ✅ Initialization complete!');
    return subscription;

  } catch (error) {
    console.error('[Notifications] ❌ Initialization failed:', error);
    // Don't throw - allow app to continue
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up push notifications on logout
 * 
 * @param userId - The user logging out
 */
export async function cleanupPushNotifications(userId: string) {
  try {
    console.log('[Notifications] 🧹 Cleaning up for user:', userId);
    
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[Notifications] ❌ Cleanup error:', error);
    } else {
      console.log('[Notifications] ✅ Cleaned up');
    }
  } catch (error) {
    console.error('[Notifications] ❌ Cleanup failed:', error);
  }
}

// ============================================================================
// Debugging Helpers
// ============================================================================

/**
 * Get current push token for debugging
 * 
 * @returns Current Expo push token or null
 */
export async function getCurrentPushToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (error) {
    console.error('[Notifications] Error getting token:', error);
    return null;
  }
}

/**
 * Check if user has notification permission
 * 
 * @returns true if permission granted
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Verify token is saved in database
 * 
 * @param userId - User to check
 * @returns Token data if found
 */
export async function getStoredToken(userId: string) {
  try {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('[Notifications] Error fetching token:', error);
    return null;
  }
}
```

---

## File 2: Integration in AuthContext

**Path:** `p2p-kids-marketplace/src/contexts/AuthContext.tsx`

Add this to your existing AuthContext (in the relevant sections):

```typescript
// Inside your AuthContext component

import { initializePushNotifications, cleanupPushNotifications } from '../services/notifications';

// ... existing code ...

export function AuthContext() {
  // ... existing state ...

  // ============================================================================
  // Login Handler
  // ============================================================================
  
  async function handleLogin(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (userId) {
        // NEW: Initialize push notifications after successful login
        console.log('[Auth] 📱 Initializing notifications...');
        await initializePushNotifications(userId);
        console.log('[Auth] ✅ Notifications initialized');
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      return { success: false, error };
    }
  }

  // ============================================================================
  // Signup Handler
  // ============================================================================

  async function handleSignup(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (userId) {
        // NEW: Initialize push notifications after successful signup
        console.log('[Auth] 📱 Initializing notifications...');
        await initializePushNotifications(userId);
        console.log('[Auth] ✅ Notifications initialized');
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('[Auth] Signup failed:', error);
      return { success: false, error };
    }
  }

  // ============================================================================
  // Logout Handler
  // ============================================================================

  async function handleLogout() {
    try {
      const userId = user?.id;
      if (userId) {
        // NEW: Clean up push notifications
        console.log('[Auth] 🧹 Cleaning up notifications...');
        await cleanupPushNotifications(userId);
        console.log('[Auth] ✅ Notifications cleaned up');
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      return { success: true };
    } catch (error) {
      console.error('[Auth] Logout failed:', error);
      return { success: false, error };
    }
  }

  // ============================================================================
  // Session Restore (when app opens)
  // ============================================================================

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;

        if (userId) {
          setUser(data.session?.user || null);
          
          // NEW: Restore notifications
          console.log('[Auth] 📱 Restoring notifications...');
          await initializePushNotifications(userId);
          console.log('[Auth] ✅ Notifications restored');
        }
      } catch (error) {
        console.error('[Auth] Session restore error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ... rest of your context ...
}
```

---

## File 3: If You're Using a LoginScreen Instead

**Path:** `p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx`

```typescript
import { initializePushNotifications } from '../../services/notifications';

export function LoginScreen() {
  // ... existing state ...

  async function handleLogin() {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // NEW: Initialize notifications
      const userId = data.user?.id;
      if (userId) {
        console.log('[LoginScreen] 📱 Initializing notifications...');
        await initializePushNotifications(userId);
        console.log('[LoginScreen] ✅ Notifications ready');
      }

      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });

    } catch (error) {
      console.error('[LoginScreen] Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  // ... rest of component ...
}
```

---

## How to Verify It's Working

### Step 1: Add Logging

You should see these console logs when the app starts:

```
✅ [Notifications] 📱 Initializing for user: abc-def-123
✅ [Notifications] 📢 Requesting notification permission...
✅ [Notifications] ✅ Permission granted
✅ [Notifications] 🔑 Getting push token...
✅ [Notifications] ✅ Expo Push Token registered: ExponentPushToken[xyz...]
✅ [Notifications] 💾 Saving token to database...
✅ [Notifications] ✅ Token saved to database
✅ [Notifications] 🎧 Setting up notification listener...
✅ [Notifications] ✅ Initialization complete!
```

### Step 2: Check Database

```sql
-- Should return one row
SELECT user_id, token, device_type, updated_at 
FROM push_tokens 
WHERE user_id = '<USER_ID>';

-- Expected output:
-- user_id | token | device_type | updated_at
-- abc-123 | ExponentPushToken[...] | expo | 2024-01-15 10:30:45
```

### Step 3: Test Push Notification

```sql
-- Insert a test message
INSERT INTO messages (
  id, trade_id, sender_id, content, created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM trades LIMIT 1),
  '<SENDER_USER_ID>',
  'Test notification',
  NOW()
);

-- Check Edge Function logs
-- Supabase Dashboard → Edge Functions → send-push-notification → Recent Invocations
```

---

## Debugging Checklist

If notifications aren't working, check in this order:

- [ ] 1. Does console show "Expo Push Token registered"?
  - No? → Check for permission errors in console
  
- [ ] 2. Is token in `push_tokens` table?
  - No? → Check Supabase connection
  
- [ ] 3. Do Edge Function logs show invocations?
  - No? → Check if cron job is running
  - Check migration 084 was applied

- [ ] 4. Is the notification listener set up?
  - Check console for "[Notifications] 🎧 Setting up notification listener..."

- [ ] 5. (iOS) Do you see notification in Notification Center?
  - Swipe down from top of simulator
  - Tap to open app

- [ ] 6. (Android) Does notification appear in status bar?
  - Top of emulator screen
  - Tap to open app

---

## Common Errors & Fixes

### Error: "Permission denied"
```
❌ [Notifications] ⚠️  Permission denied by user

Fix: Xcode → product → Scheme → Edit Scheme → Run → Permissions
     Enable "User Notifications"
     Then reinstall app on simulator
```

### Error: "Supabase connection error"
```
❌ [Notifications] ❌ Database error: 403 Forbidden

Fix: Check Supabase anon key is correct
     Check RLS policies allow insert to push_tokens
```

### Error: "Token not found" in Edge Function logs
```
❌ Edge Function error: FCM Token not found

Fix: Make sure push_tokens table has the token
     Run: SELECT * FROM push_tokens WHERE user_id = '...'
     If empty, notifications not initialized yet
```

---

## Code Summary

You need to add:

1. **File 1:** New service file `src/services/notifications.ts` (~200 lines)
2. **File 2:** Import and call in AuthContext (5 lines per function)
3. **File 3:** OR import and call in LoginScreen (5 lines)

**Total new code:** ~210 lines

**Integration effort:** ~10 minutes

---

Good luck! 🚀

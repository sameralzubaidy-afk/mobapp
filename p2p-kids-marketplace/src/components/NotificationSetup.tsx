// File: p2p-kids-marketplace/src/components/NotificationSetup.tsx
// Component to enable push notifications for the user

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { supabase } from '@/config/supabase';
import { colors } from '@/theme/colors';
// FIX-Task-66 item 5 (2026-09-18): the screen inherited `headerShown: false` with no
// headerLeft, so it had NO visible back affordance (Android hardware BACK only).
// ScreenLayout renders the canonical detail header (44px back button +
// `testID="back-button"`) used by every other detail screen.
import ScreenLayout from '@/components/ScreenLayout';
// ScreenLayout deliberately excludes the BOTTOM safe-area edge (the floating tab pill
// normally overlays content), so this screen applies it to its pinned button bar
// instead — note the pill is hidden on this route.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import {
  registerForPushNotifications,
  savePushToken,
  createNotificationObserver,
  sendLocalNotification,
} from '@/services/notifications';
import type { PushRegistrationFailureReason } from '@/services/notifications';

interface NotificationSetupProps {
  onComplete?: () => void;
  isOptional?: boolean;
  /** Injected by the navigator; used as the completion fallback. */
  navigation?: { goBack?: () => void };
  /** Deep-link params — `notification-setup?isOptional=1` drives the optional variant. */
  route?: { params?: { isOptional?: string | boolean } };
}

/**
 * FIX-Task-65 item 3 — one cause-specific message per registration-failure reason.
 *
 * Before: a single iOS string ("Make sure you granted permissions") was shown for
 * four unrelated causes, so a simulator / Expo Go run told the user to check
 * notification permissions — the wrong remedy.
 */
export const PUSH_FAILURE_COPY: Record<PushRegistrationFailureReason, string> = {
  not_device: 'Push notifications need a physical device. This is a simulator/emulator.',
  expo_go: "Push notifications aren't available in Expo Go. Use a development build.",
  permission_denied:
    'Notifications are turned off for Pass It Up. Enable them in Settings › Notifications.',
  token_error: 'Could not obtain push notification token. Make sure you granted permissions.',
};

/**
 * Resolve the user-facing copy for a failure reason. Platform-aware so the Android
 * google-services hint (token_error) and the web message are preserved.
 */
export const getPushFailureCopy = (
  reason: PushRegistrationFailureReason,
  platform: string = Platform.OS
): string => {
  if (platform === 'web') {
    return 'Push notifications are not available on web';
  }
  if (reason === 'token_error' && platform === 'android') {
    return 'Could not obtain push token. Ensure this is a development build (not Expo Go), add google-services.json, and rebuild Android.';
  }
  return PUSH_FAILURE_COPY[reason];
};

export const NotificationSetup: React.FC<NotificationSetupProps> = ({
  onComplete,
  isOptional = false,
  navigation,
  route,
}) => {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<PushRegistrationFailureReason | null>(null);

  // FIX-Task-65: `isOptional` may come as a prop (legacy callers) or as the deep-link
  // param `notification-setup?isOptional=1`. The route renders this screen with no
  // props, so the "Maybe Later" branch was previously unreachable/dead UI.
  const optional =
    isOptional || route?.params?.isOptional === '1' || route?.params?.isOptional === true;
  const complete = onComplete ?? (() => navigation?.goBack?.());

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser ? { id: authUser.id } : null);
    };

    getCurrentUser();
  }, []);

  // Set up notification listeners when component mounts
  useEffect(() => {
    const cleanup = createNotificationObserver();
    return cleanup;
  }, []);

  const handleEnableNotifications = async () => {
    if (!user) {
      setStatus('error');
      setErrorMessage('User not authenticated');
      return;
    }

    setLoading(true);
    setStatus('requesting');
    setErrorMessage(null);
    setFailureReason(null);

    try {
      // Step 1: Request permissions and get push token.
      // FIX-Task-65 item 3: the service reports WHICH cause failed so the screen
      // stops blaming permissions for a simulator / Expo Go run.
      const registration = await registerForPushNotifications();

      if (!registration.ok) {
        setStatus('error');
        setFailureReason(registration.reason);
        setErrorMessage(getPushFailureCopy(registration.reason));
        setLoading(false);
        return;
      }

      const token = registration.token;

      // Step 2: Save token to database
      const result = await savePushToken(user.id, token);

      if (result.success) {
        setStatus('success');
        setErrorMessage(null);

        // Send a test notification
        await sendLocalNotification(
          'Notifications Enabled',
          'You will now receive real-time alerts for messages, trades, and more!',
          { type: 'test' }
        );

        // Call completion callback if provided
        if (onComplete) {
          setTimeout(onComplete, 1500);
        }
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to save notification token');
      }
    } catch (err) {
      const error = err as Error;
      setStatus('error');
      setErrorMessage(`Error: ${error.message}`);
      console.warn('⚠️ Notification setup error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // FIX-Task-65 item 8: when the failure cause is a denied OS permission, give the
  // user a one-tap route into this app's settings instead of a manual hunt.
  const handleOpenSettings = () => {
    Linking.openSettings().catch((err: Error) => {
      console.warn('[NotificationSetup] Unable to open settings:', err.message);
    });
  };

  const insets = useSafeAreaInsets();

  return (
    // FIX-Task-66 item 5: header title is "Notifications" (not "Enable
    // Notifications") so it does not duplicate the primary CTA's label verbatim.
    <ScreenLayout variant="detail" title="Notifications">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🔔 Stay Connected</Text>
          <Text style={styles.subtitle}>Enable push notifications to stay updated</Text>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>You'll receive alerts for:</Text>
          <BenefitItem icon="💬" text="New messages from buyers" />
          <BenefitItem icon="🤝" text="Trade requests on your items" />
          <BenefitItem icon="📦" text="Item updates and restocks" />
          <BenefitItem icon="⭐" text="Reviews and feedback" />
          <BenefitItem icon="🎁" text="Swap Points updates" />
        </View>

        {/* Status Display */}
        {status === 'requesting' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size={32} color={colors.success[500]} />
            <Text style={styles.loadingText}>Setting up notifications...</Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.successSection}>
            <Text style={styles.successText}>✅ Notifications enabled!</Text>
            <Text style={styles.successSubtext}>You're all set to receive alerts</Text>
          </View>
        )}

        {status === 'error' && errorMessage && (
          <View style={styles.errorSection} testID="notification-error-section">
            <Text style={styles.errorText} testID="notification-error-message">
              ⚠️ {errorMessage}
            </Text>
            {!optional && (
              <Text style={styles.errorSubtext}>Please try again or contact support</Text>
            )}
            {failureReason === 'permission_denied' && (
              <Button
                variant="secondary"
                size="medium"
                testID="notification-open-settings-button"
                accessibilityLabel="Open Settings"
                style={styles.openSettingsButton}
                onPress={handleOpenSettings}
              >
                Open Settings
              </Button>
            )}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Privacy & Permissions</Text>
          <Text style={styles.infoText}>
            • We never share your device information{'\n'}• You can disable notifications anytime in
            settings{'\n'}• Notifications are stored securely in our database
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {status !== 'success' && (
          <Button
            variant="primary"
            size="large"
            testID="notification-enable-button"
            accessibilityLabel="Enable Notifications"
            onPress={handleEnableNotifications}
            disabled={loading}
            loading={loading}
          >
            Enable Notifications
          </Button>
        )}

        {optional && status !== 'success' && (
          <Button
            variant="secondary"
            size="large"
            testID="notification-maybe-later-button"
            accessibilityLabel="Maybe Later"
            onPress={complete}
            disabled={loading}
          >
            Maybe Later
          </Button>
        )}

        {status === 'success' && (
          <Button
            variant="primary"
            size="large"
            testID="notification-continue-button"
            accessibilityLabel="Continue"
            onPress={complete}
          >
            Continue
          </Button>
        )}
      </View>
    </ScreenLayout>
  );
};

interface BenefitItemProps {
  icon: string;
  text: string;
}

const BenefitItem: React.FC<BenefitItemProps> = ({ icon, text }) => (
  <View style={styles.benefitItem}>
    <Text style={styles.benefitIcon}>{icon}</Text>
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  content: {
    // FIX-Task-65 item 9: let the content container claim the leftover height so the
    // Privacy box (marginTop:'auto') can sit against the pinned CTA.
    flexGrow: 1,
    padding: 20,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.neutral[900],
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[700],
  },
  benefitsSection: {
    marginBottom: 30,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.neutral[900],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 0,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: colors.neutral[700],
    flex: 1,
  },
  loadingSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.neutral[700],
  },
  successSection: {
    backgroundColor: colors.success[100],
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success[500],
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 14,
    color: colors.success[500],
  },
  errorSection: {
    backgroundColor: colors.error[100],
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: colors.error[700],
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 12,
    color: colors.error[700],
  },
  openSettingsButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  infoBox: {
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    // FIX-Task-65 item 9: absorb the leftover space ABOVE the Privacy box so it anchors
    // to the pinned CTA instead of leaving ~300pt of void between the two. Auto margins
    // collapse to 0 when the content is taller than the viewport, so this stays scrollable.
    marginTop: 'auto',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral[700],
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    padding: 16,
    gap: 12,
  },
});

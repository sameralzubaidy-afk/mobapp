// File: p2p-kids-marketplace/src/screens/profile/SettingsScreen.tsx
// MODULE-14: Settings hub for user preferences

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendTestPushNotification } from '../../services/pushDelivery';
import { useAuth } from '../../hooks/useAuth';

export default function SettingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [testingPush, setTestingPush] = useState(false);

  const handleTestPushNotification = async () => {
    const authUserId = user?.user_id || user?.id;

    if (!authUserId) {
      Alert.alert('Error', 'You must be logged in to test push notifications');
      return;
    }

    setTestingPush(true);
    try {
      const result = await sendTestPushNotification(authUserId);

      if (result.success && result.sent) {
        Alert.alert(
          'Test Notification Sent ✅',
          'Check your device for the push notification. It should arrive within a few seconds.',
          [{ text: 'OK' }]
        );
      } else if (result.rateLimited) {
        Alert.alert(
          'Rate Limited ⏱️',
          'You have sent 10 notifications in the last hour. Please wait and try again later.',
          [{ text: 'OK' }]
        );
      } else if (result.inQuietHours) {
        Alert.alert(
          'Quiet Hours 🌙',
          'You are currently in quiet hours. Push notifications are deferred during this time.',
          [{ text: 'OK' }]
        );
      } else if (result.error) {
        Alert.alert('Send Failed ❌', `Failed to send test notification: ${result.error}`, [
          { text: 'OK' },
        ]);
      } else {
        Alert.alert(
          'Notification Queued 📬',
          'The notification was queued but not sent immediately. This may happen if quiet hours or rate limits apply.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[SettingsScreen] Test push notification error:', error);
      Alert.alert('Error', 'An unexpected error occurred while sending the test notification.', [
        { text: 'OK' },
      ]);
    } finally {
      setTestingPush(false);
    }
  };

  const settingsOptions = [
    {
      id: 'help',
      title: 'Help → How Trading Works',
      subtitle: 'Learn about Swap Points, trading, and safety',
      icon: 'help-circle',
      onPress: () => navigation.navigate('Help'),
      testID: 'settings-help-button',
    },
    {
      id: 'enable-notifications',
      title: 'Enable Push Notifications',
      subtitle: 'Register to receive real-time alerts',
      icon: 'notifications',
      onPress: () => navigation.navigate('NotificationSetup'),
      testID: 'settings-enable-notifications-button',
    },
    {
      id: 'test-push-notification',
      title: 'Test Push Notification',
      subtitle: 'Send a test push notification (NOTIF-V2-005)',
      icon: 'send',
      onPress: handleTestPushNotification,
      testID: 'settings-test-push-notification-button',
      loading: testingPush,
    },
    {
      id: 'notifications',
      title: 'Notification Preferences',
      subtitle: 'Manage push, in-app, and email alerts',
      icon: 'notifications-outline',
      onPress: () => navigation.navigate('NotificationPreferences'),
    },
    {
      id: 'linked-accounts',
      title: 'Linked Accounts',
      subtitle: 'Manage social login connections',
      icon: 'link-outline',
      onPress: () => navigation.navigate('LinkedAccounts'),
      testID: 'settings-linked-accounts-button',
    },
    {
      id: 'terms',
      title: 'Terms of Service',
      subtitle: 'View our terms and conditions',
      icon: 'document-text-outline',
      onPress: () => navigation.navigate('TermsOfService'),
      testID: 'settings-tos-button',
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      subtitle: 'View our privacy policy',
      icon: 'document-text-outline',
      onPress: () => navigation.navigate('PrivacyPolicy'),
      testID: 'settings-privacy-policy-button',
    },
    {
      id: 'liability-disclaimer',
      title: 'Liability Disclaimer',
      subtitle: 'View our liability disclaimer',
      icon: 'shield-outline',
      onPress: () => navigation.navigate('LiabilityDisclaimer'),
      testID: 'settings-liability-disclaimer-button',
    },
    // Future settings can be added here
    {
      id: 'privacy',
      title: 'Privacy & Security',
      subtitle: 'Manage your data and account security',
      icon: 'shield-checkmark-outline',
      onPress: () => {
        /* TODO */
      },
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="settings-back-button"
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {settingsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionItem}
              onPress={option.onPress as any}
              testID={option.testID}
              disabled={(option as any).loading}
            >
              <View style={styles.optionIconContainer}>
                {(option as any).loading ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : (
                  <Ionicons name={option.icon as any} size={24} color="#3B82F6" />
                )}
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              {!(option as any).loading && (
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});

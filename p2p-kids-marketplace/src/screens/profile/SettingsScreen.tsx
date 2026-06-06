// File: p2p-kids-marketplace/src/screens/profile/SettingsScreen.tsx
// MODULE-14: Settings hub for user preferences
// MODULE-15.1 FLOW-25: Restyled — Phosphor Icons, section headers, grouped rows

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Lock,
  FileText,
  Shield,
  SignOut,
  Trash,
  CaretRight,
  BellSimple,
  BellSimpleSlash,
  PaperPlaneTilt,
  Link,
  Question,
  CreditCard,
} from 'phosphor-react-native';
import { sendTestPushNotification } from '../../services/pushDelivery';
import { useAuth } from '../../hooks/useAuth';
import ScreenLayout from '@/components/ScreenLayout';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SettingsRow {
  id: string;
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  loading?: boolean;
  testID?: string;
}

interface SettingsSection {
  title: string;
  data: SettingsRow[];
}

export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [testingPush, setTestingPush] = useState(false);

  // ── handlers ────────────────────────────────────────────────────────────────
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
        Alert.alert('Test Notification Sent', 'Check your device for the push notification.');
      } else if (result.rateLimited) {
        Alert.alert('Rate Limited', 'You have reached 10 notifications in the last hour.');
      } else if (result.inQuietHours) {
        Alert.alert('Quiet Hours', 'Push notifications are deferred during quiet hours.');
      } else if (result.error) {
        Alert.alert('Send Failed', `Failed to send test notification: ${result.error}`);
      } else {
        Alert.alert('Notification Queued', 'The notification was queued for delivery.');
      }
    } catch (error) {
      console.error('[SettingsScreen] Test push notification error:', error);
      Alert.alert('Error', 'An unexpected error occurred while sending the test notification.');
    } finally {
      setTestingPush(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            console.error('[SettingsScreen] Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  // ── section data ─────────────────────────────────────────────────────────────
  const sections: SettingsSection[] = [
    {
      title: 'Notifications',
      data: [
        {
          id: 'enable-notifications',
          title: 'Enable Push Notifications',
          icon: <BellSimple size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('NotificationSetup'),
          testID: 'settings-enable-notifications-button',
        },
        {
          id: 'notifications',
          title: 'Notification Preferences',
          icon: <BellSimpleSlash size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('NotificationPreferences'),
          testID: 'settings-notification-preferences-button',
        },
        {
          id: 'test-push-notification',
          title: 'Test Push Notification',
          icon: testingPush
            ? null
            : <PaperPlaneTilt size={20} color="#5DBB8E" weight="regular" />,
          onPress: handleTestPushNotification,
          testID: 'settings-test-push-notification-button',
          loading: testingPush,
        },
      ],
    },
    {
      title: 'Account',
      data: [
        {
          id: 'payment-methods',
          title: 'Manage Payment Methods',
          icon: <CreditCard size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('PaymentMethods'),
          testID: 'settings-payment-methods-button',
        },
        {
          id: 'linked-accounts',
          title: 'Linked Accounts',
          icon: <Link size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('LinkedAccounts'),
          testID: 'settings-linked-accounts-button',
        },
        {
          id: 'privacy-security',
          title: 'Privacy & Security',
          icon: <Lock size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => {
            /* TODO(UX): Link to Privacy & Security screen when implemented */
          },
          testID: 'settings-privacy-security-button',
        },
        {
          id: 'help',
          title: 'Help & Support',
          icon: <Question size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('HelpSupport'),
          testID: 'settings-help-support-button',
        },
      ],
    },
    {
      title: 'Legal',
      data: [
        {
          id: 'terms',
          title: 'Terms of Service',
          icon: <FileText size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('TermsOfService'),
          testID: 'settings-tos-button',
        },
        {
          id: 'privacy-policy',
          title: 'Privacy Policy',
          icon: <FileText size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('PrivacyPolicy'),
          testID: 'settings-privacy-policy-button',
        },
        {
          id: 'liability-disclaimer',
          title: 'Liability Disclaimer',
          icon: <Shield size={20} color="#5DBB8E" weight="regular" />,
          onPress: () => navigation.navigate('LiabilityDisclaimer'),
          testID: 'settings-liability-disclaimer-button',
        },
      ],
    },
    {
      title: 'Danger Zone',
      data: [
        {
          id: 'sign-out',
          title: 'Sign Out',
          icon: <SignOut size={20} color="#E85D75" weight="regular" />,
          onPress: handleSignOut,
          destructive: true,
          testID: 'settings-sign-out-button',
        },
        {
          id: 'delete-account',
          title: 'Delete Account',
          icon: <Trash size={20} color="#E85D75" weight="regular" />,
          onPress: () => navigation.navigate('DeleteAccount'),
          destructive: true,
          testID: 'settings-delete-account-button',
        },
      ],
    },
  ];

  // ── render helpers ───────────────────────────────────────────────────────────
  const renderRow = (row: SettingsRow) => (
    <TouchableOpacity
      key={row.id}
      style={styles.settingsRow}
      onPress={row.isSwitch ? undefined : row.onPress}
      activeOpacity={row.isSwitch ? 1 : 0.7}
      disabled={row.loading}
      testID={row.testID}
      accessibilityRole={row.isSwitch ? 'none' : 'button'}
    >
      <View style={styles.rowIconWrap}>
        {row.loading ? (
          <ActivityIndicator size="small" color="#5DBB8E" />
        ) : (
          row.icon
        )}
      </View>
      <Text style={[styles.rowLabel, row.destructive && styles.rowLabelDestructive]}>
        {row.title}
      </Text>
      {row.isSwitch ? (
        <Switch
          value={row.switchValue}
          onValueChange={row.onSwitchChange}
          trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
          thumbColor="#FFFFFF"
          testID={row.testID ? `${row.testID}-switch` : undefined}
        />
      ) : (
        !row.loading && <CaretRight size={16} color="#999999" weight="regular" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenLayout variant="detail" title="Settings">

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        testID="settings-scroll"
      >
        {sections.map((section) => (
          <View key={section.title} testID={`settings-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.sectionGroup}>
              {section.data.map(renderRow)}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    letterSpacing: 0.5,
  },
  sectionGroup: {
    backgroundColor: '#FFFFFF',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  rowIconWrap: {
    width: 20,
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  rowLabelDestructive: {
    color: '#E85D75',
  },
});

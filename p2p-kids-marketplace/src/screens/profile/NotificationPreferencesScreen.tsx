// File: p2p-kids-marketplace/src/screens/profile/NotificationPreferencesScreen.tsx
// MODULE-14: User UI for managing notification preferences

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import {
  BellSimpleSlash,
  CreditCard,
  Gear,
  Info,
  Lightning,
  Medal,
  Moon,
  ShoppingCart,
} from 'phosphor-react-native';
import { LoadingSpinner } from '@/components/ui';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  NotificationPreference,
  NotificationCategory,
} from '@/services/notificationPreferences';
import ScreenLayout from '@/components/ScreenLayout';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  subscription: 'Subscription & Membership',
  sp_events: 'Swap Points Events',
  badges: 'Badges & Achievements',
  trades: 'Trades & Transactions',
  system: 'System Updates',
};

const CATEGORY_ORDER: Record<NotificationCategory, number> = {
  subscription: 1,
  sp_events: 2,
  badges: 3,
  trades: 4,
  system: 5,
};

const CATEGORY_ICON_META: Record<
  NotificationCategory,
  {
    Icon: React.ComponentType<any>;
    color: string;
    bg: string;
  }
> = {
  subscription: { Icon: CreditCard, color: '#4A7FBB', bg: '#E8F0FE' },
  sp_events: { Icon: Lightning, color: '#F59E0B', bg: '#FEF3C7' },
  badges: { Icon: Medal, color: '#F59E0B', bg: '#FEF3C7' },
  trades: { Icon: ShoppingCart, color: '#5DBB8E', bg: '#E8F5F0' },
  system: { Icon: Gear, color: '#6B6B6B', bg: '#EEEEEE' },
};

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: {
    elevation: 2,
  },
  default: {},
});

const toHHMM = (timeValue: string) => {
  if (!timeValue) {
    return '00:00';
  }

  const parts = timeValue.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }

  return timeValue;
};

const toHHMMSS = (timeValue: string) => {
  const trimmed = timeValue.trim();
  const validTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!validTimeRegex.test(trimmed)) {
    return null;
  }

  return `${trimmed}:00`;
};

export default function NotificationPreferencesScreen({ navigation: _navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [quietHoursStartInput, setQuietHoursStartInput] = useState('22:00');
  const [quietHoursEndInput, setQuietHoursEndInput] = useState('08:00');
  const [savingQuietHours, setSavingQuietHours] = useState(false);

  const subscriptionPreference = preferences.find((p) => p.category === 'subscription');
  const sortedPreferences = [...preferences].sort(
    (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
  );

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    const result = await getNotificationPreferences();
    if (result.success && result.preferences) {
      setPreferences(result.preferences);

      const subscription = result.preferences.find((p) => p.category === 'subscription');
      if (subscription) {
        setQuietHoursStartInput(toHHMM(subscription.quiet_hours_start));
        setQuietHoursEndInput(toHHMM(subscription.quiet_hours_end));
      }
    } else {
      Alert.alert('Error', result.error || 'Failed to load preferences');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (
    category: NotificationCategory,
    field: 'push_enabled' | 'in_app_enabled' | 'email_enabled',
    value: boolean
  ) => {
    const updateKey = `${category}-${field}`;
    setUpdating(updateKey);

    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) => (p.category === category ? { ...p, [field]: value } : p))
    );

    const result = await updateNotificationPreference(category, { [field]: value });

    if (!result.success) {
      // Revert on failure
      setPreferences((prev) =>
        prev.map((p) => (p.category === category ? { ...p, [field]: !value } : p))
      );
      Alert.alert('Error', result.error || 'Failed to update preference');
    }

    setUpdating(null);
  };

  const handleQuietHoursToggle = async (value: boolean) => {
    if (!subscriptionPreference) {
      Alert.alert('Error', 'Subscription notification preferences are not loaded yet.');
      return;
    }

    const updateKey = 'subscription-quiet_hours_enabled';
    setUpdating(updateKey);

    setPreferences((prev) =>
      prev.map((p) => (p.category === 'subscription' ? { ...p, quiet_hours_enabled: value } : p))
    );

    const result = await updateNotificationPreference('subscription', {
      quiet_hours_enabled: value,
    });

    if (!result.success) {
      setPreferences((prev) =>
        prev.map((p) => (p.category === 'subscription' ? { ...p, quiet_hours_enabled: !value } : p))
      );
      Alert.alert('Error', result.error || 'Failed to update quiet hours setting');
    }

    setUpdating(null);
  };

  const handleSaveQuietHours = async () => {
    if (!subscriptionPreference) {
      Alert.alert('Error', 'Subscription notification preferences are not loaded yet.');
      return;
    }

    const startValue = toHHMMSS(quietHoursStartInput);
    const endValue = toHHMMSS(quietHoursEndInput);

    if (!startValue || !endValue) {
      Alert.alert('Invalid time format', 'Please use 24-hour format: HH:MM (example: 22:00).');
      return;
    }

    setSavingQuietHours(true);

    const result = await updateNotificationPreference('subscription', {
      quiet_hours_start: startValue,
      quiet_hours_end: endValue,
    });

    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to save quiet hours');
      setSavingQuietHours(false);
      return;
    }

    setPreferences((prev) =>
      prev.map((p) =>
        p.category === 'subscription'
          ? {
              ...p,
              quiet_hours_start: startValue,
              quiet_hours_end: endValue,
            }
          : p
      )
    );

    Alert.alert('Saved', 'Quiet hours have been updated.');
    setSavingQuietHours(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Notification Preferences">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionDescription}>
            Choose how you want to be notified for different types of activity in the marketplace.
          </Text>

          {preferences.length === 0 ? (
            <View style={styles.emptyContainer}>
              <BellSimpleSlash size={44} color="#C4C4C4" weight="regular" />
              <Text style={styles.emptyTitle}>No preferences found</Text>
              <Text style={styles.emptyText}>
                We couldn't load your notification settings. Tap the button below to initialize
                them.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadPreferences}>
                <Text style={styles.retryButtonText}>Initialize Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedPreferences.map((pref) => {
              const iconMeta = CATEGORY_ICON_META[pref.category];
              const CategoryIcon = iconMeta.Icon;

              return (
                <View
                  key={pref.category}
                  testID={`category-section-${pref.category}`}
                  style={[styles.categoryCard, CARD_SHADOW]}
                >
                  <View style={styles.categoryHeader}>
                    <View style={[styles.categoryIconContainer, { backgroundColor: iconMeta.bg }]}>
                      <CategoryIcon size={20} color={iconMeta.color} weight="fill" />
                    </View>
                    <Text style={styles.categoryTitle}>{CATEGORY_LABELS[pref.category]}</Text>
                  </View>

                  <View style={styles.settingsList}>
                    <View style={styles.settingItem}>
                      <View style={styles.settingTextContainer}>
                        <Text style={styles.settingLabel}>Push Notifications</Text>
                        <Text style={styles.settingSublabel}>Receive alerts on your device</Text>
                      </View>
                      <Switch
                        testID={`toggle-${pref.category}-push`}
                        value={pref.push_enabled}
                        onValueChange={(val) => handleToggle(pref.category, 'push_enabled', val)}
                        disabled={updating !== null}
                        trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#E0E0E0"
                      />
                    </View>

                    <View style={styles.settingItem}>
                      <View style={styles.settingTextContainer}>
                        <Text style={styles.settingLabel}>In-App Notifications</Text>
                        <Text style={styles.settingSublabel}>Show badges inside the app</Text>
                      </View>
                      <Switch
                        testID={`toggle-${pref.category}-in_app`}
                        value={pref.in_app_enabled}
                        onValueChange={(val) => handleToggle(pref.category, 'in_app_enabled', val)}
                        disabled={updating !== null}
                        trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#E0E0E0"
                      />
                    </View>

                    <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                      <View style={styles.settingTextContainer}>
                        <Text style={styles.settingLabel}>Email Notifications</Text>
                        <Text style={styles.settingSublabel}>Send updates to your email</Text>
                      </View>
                      <Switch
                        testID={`toggle-${pref.category}-email`}
                        value={pref.email_enabled}
                        onValueChange={(val) => handleToggle(pref.category, 'email_enabled', val)}
                        disabled={updating !== null}
                        trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#E0E0E0"
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {subscriptionPreference && (
            <View style={[styles.quietHoursCard, CARD_SHADOW]} testID="quiet-hours-section">
              <View style={styles.quietHoursHeader}>
                <View style={[styles.categoryIconContainer, { backgroundColor: '#E8F5F0' }]}>
                  <Moon size={20} color="#5DBB8E" weight="fill" />
                </View>
                <Text style={styles.categoryTitle}>Quiet Hours</Text>
              </View>

              <View style={styles.settingsList}>
                <View style={styles.settingItem}>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
                    <Text style={styles.settingSublabel}>
                      Pause push notifications during selected hours
                    </Text>
                  </View>
                  <Switch
                    testID="toggle-quiet-hours-enabled"
                    value={subscriptionPreference.quiet_hours_enabled}
                    onValueChange={handleQuietHoursToggle}
                    disabled={updating !== null}
                    trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#E0E0E0"
                  />
                </View>

                {subscriptionPreference.quiet_hours_enabled ? (
                  <>
                    <View style={styles.timeRow}>
                      <View style={styles.timeInputBlock}>
                        <Text style={styles.timeLabel}>Start (HH:MM)</Text>
                        <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                          testID="quiet-hours-start-input"
                          style={styles.timeInput}
                          value={quietHoursStartInput}
                          onChangeText={setQuietHoursStartInput}
                          placeholder="22:00"
                          autoCapitalize="none"
                          keyboardType="numbers-and-punctuation"
                          editable={!savingQuietHours}
                        />
                      </View>

                      <View style={styles.timeInputBlock}>
                        <Text style={styles.timeLabel}>End (HH:MM)</Text>
                        <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                          testID="quiet-hours-end-input"
                          style={styles.timeInput}
                          value={quietHoursEndInput}
                          onChangeText={setQuietHoursEndInput}
                          placeholder="08:00"
                          autoCapitalize="none"
                          keyboardType="numbers-and-punctuation"
                          editable={!savingQuietHours}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      testID="quiet-hours-save-button"
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Quiet hours save button"
                      style={[styles.saveButton, savingQuietHours && styles.saveButtonDisabled]}
                      onPress={handleSaveQuietHours}
                      disabled={savingQuietHours}
                    >
                      <Text style={styles.saveButtonText}>
                        {savingQuietHours ? 'Saving...' : 'Save Quiet Hours'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.quietHoursDisabledHint} testID="quiet-hours-disabled-hint">
                    Enable Quiet Hours to configure start and end times.
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Info size={16} color="#E85D75" weight="fill" />
            <Text style={styles.footerText}>
              Critical system alerts and safety notifications cannot be disabled.
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B6B6B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 20,
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  quietHoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  quietHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F6F6F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F6F6F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  settingsList: {
    paddingHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  settingSublabel: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
    lineHeight: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  timeInputBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1A1A1A',
    backgroundColor: '#F0F0F0',
  },
  saveButton: {
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#5DBB8E',
  },
  saveButtonDisabled: {
    backgroundColor: '#A7D9C2',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  quietHoursDisabledHint: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    marginLeft: 8,
    lineHeight: 18,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#5DBB8E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

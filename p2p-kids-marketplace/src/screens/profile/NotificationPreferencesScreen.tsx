// File: p2p-kids-marketplace/src/screens/profile/NotificationPreferencesScreen.tsx
// MODULE-14: User UI for managing notification preferences

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getNotificationPreferences, 
  updateNotificationPreference,
  NotificationPreference,
  NotificationCategory 
} from '@/services/notificationPreferences';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  subscription: 'Subscription & Membership',
  sp_events: 'Swap Points Events',
  badges: 'Badges & Achievements',
  trades: 'Trades & Transactions',
  system: 'System Updates',
};

const CATEGORY_ICONS: Record<NotificationCategory, string> = {
  subscription: 'card-outline',
  sp_events: 'flash-outline',
  badges: 'ribbon-outline',
  trades: 'swap-horizontal-outline',
  system: 'settings-outline',
};

export default function NotificationPreferencesScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [quietHoursStartInput, setQuietHoursStartInput] = useState('22:00');
  const [quietHoursEndInput, setQuietHoursEndInput] = useState('08:00');
  const [savingQuietHours, setSavingQuietHours] = useState(false);

  const subscriptionPreference = preferences.find((p) => p.category === 'subscription');

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

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
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
  };

  const handleToggle = async (
    category: NotificationCategory, 
    field: 'push_enabled' | 'in_app_enabled' | 'email_enabled',
    value: boolean
  ) => {
    const updateKey = `${category}-${field}`;
    setUpdating(updateKey);

    // Optimistic update
    setPreferences(prev => prev.map(p => 
      p.category === category ? { ...p, [field]: value } : p
    ));

    const result = await updateNotificationPreference(category, { [field]: value });
    
    if (!result.success) {
      // Revert on failure
      setPreferences(prev => prev.map(p => 
        p.category === category ? { ...p, [field]: !value } : p
      ));
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
      prev.map((p) =>
        p.category === 'subscription' ? { ...p, quiet_hours_enabled: value } : p
      )
    );

    const result = await updateNotificationPreference('subscription', {
      quiet_hours_enabled: value,
    });

    if (!result.success) {
      setPreferences((prev) =>
        prev.map((p) =>
          p.category === 'subscription' ? { ...p, quiet_hours_enabled: !value } : p
        )
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
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            testID="back-button"
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Notification Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionDescription}>
            Choose how you want to be notified for different types of activity in the marketplace.
          </Text>

          {preferences.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No preferences found</Text>
              <Text style={styles.emptyText}>
                We couldn't load your notification settings. Tap the button below to initialize them.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadPreferences}>
                <Text style={styles.retryButtonText}>Initialize Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            preferences.map((pref) => (
              <View 
                key={pref.category} 
                testID={`category-section-${pref.category}`}
                style={styles.categoryCard}
              >
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryIconContainer}>
                    <Ionicons name={CATEGORY_ICONS[pref.category] as any} size={20} color="#3B82F6" />
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
                      trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                      thumbColor={pref.push_enabled ? '#3B82F6' : '#F9FAFB'}
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
                      trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                      thumbColor={pref.in_app_enabled ? '#3B82F6' : '#F9FAFB'}
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
                      trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                      thumbColor={pref.email_enabled ? '#3B82F6' : '#F9FAFB'}
                    />
                  </View>
                </View>
              </View>
            ))
          )}

          {subscriptionPreference && (
            <View style={styles.quietHoursCard} testID="quiet-hours-section">
              <View style={styles.quietHoursHeader}>
                <View style={styles.categoryIconContainer}>
                  <Ionicons name="moon-outline" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.categoryTitle}>Quiet Hours</Text>
              </View>

              <View style={styles.settingsList}>
                <View style={styles.settingItem}>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
                    <Text style={styles.settingSublabel}>Pause push notifications during selected hours</Text>
                  </View>
                  <Switch
                    testID="toggle-quiet-hours-enabled"
                    value={subscriptionPreference.quiet_hours_enabled}
                    onValueChange={handleQuietHoursToggle}
                    disabled={updating !== null}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={subscriptionPreference.quiet_hours_enabled ? '#3B82F6' : '#F9FAFB'}
                  />
                </View>

                {subscriptionPreference.quiet_hours_enabled ? (
                  <>
                    <View style={styles.timeRow}>
                      <View style={styles.timeInputBlock}>
                        <Text style={styles.timeLabel}>Start (HH:MM)</Text>
                        <TextInput
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
                        <TextInput
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
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
            <Text style={styles.footerText}>
              Critical system alerts and safety notifications cannot be disabled.
            </Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  quietHoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  quietHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
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
    borderBottomColor: '#F3F4F6',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  settingSublabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
    color: '#6B7280',
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  saveButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  quietHoursDisabledHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
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
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
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

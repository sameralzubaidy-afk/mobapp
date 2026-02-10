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

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    const result = await getNotificationPreferences();
    if (result.success && result.preferences) {
      setPreferences(result.preferences);
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
              <View key={pref.category} style={styles.categoryCard}>
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

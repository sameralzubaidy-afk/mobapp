/**
 * File: p2p-kids-marketplace/src/screens/admin/TrialConversionTestScreen.tsx
 * MODULE-11 TASK SUB-005: Trial Conversion Test Screen
 *
 * Admin/test screen for manually testing trial conversion logic
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  getTrialStatus,
  hasTrialExpired,
  triggerTrialConversion,
  TrialStatus,
} from '../../services/subscriptions/trialConversion';

export default function TrialConversionTestScreen() {
  const [loading, setLoading] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadTrialStatus();
  }, []);

  const loadTrialStatus = async () => {
    setLoading(true);
    try {
      const [status, expired] = await Promise.all([getTrialStatus(), hasTrialExpired()]);

      setTrialStatus(status);
      setIsExpired(expired);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('[TrialConversionTest] Error loading status:', error);
      Alert.alert('Error', 'Failed to load trial status');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerConversion = async () => {
    setLoading(true);
    try {
      const result = await triggerTrialConversion();

      if (result.success) {
        Alert.alert('Conversion Triggered', `Result: ${JSON.stringify(result.result, null, 2)}`, [
          { text: 'OK', onPress: () => loadTrialStatus() },
        ]);
      } else {
        Alert.alert('Conversion Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[TrialConversionTest] Error triggering conversion:', error);
      Alert.alert('Error', 'Failed to trigger conversion');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trial':
        return '#3B82F6'; // blue
      case 'active':
        return '#10B981'; // green
      case 'grace_period':
        return '#F59E0B'; // amber
      case 'free':
        return '#6B7280'; // gray
      default:
        return '#000000';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Trial Conversion Test</Text>
        <Text style={styles.subtitle}>MODULE-11 TASK SUB-005</Text>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      {!loading && trialStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Trial Status</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text style={[styles.value, { color: getStatusColor(trialStatus.status) }]}>
                {trialStatus.status.toUpperCase()}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Trial Ends At:</Text>
              <Text style={styles.value}>{formatDate(trialStatus.trial_ends_at)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Days Remaining:</Text>
              <Text style={styles.value}>
                {trialStatus.days_remaining !== null ? `${trialStatus.days_remaining} days` : 'N/A'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Has Payment Method:</Text>
              <Text style={[styles.value, trialStatus.has_payment_method && styles.success]}>
                {trialStatus.has_payment_method ? 'YES' : 'NO'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Can Convert:</Text>
              <Text style={[styles.value, trialStatus.can_convert && styles.success]}>
                {trialStatus.can_convert ? 'YES' : 'NO'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Is Expired:</Text>
              <Text style={[styles.value, isExpired && styles.error]}>
                {isExpired ? 'YES' : 'NO'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {!loading && !trialStatus && (
        <View style={styles.section}>
          <Text style={styles.noData}>No trial status data available</Text>
          <Text style={styles.noDataHint}>
            User may not be authenticated or may not have a subscription
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={loadTrialStatus}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Refresh Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleTriggerConversion}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Trigger Conversion</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>Test Instructions:</Text>
        <Text style={styles.infoText}>
          1. Ensure you're logged in with a test user{'\n'}
          2. User should have a trial subscription{'\n'}
          3. To test conversion: Add payment method in test mode{'\n'}
          4. To test downgrade: Remove payment method{'\n'}
          5. Click "Trigger Conversion" to manually process{'\n'}
          6. In production, this runs automatically via cron
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Last refreshed: {lastRefresh.toLocaleTimeString()}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  success: {
    color: '#10B981',
  },
  error: {
    color: '#EF4444',
  },
  noData: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 40,
  },
  noDataHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    marginBottom: 24,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#3B82F6',
  },
  buttonSecondary: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  info: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ScrollView } from 'react-native';
import { monitorMidTradeSubscriptionChanges } from '../../services/trade';

/**
 * File: p2p-kids-marketplace/src/screens/admin/AdminDashboardScreen.tsx
 * TASK TRADE-V2-007: Handling Mid-Trade Subscription Changes
 * 
 * Admin dashboard with manual verification tools.
 */
export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(false);

  const handleRunMonitoring = async () => {
    setLoading(true);
    try {
      const result = await monitorMidTradeSubscriptionChanges();
      if (result.success) {
        Alert.alert(
          'Monitoring Complete',
          `Successfully scanned trades. Flagged ${result.flagged_count || 0} trades with subscription status changes.`
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to run monitoring');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trade Monitoring (TASK TRADE-V2-007)</Text>
        <Text style={styles.description}>
          Scan all active trades to detect if a buyer's subscription status has changed since the trade was initiated.
          This will flag trades for review without retroactively changing fees.
        </Text>
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleRunMonitoring}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Run Mid-Trade Subscription Check</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Placeholder for other admin tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Status</Text>
        <View style={styles.statusRow}>
          <Text>Database:</Text>
          <Text style={styles.statusValue}>Connected</Text>
        </View>
        <View style={styles.statusRow}>
          <Text>Edge Functions:</Text>
          <Text style={styles.statusValue}>Online</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A0CFFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusValue: {
    color: 'green',
    fontWeight: '500',
  },
});

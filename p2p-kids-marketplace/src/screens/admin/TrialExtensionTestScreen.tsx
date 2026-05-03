/**
 * File: p2p-kids-marketplace/src/screens/admin/TrialExtensionTestScreen.tsx
 * Test screen for SUB-EXT-001: Trial Extension
 *
 * This screen allows manual testing of the trial extension feature.
 * Navigation: Admin → Trial Extension Test
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  extendTrial,
  getTrialExtensionStats,
  getTrialExtensionHistory,
} from '../../services/subscriptions/trialExtension';
import { useAuth } from '../../hooks/useAuth';

export default function TrialExtensionTestScreen() {
  const { user } = useAuth();
  const [referralUserId, setReferralUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    // Load stats
    const statsData = await getTrialExtensionStats(user.id);
    setStats(statsData);

    // Load history
    const historyData = await getTrialExtensionHistory(user.id);
    setHistory(historyData);
  };

  const handleExtendTrial = async () => {
    if (!user?.id || !referralUserId.trim()) {
      setResult({ error: 'Please enter a referral user ID' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const extensionResult = await extendTrial(user.id, referralUserId.trim());
      setResult(extensionResult);

      // Reload data
      await loadData();
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧪 Trial Extension Test</Text>

      {/* Current User Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current User</Text>
        <Text style={styles.text}>User ID: {user?.id || 'Not logged in'}</Text>
      </View>

      {/* Stats Card */}
      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Extension Stats</Text>
          <Text style={styles.text}>Extensions Used: {stats.extensions_used}</Text>
          <Text style={styles.text}>Extensions Remaining: {stats.extensions_remaining}</Text>
          <Text style={styles.text}>Max Extensions: {stats.max_extensions}</Text>
        </View>
      )}

      {/* Test Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test Trial Extension</Text>

        <Text style={styles.label}>Referral User ID:</Text>
        <TextInput
          style={styles.input}
          value={referralUserId}
          onChangeText={setReferralUserId}
          placeholder="Enter UUID of referred user"
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleExtendTrial}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Extend Trial</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Result Card */}
      {result && (
        <View style={[styles.card, result.success ? styles.successCard : styles.errorCard]}>
          <Text style={styles.cardTitle}>{result.success ? '✅ Success' : '❌ Error'}</Text>

          {result.success ? (
            <>
              <Text style={styles.text}>New Trial End: {result.new_trial_end}</Text>
              <Text style={styles.text}>Extensions Used: {result.extensions_used}</Text>
              <Text style={styles.text}>Extensions Remaining: {result.extensions_remaining}</Text>
              <Text style={styles.text}>Days Added: {result.days_added}</Text>
            </>
          ) : (
            <Text style={styles.errorText}>{result.error}</Text>
          )}
        </View>
      )}

      {/* History Card */}
      {history.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Extension History</Text>
          {history.map((event, index) => (
            <View key={event.id} style={styles.historyItem}>
              <Text style={styles.text}>
                #{index + 1} - {new Date(event.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.smallText}>Days Added: {event.metadata.days_added}</Text>
              <Text style={styles.smallText}>
                Extensions: {event.metadata.extensions_used} /
                {event.metadata.extensions_used + event.metadata.extensions_remaining}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Instructions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 Testing Instructions</Text>
        <Text style={styles.text}>
          1. Make sure you have an active trial subscription{'\n'}
          2. Enter a valid referral user ID (UUID){'\n'}
          3. Click "Extend Trial"{'\n'}
          4. Check that your trial end date extended by 7 days{'\n'}
          5. Repeat up to 3 times (max extensions){'\n'}
          6. 4th attempt should fail with "Maximum extensions reached"
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successCard: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
    borderWidth: 1,
  },
  errorCard: {
    backgroundColor: '#f8d7da',
    borderColor: '#dc3545',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
    fontWeight: '600',
  },
  text: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  smallText: {
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    marginBottom: 8,
  },
});

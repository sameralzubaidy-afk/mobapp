import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { monitorMidTradeSubscriptionChanges } from '../../services/trade';
import { Flag, CaretRight, Clock } from 'phosphor-react-native';
import BottomNavBar from '../../components/organisms/BottomNavBar';
// FIX-Task-29 item 7A3/7B: brand tokens + the shared button, so this screen has no
// hand-rolled blue primary and no literal hex left anywhere.
import { theme } from '@/theme';
import { Button } from '@/components/ui';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * File: p2p-kids-marketplace/src/screens/admin/AdminDashboardScreen.tsx
 * TASK TRADE-V2-007: Handling Mid-Trade Subscription Changes
 *
 * Admin dashboard with manual verification tools and moderation access.
 */
export default function AdminDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
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
    <View style={styles.fullContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Admin Dashboard</Text>

        {/* Review Moderation Card */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('ReviewModeration')}
        >
          <View style={styles.cardIconContainer}>
            <Flag size={28} color={theme.colors.error[500]} weight="regular" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Review Moderation</Text>
            <Text style={styles.cardDescription}>Review and moderate reported reviews</Text>
          </View>
          <CaretRight size={24} color={theme.colors.neutral[300]} weight="regular" />
        </TouchableOpacity>

        {/* Trial Conversion Test Card - MODULE-11 SUB-005 */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('TrialConversionTest')}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: theme.colors.secondary[100] }]}>
            <Clock size={28} color={theme.colors.secondary[500]} weight="regular" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Trial Conversion Test</Text>
            <Text style={styles.cardDescription}>
              Test trial expiration & conversion logic (SUB-005)
            </Text>
          </View>
          <CaretRight size={24} color={theme.colors.neutral[300]} weight="regular" />
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trade Monitoring (TASK TRADE-V2-007)</Text>
          <Text style={styles.description}>
            Scan all active trades to detect if a buyer's subscription status has changed since the
            trade was initiated. This will flag trades for review without retroactively changing
            fees.
          </Text>

          {/* FIX-Task-29 item 7A3: shared ui/Button (brand primary + its own disabled
              and pressed treatments) instead of a hand-rolled filled-blue control. */}
          <Button
            variant="primary"
            size="large"
            loading={loading}
            onPress={handleRunMonitoring}
            testID="admin-run-mid-trade-check"
          >
            Run Mid-Trade Subscription Check
          </Button>
          <Text style={styles.buttonCaption}>
            Flags trades for review only — it never changes fees retroactively.
          </Text>
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
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: theme.backgroundColors.page,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: theme.textColors.primary,
  },
  card: {
    backgroundColor: theme.backgroundColors.card,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.error[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: theme.textColors.secondary,
  },
  section: {
    backgroundColor: theme.backgroundColors.card,
    padding: 20,
    borderRadius: theme.borderRadius.medium,
    marginBottom: 20,
    shadowColor: theme.colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: theme.textColors.primary,
  },
  description: {
    fontSize: 14,
    color: theme.textColors.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  // FIX-Task-29 item 7A3: short "what this does" line under the maintenance action.
  buttonCaption: {
    fontSize: 12,
    color: theme.textColors.tertiary,
    marginTop: 10,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  statusValue: {
    color: theme.colors.success[500],
    fontWeight: '500',
  },
});

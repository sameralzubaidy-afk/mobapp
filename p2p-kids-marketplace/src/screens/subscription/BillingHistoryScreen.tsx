/**
 * FILE: p2p-kids-marketplace/src/screens/subscription/BillingHistoryScreen.tsx
 * MODULE-11 TASK SUB-017: Billing History View
 *
 * Displays user's billing history with pagination and filtering.
 * Shows charge details, dates, amounts, and status.
 * Allows downloading invoices (Stripe-hosted).
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '@/contexts/AuthContext';
import { getBillingHistory } from '@/services/billingHistory';
import type { BillingHistory } from '@/types/billingHistory.types';
import { formatPrice } from '@/utils/formatPrice';
import BottomNavBar from '../../components/organisms/BottomNavBar';
import { LoadingSpinner } from '@/components/ui';

//  ─── Helper: Format date ──────────────────────────────────────────────────────
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

// ─── Helper: Format amount ─────────────────────────────────────────────────────
function formatAmount(cents: number, currency: string): string {
  // For USD, use smart decimal formatting (no .00 for whole dollars)
  if (currency === 'usd') {
    return formatPrice(cents);
  }
  
  // For other currencies, always show 2 decimals
  const symbol = currency.toUpperCase();
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

// ─── Helper: Status badge color ───────────────────────────────────────────────
function getStatusColor(status: string): string {
  switch (status) {
    case 'succeeded':
      return '#10B981'; // Green
    case 'pending':
      return '#F59E0B'; // Amber
    case 'failed':
      return '#EF4444'; // Red
    case 'refunded':
      return '#6B7280'; // Gray
    default:
      return '#9CA3AF'; // Default gray
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BillingHistoryScreen() {
  const navigation = useNavigation();
  const { session } = useContext(AuthContext);
  const userId = session?.user?.id;

  // State
  const [billingRecords, setBillingRecords] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Fetch billing history
  const fetchBillingHistory = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const result = await getBillingHistory({
          user_id: userId,
          limit: 50,
        });

        setBillingRecords(result);
        setHasMore(result.length >= 50);
      } catch (error) {
        console.error('[BillingHistory] Error fetching history:', error);
        Alert.alert('Error', 'Failed to load billing history. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  // Initial load
  useEffect(() => {
    fetchBillingHistory();
  }, [fetchBillingHistory]);

  // Handle invoice download
  const handleViewInvoice = useCallback(async (invoiceId: string) => {
    // For Stripe-hosted invoices, open in browser
    // This would typically call an Edge Function to get the invoice URL
    Alert.alert('View Invoice', 'Opening invoice in your browser...', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open',
        onPress: () => {
          // eslint-disable-next-line no-console
          console.log('[BillingHistory] Requested invoice:', invoiceId);
          // TODO: Call Edge Function to get invoice URL
          // For now, show placeholder
          Alert.alert('Coming Soon', 'Invoice download will be available soon.');
        },
      },
    ]);
  }, []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading billing history...</Text>
      </View>
    );
  }

  // Empty state
  if (billingRecords.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Billing History</Text>
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Billing History</Text>
          <Text style={styles.emptyStateText}>
            You haven't been charged yet. Your billing history will appear here when you make a
            payment.
          </Text>
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Billing History</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchBillingHistory(true)} />
        }
      >
        {billingRecords.map((record) => (
          <View key={record.id} style={styles.billingCard}>
            {/* Date and Status */}
            <View style={styles.cardHeader}>
              <Text style={styles.date}>{formatDate(record.charged_at)}</Text>
              <View
                style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}
              >
                <Text style={styles.statusText}>{record.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.description}>{record.description}</Text>

            {/* Amount */}
            <Text style={styles.amount}>{formatAmount(record.amount, record.currency)}</Text>

            {/* Invoice Link (if available) */}
            {record.stripe_invoice_id && record.status === 'succeeded' && (
              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={() => handleViewInvoice(record.stripe_invoice_id!)}
              >
                <Text style={styles.invoiceButtonText}>View Invoice →</Text>
              </TouchableOpacity>
            )}

            {/* Error message (if failed) */}
            {record.status === 'failed' && record.error_message && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorLabel}>Error:</Text>
                <Text style={styles.errorMessage}>{record.error_message}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Load more indicator */}
        {hasMore && (
          <TouchableOpacity style={styles.loadMoreButton}>
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        )}

        {/* Footer spacing */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <BottomNavBar />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
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
    marginRight: 12,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0066CC',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  billingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 8,
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  invoiceButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  invoiceButtonText: {
    fontSize: 14,
    color: '#0066CC',
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorLabel: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
  loadMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 16,
    color: '#0066CC',
    fontWeight: '600',
  },
});

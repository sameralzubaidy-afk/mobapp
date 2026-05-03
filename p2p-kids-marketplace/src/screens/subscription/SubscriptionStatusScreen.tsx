/**
 * File: p2p-kids-marketplace/src/screens/subscription/SubscriptionStatusScreen.tsx
 * MODULE-11 TASK SUB-007: Subscription Status + Billing Info Screen
 *
 * Purpose: Manual verification screen showing current subscription state,
 * payment retry count, and grace period countdown.
 * Accessible via AdminDashboard → SUB-007 link.
 *
 * TODO(UX): Refine layout once final Figma design is available.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNavBar from '../../components/organisms/BottomNavBar';

type NavigationProp = NativeStackNavigationProp<any>;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubscriptionInfo {
  id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  payment_retry_count: number;
  payment_failed_at: string | null;
  grace_started_at: string | null;
  grace_ends_at: string | null;
  trial_end_date: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getDaysRemaining(isoEnd: string | null): string {
  if (!isoEnd) return '—';
  const days = Math.ceil((new Date(isoEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Expired';
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

function getNextChange(info: SubscriptionInfo): { label: string; value: string } {
  if (info.status === 'trial' && info.trial_end_date) {
    return { label: 'Trial Ends', value: formatDate(info.trial_end_date) };
  }

  if (info.status === 'active' && info.current_period_end) {
    return { label: 'Renews On', value: formatDate(info.current_period_end) };
  }

  if ((info.status === 'grace_period' || info.status === 'grace') && info.grace_ends_at) {
    return { label: 'Grace Ends', value: formatDate(info.grace_ends_at) };
  }

  if ((info.status === 'cancelled' || info.status === 'canceled') && info.current_period_end) {
    return { label: 'Access Ends', value: formatDate(info.current_period_end) };
  }

  return { label: 'Next Change', value: '—' };
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#22c55e'; // green
    case 'trial':
      return '#3b82f6'; // blue
    case 'cancelled':
    case 'canceled':
      return '#f59e0b'; // amber
    case 'grace_period':
      return '#ef4444'; // red
    case 'grace':
      return '#ef4444'; // red
    case 'expired':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function SubscriptionStatusScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select(
          'id, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, payment_retry_count, payment_failed_at, grace_started_at, grace_ends_at, trial_end_date, cancelled_at, updated_at'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setInfo(data ?? null);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load subscription data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Render states ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading subscription data…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>⚠ {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!info) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>No subscription record found for this user.</Text>
        <Text style={styles.subText}>
          User must complete signup flow to create a subscription row.
        </Text>
      </SafeAreaView>
    );
  }

  const isGracePeriod = info.status === 'grace_period' || info.status === 'grace';
  const hasPaymentFailed = info.payment_retry_count > 0;
  const nextChange = getNextChange(info);
  const isFreeOrCancelled =
    info.status === 'free' || info.status === 'cancelled' || info.status === 'canceled';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Header: Status badge ─────────────────────────────────────────── */}
        <View style={styles.statusCard}>
          <Text style={styles.sectionHeader}>Subscription Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(info.status) }]}>
            <Text style={styles.statusBadgeText}>{info.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.subText}>Last updated: {formatDate(info.updated_at)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next Change</Text>
          <Row label={nextChange.label} value={nextChange.value} highlight />
        </View>

        {/* ── Stripe IDs ────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stripe Integration</Text>
          <Row label="Customer ID" value={info.stripe_customer_id} />
          <Row label="Subscription ID" value={info.stripe_subscription_id} />
        </View>

        {/* ── Billing period ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Billing Period</Text>
          <Row label="Period Start" value={formatDate(info.current_period_start)} />
          <Row label="Period End" value={formatDate(info.current_period_end)} />
          {info.current_period_end && (
            <Row label="Time Left" value={getDaysRemaining(info.current_period_end)} highlight />
          )}
        </View>

        {/* ── Payment failure info ──────────────────────────────────────────── */}
        {hasPaymentFailed && (
          <View style={[styles.card, styles.warningCard]}>
            <Text style={[styles.cardTitle, { color: '#dc2626' }]}>⚠ Payment Failures</Text>
            <Row label="Retry Count" value={`${info.payment_retry_count} / 3`} highlight />
            <Row label="Last Failed" value={formatDate(info.payment_failed_at)} />
            {info.payment_retry_count >= 3 && (
              <Text style={styles.warningText}>
                Max retries reached — user has entered grace period.
              </Text>
            )}
          </View>
        )}

        {/* ── Grace period ──────────────────────────────────────────────────── */}
        {isGracePeriod && (
          <View style={[styles.card, styles.graceCard]}>
            <Text style={[styles.cardTitle, { color: '#b91c1c' }]}>Grace Period Active</Text>
            <Row label="Started" value={formatDate(info.grace_started_at)} />
            <Row label="Ends" value={formatDate(info.grace_ends_at)} />
            <Row label="Remaining" value={getDaysRemaining(info.grace_ends_at)} highlight />
            <Text style={styles.warningText}>
              SP wallet is frozen. User must re-subscribe to restore access.
            </Text>
          </View>
        )}

        {/* ── Cancellation info ─────────────────────────────────────────────── */}
        {info.cancelled_at && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancellation</Text>
            <Row label="Cancelled At" value={formatDate(info.cancelled_at)} />
          </View>
        )}

        {/* ── Debug: refresh button ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage Subscription</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              navigation.navigate(isFreeOrCancelled ? 'SubscriptionChoice' : 'ContinueKidsClub')
            }
          >
            <Text style={styles.retryButtonText}>
              {isFreeOrCancelled ? 'Start / Upgrade Kids Club+' : 'Manage Billing & Payment'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>↻ Refresh Status</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          SUB-007: Pull down to refresh after triggering webhook events via Stripe CLI or Dashboard
        </Text>
      </ScrollView>

      {/* MODULE-09: Universal Bottom Navigation */}
      <BottomNavBar showHelp={true} />
    </SafeAreaView>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────
function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value ?? '—'}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  errorText: { color: '#dc2626', fontSize: 16, marginBottom: 12, textAlign: 'center' },
  emptyText: { color: '#374151', fontSize: 16, textAlign: 'center' },
  subText: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 6 },
  statusBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  warningCard: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  graceCard: { borderLeftWidth: 4, borderLeftColor: '#b91c1c' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#6b7280', fontSize: 13, flex: 1 },
  rowValue: { color: '#374151', fontSize: 13, flex: 2, textAlign: 'right' },
  rowValueHighlight: { color: '#1d4ed8', fontWeight: '600' },
  warningText: { color: '#dc2626', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  retryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  note: { color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 8 },
});

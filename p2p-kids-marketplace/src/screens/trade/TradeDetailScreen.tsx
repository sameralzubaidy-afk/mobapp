/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeDetailScreen.tsx
 * TASK TRADE-V2-004: Trade State Transitions & Completion Triggers
 *
 * UI for viewing trade details and performing actions:
 * - Shows trade status and monetary breakdown
 * - Allows buyer/seller to mark trade as 'completed'
 * - Allows buyer/seller to cancel trade
 * - Allows users to review completed trades
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { Trade } from '@/types/trade';
import { completeTradeV2, cancelTradeV2 } from '@/services/trade';
import { canReviewUser, getTradeReviewStatus } from '@/services/review';
import { useAuth } from '@/hooks/useAuth';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { CancellationReasonModal } from '@/components/molecules/CancellationReasonModal';
import { Modal, LoadingSpinner } from '@/components/ui';
import { Info, CheckCircle, Circle, Star } from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';

type TradeDetailRouteProp = RouteProp<RootStackParamList, 'TradeDetail'>;
type TradeDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TradeDetail'>;

export default function TradeDetailScreen() {
  const route = useRoute<TradeDetailRouteProp>();
  const navigation = useNavigation<TradeDetailNavigationProp>();
  const { session, refreshSession } = useAuth();
  const user = session?.user;
  const { tradeId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [otherUserReviewed, setOtherUserReviewed] = useState(false);

  const fetchTrade = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*, listing:items(*)')
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      setTrade(data as any);

      // Check mutual review status (only for completed trades)
      if (user?.id && (data as any).status === 'completed') {
        const reviewStatusResult = await getTradeReviewStatus(tradeId, user.id);
        if (reviewStatusResult.success) {
          setHasReviewed(reviewStatusResult.userReviewed);
          setOtherUserReviewed(reviewStatusResult.otherUserReviewed);

          const result = await canReviewUser(tradeId, user.id);
          if (result.success) {
            setCanReview(result.canReview === true);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching trade:', error);
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  }, [tradeId, user?.id]);

  useEffect(() => {
    fetchTrade();

    // Real-time subscription for trade updates
    const channel = supabase
      .channel(`trade-${tradeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trades',
          filter: `id=eq.${tradeId}`,
        },
        (payload: any) => {
          console.log('[TradeDetail] Trade updated:', payload.new);
          setTrade(payload.new as Trade);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId, fetchTrade]);

  useFocusEffect(
    useCallback(() => {
      fetchTrade();
    }, [fetchTrade])
  );

  const handleComplete = async () => {
    setShowCompleteConfirm(true);
  };

  const confirmCompleteTrade = async () => {
    try {
      setShowCompleteConfirm(false);
      setSubmitting(true);
      const isSeller = trade?.seller_id === user?.id;
      const result = await completeTradeV2(tradeId);
      if (result.success) {
        // Optimistically update local trade state so user sees updated status immediately
        if (isSeller) {
          setTrade((prev) =>
            prev ? ({ ...prev, seller_marked_completed_at: new Date().toISOString() } as Trade) : prev
          );
        } else {
          setTrade((prev) =>
            prev
              ? ({
                  ...prev,
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                } as Trade)
              : prev
          );
        }

        // Refresh canonical trade record from server to ensure accurate fields
        try {
          await fetchTrade();
        } catch (e) {
          console.warn('[TradeDetail] fetchTrade after complete failed', e);
        }

        Alert.alert('Success', result.message || 'Trade marked as completed!');
      } else {
        Alert.alert('Error', result.error || 'Failed to complete trade');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    // Open the cancellation reason modal instead of alert
    setShowCancellationModal(true);
  };

  const handleCancellationConfirm = async (reason: string) => {
    try {
      setIsCancelling(true);
      setShowCancellationModal(false);

      const result = await cancelTradeV2(tradeId, reason);
      if (result.success) {
        // If SP were refunded, refresh the session so dashboard/wallet shows updated balance immediately
        try {
          if (refreshSession) await refreshSession();
        } catch (e) {
          console.warn('[TradeDetail] refreshSession after cancel failed', e);
        }

        Alert.alert(
          'Trade Cancelled',
          'Your trade has been cancelled. Any Swap Points have been refunded to your wallet.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'Cancellation Failed',
          result.error || 'Failed to cancel trade. Please try again.',
          [{ text: 'Try Again', onPress: () => setShowCancellationModal(true) }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred', [
        { text: 'Try Again', onPress: () => setShowCancellationModal(true) },
      ]);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReviewPress = () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      return;
    }

    if (!trade) {
      Alert.alert('Error', 'Trade information not available');
      return;
    }

    if (!canReview) {
      return;
    }

    // Get the counterparty's name (user we're reviewing)
    const isBuyer = trade.buyer_id === user.id;
    const counterpartyId = isBuyer ? trade.seller_id : trade.buyer_id;

    // For now, use a generic name (we could fetch the profile name, but we'll keep it simple)
    const counterpartyName = isBuyer ? 'the seller' : 'the buyer';

    navigation.navigate('SubmitReview', {
      tradeId,
      revieweeId: counterpartyId,
      revieweeName: counterpartyName,
    });
  };

  const handleItemDetailsPress = () => {
    if (!trade || !(trade as any).listing) {
      Alert.alert('Error', 'Item information not available');
      return;
    }

    const listingId = (trade as any).listing.id;
    navigation.navigate('ListingDetail', { listing_id: listingId });
  };

  if (loading || !trade) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
      </View>
    );
  }

  const isBuyer = trade.buyer_id === user?.id;
  const isSeller = trade.seller_id === user?.id;
  const completeConfirmMessage = isSeller
    ? 'Confirm this trade handoff is complete? The buyer will be prompted to confirm next.'
    : 'Confirm you received the item as expected? This final step releases Swap Points or cash to the seller.';
  console.log(
    '[TradeDetail] isBuyer:',
    isBuyer,
    'isSeller:',
    isSeller,
    'userId:',
    user?.id,
    'tradeId:',
    tradeId
  );
  const canAction = trade.status === 'in_progress' && (isBuyer || isSeller);
  const reviewButtonVisible = trade.status === 'completed' && (isBuyer || isSeller);
  const reviewButtonLabel = hasReviewed
    ? 'Already Reviewed'
    : `Review ${isBuyer ? 'the Seller' : 'the Buyer'}`;
  const isReviewButtonDisabled = submitting || !canReview;

  return (
    <ScreenLayout variant="detail" title="Trade Details">

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={[styles.statusBadge, (styles as any)[`status_${trade.status}`]]}>
            <Text style={styles.statusText}>{trade.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <Pressable
          onPress={handleItemDetailsPress}
          style={({ pressed }) => [styles.section, pressed && styles.sectionPressed]}
        >
          <Text style={styles.sectionTitle}>Item Details</Text>
          <Text style={styles.itemTitle}>{(trade as any).listing?.title || 'Item'}</Text>
          <Text style={styles.itemPrice}>
            Price: ${((trade as any).listing?.price || 0).toFixed(2)}
          </Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cash Paid</Text>
            <Text style={styles.value}>${(trade.cash_amount_cents / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Swap Points Used</Text>
            <Text style={styles.value}>{trade.sp_amount} SP</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Platform Fee</Text>
            <Text style={styles.value}>
              ${(trade.buyer_transaction_fee_cents / 100).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              ${((trade.cash_amount_cents + trade.buyer_transaction_fee_cents) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {canAction && (
          <View style={styles.actionContainer}>
            <Pressable
              style={[
                styles.button,
                styles.completeButton,
                (submitting || (isSeller && trade.seller_marked_completed_at)) &&
                  styles.disabledButton,
              ]}
              onPress={handleComplete}
              disabled={submitting || (isSeller && !!trade.seller_marked_completed_at)}
              testID="mark-completed-button"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSeller && trade.seller_marked_completed_at
                    ? 'waiting for buyer confirmation'
                    : 'Mark as Completed'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.button, styles.cancelButton, submitting && styles.disabledButton]}
              onPress={handleCancel}
              disabled={submitting}
              testID="cancel-trade-button"
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {isBuyer && trade.status === 'in_progress' && trade.seller_marked_completed_at && (
          <View style={[styles.infoBox, styles.sellerCompletedBox]}>
            <Info
              size={20}
              color="#065f46"
              weight="regular"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.sellerCompletedText}>
              The seller has marked this trade as completed. Please confirm if you have received the
              item.
            </Text>
          </View>
        )}

        {reviewButtonVisible && (
          <View style={styles.reviewContainer}>
            {/* Show review status info */}
            <View style={styles.reviewStatusInfo}>
              <View style={styles.reviewStatusRow}>
                {hasReviewed
                  ? <CheckCircle size={20} color="#10B981" weight="regular" />
                  : <Circle size={20} color="#9CA3AF" weight="regular" />
                }
                {/* phosphor-review-status-placeholder
                />
                <Text
                  style={[styles.reviewStatusText, hasReviewed && styles.reviewStatusTextComplete]}
                >
                  {`You ${hasReviewed ? 'have' : "haven't"} reviewed ${isBuyer ? 'the seller' : 'the buyer'}`}
                </Text>
              </View>
              <View style={styles.reviewStatusRow}>
                {otherUserReviewed
                  ? <CheckCircle size={20} color="#10B981" weight="regular" />
                  : <Circle size={20} color="#9CA3AF" weight="regular" />
                }
                {/* phosphor-other-review-status-placeholder
                />
                <Text
                  style={[
                    styles.reviewStatusText,
                    otherUserReviewed && styles.reviewStatusTextComplete,
                  ]}
                >
                  {`${isBuyer ? 'The seller' : 'The buyer'} ${otherUserReviewed ? 'has' : "hasn't"} reviewed you`}
                </Text>
              </View>
            </View>

            {/* Review button */}
            <Pressable
              style={[
                styles.button,
                styles.reviewButton,
                isReviewButtonDisabled && styles.disabledButton,
              ]}
              onPress={handleReviewPress}
              disabled={isReviewButtonDisabled}
              testID="review-trade-button"
            >
              <Star size={20} color="#fff" weight="fill" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>{reviewButtonLabel}</Text>
            </Pressable>
          </View>
        )}

        {trade.status === 'completed' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              This trade was completed on {new Date(trade.completed_at!).toLocaleDateString()}.
            </Text>
          </View>
        )}

        {trade.status === 'cancelled' && (
          <View style={[styles.infoBox, styles.errorBox]}>
            <Text style={styles.errorText}>This trade was cancelled.</Text>
            {trade.cancellation_reason && (
              <Text style={styles.reasonText}>Reason: {trade.cancellation_reason}</Text>
            )}
          </View>
        )}
      </ScrollView>
      <PersistentTabBar />

      <Modal
        visible={showCompleteConfirm}
        type="alert"
        showCloseButton={false}
        onClose={() => setShowCompleteConfirm(false)}
      >
        <View>
          <Text style={styles.confirmModalTitle}>Complete Trade</Text>
          <Text style={styles.confirmModalMessage}>{completeConfirmMessage}</Text>

          <View style={styles.confirmModalActions}>
            <Pressable
              style={styles.confirmModalCancelButton}
              onPress={() => setShowCompleteConfirm(false)}
              disabled={submitting}
            >
              <Text style={styles.confirmModalCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.confirmModalCompleteButton, submitting && styles.disabledButton]}
              onPress={confirmCompleteTrade}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmModalCompleteText}>Complete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        visible={showCancellationModal}
        itemTitle={(trade as any)?.listing?.title || 'Item'}
        onConfirm={handleCancellationConfirm}
        onCancel={() => setShowCancellationModal(false)}
        isLoading={isCancelling}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  status_in_progress: {
    backgroundColor: '#dbeafe',
  },
  status_completed: {
    backgroundColor: '#d1fae5',
  },
  status_cancelled: {
    backgroundColor: '#fee2e2',
  },
  status_pending: {
    backgroundColor: '#fef3c7',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionPressed: {
    backgroundColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#4b5563',
  },
  value: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  actionContainer: {
    marginTop: 8,
    gap: 12,
  },
  reviewContainer: {
    marginTop: 16,
    gap: 12,
  },
  reviewStatusInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  reviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewStatusText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  reviewStatusTextComplete: {
    color: '#065F46',
    fontWeight: '500',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewButton: {
    backgroundColor: '#f59e0b',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#ef4444',
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    color: '#1e40af',
    fontSize: 14,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sellerCompletedBox: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerCompletedText: {
    color: '#065f46',
    fontSize: 14,
    flex: 1,
  },
  reasonText: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  confirmModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  confirmModalMessage: {
    fontSize: 16,
    color: '#6B6B6B',
    lineHeight: 21,
    marginBottom: 20,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmModalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#7A7A7A',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  confirmModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  confirmModalCompleteButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5DBB8E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalCompleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx
 * TASK FLOW-08-03: Active Trade Screen - Whisk Design System
 *
 * Redesigned with:
 * - Phosphor icons (Clock, ArrowsLeftRight, CheckCircle, XCircle, ChatCircle)
 * - Status banners with semantic colors
 * - Vertical timeline with circle indicators  
 * - Green pill button for confirm, red for cancel
 * - Secondary message button
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
  Image,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { Trade, TradeStatus } from '@/types/trade';
import { completeTradeV2, cancelTradeV2, processTradePayment } from '@/services/trade';
import { canReviewUser, getTradeReviewStatus } from '@/services/review';
import { getPaymentMethod, type PaymentMethodInfo } from '@/services/subscription';
import { useAuth } from '@/hooks/useAuth';
import { Modal } from '@/components/ui';
import {
  Clock,
  CheckCircle,
  XCircle,
  ChatCircle,
  WarningCircle,
  ArrowsLeftRight,
  CaretLeft,
  Star,
} from 'phosphor-react-native';
import { CancellationReasonModal } from '@/components/molecules/CancellationReasonModal';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import Avatar from '@/components/atoms/Avatar';

type TradeTimelineRouteProp = RouteProp<RootStackParamList, 'TradeTimeline'>;

export default function TradeTimelineScreen() {
  const route = useRoute<TradeTimelineRouteProp>();
  const navigation = useNavigation<any>();
  const { session, refreshSession } = useAuth();
  const user = session?.user;
  const { tradeId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loadingSavedPaymentMethod, setLoadingSavedPaymentMethod] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [otherUserReviewed, setOtherUserReviewed] = useState(false);
  const [counterpartyProfile, setCounterpartyProfile] = useState<any>(null);

  const fetchTrade = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select(
          '*, listing:items(id, title, price, images:item_images(id, url, thumbnail_url, display_order))'
        )
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      const tradeData = data as any;
      setTrade(tradeData);

      const otherPersonId =
        user?.id === tradeData.buyer_id ? tradeData.seller_id : tradeData.buyer_id;
      if (otherPersonId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url, verification:id_badge_verification_requests(status)')
          .eq('user_id', otherPersonId)
          .single();

        if (profile) {
          setCounterpartyProfile({
            ...profile,
            verification_status: (profile as any).verification?.[0]?.status || 'none',
          });
        }
      }

      if (user?.id && tradeData.status === 'completed') {
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
      Alert.alert('Error', 'Failed to load trade');
    } finally {
      setLoading(false);
    }
  }, [tradeId, user?.id]);

  useEffect(() => {
    fetchTrade();

    const channel = supabase
      .channel(`trade-timeline-${tradeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trades',
          filter: `id=eq.${tradeId}`,
        },
        () => {
          fetchTrade();
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

  useEffect(() => {
    if (!trade || !user?.id) {
      return;
    }

    const needsBuyerPayment =
      trade.buyer_id === user.id &&
      (trade.status === 'payment_processing' || trade.status === 'payment_failed') &&
      ((trade.cash_amount_cents ?? 0) + (trade.buyer_transaction_fee_cents ?? 0) > 0);

    if (!needsBuyerPayment) {
      return;
    }

    let cancelled = false;
    const loadSavedPaymentMethod = async () => {
      setLoadingSavedPaymentMethod(true);
      const method = await getPaymentMethod();
      if (cancelled) {
        return;
      }

      setSavedPaymentMethod(method);

      setLoadingSavedPaymentMethod(false);
    };

    void loadSavedPaymentMethod();

    return () => {
      cancelled = true;
    };
  }, [trade, user?.id]);

  const handleComplete = async () => {
    setShowCompleteConfirm(true);
  };

  const confirmCompleteTrade = async () => {
    try {
      setShowCompleteConfirm(false);
      setSubmitting(true);
      const result = await completeTradeV2(tradeId);

      if (result.success) {
        Alert.alert('Success', result.message || 'Trade marked as completed!');
        fetchTrade();
      } else {
        Alert.alert('Error', result.error || 'Failed to complete trade');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setShowCancellationModal(true);
  };

  const handleReportProblem = () => {
    navigation.navigate('TradeDispute', { tradeId });
  };

  const handleCancellationConfirm = async (reason: string) => {
    try {
      setIsCancelling(true);
      setShowCancellationModal(false);

      const result = await cancelTradeV2(tradeId, reason);
      if (result.success) {
        if (refreshSession) await refreshSession();

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
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReviewPress = () => {
    if (!user?.id || !trade) return;

    const isBuyer = trade.buyer_id === user.id;
    const counterpartyId = isBuyer ? trade.seller_id : trade.buyer_id;
    const counterpartyName = isBuyer ? 'the seller' : 'the buyer';

    navigation.navigate('SubmitReview', {
      tradeId,
      revieweeId: counterpartyId,
      revieweeName: counterpartyName,
    });
  };

  const handleItemDetailsPress = () => {
    const listingId = (trade as any).listing?.id;
    if (listingId) {
      navigation.navigate('ListingDetail', { listing_id: listingId });
    }
  };

  const handleOpenChat = () => {
    navigation.navigate('Chat', { tradeId });
  };

  const handleMakePayment = async () => {
    if (!trade || !user?.id) {
      return;
    }

    const totalCashChargeCents =
      Number(trade.cash_amount_cents ?? 0) + Number(trade.buyer_transaction_fee_cents ?? 0);

    if (totalCashChargeCents <= 0) {
      Alert.alert('Payment Not Required', 'No card payment is required for this trade.');
      return;
    }

    if (!savedPaymentMethod?.id) {
      Alert.alert(
        'Payment Setup Required',
        'No saved card is available. Add a payment method in subscription settings, then try again.'
      );
      return;
    }

    try {
      setIsPaying(true);

      const paymentResult = await processTradePayment(tradeId, savedPaymentMethod.id);
      if (!paymentResult.success) {
        Alert.alert('Payment Failed', paymentResult.error || 'Could not process payment');
        await fetchTrade();
        return;
      }

      Alert.alert('Payment Successful', 'Payment completed. Trade is now in progress.');
      await fetchTrade();
    } finally {
      setIsPaying(false);
    }
  };

  if (loading || !trade) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5DBB8E" />
          <Text style={styles.loadingText}>Loading trade...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBuyer = user?.id === trade.buyer_id;
  const isSeller = user?.id === trade.seller_id;
  const needsBuyerPayment =
    isBuyer &&
    (trade.status === 'payment_processing' || trade.status === 'payment_failed') &&
    ((trade.cash_amount_cents ?? 0) + (trade.buyer_transaction_fee_cents ?? 0) > 0);
  const totalCashCharge =
    ((trade.cash_amount_cents ?? 0) + (trade.buyer_transaction_fee_cents ?? 0)) / 100;
  const completeConfirmMessage = isSeller
    ? 'Confirm this trade handoff is complete? The buyer will be prompted to confirm next.'
    : 'Confirm you received the item as expected? This final step releases Swap Points or cash to the seller.';
  const listing = (trade as any).listing;
  const listingImages = Array.isArray(listing?.images) ? listing.images : [];
  const firstListingImage = listingImages.length
    ? [...listingImages].sort(
        (a: any, b: any) => (a?.display_order ?? 0) - (b?.display_order ?? 0)
      )[0]
    : null;
  const listingImageUri: string | null = firstListingImage
    ? (firstListingImage.thumbnail_url as string | null) || (firstListingImage.url as string)
    : null;
  const listingPriceNumber =
    typeof listing?.price === 'number' ? listing.price : Number(listing?.price ?? 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} testID="back-button">
          <CaretLeft size={24} color="#1A1A1A" weight="regular" />
        </Pressable>
        <Text style={styles.navTitle}>Trade Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={[styles.statusBanner, getStatusBannerStyle(trade.status)]} testID="status-banner">
          {getStatusIcon(trade.status)}
          <View style={styles.statusBannerTextContainer}>
            <Text style={[styles.statusBannerLabel, getStatusTextStyle(trade.status)]}>
              {getStatusDisplay(trade.status)}
            </Text>
            {trade.status === 'cancelled' && trade.cancellation_reason && (
              <Text style={[styles.statusBannerSubtext, getStatusTextStyle(trade.status)]}>
                Reason: {trade.cancellation_reason}
              </Text>
            )}
          </View>
        </View>

        <Pressable style={styles.listingCard} onPress={handleItemDetailsPress}>
          <View style={styles.imageContainer}>
            {listingImageUri ? (
              <Image source={{ uri: listingImageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>📦</Text>
              </View>
            )}
          </View>

          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={2}>
              {listing?.title || 'Item'}
            </Text>
            <Text style={styles.listingSubtitle}>
              {isBuyer ? 'Buying' : 'Selling'}
              {Number.isFinite(listingPriceNumber) && listingPriceNumber > 0
                ? ` · $${listingPriceNumber.toFixed(2)}`
                : ''}
            </Text>
          </View>
        </Pressable>

        <View style={styles.timeline} testID="trade-timeline">
          {renderTimelineStep('pending', 'Initiated', trade.status)}
          {renderTimelineStep('payment_processing', 'Processing Payment', trade.status)}
          {renderTimelineStep('in_progress', 'In Progress', trade.status)}
          {renderTimelineStep('completed', 'Completed', trade.status)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cash Paid:</Text>
            <Text style={styles.value}>${(trade.cash_amount_cents / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Swap Points Used:</Text>
            <Text style={styles.value}>{trade.sp_amount} SP</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Platform Fee:</Text>
            <Text style={styles.value}>
              ${(trade.buyer_transaction_fee_cents / 100).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              ${((trade.cash_amount_cents + trade.buyer_transaction_fee_cents) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        <Pressable style={styles.messageButton} onPress={handleOpenChat} testID="message-button">
          {counterpartyProfile ? (
            <Avatar
              imageUrl={counterpartyProfile.avatar_url}
              name={counterpartyProfile.name}
              size={24}
              verificationStatus={counterpartyProfile.verification_status}
            />
          ) : (
            <ChatCircle size={20} color="#5DBB8E" weight="regular" />
          )}
          <Text style={styles.messageButtonText}>Message {isBuyer ? 'Seller' : 'Buyer'}</Text>
        </Pressable>

        {needsBuyerPayment && (
          <View style={styles.card} testID="trade-payment-section">
            <Text style={styles.cardTitle}>Make Payment</Text>
            <Text style={styles.paymentInstructionText}>
              Complete payment to move this trade into progress.
            </Text>
            <Text style={styles.paymentAmountText}>Card Charge: ${totalCashCharge.toFixed(2)}</Text>

            {loadingSavedPaymentMethod && (
              <View style={styles.paymentModeLoadingContainer}>
                <ActivityIndicator size="small" color="#5DBB8E" />
                <Text style={styles.paymentModeLoadingText}>Checking saved cards...</Text>
              </View>
            )}

            {!loadingSavedPaymentMethod && (
              <View style={styles.paymentModeSelector}>
                <View
                  style={[
                    styles.paymentModeOption,
                    savedPaymentMethod && styles.paymentModeOptionSelected,
                    !savedPaymentMethod && styles.paymentModeOptionDisabled,
                  ]}
                >
                  <Text style={styles.paymentModeTitle}>Saved Card</Text>
                  <Text style={styles.paymentModeSubtitle}>
                    {savedPaymentMethod
                      ? `${savedPaymentMethod.brand?.toUpperCase() || 'CARD'} •••• ${savedPaymentMethod.last4}`
                      : 'No saved card found'}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={[
                styles.confirmButton,
                (isPaying || submitting || !savedPaymentMethod?.id) && styles.disabledButton,
              ]}
              onPress={handleMakePayment}
              disabled={isPaying || submitting || !savedPaymentMethod?.id}
              testID="make-payment-button"
            >
              {isPaying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Make Payment</Text>
              )}
            </Pressable>
          </View>
        )}

        {trade.status === 'in_progress' && (
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.confirmButton,
                (submitting || (isSeller && !!trade.seller_marked_completed_at)) &&
                  styles.disabledButton,
              ]}
              onPress={handleComplete}
              disabled={submitting || (isSeller && !!trade.seller_marked_completed_at)}
              testID="confirm-trade-button"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle size={20} color="#FFFFFF" weight="regular" />
                  <Text style={styles.confirmButtonText}>
                    {isSeller && trade.seller_marked_completed_at
                      ? 'Waiting for buyer'
                      : 'Mark as Completed'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.cancelButtonOutline, submitting && styles.disabledButton]}
              onPress={handleReportProblem}
              disabled={submitting}
              testID="report-problem-button"
            >
              <WarningCircle size={20} color="#E85D75" weight="regular" />
              <Text style={styles.cancelButtonOutlineText}>Report Problem</Text>
            </Pressable>
          </View>
        )}

        {trade.status === 'pending' && (!isSeller || trade.cash_amount_cents === 0) && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.cancelButtonOutline, submitting && styles.disabledButton]}
              onPress={handleCancel}
              disabled={submitting}
              testID="cancel-trade-button"
            >
              <XCircle size={20} color="#E85D75" weight="regular" />
              <Text style={styles.cancelButtonOutlineText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {isSeller && trade.status === 'payment_processing' && (
          <View style={styles.sellerCompletedBox} testID="seller-awaiting-payment-notice">
            <Clock size={20} color="#2563EB" weight="regular" style={{ marginRight: 8 }} />
            <Text style={styles.sellerCompletedText}>
              Trade accepted. Waiting for buyer payment confirmation.
            </Text>
          </View>
        )}

        {trade.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reviews</Text>
            <View style={styles.reviewStatusRow}>
              {hasReviewed ? (
                <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              ) : (
                <XCircle size={20} color="#E0E0E0" weight="regular" />
              )}
              <Text
                style={[styles.reviewStatusText, hasReviewed && styles.reviewStatusTextComplete]}
              >
                {`You ${hasReviewed ? 'have' : "haven't"} reviewed ${isBuyer ? 'the seller' : 'the buyer'}`}
              </Text>
            </View>
            <View style={[styles.reviewStatusRow, { marginTop: 8 }]}>
              {otherUserReviewed ? (
                <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              ) : (
                <XCircle size={20} color="#E0E0E0" weight="regular" />
              )}
              <Text
                style={[
                  styles.reviewStatusText,
                  otherUserReviewed && styles.reviewStatusTextComplete,
                ]}
              >
                {`${isBuyer ? 'The seller' : 'The buyer'} ${otherUserReviewed ? 'has' : "hasn't"} reviewed you`}
              </Text>
            </View>

            {canReview && !hasReviewed && (
              <Pressable
                style={[styles.reviewButton, { marginTop: 16 }]}
                onPress={handleReviewPress}
                testID="review-button"
              >
                <Star size={20} color="#FFFFFF" weight="regular" />
                <Text style={styles.confirmButtonText}>
                  Review {isBuyer ? 'the Seller' : 'the Buyer'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {isBuyer && trade.status === 'in_progress' && trade.seller_marked_completed_at && (
          <View style={styles.sellerCompletedBox} testID="seller-completed-notice">
            <WarningCircle size={20} color="#5DBB8E" weight="regular" style={{ marginRight: 8 }} />
            <Text style={styles.sellerCompletedText}>
              The seller has marked this trade as completed. Please confirm if you have received the
              item.
            </Text>
          </View>
        )}
      </ScrollView>
      <BottomNavBar />

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

      <CancellationReasonModal
        visible={showCancellationModal}
        itemTitle={listing?.title || 'Item'}
        onConfirm={handleCancellationConfirm}
        onCancel={() => setShowCancellationModal(false)}
        isLoading={isCancelling}
      />
    </SafeAreaView>
  );
}

function renderTimelineStep(
  step: TradeStatus,
  label: string,
  currentStatus: TradeStatus
): React.JSX.Element {
  const statusOrder: TradeStatus[] = ['pending', 'payment_processing', 'in_progress', 'completed'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepIndex = statusOrder.indexOf(step);

  const isActive = stepIndex === currentIndex;
  const isCompleted = stepIndex < currentIndex || currentStatus === 'completed';
  const isCancelled = currentStatus === 'cancelled';

  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineIconContainer}>
        <View
          style={[
            styles.timelineIcon,
            isCompleted && styles.timelineIconCompleted,
            isActive && styles.timelineIconActive,
            isCancelled && styles.timelineIconCancelled,
          ]}
        >
          {isCompleted && !isCancelled && <CheckCircle size={16} color="#FFFFFF" weight="fill" />}
          {isCancelled && <XCircle size={16} color="#FFFFFF" weight="fill" />}
        </View>
        {stepIndex < statusOrder.length - 1 && (
          <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text
          style={[styles.timelineLabel, (isActive || isCompleted) && styles.timelineLabelActive]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function getStatusDisplay(status: TradeStatus): string {
  const statusMap: Record<TradeStatus, string> = {
    pending: 'Pending Payment',
    payment_processing: 'Processing Payment',
    payment_failed: 'Payment Failed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return statusMap[status] || status;
}

function getStatusBannerStyle(status: TradeStatus): any {
  const styleMap: Record<TradeStatus, any> = {
    pending: styles.statusBannerPending,
    payment_processing: styles.statusBannerProcessing,
    payment_failed: styles.statusBannerFailed,
    in_progress: styles.statusBannerActive,
    completed: styles.statusBannerCompleted,
    cancelled: styles.statusBannerCancelled,
  };
  return styleMap[status] || {};
}

function getStatusTextStyle(status: TradeStatus): any {
  const styleMap: Record<TradeStatus, any> = {
    pending: { color: '#D97706' },
    payment_processing: { color: '#2563EB' },
    payment_failed: { color: '#DC2626' },
    in_progress: { color: '#059669' },
    completed: { color: '#16A34A' },
    cancelled: { color: '#6B6B6B' },
  };
  return styleMap[status] || { color: '#1A1A1A' };
}

function getStatusIcon(status: TradeStatus) {
  const iconProps = { size: 20, weight: 'regular' as const };
  switch (status) {
    case 'pending':
      return <Clock {...iconProps} color="#D97706" />;
    case 'payment_processing':
      return <ArrowsLeftRight {...iconProps} color="#2563EB" />;
    case 'payment_failed':
      return <XCircle {...iconProps} color="#DC2626" />;
    case 'in_progress':
      return <ArrowsLeftRight {...iconProps} color="#059669" />;
    case 'completed':
      return <CheckCircle {...iconProps} color="#16A34A" />;
    case 'cancelled':
      return <XCircle {...iconProps} color="#6B6B6B" />;
    default:
      return <Clock {...iconProps} color="#6B6B6B" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B6B6B',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  statusBannerTextContainer: {
    flex: 1,
  },
  statusBannerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBannerSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBannerPending: { backgroundColor: '#FEF3C7' },
  statusBannerProcessing: { backgroundColor: '#DBEAFE' },
  statusBannerFailed: { backgroundColor: '#FEE2E2' },
  statusBannerActive: { backgroundColor: '#E8F5F0' },
  statusBannerCompleted: { backgroundColor: '#F0FDF4' },
  statusBannerCancelled: { backgroundColor: '#F0F0F0' },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 24,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  listingSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  timeline: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconActive: {
    backgroundColor: '#5DBB8E',
  },
  timelineIconCompleted: {
    backgroundColor: '#5DBB8E',
  },
  timelineIconCancelled: {
    backgroundColor: '#E85D75',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#5DBB8E',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 6,
  },
  timelineLabel: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  timelineLabelActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  value: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    marginBottom: 16,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#E85D75',
    borderRadius: 24,
    gap: 8,
  },
  cancelButtonOutlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E85D75',
  },
  reviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewStatusText: {
    fontSize: 14,
    color: '#6B6B6B',
    flex: 1,
  },
  reviewStatusTextComplete: {
    color: '#5DBB8E',
    fontWeight: '500',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#F59E0B',
    borderRadius: 26,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  sellerCompletedBox: {
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  sellerCompletedText: {
    color: '#1A1A1A',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  paymentInstructionText: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  paymentAmountText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentModeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentModeLoadingText: {
    color: '#6B6B6B',
    fontSize: 13,
  },
  paymentModeSelector: {
    gap: 8,
    marginBottom: 12,
  },
  paymentModeOption: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  paymentModeOptionSelected: {
    borderColor: '#5DBB8E',
    backgroundColor: '#E8F5F0',
  },
  paymentModeOptionDisabled: {
    opacity: 0.5,
  },
  paymentModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  paymentModeSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
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

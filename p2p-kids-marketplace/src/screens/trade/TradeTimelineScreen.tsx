/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx
 * TASK TRADE-V2-008: Trade UI Flows - Timeline View
 * 
 * Visual progress indicator for trade lifecycle with action buttons.
 * Shows: pending → payment_processing → in_progress → completed/cancelled
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
import { completeTradeV2, cancelTradeV2 } from '@/services/trade';
import { canReviewUser, getTradeReviewStatus } from '@/services/review';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
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
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [otherUserReviewed, setOtherUserReviewed] = useState(false);
  const [revieweeId, setRevieweeId] = useState<string>('');
  const [counterpartyProfile, setCounterpartyProfile] = useState<any>(null);

  const fetchTrade = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*, listing:items(id, title, price, images:item_images(id, url, thumbnail_url, display_order))')
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      const tradeData = data as any;
      setTrade(tradeData);

      // Fetch counterparty profile
      const otherPersonId = user?.id === tradeData.buyer_id ? tradeData.seller_id : tradeData.buyer_id;
      if (otherPersonId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url, verification:id_badge_verification_requests(status)')
          .eq('user_id', otherPersonId)
          .single();
        
        if (profile) {
          setCounterpartyProfile({
            ...profile,
            verification_status: (profile as any).verification?.[0]?.status || 'none'
          });
        }
      }

      // Check mutual review status (only for completed trades)
      if (user?.id && tradeData.status === 'completed') {
        const revieweeUserId = (data as any).buyer_id === user.id 
          ? (data as any).seller_id 
          : (data as any).buyer_id;
        
        setRevieweeId(revieweeUserId);
        
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

    // Real-time subscription for trade updates
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
        (payload: any) => {
          console.log('[TradeTimeline] Trade updated:', payload.new);
          // Re-fetch to get any updated related data or full state
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

  const handleComplete = async () => {
    const isSeller = trade?.seller_id === user?.id;
    const confirmMessage = isSeller 
      ? 'Are you sure you want to mark this trade as completed? The buyer will be notified to confirm.'
      : 'Are you sure you want to mark this trade as completed? This will release Swap Points or cash to the seller.';

    Alert.alert(
      'Complete Trade',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            try {
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
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    setShowCancellationModal(true);
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
    
    // Get the counterparty's name
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

  if (loading || !trade) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  const isBuyer = user?.id === trade.buyer_id;
  const isSeller = user?.id === trade.seller_id;
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Trade Timeline</Text>

          <Pressable style={styles.listingCard} onPress={handleItemDetailsPress}>
            <View style={styles.imageContainer}>
              {listingImageUri ? (
                <Image
                  source={{ uri: listingImageUri }}
                  style={styles.image}
                  resizeMode="cover"
                />
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
                  ? ` · ${listingPriceNumber.toFixed(2)}`
                  : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </Pressable>
        </View>

        {/* Visual Progress Timeline */}
        <View style={styles.timeline}>
          {renderTimelineStep('pending', 'Initiated', trade.status)}
          {renderTimelineStep('payment_processing', 'Processing Payment', trade.status)}
          {renderTimelineStep('in_progress', 'In Progress', trade.status)}
          {renderTimelineStep('completed', 'Completed', trade.status)}
        </View>

        {/* Status Info */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <Text style={[styles.statusValue, getStatusColor(trade.status)]}>
            {getStatusDisplay(trade.status)}
          </Text>
          {trade.status === 'cancelled' && trade.cancellation_reason && (
            <Text style={styles.cancellationReason}>
              Reason: {trade.cancellation_reason}
            </Text>
          )}
        </View>

        {/* Monetary Breakdown */}
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
            <Text style={styles.value}>${(trade.buyer_transaction_fee_cents / 100).toFixed(2)}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              ${((trade.cash_amount_cents + trade.buyer_transaction_fee_cents) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Message Button */}
        <Pressable
          style={[styles.button, styles.messageButton]}
          onPress={handleOpenChat}
        >
          {counterpartyProfile ? (
            <Avatar 
              imageUrl={counterpartyProfile.avatar_url} 
              name={counterpartyProfile.name} 
              size={24} 
              verificationStatus={counterpartyProfile.verification_status} 
            />
          ) : (
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          )}
          <Text style={styles.messageButtonText}>Message {isBuyer ? 'Seller' : 'Buyer'}</Text>
        </Pressable>

        {/* Action Buttons */}
        {trade.status === 'in_progress' && (
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button, 
                styles.primaryButton, 
                (submitting || (isSeller && !!trade.seller_marked_completed_at)) && styles.disabledButton
              ]}
              onPress={handleComplete}
              disabled={submitting || (isSeller && !!trade.seller_marked_completed_at)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {isSeller && trade.seller_marked_completed_at 
                      ? 'Waiting for buyer' 
                      : 'Mark as Completed'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.button, styles.cancelButton, submitting && styles.disabledButton]}
              onPress={handleCancel}
              disabled={submitting}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {trade.status === 'pending' && (!isSeller || trade.cash_amount_cents === 0) && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton, submitting && styles.disabledButton]}
              onPress={handleCancel}
              disabled={submitting}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {/* Review Section */}
        {trade.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reviews</Text>
            <View style={styles.reviewStatusRow}>
              <Ionicons
                name={hasReviewed ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={hasReviewed ? '#34C759' : '#8E8E93'}
              />
              <Text style={[styles.reviewStatusText, hasReviewed && styles.reviewStatusTextComplete]}>
                {`You ${hasReviewed ? 'have' : "haven't"} reviewed ${isBuyer ? 'the seller' : 'the buyer'}`}
              </Text>
            </View>
            <View style={[styles.reviewStatusRow, { marginTop: 8 }]}>
              <Ionicons
                name={otherUserReviewed ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={otherUserReviewed ? '#34C759' : '#8E8E93'}
              />
              <Text style={[styles.reviewStatusText, otherUserReviewed && styles.reviewStatusTextComplete]}>
                {`${isBuyer ? 'The seller' : 'The buyer'} ${otherUserReviewed ? 'has' : "hasn't"} reviewed you`}
              </Text>
            </View>

            {canReview && !hasReviewed && (
              <Pressable
                style={[styles.button, styles.reviewButton, { marginTop: 16 }]}
                onPress={handleReviewPress}
              >
                <Ionicons name="star" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  Review {isBuyer ? 'the Seller' : 'the Buyer'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Seller Progress Info Box */}
        {isBuyer && trade.status === 'in_progress' && trade.seller_marked_completed_at && (
          <View style={[styles.infoBox, styles.sellerCompletedBox]}>
            <Ionicons name="information-circle" size={20} color="#065f46" style={{ marginRight: 8 }} />
            <Text style={styles.sellerCompletedText}>
              The seller has marked this trade as completed. Please confirm if you have received the item.
            </Text>
          </View>
        )}

      </ScrollView>
      <BottomNavBar />

      {/* Cancellation Reason Modal */}
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
          {isCompleted && !isCancelled && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
          {isCancelled && <Ionicons name="close" size={16} color="#fff" />}
        </View>
        {stepIndex < statusOrder.length - 1 && (
          <View
            style={[
              styles.timelineLine,
              isCompleted && styles.timelineLineCompleted,
            ]}
          />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text
          style={[
            styles.timelineLabel,
            (isActive || isCompleted) && styles.timelineLabelActive,
          ]}
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

function getStatusColor(status: TradeStatus): any {
  const colorMap: Record<TradeStatus, any> = {
    pending: { color: '#FF9500' },
    payment_processing: { color: '#007AFF' },
    payment_failed: { color: '#FF3B30' },
    in_progress: { color: '#007AFF' },
    completed: { color: '#34C759' },
    cancelled: { color: '#8E8E93' },
  };
  return colorMap[status] || { color: '#000' };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
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
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 28,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  listingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  timeline: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
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
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconActive: {
    backgroundColor: '#007AFF',
  },
  timelineIconCompleted: {
    backgroundColor: '#34C759',
  },
  timelineIconCancelled: {
    backgroundColor: '#FF3B30',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E5EA',
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#34C759',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 6,
  },
  timelineLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  timelineLabelActive: {
    color: '#000',
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  cancellationReason: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#8E8E93',
  },
  value: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  actions: {
    marginTop: 8,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  reviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewStatusText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  reviewStatusTextComplete: {
    color: '#34C759',
    fontWeight: '500',
  },
  reviewButton: {
    backgroundColor: '#FF9500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
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
  linkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  messageButton: {
    backgroundColor: '#007AFF',
    marginBottom: 16,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

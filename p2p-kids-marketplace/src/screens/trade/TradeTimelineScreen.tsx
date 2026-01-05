/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx
 * TASK TRADE-V2-008: Trade UI Flows - Timeline View
 * 
 * Visual progress indicator for trade lifecycle with action buttons.
 * Shows: pending → payment_processing → in_progress → completed/cancelled
 */

import React, { useState, useEffect } from 'react';
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
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { Trade, TradeStatus } from '@/types/trade';
import { completeTradeV2, cancelTradeV2 } from '@/services/trade';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

type TradeTimelineRouteProp = RouteProp<RootStackParamList, 'TradeTimeline'>;

export default function TradeTimelineScreen() {
  const route = useRoute<TradeTimelineRouteProp>();
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const user = session?.user;
  const { tradeId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);

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
          setTrade(payload.new as Trade);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId]);

  const fetchTrade = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*, listing:items(title, price, images:item_images(id, url, thumbnail_url, display_order))')
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      setTrade(data as any);
    } catch (error) {
      console.error('❌ Error fetching trade:', error);
      Alert.alert('Error', 'Failed to load trade');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    Alert.alert(
      'Complete Trade',
      'Mark this trade as completed? This confirms you have received/delivered the item.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            try {
              setSubmitting(true);
              await completeTradeV2(tradeId);
              Alert.alert('Success', 'Trade marked as completed!');
              fetchTrade();
            } catch (error: any) {
              console.error('❌ Error completing trade:', error);
              Alert.alert('Error', error.message || 'Failed to complete trade');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Trade',
      'Are you sure you want to cancel this trade? Refunds will be processed if payment was made.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await cancelTradeV2(tradeId, 'User requested cancellation');
              Alert.alert('Cancelled', 'Trade has been cancelled. Refunds will be processed.');
              navigation.goBack();
            } catch (error: any) {
              console.error('❌ Error cancelling trade:', error);
              Alert.alert('Error', error.message || 'Failed to cancel trade');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = () => {
    navigation.navigate('TradeDetail', { tradeId });
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

          <View style={styles.listingCard}>
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
                  ? ` · $${listingPriceNumber.toFixed(2)}`
                  : ''}
              </Text>
            </View>
          </View>
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
            <Text style={styles.label}>Cash Amount:</Text>
            <Text style={styles.value}>${(trade.cash_amount_cents / 100).toFixed(2)}</Text>
          </View>
          {trade.sp_amount > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Swap Points Used:</Text>
              <Text style={styles.value}>{trade.sp_amount} SP</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Transaction Fee:</Text>
            <Text style={styles.value}>${(trade.buyer_transaction_fee_cents / 100).toFixed(2)}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              ${(trade.cash_amount_cents / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Message Button */}
        <Pressable
          style={[styles.button, styles.messageButton]}
          onPress={handleOpenChat}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.messageButtonText}>Message {isBuyer ? 'Seller' : 'Buyer'}</Text>
        </Pressable>

        {/* Action Buttons */}
        {trade.status === 'in_progress' && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={handleComplete}
              disabled={submitting}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Mark as Completed</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={submitting}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {trade.status === 'pending' && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={submitting}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {/* View Full Details Link */}
        <Pressable style={styles.linkButton} onPress={handleViewDetails}>
          <Text style={styles.linkText}>View Full Details</Text>
          <Ionicons name="chevron-forward" size={16} color="#007AFF" />
        </Pressable>
      </ScrollView>
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

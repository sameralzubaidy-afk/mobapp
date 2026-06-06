/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeReviewScreen.tsx
 * @deprecated Use ReviewOfferScreen instead.
 * 
 * ⚠️ This screen is DEPRECATED. It directly updates DB to payment_processing
 *    instead of calling the transactions-update Edge Function, which means
 *    Stripe PaymentIntent is never captured and the trade gets stuck.
 * 
 *    🛡️ Safety redirect: on mount, navigates to ReviewOffer.
 *    Remove this file entirely once all old notification payloads are expired.
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
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { ArrowsLeftRight, Coins, ShieldCheck } from 'phosphor-react-native';
import { useAuth } from '@/hooks/useAuth';
import { Modal, LoadingSpinner } from '@/components/ui';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { sendTradeNotificationPush } from '@/services/tradeNotifications';
import ScreenLayout from '@/components/ScreenLayout';

type TradeReviewRouteProp = RouteProp<RootStackParamList, 'TradeReview'>;

export default function TradeReviewScreen() {
  const route = useRoute<TradeReviewRouteProp>();
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const user = session?.user;
  const { tradeId } = route.params;

  // 🛡️ Safety redirect: this screen is deprecated — route to ReviewOffer instead.
  useEffect(() => {
    navigation.replace('ReviewOffer', { tradeId });
  }, []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [trade, setTrade] = useState<any>(null);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const fetchTrade = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*, listing:items(id, title, price, images:item_images(url, thumbnail_url))')
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      setTrade(data);
    } catch (error) {
      console.error('Error fetching trade:', error);
      Alert.alert('Error', 'Failed to load trade details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation, tradeId]);

  useEffect(() => {
    fetchTrade();
  }, [fetchTrade]);

  const handleAccept = async () => {
    setShowAcceptConfirm(true);
  };

  const handleDecline = async () => {
    setShowDeclineConfirm(true);
  };

  const confirmAcceptTrade = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'You must be signed in to accept this trade.');
        return;
      }

      setShowAcceptConfirm(false);
      setSubmitting(true);

      const { data: updatedTrade, error } = await supabase
        .from('trades')
        .update({ status: 'payment_processing' })
        .eq('id', tradeId)
        .eq('seller_id', user.id)
        .eq('status', 'pending')
        .select('id, status')
        .single();

      if (error || !updatedTrade) {
        throw new Error(error?.message || 'Unable to accept this trade. It may already be updated.');
      }

      const buyerUserId = trade?.buyer_id;
      const itemId = trade?.listing_id || trade?.item_id || trade?.listing?.id || '';
      const itemTitle = trade?.listing?.title || 'item';

      if (buyerUserId) {
        const notificationResult = await sendTradeNotificationPush(
          buyerUserId,
          'trade_accepted',
          `Your trade request for "${itemTitle}" was accepted. Complete payment to continue.`,
          {
            trade_id: tradeId,
            item_id: itemId,
            item_title: itemTitle,
            buyer_id: buyerUserId,
            deep_link: `/trades/${tradeId}`,
            type: 'trade_accepted',
          }
        );

        if (!notificationResult.success) {
          console.warn('[TradeReviewScreen] Buyer notification failed after accept:', {
            tradeId,
            buyerUserId,
            error: notificationResult.error,
          });
        }
      }

      Alert.alert('Success', 'Trade accepted! Buyer can now complete payment.');
      navigation.replace('TradeTimeline', { tradeId });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept trade');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeclineTrade = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'You must be signed in to decline this trade.');
        return;
      }

      setShowDeclineConfirm(false);
      setSubmitting(true);
      const { data: updatedTrade, error } = await supabase
        .from('trades')
        .update({ status: 'cancelled' })
        .eq('id', tradeId)
        .eq('seller_id', user.id)
        .eq('status', 'pending')
        .select('id, status')
        .single();

      if (error || !updatedTrade) {
        throw new Error(error?.message || 'Unable to decline this trade. It may already be updated.');
      }

      Alert.alert('Declined', 'Trade offer declined');
      navigation.navigate('TradeList');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to decline trade');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !trade) {
    return (
      <ScreenLayout variant="detail" title="Leave Review">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading offer...</Text>
        </View>
      </ScreenLayout>
    );
  }

  const listing = trade.listing;
  const rawSpAmount =
    trade.sp_amount ??
    trade.swap_points_used ??
    trade.sp_used ??
    trade.swap_points_amount ??
    0;
  const spAmount = Number.isFinite(Number(rawSpAmount)) ? Number(rawSpAmount) : 0;
  const rawCashCents = trade.cash_amount_cents ?? trade.cash_cents ?? trade.offer_cash_cents ?? 0;
  const cashAmount = Number.isFinite(Number(rawCashCents)) ? Number(rawCashCents) / 100 : 0;

  return (
    <ScreenLayout variant="detail" title="Leave Review">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Review Offer</Text>

        {/* Trade Summary Card */}
        <View style={styles.tradeCard} testID="trade-review-card">
          <View style={styles.tradeSide}>
            <Image
              source={{ uri: listing?.images?.[0]?.url || 'https://via.placeholder.com/80' }}
              style={styles.itemThumb}
              resizeMode="cover"
            />
            <Text style={styles.itemTitle} numberOfLines={2}>
              {listing?.title || 'Item'}
            </Text>
            <Text style={styles.itemPrice}>${listing?.price?.toFixed(2) || '0.00'}</Text>
          </View>

          <View style={styles.arrowsDivider}>
            <ArrowsLeftRight size={24} color="#6B6B6B" weight="regular" />
          </View>

          <View style={styles.tradeSide}>
            <Text style={styles.tradeSideLabel}>Buyer Offers</Text>
            <Text style={styles.offerAmount}>${cashAmount.toFixed(2)}</Text>
            {spAmount > 0 && (
              <View style={styles.spBadgeRow}>
                <Coins size={16} color="#F59E0B" weight="regular" />
                <Text style={styles.spBadgeText}>+{spAmount} SP</Text>
              </View>
            )}
          </View>
        </View>

        {/* SP Summary */}
        <View style={styles.spSummaryRow} testID="trade-review-sp-summary">
          <Coins size={16} color="#F59E0B" weight="regular" style={{ marginRight: 8 }} />
          <Text style={styles.spSummaryText}>
            You'll receive {spAmount} swap points when trade completes
          </Text>
        </View>

        {/* Safety Disclaimer */}
        <View style={styles.disclaimerBox} testID="safety-disclaimer">
          <ShieldCheck size={20} color="#5DBB8E" weight="regular" style={{ marginRight: 8 }} />
          <Text style={styles.disclaimerText}>
            Meet in a safe, public location. Never share personal payment information.
          </Text>
        </View>

        {/* Accept Button */}
        <Pressable
          style={[styles.acceptButton, submitting && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={submitting}
          testID="accept-trade-button"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept Trade</Text>
          )}
        </Pressable>

        {/* Decline Link */}
        <Pressable
          style={styles.declineButton}
          onPress={handleDecline}
          disabled={submitting}
          testID="decline-trade-button"
        >
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showAcceptConfirm}
        type="alert"
        title="Accept Trade"
        message="Are you sure you want to accept this offer?"
        primaryButtonText="Accept"
        secondaryButtonText="Cancel"
        onPrimaryPress={confirmAcceptTrade}
        onSecondaryPress={() => setShowAcceptConfirm(false)}
        onClose={() => setShowAcceptConfirm(false)}
      />

      <Modal
        visible={showDeclineConfirm}
        type="alert"
        title="Decline Trade"
        message="Are you sure you want to decline this offer?"
        primaryButtonText="Decline"
        secondaryButtonText="Cancel"
        onPrimaryPress={confirmDeclineTrade}
        onSecondaryPress={() => setShowDeclineConfirm(false)}
        onClose={() => setShowDeclineConfirm(false)}
      />

      <PersistentTabBar />
    </ScreenLayout>
  );
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
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  tradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  tradeSide: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  itemThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  arrowsDivider: {
    paddingHorizontal: 8,
  },
  tradeSideLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    textTransform: 'uppercase',
  },
  offerAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  spBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  spBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  spSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  spSummaryText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  disclaimerBox: {
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 20,
  },
  acceptButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  declineButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineText: {
    fontSize: 14,
    color: '#E85D75',
  },
});

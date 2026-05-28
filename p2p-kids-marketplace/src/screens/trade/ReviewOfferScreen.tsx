/**
 * File: p2p-kids-marketplace/src/screens/trade/ReviewOfferScreen.tsx
 * Review Offer Screen - Sellers can review and accept/reject offers on their listings
 * 
 * Features:
 * - Display offer details (buyer's offer amount, SP amount)
 * - Show listing details
 * - Calculate SP earnings for seller
 * - Accept or Decline buttons
 * - Safety disclaimer
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowsLeftRight, Coins, ShieldCheck } from 'phosphor-react-native';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { LoadingSpinner } from '@/components/ui';
import { OfferCountdownPill } from '@/components/trade';
import ScreenLayout from '@/components/ScreenLayout';
import { previewTotalSPToSeller } from '@/services/spCalculatorService';

type ReviewOfferRouteProp = RouteProp<RootStackParamList, 'ReviewOffer'>;

interface OfferData {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  sp_amount: number;
  cash_amount_cents: number;
  buyer_transaction_fee_cents: number;
  created_at: string;
  offer_expires_at?: string | null;
  bundle_id?: string | null;
  listing: {
    title: string;
    price: number;
    images: { url: string; thumbnail_url?: string }[];
  };
  buyer_profile: {
    name: string;
  };
}

export default function ReviewOfferScreen() {
  const route = useRoute<ReviewOfferRouteProp>();
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { tradeId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offer, setOffer] = useState<OfferData | null>(null);
  // Addendum E: bundle context
  const [bundleSiblings, setBundleSiblings] = useState<OfferData[]>([]);
  const [showBundleList, setShowBundleList] = useState(false);
  const [acceptingBundle, setAcceptingBundle] = useState(false);
  // TFV2-D11: combined SP preview for seller
  const [spPreview, setSpPreview] = useState<{ totalSp: number } | null>(null);

  const fetchOffer = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select(`
          id,
          listing_id,
          buyer_id,
          seller_id,
          status,
          sp_amount,
          cash_amount_cents,
          buyer_transaction_fee_cents,
          created_at,
          offer_expires_at,
          bundle_id,
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `)
        .eq('id', tradeId)
        .eq('seller_id', session.user.id)
        .single();

      if (error) throw error;

      if (!data) {
        Alert.alert('Error', 'Offer not found');
        navigation.goBack();
        return;
      }

      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', data.buyer_id)
        .maybeSingle();

      setOffer({
        ...(data as any),
        buyer_profile: {
          name: buyerProfile?.name || 'Buyer',
        },
      });

      // Addendum E: fetch bundle siblings if this offer is part of a bundle.
      const bundleId = (data as any)?.bundle_id;
      if (bundleId) {
        try {
          const { data: siblings } = await supabase
            .from('trades')
            .select(`
              id,
              listing_id,
              buyer_id,
              seller_id,
              status,
              sp_amount,
              cash_amount_cents,
              buyer_transaction_fee_cents,
              created_at,
              offer_expires_at,
              bundle_id,
              listing:items(title, price, images:item_images(url, thumbnail_url))
            `)
            .eq('bundle_id', bundleId)
            .neq('id', tradeId)
            .eq('seller_id', session.user.id);
          if (siblings) {
            setBundleSiblings(
              siblings.map((s: any) => ({ ...s, buyer_profile: { name: '' } }))
            );
          }
        } catch {
          // Non-blocking: bundle list is informational.
        }
      }
    } catch (error: any) {
      console.error('[ReviewOffer] fetchOffer error:', error);
      Alert.alert('Error', 'Failed to load offer details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, tradeId, navigation]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  // TFV2-D11: load combined SP preview after offer is available
  useEffect(() => {
    if (!offer) return;
    previewTotalSPToSeller(offer.listing_id, offer.sp_amount)
      .then(preview => setSpPreview({ totalSp: preview.totalSp }))
      .catch(() => setSpPreview(null));
  }, [offer?.listing_id, offer?.sp_amount]);

  // Addendum E: accept all bundle offers in sequence.
  const handleAcceptBundle = async () => {
    if (!offer) return;
    const allOffers = [offer, ...bundleSiblings];
    Alert.alert(
      `Accept all ${allOffers.length} items?`,
      'The buyer will be notified to complete payment for all items.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Accept All ${allOffers.length}`,
          onPress: async () => {
            try {
              setAcceptingBundle(true);
              for (const o of allOffers) {
                if (o.status !== 'pending') continue;
                const { error } = await supabase
                  .from('trades')
                  .update({ status: 'payment_processing', updated_at: new Date().toISOString() })
                  .eq('id', o.id);
                if (error) throw error;
              }
              Alert.alert(
                'Bundle Accepted!',
                'The buyer has been notified to complete payment.',
                [{ text: 'OK', onPress: () => navigation.navigate('MyListings') }]
              );
            } catch (err: any) {
              console.error('[ReviewOffer] handleAcceptBundle error:', err);
              Alert.alert('Error', 'Failed to accept all items. Please try again.');
            } finally {
              setAcceptingBundle(false);
            }
          },
        },
      ]
    );
  };

  const handleAccept = async () => {
    if (!offer) return;

    Alert.alert(
      'Accept Trade',
      'Are you sure you want to accept this offer? The buyer will be notified to complete payment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              setSubmitting(true);
              
              // Update trade status to payment_processing (buyer needs to pay)
              const { error } = await supabase
                .from('trades')
                .update({ 
                  status: 'payment_processing',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', offer.id);

              if (error) throw error;

              Alert.alert(
                'Offer Accepted!',
                'The buyer has been notified and will complete payment. You will be notified when payment is received.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('MyListings'),
                  },
                ]
              );
            } catch (error: any) {
              console.error('[ReviewOffer] handleAccept error:', error);
              Alert.alert('Error', 'Failed to accept offer. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async () => {
    if (!offer) return;

    Alert.alert(
      'Decline Trade',
      'Are you sure you want to decline this offer? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);

              const { error } = await supabase
                .from('trades')
                .update({ 
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString(),
                  cancellation_reason: 'Seller declined offer',
                })
                .eq('id', offer.id);

              if (error) throw error;

              Alert.alert(
                'Offer Declined',
                'The buyer has been notified.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('MyListings'),
                  },
                ]
              );
            } catch (error: any) {
              console.error('[ReviewOffer] handleDecline error:', error);
              Alert.alert('Error', 'Failed to decline offer. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Review Offer">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading offer...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!offer) {
    return null;
  }

  const cashAmount = (offer.cash_amount_cents / 100).toFixed(2);
  const listingPrice = offer.listing.price.toFixed(2);
  const firstImage = offer.listing.images?.[0];

  return (
    <ScreenLayout variant="detail" title="Review Offer">

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {offer.status === 'pending' && offer.offer_expires_at ? (
          <OfferCountdownPill
            offerExpiresAt={offer.offer_expires_at}
            createdAt={offer.created_at}
            style={styles.countdownPill}
          />
        ) : null}

        {/* Addendum E: bundle context banner */}
        {bundleSiblings.length > 0 && (
          <View style={styles.bundleBanner} testID="bundle-context-banner">
            <Text style={styles.bundleBannerTitle}>
              Bundle offer · {bundleSiblings.length + 1} items
            </Text>
            <TouchableOpacity
              onPress={() => setShowBundleList((v) => !v)}
              accessibilityLabel="Toggle bundle item list"
            >
              <Text style={styles.bundleBannerToggle}>
                {showBundleList ? 'Hide items' : 'View all items'}
              </Text>
            </TouchableOpacity>
            {showBundleList && (
              <View style={styles.bundleItemsList}>
                {[offer, ...bundleSiblings].map((o) => (
                  <View key={o.id} style={styles.bundleItemRow}>
                    <Text style={styles.bundleItemTitle} numberOfLines={1}>
                      {o.listing?.title || 'Item'}
                    </Text>
                    <Text style={styles.bundleItemPrice}>
                      ${(o.cash_amount_cents / 100).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Trade Card */}
        <View style={styles.tradeCard}>
          <View style={styles.tradeCardHeader}>
            <Text style={styles.buyerLabel}>BUYER OFFERS</Text>
          </View>

          <View style={styles.tradeRow}>
            {/* Your Item */}
            <View style={styles.tradeItem}>
              {firstImage && (
                <Image
                  source={{ uri: firstImage.thumbnail_url || firstImage.url }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
              )}
              <Text style={styles.itemTitle} numberOfLines={2}>
                {offer.listing.title}
              </Text>
              <Text style={styles.itemPrice}>${listingPrice}</Text>
            </View>

            {/* Arrow */}
            <View style={styles.arrowContainer}>
              <ArrowsLeftRight size={24} color="#6B6B6B" weight="regular" />
            </View>

            {/* Cash Offer */}
            <View style={styles.offerAmountContainer}>
              <Text style={styles.offerAmount}>${cashAmount}</Text>
              {offer.sp_amount > 0 && (
                <View style={styles.spBadge}>
                  <Coins size={16} color="#F59E0B" weight="fill" />
                  <Text style={styles.spBadgeText}>+{offer.sp_amount} SP</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* SP Earnings Info — D-11: combined total only, no breakdown */}
        {spPreview && spPreview.totalSp > 0 && (
          <View style={styles.spInfoCard}>
            <Coins size={20} color="#F59E0B" weight="fill" />
            <Text style={styles.spInfoText}>
              {spPreview.totalSp} SP releasing in 3 days after completion
            </Text>
          </View>
        )}

        {/* Safety Disclaimer */}
        <View style={styles.disclaimerCard}>
          <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
          <Text style={styles.disclaimerText}>
            Meet in a safe, public location. Never share personal payment information.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Addendum E: Accept All button shown only for bundle offers */}
          {bundleSiblings.length > 0 && offer.status === 'pending' && (
            <TouchableOpacity
              style={[styles.acceptAllButton, (submitting || acceptingBundle) && styles.buttonDisabled]}
              onPress={handleAcceptBundle}
              disabled={submitting || acceptingBundle}
              accessibilityLabel={`Accept all ${bundleSiblings.length + 1} items`}
              testID="accept-bundle-button"
            >
              {acceptingBundle ? (
                <LoadingSpinner color="#FFFFFF" size={20} />
              ) : (
                <Text style={styles.acceptButtonText}>
                  Accept All {bundleSiblings.length + 1} Items
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.acceptButton, (submitting || acceptingBundle) && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={submitting || acceptingBundle}
            accessibilityLabel="Accept trade offer"
          >
            {submitting ? (
              <LoadingSpinner color="#FFFFFF" size={20} />
            ) : (
              <Text style={styles.acceptButtonText}>Accept Trade</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.declineButton, (submitting || acceptingBundle) && styles.buttonDisabled]}
            onPress={handleDecline}
            disabled={submitting || acceptingBundle}
            accessibilityLabel="Decline trade offer"
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  countdownPill: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  tradeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tradeCardHeader: {
    marginBottom: 12,
  },
  buyerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    letterSpacing: 0.5,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tradeItem: {
    flex: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  arrowContainer: {
    paddingHorizontal: 16,
  },
  offerAmountContainer: {
    flex: 1,
    alignItems: 'center',
  },
  offerAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5DBB8E',
    marginBottom: 8,
  },
  spBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
  },
  spBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  // Addendum E: bundle styles
  bundleBanner: {
    backgroundColor: '#EEF9F4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bundleBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5DBB8E',
    marginBottom: 4,
  },
  bundleBannerToggle: {
    fontSize: 13,
    color: '#5DBB8E',
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  bundleItemsList: {
    marginTop: 8,
    gap: 6,
  },
  bundleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  bundleItemTitle: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    marginRight: 8,
  },
  bundleItemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  acceptAllButton: {
    backgroundColor: '#34A56F',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  spInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  spInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 12,
  },
  acceptButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 52,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

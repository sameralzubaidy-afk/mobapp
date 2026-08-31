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
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowsLeftRight, Coins, CreditCard, ShieldCheck } from 'phosphor-react-native';
import { LoadingSpinner } from '@/components/ui';
import { OfferCountdownPill } from '@/components/trade';
import ScreenLayout from '@/components/ScreenLayout';
import { respondToOffer, acceptBundleOffers } from '@/services/tradeServiceV2';
import { TradeConfirmationModal } from '@/components/molecules/TradeConfirmationModal';
import { previewTotalSPToSeller } from '@/services/spCalculatorService';
import { getSubscriptionSummary } from '@/services/subscription';
import { captureException } from '@/services/errorReporter';
import { getSPReleaseDays } from '@/services/adminConfig';
// Dev Task 51 item 4: branded, AX-exposed success notices instead of native
// Alert.alert — deterministic testIDs for QA + design-system-consistent buttons.
import { useGlobalAlert } from '@/providers/GlobalAlertProvider';

type ReviewOfferRouteProp = RouteProp<RootStackParamList, 'ReviewOffer'>;

interface OfferData {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  cancellation_reason?: string | null;
  sp_amount: number;
  cash_amount_cents: number;
  buyer_transaction_fee_cents: number;
  seller_transaction_fee_cents?: number; // DEV-TASK-62 (Item 2): net payout = cash − seller fee
  created_at: string;
  offer_expires_at?: string | null;
  bundle_id?: string | null;
  seller_sp_earned?: number; // NEW: total SP to seller (buyer SP + bonus)
  seller_sp_bonus?: number; // NEW: platform-funded bonus
  sp_transferred_at?: string; // NEW: when SP transferred (set at completion — DT-17)
  // DEV-TASK-76 (T08): category SP multiplier snapshot on the trade row. The
  // bundle-list platform-bonus preview must use THIS (same source as
  // fn_release_all_sp_on_complete), not a 1.0 fallback — otherwise the bundle
  // list and the payout card disagree (e.g. +60 vs +61 for Sports 1.10).
  sp_category_multiplier?: number;
  stripe_payment_method_brand?: string | null; // DT-69 (Item 6): buyer's card brand, offer-time snapshot
  stripe_payment_method_last4?: string | null; // DT-69 (Item 6): buyer's card last4, offer-time snapshot
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
  const { showAlert } = useGlobalAlert();
  const { tradeId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offer, setOffer] = useState<OfferData | null>(null);
  // ✅ FIX: Track total SP (buyer SP + platform bonus) for accurate display
  const [totalSpToSeller, setTotalSpToSeller] = useState<number>(0);
  // C05 (2026-08-28): the seller's platform bonus is only credited to a
  // subscribed seller — gate the bundle preview on the same check the server uses.
  const [sellerIsSubscriber, setSellerIsSubscriber] = useState(false);
  // Addendum E: bundle context
  const [bundleSiblings, setBundleSiblings] = useState<OfferData[]>([]);
  const [showBundleList, setShowBundleList] = useState(false);
  const [acceptingBundle, setAcceptingBundle] = useState(false);
  // Whisk styled confirmation modals (replacing native Alert.alert)
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showAcceptBundleModal, setShowAcceptBundleModal] = useState(false);
  const [releaseDays, setReleaseDays] = useState(3);

  const fetchOffer = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select(
          `
          id,
          listing_id,
          buyer_id,
          seller_id,
          status,
          cancellation_reason,
          sp_amount,
          cash_amount_cents,
          buyer_transaction_fee_cents,
          seller_transaction_fee_cents,
          created_at,
          offer_expires_at,
          bundle_id,
          seller_sp_earned,
          seller_sp_bonus,
          sp_transferred_at,
          sp_category_multiplier,
          stripe_payment_method_brand,
          stripe_payment_method_last4,
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `
        )
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

      const offerData = {
        ...(data as any),
        buyer_profile: {
          name: buyerProfile?.name || 'Buyer',
        },
      };
      setOffer(offerData);

      // ✅ FIX: Calculate total SP (buyer SP + platform bonus) for accurate display
      if (offerData.sp_amount > 0 && offerData.listing_id) {
        try {
          const spPreview = await previewTotalSPToSeller(offerData.listing_id, offerData.sp_amount);
          setTotalSpToSeller(spPreview.totalSp);
        } catch (err) {
          captureException(err, {
            tags: { screen: 'ReviewOfferScreen', action: 'calculate_total_sp' },
          });
          // Fallback to buyer SP only if calculation fails
          setTotalSpToSeller(offerData.sp_amount);
        }
      } else {
        setTotalSpToSeller(0);
      }

      // Addendum E: fetch bundle siblings if this offer is part of a bundle.
      const bundleId = (data as any)?.bundle_id;
      if (bundleId) {
        try {
          const { data: siblings } = await supabase
            .from('trades')
            .select(
              `
              id,
              listing_id,
              buyer_id,
              seller_id,
              status,
              sp_amount,
              cash_amount_cents,
              buyer_transaction_fee_cents,
              seller_transaction_fee_cents,
              created_at,
              offer_expires_at,
              bundle_id,
              seller_sp_earned,
              seller_sp_bonus,
              sp_category_multiplier,
              listing:items(title, price, images:item_images(url, thumbnail_url))
            `
            )
            .eq('bundle_id', bundleId)
            .neq('id', tradeId)
            .eq('seller_id', session.user.id);
          if (siblings) {
            setBundleSiblings(siblings.map((s: any) => ({ ...s, buyer_profile: { name: '' } })));
          }
        } catch {
          // Non-blocking: bundle list is informational.
        }
      }
    } catch (error: any) {
      captureException(error, {
        tags: { screen: 'ReviewOfferScreen', action: 'fetch_offer' },
        extra: { message: error?.message },
      });
      Alert.alert('Error', 'Failed to load offer details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, tradeId, navigation]);

  useEffect(() => {
    fetchOffer();
    // Load admin-configured SP release days
    getSPReleaseDays()
      .then(setReleaseDays)
      .catch(() => {
        /* keep default 3 */
      });
  }, [fetchOffer]);

  // C05 (2026-08-28): resolve the seller's subscription status so the bundle
  // preview can gate the platform bonus exactly like the server credit path
  // (fn_release_all_sp_on_complete checks the SELLER's subscription).
  useEffect(() => {
    if (!session?.user?.id) return;
    let isCancelled = false;
    getSubscriptionSummary(session.user.id)
      .then((summary) => {
        if (!isCancelled) setSellerIsSubscriber(summary.is_subscriber);
      })
      .catch(() => {
        /* keep default false */
      });
    return () => {
      isCancelled = true;
    };
  }, [session?.user?.id]);

  // TFV2-012A (D-30): Accept all bundle offers via Edge Function (Stripe capture + in_progress)
  const handleAcceptBundle = async () => {
    if (!offer) return;
    setShowAcceptBundleModal(true);
  };

  const executeAcceptBundle = async () => {
    if (!offer) return;
    const allOffers = [offer, ...bundleSiblings];
    const pendingIds = allOffers.filter((o) => o.status === 'pending').map((o) => o.id);
    if (pendingIds.length === 0) return;
    try {
      setAcceptingBundle(true);
      // Single EF call — processes all trades in parallel internally
      await acceptBundleOffers(pendingIds);
      setShowAcceptBundleModal(false);
      showAlert({
        title: 'Bundle Accepted!',
        message: 'Payment authorized. Trades are now in progress.',
        buttons: [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MyListings'),
            testID: 'bundle-accepted-ok-button',
          },
        ],
      });
    } catch (err: any) {
      captureException(err, {
        tags: { screen: 'ReviewOfferScreen', action: 'accept_bundle' },
        extra: { message: err?.message },
      });
      Alert.alert('Error', 'Failed to accept all items. Please try again.');
    } finally {
      setAcceptingBundle(false);
    }
  };

  // TFV2-012A (D-30): Accept via Edge Function — captures Stripe pre-auth, sets in_progress, sets auto_complete_at
  const handleAccept = async () => {
    if (!offer) return;
    setShowAcceptModal(true);
  };

  const executeAccept = async () => {
    if (!offer) return;
    try {
      setSubmitting(true);
      setShowAcceptModal(false);
      await respondToOffer(offer.id, 'accept');
      showAlert({
        title: 'Offer Accepted!',
        message: 'Payment authorized. Trade is now in progress. The buyer can confirm receipt.',
        buttons: [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MyListings'),
            testID: 'offer-accepted-ok-button',
          },
        ],
      });
    } catch (error: any) {
      captureException(error, {
        tags: { screen: 'ReviewOfferScreen', action: 'accept_offer' },
        extra: { message: error?.message },
      });
      Alert.alert('Error', 'Failed to accept offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!offer) return;
    setShowDeclineModal(true);
  };

  const executeDecline = async () => {
    if (!offer) return;
    try {
      setSubmitting(true);
      setShowDeclineModal(false);
      await respondToOffer(offer.id, 'decline');
      showAlert({
        title: 'Offer Declined',
        message: 'The buyer has been notified. The item stays listed.',
        buttons: [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MyListings'),
            testID: 'offer-declined-ok-button',
          },
        ],
      });
    } catch (error: any) {
      captureException(error, {
        tags: { screen: 'ReviewOfferScreen', action: 'decline_offer' },
        extra: { message: error?.message },
      });
      Alert.alert('Error', 'Failed to decline offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  // DEV-TASK-62 (Item 2): Net Cash Payout must be cash MINUS the seller
  // platform fee. Server formula (complete_trade_v2 / TradeTimelineScreen):
  // payout = GREATEST(0, cash_amount_cents − seller_transaction_fee_cents).
  const sellerFeeCents = offer.seller_transaction_fee_cents ?? 0;
  const sellerNetCents = Math.max(0, offer.cash_amount_cents - sellerFeeCents);
  const sellerNet = (sellerNetCents / 100).toFixed(2);
  const sellerFee = (sellerFeeCents / 100).toFixed(2);

  return (
    <ScreenLayout variant="detail" title="Review Offer">
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Show expired badge for cancelled offers */}
        {offer.status === 'cancelled' && offer.cancellation_reason === 'Offer expired' && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredBannerText}>⏱️ Expired</Text>
          </View>
        )}

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
              testID="review-bundle-toggle"
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.bundleBannerToggle}>
                {showBundleList ? 'Hide items' : 'View all items'}
              </Text>
            </TouchableOpacity>
            {showBundleList && (
              <View style={styles.bundleItemsList}>
                {[offer, ...bundleSiblings].map((o) => {
                  const itemSp = o.sp_amount ?? 0;
                  const itemPrice = o.listing?.price ?? 0;
                  // DEV-TASK-62 (Item 2): per-item NET payout = cash portion
                  // (price − SP) − seller platform fee.
                  const netPayout =
                    Math.max(
                      0,
                      (o.cash_amount_cents ?? 0) - (o.seller_transaction_fee_cents ?? 0)
                    ) / 100;
                  // Seller earnings = buyer SP + platform bonus. Platform bonus
                  // mirrors fn_release_all_sp_on_complete: FLOOR(price × 0.25 ×
                  // multiplier), credited only to a subscribed seller (C05 fix).
                  const multiplier = o.sp_category_multiplier ?? 1.0;
                  const platformBonus =
                    sellerIsSubscriber && itemPrice > 0
                      ? Math.floor(itemPrice * 0.25 * multiplier)
                      : 0;
                  const sellerSpEarned = itemSp + platformBonus;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={styles.bundleItemRow}
                      onPress={() => navigation.navigate('ReviewOffer', { tradeId: o.id })}
                      testID={`review-bundle-item-${o.id}`}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={o.listing?.title || 'Item'}
                    >
                      <Text style={styles.bundleItemTitle} numberOfLines={1}>
                        {o.listing?.title || 'Item'}
                      </Text>
                      <View style={styles.bundleItemDetail}>
                        {o.status !== 'pending' && (
                          <View
                            style={
                              o.status === 'cancelled'
                                ? styles.statusBadgeCancelled
                                : styles.statusBadgeAccepted
                            }
                          >
                            <Text
                              style={
                                o.status === 'cancelled'
                                  ? styles.statusTextCancelled
                                  : styles.statusTextAccepted
                              }
                            >
                              {o.status === 'cancelled' ? 'Declined' : 'Accepted'}
                            </Text>
                          </View>
                        )}
                        {sellerSpEarned > 0 && o.status === 'pending' && (
                          <Text style={styles.bundleItemSp}>+{sellerSpEarned} SP</Text>
                        )}
                        <Text style={styles.bundleItemPrice}>${netPayout.toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {/* Bundle totals */}
                {(() => {
                  const allItems = [offer, ...bundleSiblings];
                  const totalCash = allItems.reduce(
                    (s, o) => s + (o.cash_amount_cents ?? 0) / 100,
                    0
                  );
                  // Seller SP earned per item = sp_amount + platform bonus
                  // (FLOOR(price × 0.25 × multiplier), subscribed sellers only — C05 fix)
                  const totalSellerSp = allItems.reduce((s, o) => {
                    const sp = o.sp_amount ?? 0;
                    const mult = o.sp_category_multiplier ?? 1.0;
                    const price = o.listing?.price ?? 0;
                    const bonus =
                      sellerIsSubscriber && price > 0 ? Math.floor(price * 0.25 * mult) : 0;
                    return s + sp + bonus;
                  }, 0);
                  return (
                    <View style={styles.bundleTotalRow}>
                      <View style={styles.bundleTotalLine}>
                        <Text style={styles.bundleTotalLabel}>Buyer's Total Paid</Text>
                        <Text style={styles.bundleTotalValue}>${totalCash.toFixed(2)}</Text>
                      </View>
                      {totalSellerSp > 0 && (
                        <View style={styles.bundleTotalLine}>
                          <Text style={styles.bundleTotalLabel}>Points Earned</Text>
                          <Text style={[styles.bundleTotalValue, styles.spEarnedText]}>
                            +{totalSellerSp} SP
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
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
            </View>
          </View>
        </View>

        {/* ✅ FIX: SP Info — shows TOTAL SP (buyer SP + platform bonus) */}
        {totalSpToSeller > 0 && (
          <View style={styles.spInfoCard}>
            <Coins size={20} color="#F59E0B" weight="fill" />
            <Text style={styles.spInfoText}>
              {totalSpToSeller} SP releasing in {releaseDays} days after completion
            </Text>
          </View>
        )}

        {/* DT-69 (Item 6): show the buyer's payment method so the seller knows how
            the buyer intends to pay before accepting. A pending offer always has a
            Stripe auth hold, hence the "(authorized)" suffix. Hidden for expired /
            declined offers (no active authorization) and for $0-cash (donate) offers
            where no payment method was used. */}
        {offer.status === 'pending' && offer.stripe_payment_method_last4 && (
          <View style={styles.paymentMethodCard} testID="review-buyer-payment-method">
            <CreditCard size={20} color="#6B6B6B" weight="fill" />
            <Text style={styles.paymentMethodText}>
              Buyer pays via {offer.stripe_payment_method_brand?.toUpperCase() ?? 'Card'} ••••{' '}
              {offer.stripe_payment_method_last4} (authorized)
            </Text>
          </View>
        )}

        {/* Payout Breakdown — DEV-TASK-62 (Item 2): shows the cash amount, the
            seller platform fee, and the true NET payout; now shown for ALL
            offers (was gated on sp_amount > 0 and displayed gross cash). */}
        <View style={styles.payoutCard} testID="payout-breakdown">
          <Text style={styles.payoutCardTitle}>Your Payout</Text>
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Cash Amount</Text>
            <Text style={styles.payoutValue}>${cashAmount}</Text>
          </View>
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Platform Fee</Text>
            <Text style={[styles.payoutValue, styles.payoutFeeText]}>-${sellerFee}</Text>
          </View>
          {totalSpToSeller > 0 && (
            <View style={styles.payoutRow}>
              <Text style={styles.payoutLabel}>Points Earned</Text>
              <Text style={[styles.payoutValue, styles.spDiscountText]}>+{totalSpToSeller} SP</Text>
            </View>
          )}
          <View style={[styles.payoutRow, styles.payoutTotalRow]}>
            <Text style={styles.payoutTotalLabel}>Net Cash Payout</Text>
            <Text style={styles.payoutTotalValue}>${sellerNet}</Text>
          </View>
        </View>

        {/* Safety Disclaimer */}
        <View style={styles.disclaimerCard}>
          <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
          <Text style={styles.disclaimerText}>
            Meet in a safe, public location. Never share personal payment information.
          </Text>
        </View>

        {/* Action Buttons - Only show if offer is still pending */}
        {offer.status === 'pending' ? (
          <View style={styles.actionsContainer}>
            {/* Addendum E: Accept All button — only pending items */}
            {(() => {
              const pendingCount = [offer, ...bundleSiblings].filter(
                (o) => o.status === 'pending'
              ).length;
              if (pendingCount <= 1) return null;
              return (
                <TouchableOpacity
                  style={[
                    styles.acceptAllButton,
                    (submitting || acceptingBundle) && styles.buttonDisabled,
                  ]}
                  onPress={handleAcceptBundle}
                  disabled={submitting || acceptingBundle}
                  accessibilityLabel={`Accept all ${pendingCount} items`}
                  testID="accept-bundle-button"
                  accessible
                  accessibilityRole="button"
                >
                  {acceptingBundle ? (
                    <LoadingSpinner color="#FFFFFF" size={20} />
                  ) : (
                    <Text style={styles.acceptButtonText}>Accept All {pendingCount} Items</Text>
                  )}
                </TouchableOpacity>
              );
            })()}

            <TouchableOpacity
              style={[
                styles.acceptButton,
                (submitting || acceptingBundle) && styles.buttonDisabled,
              ]}
              onPress={handleAccept}
              disabled={submitting || acceptingBundle}
              accessibilityLabel="Accept trade offer"
              testID="accept-trade-button"
              accessible
              accessibilityRole="button"
            >
              {submitting ? (
                <LoadingSpinner color="#FFFFFF" size={20} />
              ) : (
                <Text style={styles.acceptButtonText}>Accept Trade</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.declineButton,
                (submitting || acceptingBundle) && styles.buttonDisabled,
              ]}
              onPress={handleDecline}
              disabled={submitting || acceptingBundle}
              accessibilityLabel="Decline trade offer"
              testID="decline-trade-button"
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.expiredActionsContainer}>
            <Text style={styles.expiredMessage}>
              This offer has expired and can no longer be accepted.
            </Text>
            <TouchableOpacity
              style={styles.expiredBackButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              testID="back-to-offers-button"
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.expiredBackButtonText}>Back to Offers</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Whisk styled confirmation modals */}
      <TradeConfirmationModal
        visible={showAcceptModal}
        title="Accept Trade"
        message="Are you sure you want to accept this offer? The buyer's payment will be authorized and the trade moves to in progress."
        confirmLabel="Accept"
        variant="accept"
        onConfirm={executeAccept}
        onCancel={() => setShowAcceptModal(false)}
        loading={submitting}
        confirmTestID="accept-trade-confirm-button"
        cancelTestID="accept-trade-cancel-button"
      />

      <TradeConfirmationModal
        visible={showDeclineModal}
        title="Decline Trade"
        message="Are you sure you want to decline this offer? Your item stays listed and can receive new offers. This action cannot be undone."
        confirmLabel="Decline"
        variant="decline"
        onConfirm={executeDecline}
        onCancel={() => setShowDeclineModal(false)}
        loading={submitting}
        confirmTestID="decline-trade-confirm-button"
        cancelTestID="decline-trade-cancel-button"
      />

      <TradeConfirmationModal
        visible={showAcceptBundleModal}
        title={(() => {
          const pendingCount = offer
            ? [offer, ...bundleSiblings].filter((o) => o.status === 'pending').length
            : 0;
          return `Accept all ${pendingCount} items?`;
        })()}
        message="Accepting will authorize the buyer's payment and move all trades in progress."
        confirmLabel={`Accept All ${offer ? [offer, ...bundleSiblings].length : 0}`}
        variant="accept"
        onConfirm={executeAcceptBundle}
        onCancel={() => setShowAcceptBundleModal(false)}
        loading={acceptingBundle}
        confirmTestID="accept-bundle-confirm-button"
        cancelTestID="accept-bundle-cancel-button"
      />
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
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
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
  expiredBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  expiredBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
  expiredActionsContainer: {
    gap: 12,
    paddingTop: 8,
  },
  expiredMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  expiredBackButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  expiredBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Points-redemption: payout breakdown card
  payoutCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  payoutCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  payoutLabel: {
    fontSize: 14,
    color: '#374151',
  },
  payoutValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  spDiscountText: {
    color: '#5DBB8E',
    fontWeight: '600',
  },
  spEarnedText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  // DEV-TASK-62 (Item 2): platform-fee deduction row on the payout card
  payoutFeeText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  payoutTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 6,
    paddingTop: 8,
  },
  payoutTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  payoutTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  // Bundle item SP detail
  bundleItemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bundleItemSp: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  statusBadgeAccepted: {
    backgroundColor: '#E8F5F0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusTextAccepted: {
    fontSize: 10,
    color: '#5DBB8E',
    fontWeight: '700',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusTextCancelled: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
  // Bundle totals
  bundleTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
  },
  bundleTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  bundleTotalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  bundleTotalValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  bundlePayoutRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
    paddingTop: 6,
  },
  bundlePayoutLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bundlePayoutValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5DBB8E',
  },
});

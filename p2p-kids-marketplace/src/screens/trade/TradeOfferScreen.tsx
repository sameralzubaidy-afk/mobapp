/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeOfferScreen.tsx
 * TASK FLOW-08-01: Trade Offer Screen - Whisk Design System
 *
 * Redesigned with:
 * - Phosphor icons (ArrowsLeftRight, Coins, ShieldCheck)
 * - Two-column trade card layout
 * - Gold SP input (#FEF3C7 bg, #F59E0B accent)
 * - Green pill button (#5DBB8E)
 *
 * Bugfix: Added missing payment method section (saved card + new card CardField)
 * Bugfix: Added getTransactionFee to fetchData for dynamic fee resolution
 * Bugfix: useStripe() called unconditionally at top level (React Hooks rule)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { getItemById, Item } from '@/services/items';
import {
  createTradeOfferWithHold,
  mapStripeErrorToMessage,
  getBuyerPendingOffersForSeller,
} from '@/services/trade';
import { captureException } from '@/services/errorReporter';
import { useAuth, useSPWallet, useSubscriptionStatus } from '@/hooks/useAuth';
import { getAdminConfig, getBuyerFeeForCheckout, type BuyerFeeInfo } from '@/services/adminConfig';
import { trackEvent } from '@/services/analytics';
import { calculateCategorySP } from '@/services/categoryService';
import { getPaymentMethod, type PaymentMethodInfo } from '@/services/subscription';
import { useStripe } from '@stripe/stripe-react-native';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';
import { supabase } from '@/config/supabase';
import WalletWarningBanner, { type WalletState } from '@/components/molecules/WalletWarningBanner';
import DisclaimerModal from '@/components/DisclaimerModal';
import { SPInfoTooltip } from '@/components/modals/SPInfoTooltip';
import { Modal, LoadingSpinner } from '@/components/ui';
import { TradeConfirmationModal } from '@/components/molecules/TradeConfirmationModal';
import { ArrowsLeftRight, Coins, ShieldCheck } from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';
import { useTaxCalculation } from '@/hooks/useTaxCalculation';
import TaxBreakdownRow from '@/components/trade/TaxBreakdownRow';
import {
  KeyboardDoneAccessory,
  KEYBOARD_DONE_ACCESSORY_ID,
} from '@/components/shared/KeyboardDoneAccessory';

type TradeOfferRouteProp = RouteProp<RootStackParamList, 'TradeInitiation'>;

export default function TradeOfferScreen() {
  const route = useRoute<TradeOfferRouteProp>();
  const navigation = useNavigation<any>();
  const { session, refreshSession } = useAuth();
  const subStatus = useSubscriptionStatus();
  const walletStats = useSPWallet();

  const user = session?.user;
  const { itemId } = route.params;

  // ── Stripe hooks (unconditional, top-level) ─────────────────────────────
  // The Stripe module is intentionally unused on this screen (card entry flows
  // through usePaymentSheet), but the hook MUST be called unconditionally at
  // top level to satisfy the React Hooks rule (see file-top comment).
  useStripe();
  const {
    setupPaymentSheet,
    presentSheet,
    loading: paymentSheetLoading,
    error: paymentSheetError,
  } = usePaymentSheet();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [spAmount, setSpAmount] = useState(0);
  const [maxSpAllowed, setMaxSpAllowed] = useState(0);
  const [maxSpPercentage, setMaxSpPercentage] = useState(50);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showSpInfoTooltip, setShowSpInfoTooltip] = useState(false);
  const [showOfferLimitModal, setShowOfferLimitModal] = useState(false);
  const [offerLimitMessage, setOfferLimitMessage] = useState('');
  // R1 — Tiered Buyer-Fee Engine: the buyer fee is resolved from the DB and kept
  // in sync with the SP amount (percentage tier applies to the cash portion).
  const [buyerFeeInfo, setBuyerFeeInfo] = useState<BuyerFeeInfo | null>(null);
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loadingSavedPaymentMethod, setLoadingSavedPaymentMethod] = useState(false);
  const [paymentInputMode, setPaymentInputMode] = useState<'saved' | 'new'>('saved');
  const [addingNewCard, setAddingNewCard] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isDuplicate?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    isDuplicate: false,
  });
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [itemData, config] = await Promise.all([getItemById(itemId), getAdminConfig()]);

      if (!itemData) {
        Alert.alert('Error', 'Item not found');
        navigation.goBack();
        return;
      }

      await refreshSession();

      setItem(itemData);

      if (itemData.category_id) {
        const spConfig = await calculateCategorySP(itemData.category_id, itemData.price);
        if (spConfig) {
          setMaxSpAllowed(spConfig.max_spend_sp);
          setMaxSpPercentage(spConfig.spend_percent);
        } else {
          const fallbackMaxSp = Math.floor(
            (itemData.price * (config?.sp_max_percentage_per_purchase || 50)) / 100
          );
          setMaxSpAllowed(fallbackMaxSp);
          if (config?.sp_max_percentage_per_purchase) {
            setMaxSpPercentage(config.sp_max_percentage_per_purchase);
          }
        }
      } else {
        const fallbackPercent = config?.sp_max_percentage_per_purchase || 50;
        const fallbackMaxSp = Math.floor((itemData.price * fallbackPercent) / 100);
        setMaxSpAllowed(fallbackMaxSp);
        setMaxSpPercentage(fallbackPercent);
      }
    } catch (error) {
      captureException(error, {
        tags: { screen: 'TradeOfferScreen', action: 'fetch_trade_data' },
      });
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  }, [itemId, navigation, refreshSession, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // R1 — Tiered Buyer-Fee Engine: recompute the buyer fee whenever the item or
  // the applied Swap Points change (the percentage tier is a % of the cash
  // portion, so SP reduces the fee). The server recomputes authoritatively at
  // offer time; this keeps the preview accurate.
  useEffect(() => {
    if (!item || !user?.id) return;
    let isCancelled = false;
    const itemPriceCents = Math.round(item.price * 100);
    const cashPortionCents = itemPriceCents - spAmount * 100;
    getBuyerFeeForCheckout(cashPortionCents).then((fee) => {
      if (!isCancelled && fee) {
        setBuyerFeeInfo(fee);
        // R9 — checkout event: fee breakdown shown to the buyer.
        trackEvent('checkout_fee_shown', {
          screen: 'trade_offer',
          item_id: item.id,
          fee_cents: fee.feeCents,
          item_price_cents: itemPriceCents,
          sp_amount: spAmount,
          cash_portion_cents: cashPortionCents,
        });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [item, spAmount, user?.id]);

  // Load saved payment method on mount
  useEffect(() => {
    if (!user?.id || !item || loading) {
      return;
    }

    let isCancelled = false;

    const loadSavedPaymentMethod = async () => {
      setLoadingSavedPaymentMethod(true);
      const method = await getPaymentMethod();

      if (isCancelled) {
        return;
      }

      setSavedPaymentMethod(method);
      if (method?.id) {
        setPaymentInputMode('saved');
      } else {
        setPaymentInputMode('new');
      }
      setLoadingSavedPaymentMethod(false);
    };
    void loadSavedPaymentMethod();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, item, loading]);

  /** handleAddNewCard — Uses Stripe Payment Sheet (same as PaymentMethodsScreen)
   *  to securely collect card details via Stripe's native UI (PCI-compliant).
   *  On success, attaches the PaymentMethod to the customer and refreshes state. */
  const handleAddNewCard = async () => {
    setAddingNewCard(true);
    try {
      await setupPaymentSheet({ amount: 0, isRenewal: true });

      const result = await presentSheet();

      if (result.success && result.paymentMethodId) {
        // Attach payment method to Stripe customer and persist to DB
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!currentSession?.user?.id) {
          Alert.alert('Error', 'Not authenticated');
          return;
        }

        const { data, error } = await supabase.functions.invoke('attach-payment-method', {
          body: {
            payment_method_id: result.paymentMethodId,
          },
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        });

        if (error) {
          Alert.alert('Error', error.message || 'Failed to save payment method');
          return;
        }

        if (!data?.success) {
          const errMsg = (data as any)?.error || 'Failed to save payment method';
          Alert.alert('Error', errMsg);
          return;
        }

        // Refresh payment method from DB
        const updatedMethod = await getPaymentMethod();
        setSavedPaymentMethod(updatedMethod);
        setPaymentInputMode('saved');
        Alert.alert('Card Added', 'Your new card has been saved successfully.');
      } else if (result.error) {
        const errorLower = result.error.toLowerCase();
        if (!errorLower.includes('cancel')) {
          Alert.alert('Error', result.error || 'Failed to add card.');
        }
      }
    } catch (err: any) {
      captureException(err, {
        tags: { screen: 'TradeOfferScreen', action: 'add_new_card' },
        extra: { message: err?.message },
      });
      Alert.alert('Error', err.message || 'An unexpected error occurred');
    } finally {
      setAddingNewCard(false);
    }
  };

  const handleSendOffer = async () => {
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = async (policyId: string) => {
    setShowDisclaimer(false);
    await handleInitiateTrade(policyId);
  };

  const handleInitiateTrade = async (policyId?: string) => {
    if (!item) return;

    const isSubscriber =
      subStatus.status === 'active' || subStatus.status === 'trial' || subStatus.status === 'grace';

    // Calculate cash amount (item price - SP discount + fee)
    const itemPriceCents = Math.round(item.price * 100);
    const spDiscountCents = spAmount * 100;
    // R1: use the server-resolved fee (falls back to a legacy estimate for
    // display only; the Edge Function recomputes authoritatively).
    const platformFeeCents = buyerFeeInfo?.feeCents ?? (isSubscriber ? 99 : 299);
    const cashAmountCents = itemPriceCents - spDiscountCents + platformFeeCents;

    // ── Payment method validation ──────────────────────────────────────────
    if (cashAmountCents > 0 && paymentInputMode === 'new' && !savedPaymentMethod?.id) {
      Alert.alert(
        'Payment Method Required',
        'Please add a new card first by tapping "Add New Card" below.'
      );
      return;
    }

    if (cashAmountCents > 0 && paymentInputMode === 'saved' && !savedPaymentMethod?.id) {
      Alert.alert('Payment Method Required', 'No saved card is available. Please add a new card.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Payment Method', onPress: () => navigation.navigate('PaymentMethods') },
      ]);
      return;
    }

    try {
      setSubmitting(true);

      // ── 1. Collect payment method ID (saved card) ─────────────────────────
      const selectedPaymentMethodId: string | undefined = savedPaymentMethod?.id ?? undefined;

      if (cashAmountCents > 0 && !selectedPaymentMethodId) {
        Alert.alert('Payment Error', 'No valid payment method selected');
        return;
      }

      // ── 2. TFV2-012A (D-30): Atomic offer creation with Stripe pre-auth ──
      const subscriptionStatus =
        subStatus.status === 'active' ||
        subStatus.status === 'trial' ||
        subStatus.status === 'grace'
          ? subStatus.status
          : 'free';

      // R9 — checkout event: user tapped Send Offer, checkout began.
      trackEvent('checkout_started', {
        screen: 'trade_offer',
        item_id: item.id,
        sp_amount: spAmount,
        cash_amount_cents: cashAmountCents,
      });

      const offerResult = await createTradeOfferWithHold({
        item_id: item.id,
        sp_amount: spAmount,
        payment_method_id: selectedPaymentMethodId,
        cash_amount_cents: cashAmountCents,
        transaction_fee_cents: platformFeeCents,
        buyer_subscription_status: subscriptionStatus,
        tax_amount_cents: tax.taxAmountCents,
      });

      if (!offerResult.success || !offerResult.trade_id) {
        // R9 — checkout event: checkout did not complete.
        trackEvent('checkout_failed', {
          screen: 'trade_offer',
          item_id: item.id,
          reason: offerResult.error_code ?? 'offer_error',
        });

        // D-30: max pending offers per seller (cap is admin-configurable)
        if (offerResult.error_code === 'MAX_PENDING_OFFERS') {
          // Dev Task 41 item 7: name the open offers so the buyer can identify
          // and cancel the right one instead of guessing.
          const pendingOffers = (await getBuyerPendingOffersForSeller(item.seller_id)) ?? [];
          const openList = pendingOffers.length
            ? pendingOffers
                .map(
                  (o) =>
                    `• ${o.title} — $${(o.cash_amount_cents / 100).toFixed(2)}${
                      o.sp_amount > 0 ? ` + ${o.sp_amount} SP` : ''
                    }`
                )
                .join('\n')
            : '';
          setOfferLimitMessage(
            `${offerResult.error || 'You have reached the offer limit for this seller.'}\n\nOpen offers:\n${openList}\n\nWait for one of your pending offers to resolve, or cancel one to free a slot.`
          );
          setShowOfferLimitModal(true);
          return;
        }

        // Card decline / Stripe errors → user-friendly message
        if (
          offerResult.error_code === 'STRIPE_HOLD_FAILED' ||
          offerResult.error_code === 'STRIPE_ERROR'
        ) {
          Alert.alert('Payment Hold Failed', mapStripeErrorToMessage(offerResult.error));
          return;
        }

        Alert.alert(
          'Offer Failed',
          offerResult.error || 'Could not submit your offer. Please try again.'
        );
        return;
      }

      const tradeId = offerResult.trade_id;

      // ── 3. Record disclaimer acknowledgment (best effort) ─────────────────
      if (policyId) {
        try {
          const { error: disclaimerError } = await supabase.rpc('acknowledge_trade_disclaimer', {
            p_trade_id: tradeId,
            p_disclaimer_policy_id: policyId,
          });
          if (disclaimerError) {
            console.warn('⚠️ Failed to record disclaimer acknowledgment:', disclaimerError);
          }
        } catch (disclaimerErr) {
          console.warn('⚠️ Disclaimer acknowledgment error:', disclaimerErr);
        }
      }

      // ── 4. Success ─────────────────────────────────────────────────────────
      navigation.replace('TradeSuccess', {
        tradeId,
        role: 'buyer',
        spUsed: spAmount,
        spAmountDollars: spAmount,
        // DT-21 Item 1: project the post-reserve SP balance — `walletStats.available`
        // is still the pre-reserve figure at submit time (the wallet Realtime refresh
        // may not have landed before the success screen renders), so subtract this
        // offer's SP so the buyer sees their true remaining points without mental math.
        remainingSP: Math.max(0, (walletStats?.available ?? 0) - spAmount),
        listingType: item?.accepts_swap_points ? 'accept_sp' : 'cash_only',
      });
    } catch (error: any) {
      // R9 — checkout event: unexpected failure during checkout.
      trackEvent('checkout_failed', {
        screen: 'trade_offer',
        item_id: item.id,
        reason: 'unexpected_error',
      });
      captureException(error, {
        tags: { screen: 'TradeOfferScreen', action: 'initiate_trade' },
      });
      setErrorModal({
        visible: true,
        title: 'Error',
        message: error.message || 'An unexpected error occurred',
        isDuplicate: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // MODULE-15.3-PART3 TAX-011: tax calculated on full item price (SP doesn't reduce taxable amount)
  const itemPriceCentsForTax = item ? Math.round(item.price * 100) : 0;
  const tax = useTaxCalculation({
    nodeId: (item as any)?.node_id ?? null,
    taxableAmountCents: itemPriceCentsForTax,
    taxCategoryId: item?.tax_category_id ?? null,
  });

  if (loading || !item) {
    return (
      <ScreenLayout variant="detail" title="Make Offer">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading offer...</Text>
        </View>
      </ScreenLayout>
    );
  }

  const isSubscriber =
    subStatus.status === 'active' || subStatus.status === 'trial' || subStatus.status === 'grace';
  const availableSp = walletStats.available;
  const maxSpToUse = Math.min(maxSpAllowed, availableSp);
  const spDiscountCents = spAmount * 100;
  const itemPriceCents = Math.round(item.price * 100);
  // Offer amount = item price minus SP (no fees shown on offer screen)
  const offerAmountCents = itemPriceCents - spDiscountCents;
  // R1: server-resolved tiered fee for display (falls back to legacy estimate).
  const platformFeeCents = buyerFeeInfo?.feeCents ?? (isSubscriber ? 99 : 299);
  const cashAmountCents = itemPriceCents - spDiscountCents + platformFeeCents;
  const grandTotalCents = cashAmountCents + (tax.taxAmountCents || 0);

  return (
    <ScreenLayout variant="detail" title="Make Offer">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID="offer-screen-scroll-view"
        >
          <Text style={styles.heading}>Make an Offer</Text>

          <WalletWarningBanner walletState={(session?.wallet_state ?? 'inactive') as WalletState} />

          {/* Trade Card - Two Column Layout */}
          <View style={styles.tradeCard} testID="trade-offer-card">
            <View style={styles.tradeSide}>
              <Image
                source={{ uri: item.images?.[0]?.url || 'https://via.placeholder.com/80' }}
                style={styles.itemThumb}
                resizeMode="cover"
              />
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            </View>

            <View style={styles.arrowsDivider}>
              <ArrowsLeftRight size={24} color="#6B6B6B" weight="regular" />
            </View>

            <View style={styles.tradeSide}>
              <Text style={styles.tradeSideLabel}>You Offer</Text>
              <Text style={styles.offerAmount}>${(offerAmountCents / 100).toFixed(2)}</Text>
              {spAmount > 0 && <Text style={styles.spUsedBadge}>{spAmount} SP applied</Text>}
            </View>
          </View>

          {/* SP Offer Input — only for subscribers */}
          {isSubscriber && item.accepts_swap_points && maxSpToUse > 0 && (
            <View style={styles.section}>
              <Text style={styles.spLabel}>ADD SP OFFER</Text>
              <View style={styles.spInputWrapper} testID="sp-input-wrapper">
                <Coins size={20} color="#F59E0B" weight="regular" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.spInput}
                  value={spAmount === 0 ? '' : spAmount.toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    setSpAmount(Math.min(num, maxSpToUse));
                  }}
                  placeholder="0"
                  placeholderTextColor="#D97706"
                  keyboardType="decimal-pad"
                  testID="sp-amount-input"
                  inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                />
                <Text style={styles.spUnit}>SP</Text>
              </View>
              <Text style={styles.spHint}>
                Max: {maxSpToUse} SP ({maxSpPercentage}% of price)
              </Text>
            </View>
          )}

          {/* Subscribe upsell for non-subscribers */}
          {!isSubscriber && item.accepts_swap_points && (
            <View style={styles.subscribeUpsellCard} testID="subscribe-upsell-card">
              <View style={styles.subscribeUpsellRow}>
                <Coins size={24} color="#F59E0B" weight="regular" />
                <View style={styles.subscribeUpsellTextContainer}>
                  <Text style={styles.subscribeUpsellTitle}>
                    Save up to {maxSpPercentage}% with Swap Points
                  </Text>
                  <Text style={styles.subscribeUpsellBody}>
                    Kids Club+ members can use Swap Points to save on every trade. Try it free for
                    30 days.
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.subscribeUpsellButton}
                onPress={() => navigation.navigate('JoinKidsClub')}
                testID="subscribe-upsell-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Subscribe upsell button"
              >
                <Text style={styles.subscribeUpsellButtonText}>Try Kids Club+ Free</Text>
              </Pressable>
            </View>
          )}

          {/* ── Payment Method Section ─────────────────────────────────────── */}
          {cashAmountCents > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              {loadingSavedPaymentMethod && (
                <View style={styles.paymentModeLoadingContainer}>
                  <ActivityIndicator size="small" color="#5DBB8E" />
                  <Text style={styles.paymentModeLoadingText}>Checking saved cards...</Text>
                </View>
              )}

              {!!savedPaymentMethod && (
                <View style={styles.paymentModeSelector}>
                  <Pressable
                    onPress={() => {
                      setPaymentInputMode('saved');
                    }}
                    style={[
                      styles.paymentModeOption,
                      paymentInputMode === 'saved' && styles.paymentModeOptionSelected,
                    ]}
                  >
                    <Text style={styles.paymentModeTitle}>Use Saved Card</Text>
                    <Text style={styles.paymentModeSubtitle}>
                      {savedPaymentMethod.brand?.toUpperCase()} •••• {savedPaymentMethod.last4}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setPaymentInputMode('new');
                    }}
                    style={[
                      styles.paymentModeOption,
                      paymentInputMode === 'new' && styles.paymentModeOptionSelected,
                    ]}
                    testID="add-new-card-mode-button"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Add new card mode"
                    accessibilityState={{ selected: paymentInputMode === 'new' }}
                  >
                    <Text style={styles.paymentModeTitle}>Add New Card</Text>
                    <Text style={styles.paymentModeSubtitle}>Use Stripe secure checkout</Text>
                  </Pressable>
                </View>
              )}

              {paymentInputMode === 'saved' && savedPaymentMethod ? (
                <View style={styles.savedCardInfoContainer}>
                  <Text style={styles.savedCardInfoText}>
                    Paying with {savedPaymentMethod.brand?.toUpperCase()} ••••{' '}
                    {savedPaymentMethod.last4}
                  </Text>
                  <Text style={styles.savedCardInfoSubtext}>
                    Expires {String(savedPaymentMethod.exp_month).padStart(2, '0')}/
                    {savedPaymentMethod.exp_year}
                  </Text>
                </View>
              ) : paymentInputMode === 'new' && !savedPaymentMethod ? (
                /* No saved card — show "Add New Card" button using Stripe Payment Sheet */
                <View>
                  <Pressable
                    style={[styles.addCardButton, addingNewCard && styles.addCardButtonDisabled]}
                    onPress={handleAddNewCard}
                    disabled={addingNewCard}
                    testID="add-new-card-button"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Add new card button"
                  >
                    {addingNewCard || paymentSheetLoading ? (
                      <View style={styles.addCardButtonLoadingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.addCardButtonText}>Adding Card...</Text>
                      </View>
                    ) : (
                      <Text style={styles.addCardButtonText}>Add New Card</Text>
                    )}
                  </Pressable>
                  {paymentSheetError && (
                    <Text style={styles.addCardErrorText}>{paymentSheetError}</Text>
                  )}
                </View>
              ) : paymentInputMode === 'new' && savedPaymentMethod ? (
                /* User has a saved card but selected "Add New Card" — show button to replace it */
                <View>
                  <Pressable
                    style={[styles.addCardButton, addingNewCard && styles.addCardButtonDisabled]}
                    onPress={handleAddNewCard}
                    disabled={addingNewCard}
                    testID="replace-card-button"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Replace card button"
                  >
                    {addingNewCard || paymentSheetLoading ? (
                      <View style={styles.addCardButtonLoadingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.addCardButtonText}>Replacing Card...</Text>
                      </View>
                    ) : (
                      <Text style={styles.addCardButtonText}>Replace Card</Text>
                    )}
                  </Pressable>
                  {paymentSheetError && (
                    <Text style={styles.addCardErrorText}>{paymentSheetError}</Text>
                  )}
                </View>
              ) : null}
            </View>
          )}

          {/* Safety Disclaimer */}
          <View style={styles.disclaimerBox} testID="safety-disclaimer">
            <ShieldCheck size={20} color="#5DBB8E" weight="regular" style={{ marginRight: 8 }} />
            <Text style={styles.disclaimerText}>
              Trades are protected by our safety guidelines. Complete in-person exchanges only.
            </Text>
          </View>

          {/* Addendum B (D-20): Value stack — fee + SP breakdown.
              Platform fee is now dynamic — fetched from admin_config via getTransactionFee(). */}
          <View style={styles.valueStackCard} testID="value-stack-row">
            <Text style={styles.valueStackTitle}>What you pay</Text>
            <View style={styles.valueStackRow}>
              <Text style={styles.valueStackLabel}>Offer amount</Text>
              <Text style={styles.valueStackValue}>${(offerAmountCents / 100).toFixed(2)}</Text>
            </View>
            {spAmount > 0 && (
              <View style={styles.valueStackRow}>
                <Text style={styles.valueStackLabel}>SP discount</Text>
                <Text style={[styles.valueStackValue, styles.valueStackSP]}>-{spAmount} SP</Text>
              </View>
            )}
            <View style={styles.valueStackRow}>
              <Text style={styles.valueStackLabel}>{buyerFeeInfo?.label ?? 'Platform fee'}</Text>
              <Text style={styles.valueStackValue}>${(platformFeeCents / 100).toFixed(2)}</Text>
            </View>
            {/* MODULE-15.3-PART3 TAX-011: sales tax row (hidden when 0) */}
            <TaxBreakdownRow
              taxAmountCents={tax.taxAmountCents}
              taxRate={tax.taxRate}
              jurisdiction={tax.jurisdiction}
              loading={tax.loading}
              isTaxExempt={tax.isTaxExempt}
              testID="offer-tax-row"
            />
            <View style={[styles.valueStackRow, styles.valueStackTotalRow]}>
              <Text style={styles.valueStackTotalLabel}>Total cash</Text>
              <Text style={styles.valueStackTotalValue}>${(grandTotalCents / 100).toFixed(2)}</Text>
            </View>
          </View>

          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleSendOffer}
            disabled={submitting}
            testID="send-offer-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Send offer button"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send Offer</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardDoneAccessory />

      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        onCancel={() => setShowDisclaimer(false)}
      />

      <SPInfoTooltip visible={showSpInfoTooltip} onClose={() => setShowSpInfoTooltip(false)} />

      <Modal
        visible={errorModal.visible}
        type="alert"
        title={errorModal.title}
        message={errorModal.message}
        primaryButtonText={errorModal.isDuplicate ? 'Go to Trade History' : 'OK'}
        secondaryButtonText={errorModal.isDuplicate ? 'Dismiss' : undefined}
        onPrimaryPress={() => {
          setErrorModal({ ...errorModal, visible: false });
          if (errorModal.isDuplicate) {
            navigation.navigate('TradeList');
          }
        }}
        onSecondaryPress={() => setErrorModal({ ...errorModal, visible: false })}
        onClose={() => setErrorModal({ ...errorModal, visible: false })}
      />

      <TradeConfirmationModal
        visible={showOfferLimitModal}
        title="Too Many Open Offers"
        message={offerLimitMessage}
        confirmLabel="View My Offers"
        cancelLabel="OK"
        variant="accept"
        onConfirm={() => {
          setShowOfferLimitModal(false);
          navigation.navigate('TradeList');
        }}
        onCancel={() => setShowOfferLimitModal(false)}
        confirmTestID="offer-limit-view-offers-button"
        cancelTestID="offer-limit-ok-button"
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
    marginTop: 16,
    fontSize: 16,
    color: '#6B6B6B',
  },
  scrollContent: {
    padding: 24,
    // Clear the floating pill bottom nav (PersistentTabBar) so the Send Offer
    // button scrolls fully above it — matches the app-wide 100px clearance used
    // by Profile/Edit Profile/Home etc.
    paddingBottom: 100,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 4,
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
    marginBottom: 24,
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
  spUsedBadge: {
    fontSize: 12,
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  spLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F59E0B',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  spInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
  },
  spInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  spUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
  },
  spHint: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 8,
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
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Addendum B: value stack styles
  valueStackCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  valueStackTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  valueStackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  valueStackLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  valueStackValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  valueStackSP: {
    color: '#F59E0B',
  },
  valueStackTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 6,
    paddingTop: 8,
  },
  valueStackTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  valueStackTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  // Payment method styles
  paymentModeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  paymentModeLoadingText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  paymentModeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentModeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  paymentModeOptionSelected: {
    borderColor: '#5DBB8E',
    backgroundColor: '#F0FDF4',
  },
  paymentModeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  paymentModeSubtitle: {
    fontSize: 11,
    color: '#6B6B6B',
  },
  savedCardInfoContainer: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  savedCardInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  savedCardInfoSubtext: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 4,
  },
  addCardButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  addCardButtonDisabled: {
    opacity: 0.5,
  },
  addCardButtonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCardButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addCardErrorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  // Subscribe upsell card for non-subscribers
  subscribeUpsellCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  subscribeUpsellRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  subscribeUpsellTextContainer: {
    flex: 1,
  },
  subscribeUpsellTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  subscribeUpsellBody: {
    fontSize: 13,
    color: '#A16207',
    lineHeight: 20,
  },
  subscribeUpsellButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  subscribeUpsellButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

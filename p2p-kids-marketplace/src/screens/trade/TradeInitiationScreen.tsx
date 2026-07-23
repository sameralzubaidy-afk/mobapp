/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeInitiationScreen.tsx
 * TASK TRADE-V2-002: Initiate Trade with Subscription & SP Context
 * Updated: ADMIN-V3-007 - Enforce category-specific SP spending cap
 *
 * UI for initiating a trade:
 * - Shows item summary
 * - Shows SP wallet balance
 * - Allows SP discount selection (capped by category config)
 * - Shows fee breakdown using admin-config-driven transaction fee
 * - Handles trade initiation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Pressable,
  NativeModules,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { getItemById, Item } from '@/services/items';
// TFV2-012A: replaced initiateTradeV2 + processTradePayment with createTradeOfferWithHold (D-30)
import { createTradeOfferWithHold, mapStripeErrorToMessage } from '@/services/trade';
import { useAuth, useSPWallet, useSubscriptionStatus } from '@/hooks/useAuth';
import { getAdminConfig } from '@/services/adminConfig';
import {
  getTransactionFee,
  getPaymentMethod,
  type PaymentMethodInfo,
} from '@/services/subscription';
import { calculateCategorySP } from '@/services/categoryService';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import WalletWarningBanner, { type WalletState } from '@/components/molecules/WalletWarningBanner';
import DisclaimerModal from '@/components/DisclaimerModal';
import { supabase } from '@/config/supabase';
import { SPInfoTooltip } from '@/components/modals/SPInfoTooltip';
import { LoadingSpinner } from '@/components/ui';
import { TradeConfirmationModal } from '@/components/molecules/TradeConfirmationModal';
import ScreenLayout from '@/components/ScreenLayout';
// MODULE-15.3-PART3 TAX-011: tax preview row
import { useTaxCalculation } from '@/hooks/useTaxCalculation';
import TaxBreakdownRow from '@/components/trade/TaxBreakdownRow';
import { formatCents } from '@/services/tax';

type TradeInitiationRouteProp = RouteProp<RootStackParamList, 'TradeInitiation'>;

export default function TradeInitiationScreen() {
  const route = useRoute<TradeInitiationRouteProp>();
  const navigation = useNavigation<any>();
  const { session, refreshSession } = useAuth();
  const subStatus = useSubscriptionStatus();
  const walletStats = useSPWallet();
  let createPaymentMethod: ReturnType<typeof useStripe>['createPaymentMethod'] | null = null;
  let stripeContextError: string | null = null;
  try {
    const stripe = useStripe();
    createPaymentMethod = stripe.createPaymentMethod;
  } catch (error: any) {
    stripeContextError = error?.message || 'Stripe context unavailable';
  }
  const user = session?.user;
  const { itemId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [spAmount, setSpAmount] = useState(0);
  const [maxSpAllowed, setMaxSpAllowed] = useState(0); // Category-specific SP cap (MODULE-12 V3)
  const [maxSpPercentage, setMaxSpPercentage] = useState(50); // Fallback global percentage
  const [transactionFeeCents, setTransactionFeeCents] = useState(0);
  const [cardComplete, setCardComplete] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showSpInfoTooltip, setShowSpInfoTooltip] = useState(false);
  const [showOfferLimitModal, setShowOfferLimitModal] = useState(false);
  const [offerLimitMessage, setOfferLimitMessage] = useState('');
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loadingSavedPaymentMethod, setLoadingSavedPaymentMethod] = useState(false);
  const [paymentInputMode, setPaymentInputMode] = useState<'saved' | 'new'>('new');
  const scrollViewRef = useRef<ScrollView>(null);
  const loadedSavedMethodKeyRef = useRef<string | null>(null);

  const hasStripeNativeModule = Boolean(
    (NativeModules as any)?.StripeSdk ||
    (NativeModules as any)?.Stripe ||
    (NativeModules as any)?.RNStripe ||
    (NativeModules as any)?.StripeReactNative
  );

  const stripePublishableKey = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
  const stripePublishableKeyLooksValid =
    stripePublishableKey.startsWith('pk_') &&
    !stripePublishableKey.includes('YOUR_KEY_HERE') &&
    !stripePublishableKey.includes('your-key');

  useEffect(() => {
    fetchData();
  }, [itemId, user?.id]);

  useEffect(() => {
    // If still loading trade data, keep Stripe unmounted.
    if (loading || !item || paymentInputMode === 'saved') {
      setStripeReady(false);
      return;
    }

    // Delay mounting Stripe UI until AFTER the main screen layout has finished rendering.
    // Mounting Stripe card input instantly when `loading` turns false can cause Android native crashes.
    const timer = setTimeout(() => {
      if (stripeContextError) {
        setStripeReady(false);
        setStripeError(
          'Stripe context is not available in this build. Please reinstall the latest native build.'
        );
        return;
      }

      if (!hasStripeNativeModule) {
        setStripeReady(false);
        setStripeError(
          'This app build does not include Stripe native components. Please install the latest staging build.'
        );
        return;
      }

      if (!stripePublishableKeyLooksValid) {
        setStripeReady(false);
        setStripeError('Stripe publishable key is missing or invalid in app configuration.');
        return;
      }

      // StripeProvider is mounted at app root. Avoid re-initializing Stripe per-screen,
      // which can cause instability on some physical devices.
      setStripeReady(true);
      setStripeError(null);
    }, 600); // 600ms is enough to let screen layout complete

    return () => clearTimeout(timer);
  }, [
    loading,
    item,
    hasStripeNativeModule,
    stripePublishableKeyLooksValid,
    stripeContextError,
    paymentInputMode,
  ]);

  useEffect(() => {
    if (!user?.id || !item || loading) {
      return;
    }

    const loadKey = `${user.id}:${item.id}`;
    if (loadedSavedMethodKeyRef.current === loadKey) {
      return;
    }
    loadedSavedMethodKeyRef.current = loadKey;

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
        setCardComplete(true);
      } else {
        setPaymentInputMode('new');
        setCardComplete(false);
      }

      setLoadingSavedPaymentMethod(false);
    };

    void loadSavedPaymentMethod();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, item, loading]);

  const fetchData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [itemData, config, feeCents] = await Promise.all([
        getItemById(itemId),
        getAdminConfig(),
        getTransactionFee(user.id),
      ]);

      if (!itemData) {
        Alert.alert('Error', 'Item not found');
        navigation.goBack();
        return;
      }

      // Refresh session to get latest subscription/wallet info from RPCs
      await refreshSession();

      setItem(itemData);
      if (Number.isFinite(feeCents) && feeCents >= 0) {
        setTransactionFeeCents(Math.round(feeCents));
      }

      // MODULE-12 V3: Use category-specific SP spending cap
      if (itemData.category_id) {
        const spConfig = await calculateCategorySP(itemData.category_id, itemData.price);
        if (spConfig) {
          setMaxSpAllowed(spConfig.max_spend_sp);
          setMaxSpPercentage(spConfig.spend_percent);
        } else {
          // Fallback to global admin config
          const fallbackMaxSp = Math.floor(
            (itemData.price * (config?.sp_max_percentage_per_purchase || 50)) / 100
          );
          setMaxSpAllowed(fallbackMaxSp);
          if (config?.sp_max_percentage_per_purchase) {
            setMaxSpPercentage(config.sp_max_percentage_per_purchase);
          }
        }
      } else {
        // No category - use global config
        const fallbackPercent = config?.sp_max_percentage_per_purchase || 50;
        const fallbackMaxSp = Math.floor((itemData.price * fallbackPercent) / 100);
        setMaxSpAllowed(fallbackMaxSp);
        setMaxSpPercentage(fallbackPercent);
      }
    } catch (error) {
      console.error('❌ Error fetching trade data:', error);
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  };

  // MODULE-15.3-PART3 TAX-011: call hook unconditionally before any early return
  // to satisfy react-hooks/rules-of-hooks. Pass safe defaults when item is null.
  const itemPriceCentsForTax = item ? Math.round(item.price * 100) : 0;
  const spDiscountCentsForTax = spAmount * 100;
  const taxableSubtotalCents = Math.max(0, itemPriceCentsForTax - spDiscountCentsForTax);
  const tax = useTaxCalculation({
    nodeId: (item as any)?.seller_node_id ?? null,
    taxableAmountCents: taxableSubtotalCents,
  });

  // MODULE-12 V3: Use category-specific max SP cap (already calculated in fetchData)
  if (loading || !item) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Preparing your trade...</Text>
      </View>
    );
  }

  // Business Rules using standardized hooks
  const isSubscriber =
    subStatus.status === 'active' || subStatus.status === 'trial' || subStatus.status === 'grace';
  const platformFeeCents = transactionFeeCents;
  const itemPriceCents = Math.round(item.price * 100);

  // V2: 1 SP = $1.00 (100 cents)
  const spToCashRate = 100;

  const availableSp = walletStats.available;
  const maxSpToUse = Math.min(maxSpAllowed, availableSp);
  const walletState = (session?.wallet_state ?? 'inactive') as WalletState;

  const spDiscountCents = spAmount * spToCashRate;
  // Stripe charge: item price (after SP discount) + platform fee - BOTH must be paid
  const cashAmountCents = itemPriceCents - spDiscountCents + platformFeeCents;
  const cashAmount = cashAmountCents / 100;

  // MODULE-15.3-PART3 TAX-011: tax already calculated above (before early return)
  const grandTotalCents = cashAmountCents + (tax.taxAmountCents || 0);

  const handleConfirmPurchase = () => {
    // Show disclaimer modal before trade initiation
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = async (policyId: string) => {
    setShowDisclaimer(false);
    // Proceed with trade initiation
    await handleInitiateTrade(policyId);
  };

  const handleInitiateTrade = async (policyId?: string) => {
    if (cashAmountCents > 0 && paymentInputMode === 'new' && !stripeReady) {
      Alert.alert(
        'Payment Setup Required',
        stripeError || 'Secure payment fields are still loading. Please try again.'
      );
      return;
    }

    if (cashAmountCents > 0 && paymentInputMode === 'saved' && !savedPaymentMethod?.id) {
      Alert.alert(
        'Payment Method Required',
        'No saved card is available. Please add a new card.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Payment Method', onPress: () => navigation.navigate('PaymentMethods') },
        ]
      );
      return;
    }

    if (!cardComplete && cashAmountCents > 0 && paymentInputMode === 'new') {
      Alert.alert('Payment Required', 'Please enter your card details to continue.');
      return;
    }

    try {
      setSubmitting(true);

      // ── 1. Collect payment method ID (new card or saved) ──────────────────
      let selectedPaymentMethodId: string | undefined = savedPaymentMethod?.id ?? undefined;

      if (cashAmountCents > 0 && paymentInputMode === 'new') {
        if (!createPaymentMethod) {
          Alert.alert(
            'Payment System Error',
            'Stripe payment context is unavailable. Please reinstall the latest build and try again.'
          );
          return;
        }

        const { paymentMethod, error: pmError } = await createPaymentMethod({
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: { email: user?.email },
          },
        });

        if (pmError) {
          if (pmError.message?.includes('API key') || pmError.code === 'Failed') {
            Alert.alert(
              'Payment Setup Error',
              'Payment system is not properly configured. Please contact support or try again later.'
            );
          } else {
            Alert.alert('Payment Error', pmError.message || 'Card validation failed');
          }
          return;
        }

        if (!paymentMethod?.id) {
          Alert.alert('Payment Error', 'Failed to create payment method');
          return;
        }

        selectedPaymentMethodId = paymentMethod.id;
      }

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

      const offerResult = await createTradeOfferWithHold({
        item_id: item.id,
        sp_amount: spAmount,
        payment_method_id: selectedPaymentMethodId,
        cash_amount_cents: cashAmountCents, // total Stripe charge (item - sp + fee)
        transaction_fee_cents: platformFeeCents,
        buyer_subscription_status: subscriptionStatus,
      });

      if (!offerResult.success || !offerResult.trade_id) {
        // D-30: max pending offers per seller (cap is admin-configurable)
        if (offerResult.error_code === 'MAX_PENDING_OFFERS') {
          setOfferLimitMessage(
            offerResult.error || 'You have reached the offer limit for this seller. Cancel one to make a new offer.'
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

        Alert.alert('Offer Failed', offerResult.error || 'Could not submit your offer. Please try again.');
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
        remainingSP: walletStats?.available ?? 0,
        listingType: item?.accepts_swap_points ? 'accept_sp' : 'cash_only',
      });
    } catch (error: any) {
      console.error('[TradeInitiationScreen] handleInitiateTrade error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const incrementSp = () => {
    if (spAmount < maxSpToUse) {
      setSpAmount((prev) => Math.min(prev + 1, maxSpToUse));
    }
  };

  const decrementSp = () => {
    if (spAmount > 0) {
      setSpAmount((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleSpInputChange = (text: string) => {
    // Allow only numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = cleaned.split('.');
    const formatted = parts[0] + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '');

    if (formatted === '') {
      setSpAmount(0);
    } else {
      const numericValue = parseFloat(formatted);
      if (!isNaN(numericValue)) {
        const cappedValue = Math.min(numericValue, maxSpToUse);
        setSpAmount(cappedValue);

        // MODULE-12 V3: Show inline error if user tries to exceed category cap
        if (numericValue > maxSpToUse) {
          Alert.alert(
            'SP Limit Exceeded',
            `For this category, you can use up to ${maxSpToUse} SP (${maxSpPercentage}% of item price).`
          );
        }
      }
    }
  };

  return (
    <ScreenLayout variant="detail" title="Start Trade">
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 24}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <Text style={styles.title}>Confirm Your Trade</Text>

          <WalletWarningBanner walletState={walletState} />

          {/* Item Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item</Text>
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Swap Points Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.spHeaderLeft}>
                <Text style={styles.sectionTitle}>Swap Points Discount</Text>
                <Pressable
                  onPress={() => setShowSpInfoTooltip(true)}
                  accessibilityLabel="What are Swap Points? Tap to learn more"
                  accessibilityRole="button"
                  testID="trade-sp-info-icon"
                  style={styles.infoIcon}
                >
                  <Text style={styles.infoIconText}>i</Text>
                </Pressable>
              </View>
              <Text style={styles.walletBalance}>Balance: {availableSp} SP</Text>
            </View>

            {!isSubscriber ? (
              <View style={styles.upgradeContainer}>
                <Text style={styles.upgradeText}>
                  Swap Points are a Kids Club+ feature. Join now to save up to {maxSpPercentage}% on
                  every trade!
                </Text>
                <Pressable
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('SubscriptionChoice')}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade to Kids Club+</Text>
                </Pressable>
              </View>
            ) : !subStatus.canSpendSP ? (
              <Text style={styles.infoText}>
                {walletState === 'frozen'
                  ? 'Your Swap Points wallet is frozen. Renew your subscription to restore SP spending.'
                  : walletState === 'suspended'
                    ? 'Your Swap Points wallet is suspended. Please contact support for assistance.'
                    : walletState === 'grace_period'
                      ? 'Your wallet is in grace period. Renew your subscription to spend Swap Points.'
                      : 'Swap Points are currently unavailable.'}
              </Text>
            ) : !item.accepts_swap_points ? (
              <Text style={styles.infoText}>
                This seller does not accept Swap Points for this item.
              </Text>
            ) : maxSpToUse === 0 ? (
              <Text style={styles.infoText}>
                {availableSp === 0
                  ? "You don't have any Swap Points yet."
                  : 'This item is too cheap to use Swap Points.'}
              </Text>
            ) : (
              <View style={styles.spControls}>
                <View style={styles.spRow}>
                  <Pressable
                    onPress={decrementSp}
                    style={[styles.spButton, spAmount === 0 && styles.spButtonDisabled]}
                    disabled={spAmount === 0}
                  >
                    <Text style={styles.spButtonText}>−</Text>
                  </Pressable>
                  <View style={styles.spValueContainer}>
                    <TextInput
                      style={styles.spInput}
                      value={spAmount === 0 ? '' : spAmount.toString()}
                      onChangeText={handleSpInputChange}
                      keyboardType="decimal-pad"
                      maxLength={8}
                      selectTextOnFocus
                      placeholder="0.00"
                    />
                    <Text style={styles.spLabel}>SP</Text>
                  </View>
                  <Pressable
                    onPress={incrementSp}
                    style={[styles.spButton, spAmount >= maxSpToUse && styles.spButtonDisabled]}
                    disabled={spAmount >= maxSpToUse}
                  >
                    <Text style={styles.spButtonText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.spLimitText}>
                  Max discount: {maxSpToUse.toFixed(2)} SP ({maxSpPercentage}% of price)
                </Text>
              </View>
            )}
          </View>

          {/* Fee Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Item Price</Text>
              <Text style={styles.breakdownValue}>${item.price.toFixed(2)}</Text>
            </View>

            {spAmount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>SP Discount</Text>
                <Text style={[styles.breakdownValue, styles.discountText]}>
                  -${(spAmount * (spToCashRate / 100)).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.breakdownRow}>
              <View>
                <Text style={styles.breakdownLabel}>Platform Fee</Text>
                <Text style={styles.feeSubtext}>
                  {subStatus.canSpendSP ? 'Kids Club+ Rate' : 'Standard Rate'}
                </Text>
              </View>
              <Text style={styles.breakdownValue}>${(platformFeeCents / 100).toFixed(2)}</Text>
            </View>

            {/* MODULE-15.3-PART3 TAX-011: sales tax row (hidden when 0) */}
            <TaxBreakdownRow
              taxAmountCents={tax.taxAmountCents}
              taxRate={tax.taxRate}
              jurisdiction={tax.jurisdiction}
              loading={tax.loading}
              testID="checkout-tax-row"
            />

            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Cash Due (Item + Fee)</Text>
              <Text style={styles.totalValue} testID="checkout-total">
                {formatCents(grandTotalCents)}
              </Text>
            </View>
          </View>

          {/* Payment Section */}
          {cashAmountCents > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              {loadingSavedPaymentMethod && (
                <View style={styles.paymentModeLoadingContainer}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.paymentModeLoadingText}>Checking saved cards...</Text>
                </View>
              )}

              {!!savedPaymentMethod && (
                <View style={styles.paymentModeSelector}>
                  <Pressable
                    onPress={() => {
                      setPaymentInputMode('saved');
                      setCardComplete(true);
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
                      setCardComplete(false);
                    }}
                    style={[
                      styles.paymentModeOption,
                      paymentInputMode === 'new' && styles.paymentModeOptionSelected,
                    ]}
                  >
                    <Text style={styles.paymentModeTitle}>Use New Card</Text>
                    <Text style={styles.paymentModeSubtitle}>Enter different card details</Text>
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
              ) : stripeReady ? (
                <CardField
                  postalCodeEnabled={true}
                  placeholders={{
                    number: '4242 4242 4242 4242',
                  }}
                  cardStyle={{
                    backgroundColor: '#FFFFFF',
                    textColor: '#000000',
                    placeholderColor: '#A0AEC0',
                    borderColor: '#E5E7EB',
                    borderWidth: 1,
                    borderRadius: 8,
                  }}
                  style={styles.cardField}
                  onCardChange={(cardDetails) => {
                    setCardComplete(cardDetails.complete ?? false);
                  }}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    });
                  }}
                />
              ) : stripeError === null ? (
                <View style={{ height: 100, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={{ marginTop: 8, color: '#6b7280' }}>Loading secure payment...</Text>
                </View>
              ) : (
                <View style={styles.paymentErrorContainer}>
                  <Text style={styles.paymentErrorText}>
                    {stripeError || 'Unable to load card fields.'}
                  </Text>
                  <Pressable
                    style={styles.retryPaymentButton}
                    onPress={() => {
                      if (!hasStripeNativeModule) {
                        setStripeReady(false);
                        setStripeError(
                          'This app build does not include Stripe native components. Please install the latest staging build.'
                        );
                        return;
                      }

                      if (!stripePublishableKeyLooksValid) {
                        setStripeReady(false);
                        setStripeError(
                          'Stripe publishable key is missing or invalid in app configuration.'
                        );
                        return;
                      }

                      setStripeReady(true);
                      setStripeError(null);
                    }}
                  >
                    <Text style={styles.retryPaymentButtonText}>Retry Payment Fields</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.disclaimer}>
              By confirming, you agree to the trade terms. Swap Points will be deducted immediately.
            </Text>
            <Pressable
              style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
              onPress={handleConfirmPurchase}
              disabled={submitting}
              testID="confirm-trade-button"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm & Pay ${cashAmount.toFixed(2)}</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Disclaimer Modal - Conditional render to prevent aggressive native view parsing */}
      {showDisclaimer && (
        <DisclaimerModal
          visible={showDisclaimer}
          onAccept={handleDisclaimerAccept}
          onCancel={() => setShowDisclaimer(false)}
          testID="trade-disclaimer-modal"
        />
      )}

      <SPInfoTooltip
        visible={showSpInfoTooltip}
        onClose={() => setShowSpInfoTooltip(false)}
        testID="trade-sp-info-tooltip"
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
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  spHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  walletBalance: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  upgradeContainer: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  upgradeText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 12,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  spControls: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  spRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  spButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  spButtonDisabled: {
    opacity: 0.3,
  },
  spButtonText: {
    fontSize: 24,
    color: '#3b82f6',
    fontWeight: '600',
  },
  spValueContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  spValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  spInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    minWidth: 80,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  spLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  spLimitText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 15,
    color: '#4b5563',
  },
  breakdownValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  discountText: {
    color: '#10b981',
  },
  feeSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  cardField: {
    width: '100%',
    height: 52,
    marginVertical: 10,
  },
  paymentModeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  paymentModeLoadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentModeSelector: {
    gap: 8,
    marginBottom: 10,
  },
  paymentModeOption: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  paymentModeOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  paymentModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  paymentModeSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  savedCardInfoContainer: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    marginVertical: 8,
  },
  savedCardInfoText: {
    fontSize: 14,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  savedCardInfoSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#1e40af',
  },
  paymentLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  paymentLoadingText: {
    fontSize: 14,
    color: '#4b5563',
  },
  paymentErrorContainer: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  paymentErrorText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  paymentInfoContainer: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  paymentInfoText: {
    fontSize: 14,
    color: '#1d4ed8',
    lineHeight: 20,
  },
  addPaymentButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 170,
    alignItems: 'center',
  },
  addPaymentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentSuccessText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  retryPaymentButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryPaymentButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 8,
    marginBottom: 40,
  },
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});

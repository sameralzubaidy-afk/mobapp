/**
 * File: p2p-kids-marketplace/src/screens/cart/CartCheckoutScreen.tsx
 * TFV2-022: Cart checkout screen with per-item points-redemption toggles.
 *
 * Features:
 *  - Lists all cart items with per-item SP toggle (points-redemption)
 *  - Live wallet balance check + category redemption cap enforcement
 *  - Sequential toggle-order allocation (first toggled = first served)
 *  - Running "Points remaining" counter
 *  - Order Summary: Subtotal, Points Applied, Platform Fee, Tax, Cash Total
 *  - D-27: all items share bundleId, passed to create-trade-offer
 *  - Platform fees loaded dynamically from admin_config (no hardcoded values)
 *  - "Send Offer" calls cartService.checkoutCart → navigates to TradeSuccess
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Coins } from 'phosphor-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/ui';
import { colors } from '@/theme';
import ScreenLayout from '@/components/ScreenLayout';
import {
  getCartItems,
  checkoutCart,
  CartItem,
  CartWithDetails,
  CartResult,
  CheckoutWarning,
  buildSkippedItemsCopy,
} from '@/services/cartService';
import { useSubscriptionStatus } from '@/hooks/useAuth';
import { calculateTax, isTaxExemptCategory } from '@/services/tax';
import TaxBreakdownRow from '@/components/trade/TaxBreakdownRow';
import { getBuyerFeeForCheckout, getChargeOneFeePerBundle, type BuyerFeeInfo } from '@/services/adminConfig';
import { supabase } from '@/config/supabase';
import { getBuyerSpBalance } from '@/services/spWalletService';
import { calculateCategorySP } from '@/services/categoryService';
import { getPaymentMethod, type PaymentMethodInfo } from '@/services/subscription';
import { Modal } from '@/components/ui/Modal';
import DisclaimerModal from '@/components/DisclaimerModal';
import { TradeConfirmationModal } from '@/components/molecules/TradeConfirmationModal';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CartCheckout'>;

interface ItemSpState {
  spApplied: number;
  maxAllowed: number; // Max SP this item can accept (min of 50% cap, category cap)
  catCap: number;
}

export default function CartCheckoutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bundleId, bundleMode } = route.params;
  const { canSpendSP, status } = useSubscriptionStatus();
  const isSubscriber = status === 'active' || status === 'trial';

  const {
    setupPaymentSheet,
    presentSheet,
    loading: paymentSheetLoading,
    error: paymentSheetError,
  } = usePaymentSheet();

  const [cart, setCart] = useState<CartWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  // R1 — Tiered Buyer-Fee Engine: server-resolved buyer fee for the whole checkout.
  const [buyerFeeInfo, setBuyerFeeInfo] = useState<BuyerFeeInfo | null>(null);
  const [chargeOneFeePerBundle, setChargeOneFeePerBundle] = useState<boolean>(false);
  const [sellerNodeId, setSellerNodeId] = useState<string | null>(null);

  // PARTIAL-SUCCESS (2026-08-01): state for the "some items weren't included" modal —
  // shown after a bundle checkout when one or more items were skipped (e.g. they
  // already have an active/in-progress trade). Non-blocking — OK continues the flow.
  const [showSkippedModal, setShowSkippedModal] = useState(false);
  const [skippedWarning, setSkippedWarning] = useState<CheckoutWarning | null>(null);
  const [successTradeIds, setSuccessTradeIds] = useState<string[]>([]);

  // Points-redemption state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [itemSpState, setItemSpState] = useState<Record<string, ItemSpState>>({});

  // Payment method state (mirrors TradeInitiationScreen)
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loadingSavedPaymentMethod, setLoadingSavedPaymentMethod] = useState(false);
  const [paymentInputMode, setPaymentInputMode] = useState<'saved' | 'new'>('new');
  const [addingNewCard, setAddingNewCard] = useState(false);
  const loadedSavedMethodKeyRef = useRef<string | null>(null);

  // Prefetch payment method + warm create-trade-offer EF on mount
  // so the submit flow doesn't wait for Edge Function cold starts.
  useEffect(() => {
    getPaymentMethod().catch(() => {});
    supabase.functions.invoke('create-trade-offer', { body: { __warmup: true } }).catch(() => {});
  }, []);

  // BUNDLE-FEE-MODE (2026-07-30): load the one-fee-per-bundle toggle.
  useEffect(() => {
    getChargeOneFeePerBundle()
      .then(setChargeOneFeePerBundle)
      .catch(() => {
        setChargeOneFeePerBundle(false);
      });
  }, []);

  // R1 — Tiered Buyer-Fee Engine: resolved fee (set by the effect below). Legacy
  // 99/299 fallback is display-only; the Edge Function recomputes authoritatively.
  const platformFeeCents = buyerFeeInfo?.feeCents ?? (isSubscriber ? 99 : 299);
  const platformFeeDollars = platformFeeCents / 100;

  // Load saved payment method (mirrors TradeInitiationScreen logic)
  useEffect(() => {
    if (!cart || loading) return;

    const loadKey = `cart:${cart.bundleId ?? bundleId}`;
    if (loadedSavedMethodKeyRef.current === loadKey) return;
    loadedSavedMethodKeyRef.current = loadKey;

    let isCancelled = false;

    const load = async () => {
      setLoadingSavedPaymentMethod(true);
      const method = await getPaymentMethod();
      if (isCancelled) return;
      setSavedPaymentMethod(method);
      if (method?.id) {
        setPaymentInputMode('saved');
      } else {
        setPaymentInputMode('new');
      }
      setLoadingSavedPaymentMethod(false);
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [cart, loading, bundleId]);

  const subtotal = cart?.subtotal ?? 0;

  // Calculate total points applied across all items
  const totalSpApplied = Object.values(itemSpState).reduce((sum, s) => sum + s.spApplied, 0);

  // R1 — Tiered Buyer-Fee Engine: resolve the buyer fee server-side on the total
  // cash portion (subtotal − SP). Recompute when the SP applied changes (the
  // percentage tier applies only to the cash portion; flat tiers are unaffected).
  useEffect(() => {
    let cancelled = false;
    const subtotalCents = Math.round((cart?.subtotal ?? 0) * 100);
    const spCents = totalSpApplied * 100;
    const cashPortionCents = Math.max(0, subtotalCents - spCents);
    getBuyerFeeForCheckout(cashPortionCents)
      .then((fee) => {
        if (!cancelled && fee) setBuyerFeeInfo(fee);
      })
      .catch(() => {
        /* display-only fallback; the Edge Function is authoritative */
      });
    return () => {
      cancelled = true;
    };
  }, [cart?.subtotal, totalSpApplied]);

  // Calculate remaining balance
  const remainingBalance = Math.max(0, walletBalance - totalSpApplied);

  // BP-fix (2026-07-29 / TC-O2-C02): tax is now computed PER LINE ITEM using each
  // item's own tax_category_id, instead of one flat rate on the whole bundle
  // subtotal. A bundle mixing a taxable item, a Tax Exempt Goods item, and a
  // price-threshold item must NOT charge one blended rate on everything — each
  // item's exemption/threshold rule has to be honored individually. Tax is
  // computed on each item's full price (points don't reduce the taxable amount).
  const [taxState, setTaxState] = useState<{
    loading: boolean;
    taxAmountCents: number;
    taxRate: number;
    jurisdiction: string | null;
    isTaxExempt: boolean;
  }>({ loading: false, taxAmountCents: 0, taxRate: 0, jurisdiction: null, isTaxExempt: false });

  useEffect(() => {
    let cancelled = false;
    const items = cart?.items ?? [];
    if (items.length === 0 || !sellerNodeId) {
      setTaxState({
        loading: false,
        taxAmountCents: 0,
        taxRate: 0,
        jurisdiction: null,
        isTaxExempt: false,
      });
      return;
    }
    setTaxState((s) => ({ ...s, loading: true }));
    (async () => {
      const results = await Promise.all(
        items.map((it) => {
          const priceCents = it.priceCents ?? Math.round((it.price ?? 0) * 100);
          return calculateTax(sellerNodeId, priceCents, it.taxCategoryId ?? null, priceCents);
        })
      );
      // TC-O05 (2026-08-01): badge only when EVERY item in the bundle is
      // tax-exempt — a mixed bundle is not "Tax Free" (taxable items still owe tax).
      const exemptResults = await Promise.all(
        items.map((it) => isTaxExemptCategory(it.taxCategoryId ?? null))
      );
      const allExempt = exemptResults.length > 0 && exemptResults.every(Boolean);
      if (cancelled) return;
      let totalTaxCents = 0;
      let jurisdiction: string | null = null;
      for (const r of results) {
        if (r.success) {
          totalTaxCents += r.data.tax_amount_cents;
          if (!jurisdiction && r.data.tax_jurisdiction) jurisdiction = r.data.tax_jurisdiction;
        }
      }
      const taxableTotalCents = items.reduce(
        (sum, it) => sum + (it.priceCents ?? Math.round((it.price ?? 0) * 100)),
        0
      );
      // Blended rate shown in the UI subtext only — the dollar amount charged is the
      // exact sum of each item's own correctly-computed tax, never a blended estimate.
      const blendedRate = taxableTotalCents > 0 ? totalTaxCents / taxableTotalCents : 0;
      setTaxState({
        loading: false,
        taxAmountCents: totalTaxCents,
        taxRate: blendedRate,
        jurisdiction,
        isTaxExempt: allExempt,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cart?.items, sellerNodeId]);

  const taxDollars = (taxState.taxAmountCents || 0) / 100;
  // BUNDLE-FEE-MODE (2026-07-30): When one-fee-per-bundle is disabled, the fee is
  // charged per item. Show the accurate total fee amount in the UI.
  const itemCount = cart?.items?.length ?? 1;
  const effectiveFeeDollars =
    bundleMode && !chargeOneFeePerBundle ? platformFeeDollars * itemCount : platformFeeDollars;
  const cashTotal = Math.max(0, subtotal - totalSpApplied) + effectiveFeeDollars + taxDollars;

  const loadCart = useCallback(async () => {
    setLoading(true);
    const result = await getCartItems();
    if (result.success) {
      setCart(result.data);
      // Fetch seller's node for tax calculation
      const sellerId = result.data.items[0]?.sellerId;
      if (sellerId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('node_id')
          .eq('user_id', sellerId)
          .single();
        if (profile?.node_id) {
          setSellerNodeId(profile.node_id);
        }
      }
    } else {
      Alert.alert('Error', result.error.message, [
        { text: 'Go Back', onPress: () => navigation.goBack() },
      ]);
    }
    setLoading(false);
  }, [navigation]);

  // FLOW-07 (2026-08-01): Tap an item card -> open that item's detail screen.
  // ListingDetail is pushed onto the stack, so Back returns to Checkout with
  // all state (SP inputs, scroll) preserved.
  const handleOpenItemDetail = (item: CartItem) => {
    navigation.navigate('ListingDetail', { listing_id: item.listingId });
  };

  // Fetch wallet balance and category caps
  const loadPointsData = useCallback(async () => {
    if (!isSubscriber || !canSpendSP) {
      setBalanceLoading(false);
      return;
    }

    setBalanceLoading(true);
    try {
      const balance = await getBuyerSpBalance();
      setWalletBalance(balance.availableBalance);
    } catch {
      setWalletBalance(0);
    }

    if (cart?.items) {
      // Precompute per-item maxAllowed using category-specific SP cap (same as TradeInitiationScreen)
      const initialState: Record<string, ItemSpState> = {};
      for (const item of cart.items) {
        if (item.acceptsSP && item.price) {
          try {
            // Look up the listing's category_id to get the category SP spending cap percent
            const { data: listingData } = await supabase
              .from('items')
              .select('category_id')
              .eq('id', item.listingId)
              .single();

            if (listingData?.category_id) {
              const spConfig = await calculateCategorySP(listingData.category_id, item.price);
              if (spConfig) {
                initialState[item.listingId] = {
                  spApplied: 0,
                  maxAllowed: spConfig.max_spend_sp,
                  catCap: spConfig.max_spend_sp,
                };
              }
            }
          } catch {
            // Fallback: if lookup fails, no SP for this item
            console.warn(`[CartCheckout] Could not load SP config for listing ${item.listingId}`);
          }
        }
      }
      setItemSpState(initialState);
    }

    setBalanceLoading(false);
  }, [isSubscriber, canSpendSP, cart?.items]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    if (cart) {
      loadPointsData();
    }
  }, [cart, loadPointsData]);

  // Compute remaining balance available for new SP
  const getAvailableBalance = useCallback(() => {
    const used = Object.values(itemSpState).reduce((sum, s) => sum + (s.spApplied ?? 0), 0);
    return Math.max(0, walletBalance - used);
  }, [itemSpState, walletBalance]);

  // Handle SP amount change for a specific item
  const handleSpChange = (itemId: string, text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const newVal = cleaned === '' ? 0 : parseInt(cleaned, 10);

    setItemSpState((prev) => {
      const current = prev[itemId];
      if (!current) return prev;

      // Available = wallet - what OTHER items are using
      const otherTotal = Object.entries(prev)
        .filter(([id]) => id !== itemId)
        .reduce((sum, [, s]) => sum + (s.spApplied ?? 0), 0);
      const remaining = Math.max(0, walletBalance - otherTotal);

      const effective = Math.min(newVal, current.maxAllowed, remaining);
      return { ...prev, [itemId]: { ...current, spApplied: effective } };
    });
  };

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
      console.error('[CartCheckoutScreen] handleAddNewCard error:', err);
      Alert.alert('Error', err.message || 'An unexpected error occurred');
    } finally {
      setAddingNewCard(false);
    }
  };

  const handleSendOffer = () => {
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = (policyId: string) => {
    setShowDisclaimer(false);
    // Trigger the actual submit immediately after accepting disclaimer
    setImmediate(() => handleConfirm(policyId));
  };

  const handleConfirm = async (policyId?: string) => {
    if (!cart || cart.items.length === 0) return;

    setSubmitting(true);
    try {
      const cashTotalCents = Math.round(cashTotal * 100);

      // ── Collect payment method ID (saved or new card) ──────────────────
      let selectedPaymentMethodId: string | undefined;

      if (cashTotalCents > 0) {
        if (paymentInputMode === 'new' && !savedPaymentMethod?.id) {
          Alert.alert(
            'Payment Method Required',
            'Please add a new card first by tapping "Add New Card" below.'
          );
          setSubmitting(false);
          return;
        }

        if (paymentInputMode === 'saved' && !savedPaymentMethod?.id) {
          Alert.alert(
            'Payment Method Required',
            'No saved card is available. Please add a new card.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Add Payment Method', onPress: () => navigation.navigate('PaymentMethods') },
            ]
          );
          setSubmitting(false);
          return;
        }

        // If we reach here, savedPaymentMethod.id is guaranteed (guards above catch missing cases)
        selectedPaymentMethodId = savedPaymentMethod!.id;
      }

      // Build per-item SP amounts map
      const perItemSpCents: Record<string, number> = {};
      let totalSpCents = 0;
      for (const item of cart.items) {
        const sp = itemSpState[item.listingId];
        const spCents = sp ? Math.round(sp.spApplied * 100) : 0;
        perItemSpCents[item.listingId] = spCents;
        totalSpCents += spCents;
      }

      const result: CartResult<{ tradeIds: string[]; bundleId: string }> = await checkoutCart({
        bundleId: cart.bundleId ?? bundleId,
        spAmountCents: totalSpCents,
        perItemSpCents,
        isSubscriber,
        paymentMethodId: selectedPaymentMethodId,
      });

      if (!result.success) {
        // If the EF returned NO_PAYMENT_METHOD (shouldn't happen now, but guard)
        if (result.error.code === 'NO_PAYMENT_METHOD') {
          setShowPaymentMethodModal(true);
          return;
        }
        Alert.alert('Checkout Failed', result.error.message);
        return;
      }

      const tradeIds = result.data.tradeIds;

      // ── Record disclaimer acknowledgment for each trade (best effort) ──
      if (policyId && tradeIds.length > 0) {
        try {
          const { error: disclaimerError } = await supabase.rpc('acknowledge_trade_disclaimer', {
            p_trade_id: tradeIds[0],
            p_disclaimer_policy_id: policyId,
          });
          if (disclaimerError) {
            console.warn('⚠️ Failed to record disclaimer acknowledgment:', disclaimerError);
          }
        } catch (disclaimerErr) {
          console.warn('⚠️ Disclaimer acknowledgment error:', disclaimerErr);
        }
      }

      // PARTIAL-SUCCESS (2026-08-01): If the bundle checkout skipped one or more items
      // (e.g. they already have an active/in-progress trade), tell the buyer BEFORE
      // moving on. This does NOT block the flow — eligible offers are already submitted
      // and the branded modal's OK button continues to the success screen.
      if (result.warning?.skippedItems?.length) {
        setSuccessTradeIds(tradeIds);
        setSkippedWarning(result.warning);
        setShowSkippedModal(true);
        return;
      }

      navigation.replace('TradeSuccess', {
        tradeId: tradeIds[0] ?? '',
      });
    } catch (e) {
      console.error('[CartCheckoutScreen] Checkout error:', e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if any item is SP-eligible (subscriber + item accepts SP)
  const isItemSpEligible = (item: CartWithDetails['items'][0]) =>
    isSubscriber && canSpendSP && item.acceptsSP === true;

  // PARTIAL-SUCCESS (2026-08-01): precompute the modal copy once per render.
  const skippedCopy = skippedWarning ? buildSkippedItemsCopy(skippedWarning) : null;

  if (loading) {
    // DEFERRED-DECISION (2026-07-19): Checkout screens had showBell={false} intentionally
    // to avoid payment-flow distractions. Keeping bell hidden — revert if product team decides otherwise.
    return (
      <ScreenLayout variant="detail" title="Checkout" showBell={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </ScreenLayout>
    );
  }

  if (!cart || cart.items.length === 0) {
    // DEFERRED-DECISION (2026-07-19): Keep bell hidden on checkout — see first instance
    return (
      <ScreenLayout variant="detail" title="Checkout" showBell={false}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Your cart is empty.</Text>
          <Button onPress={() => navigation.navigate('Home')} testID="browse-items-button">
            Browse Items
          </Button>
        </View>
      </ScreenLayout>
    );
  }

  // DEFERRED-DECISION (2026-07-19): Keep bell hidden on checkout — see first instance
  return (
    <ScreenLayout variant="detail" title="Checkout" showBell={false}>
      <ScrollView contentContainerStyle={styles.scrollContent} testID="cart-checkout-scroll">
        {/* Bundle mode banner */}
        {bundleMode && (
          <View style={styles.bundleBanner} testID="bundle-checkout-banner">
            <Text style={styles.bundleBannerTitle}>📦 Combined Offer</Text>
            <Text style={styles.bundleBannerText}>
              You're making a single offer for all {cart.items.length} items from this seller.
            </Text>
          </View>
        )}

        {/* ── Points Remaining Counter ── */}
        {isSubscriber && canSpendSP && (
          <View style={styles.balanceBanner} testID="points-remaining-banner">
            {balanceLoading ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Text style={styles.balanceText}>
                Points remaining: <Text style={styles.balanceValue}>{remainingBalance}</Text>
              </Text>
            )}
          </View>
        )}

        {/* ── Items with per-item SP inputs ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({cart.items.length})</Text>
          {cart.items.map((item) => {
            const eligible = isItemSpEligible(item);
            const spState = itemSpState[item.listingId];
            const itemPrice = item.price ?? 0;

            return (
              <View
                key={item.id}
                style={styles.itemCard}
                testID={`checkout-item-${item.listingId}`}
              >
                {/* Item header: thumbnail + title + price — FLOW-07: tap -> item detail (back returns to checkout) */}
                <TouchableOpacity
                  style={styles.itemRow}
                  activeOpacity={0.7}
                  onPress={() => handleOpenItemDetail(item)}
                  testID={`checkout-item-open-${item.listingId}`}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.itemThumbnail}
                    testID={`checkout-item-image-${item.listingId}`}
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title ?? 'Item'}
                    </Text>
                    <Text style={styles.itemPrice}>${itemPrice.toFixed(2)}</Text>
                  </View>

                  {!eligible && (
                    <View style={styles.notEligibleBadge}>
                      <Text style={styles.notEligibleText}>Not eligible for points</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* SP input field (like TradeOfferScreen) */}
                {eligible && spState && (
                  <View style={styles.spFieldContainer}>
                    <View style={styles.spInputWrapper}>
                      <Coins
                        size={20}
                        color="#F59E0B"
                        weight="regular"
                        style={{ marginRight: 12 }}
                      />
                      <TextInput
                        style={styles.spInput}
                        value={spState.spApplied === 0 ? '' : spState.spApplied.toString()}
                        onChangeText={(text) => handleSpChange(item.listingId, text)}
                        placeholder="0"
                        placeholderTextColor="#D97706"
                        keyboardType="decimal-pad"
                        testID={`sp-input-${item.listingId}`}
                      />
                      <Text style={styles.spUnit}>SP</Text>
                    </View>
                    <Text style={styles.spHint}>
                      Max:{' '}
                      {Math.min(
                        spState.maxAllowed,
                        Math.max(0, walletBalance - getAvailableBalance() + spState.spApplied)
                      )}{' '}
                      SP
                    </Text>
                    {spState.spApplied > 0 && spState.spApplied < spState.maxAllowed && (
                      <Text style={styles.spBalanceNote}>
                        {spState.spApplied} of {spState.maxAllowed} — balance limit
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Order Summary ── */}
        <View style={styles.section} testID="price-breakdown">
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal</Text>
            <Text style={styles.breakdownValue} testID="subtotal-amount">
              ${subtotal.toFixed(2)}
            </Text>
          </View>

          {totalSpApplied > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, styles.discountLabel]}>Points Applied</Text>
              <Text
                style={[styles.breakdownValue, styles.discountValue]}
                testID="points-applied-amount"
              >
                -${totalSpApplied.toFixed(2)}
              </Text>
            </View>
          )}

          {/* BUNDLE-FEE-MODE (2026-07-30): Show per-item count when charging per item,
              show single fee label when one-fee-per-bundle is enabled. R1: fee label
              comes from admin_config (buyer_fee_label). */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              {bundleMode && !chargeOneFeePerBundle
                ? `${buyerFeeInfo?.label ?? 'Platform Fee'} (\u00D7${itemCount} items)`
                : (buyerFeeInfo?.label ?? 'Platform Fee')}
            </Text>
            <Text style={styles.breakdownValue} testID="platform-fee-amount">
              ${effectiveFeeDollars.toFixed(2)}
            </Text>
          </View>

          {/* MODULE-15.3-PART3 TAX-011: sales tax row (hidden when 0) */}
          <TaxBreakdownRow
            taxAmountCents={taxState.taxAmountCents}
            taxRate={taxState.taxRate}
            jurisdiction={taxState.jurisdiction}
            loading={taxState.loading}
            isTaxExempt={taxState.isTaxExempt}
            testID="cart-tax-row"
          />

          <View style={[styles.breakdownRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Cash Total</Text>
            <Text style={styles.totalValue} testID="cash-total-amount">
              ${cashTotal.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ── Payment Method (same section as TradeInitiationScreen) ── */}
        {cashTotal > 0 && (
          <View style={styles.paymentSection} testID="payment-method-section">
            <Text style={styles.paymentSectionTitle}>Payment Method</Text>
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
            ) : !savedPaymentMethod ? (
              /* No saved card — show "Add New Card" button using Stripe Payment Sheet */
              <View>
                <Pressable
                  style={[styles.addCardButton, addingNewCard && styles.addCardButtonDisabled]}
                  onPress={handleAddNewCard}
                  disabled={addingNewCard}
                  testID="add-new-card-button"
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
            ) : (
              /* User has a saved card but selected "Add New Card" — show button to replace it */
              <View>
                <Pressable
                  style={[styles.addCardButton, addingNewCard && styles.addCardButtonDisabled]}
                  onPress={handleAddNewCard}
                  disabled={addingNewCard}
                  testID="replace-card-button"
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
            )}
          </View>
        )}

        {/* ── CTA ── */}
        <View style={styles.ctaContainer}>
          <Button onPress={handleSendOffer} disabled={submitting} testID="send-offer-button">
            {submitting ? 'Processing…' : `Send Offer · $${cashTotal.toFixed(2)}`}
          </Button>
          <Button
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={submitting}
            testID="go-back-button"
          >
            Go Back
          </Button>
        </View>
      </ScrollView>

      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        onCancel={() => setShowDisclaimer(false)}
      />

      {/* ── Branded Payment Method Modal (design-system.md §6.4 Alert Modal) ── */}
      <Modal
        visible={showPaymentMethodModal}
        title="Payment Method Required"
        message="No saved card is available. Please add a new card before checking out."
        primaryButtonText="Add Payment Method"
        secondaryButtonText="Cancel"
        onPrimaryPress={() => {
          setShowPaymentMethodModal(false);
          navigation.navigate('PaymentMethods');
        }}
        onSecondaryPress={() => setShowPaymentMethodModal(false)}
        onClose={() => setShowPaymentMethodModal(false)}
      />

      {/* PARTIAL-SUCCESS (2026-08-01): Branded, non-blocking notice when a bundle
          checkout skipped one or more items (e.g. already in an active trade).
          Green OK button (#5DBB8E) per the design system; continues to TradeSuccess. */}
      {skippedWarning && skippedCopy && (
        <TradeConfirmationModal
          visible={showSkippedModal}
          title={skippedCopy.title}
          message={skippedCopy.message}
          confirmLabel="OK"
          variant="accept"
          hideCancel
          onConfirm={() => {
            setShowSkippedModal(false);
            navigation.replace('TradeSuccess', {
              tradeId: successTradeIds[0] ?? '',
            });
          }}
          onCancel={() => {
            // Offers are already submitted and the cart is cleared — system-back
            // (Android) must continue to TradeSuccess, not strand the buyer here.
            setShowSkippedModal(false);
            navigation.replace('TradeSuccess', {
              tradeId: successTradeIds[0] ?? '',
            });
          }}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[700],
    marginBottom: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceBanner: {
    backgroundColor: '#EEF9F4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: {
    fontSize: 15,
    color: colors.neutral[700],
  },
  balanceValue: {
    fontWeight: '700',
    color: colors.primary[500],
  },
  itemCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    paddingVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 15,
    color: colors.neutral[900],
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  toggleContainer: {
    paddingLeft: 8,
  },
  notEligibleBadge: {
    backgroundColor: colors.neutral[100],
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  notEligibleText: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  // SP input field (matches TradeOfferScreen style)
  spFieldContainer: {
    marginTop: 10,
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
  spBalanceNote: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 15,
    color: colors.neutral[900],
  },
  breakdownValue: {
    fontSize: 15,
    color: colors.neutral[900],
  },
  discountLabel: {
    color: colors.success[500],
  },
  discountValue: {
    color: colors.success[500],
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[300],
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
  },
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
  bundleBannerText: {
    fontSize: 13,
    color: colors.neutral[700],
  },
  ctaContainer: {
    gap: 12,
    marginTop: 8,
  },
  // ── Payment method section (overrides shared section styles — matches TradeInitiationScreen) ──
  paymentSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  paymentSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Payment method inner styles (mirrors TradeInitiationScreen) ──
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
});

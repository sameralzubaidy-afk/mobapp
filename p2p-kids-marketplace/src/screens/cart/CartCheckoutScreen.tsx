/**
 * File: p2p-kids-marketplace/src/screens/cart/CartCheckoutScreen.tsx
 * TFV2-022: Cart checkout screen.
 *
 * Features:
 *  - Lists all cart items from cartService
 *  - D-27: all items share bundleId, passed to create-trade-offer
 *  - SP stepper (subscriber only, capped at 50% of subtotal — SP_CAP_PERCENT)
 *  - Value breakdown: subtotal, SP discount, platform fee, cash total
 *  - Platform fees loaded dynamically from admin_config (no hardcoded values)
 *  - "Confirm Purchase" calls cartService.checkoutCart → navigates to TradeSuccess
 * // TODO(UX): refine layout once final Figma design is available
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/ui';
import { colors } from '@/theme';
import ScreenLayout from '@/components/ScreenLayout';
import { getCartItems, checkoutCart, CartWithDetails, CartResult } from '@/services/cartService';
import { useSubscriptionStatus } from '@/hooks/useAuth';
import { getPlatformFeeCents } from '@/services/adminConfig';
import { SP_CAP_PERCENT } from '@/constants/fees';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CartCheckout'>;

export default function CartCheckoutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bundleId } = route.params;
  const { canSpendSP, status } = useSubscriptionStatus();
  const isSubscriber = status === 'active' || status === 'trial';

  const [cart, setCart] = useState<CartWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [spDollars, setSpDollars] = useState(0); // SP amount in dollars (0 = not using SP)
  const [platformFeeCents, setPlatformFeeCents] = useState<number>(0);

  // Load platform fee from admin_config (dynamic — no hardcoded values)
  useEffect(() => {
    getPlatformFeeCents(isSubscriber).then(setPlatformFeeCents).catch(() => {
      // Fallback to defaults already embedded in getDefaultConfig() inside adminConfig.ts
      setPlatformFeeCents(isSubscriber ? 99 : 299);
    });
  }, [isSubscriber]);
  const platformFeeDollars = platformFeeCents / 100;

  const subtotal = cart?.subtotal ?? 0;
  // 50% cap, floored to nearest cent
  const spCapDollars = Math.floor(subtotal * SP_CAP_PERCENT * 100) / 100;

  const spDiscount = Math.min(spDollars, spCapDollars);
  const cashTotal = Math.max(0, subtotal - spDiscount) + platformFeeDollars;

  const loadCart = useCallback(async () => {
    setLoading(true);
    const result = await getCartItems();
    if (result.success) {
      setCart(result.data);
    } else {
      Alert.alert('Error', result.error.message, [{ text: 'Go Back', onPress: () => navigation.goBack() }]);
    }
    setLoading(false);
  }, [navigation]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const handleSpStep = (direction: 'up' | 'down') => {
    const step = 1; // $1 increments
    setSpDollars((prev) => {
      const next = direction === 'up' ? prev + step : prev - step;
      return Math.min(spCapDollars, Math.max(0, next));
    });
  };

  const handleConfirm = async () => {
    if (!cart || cart.items.length === 0) return;

    setSubmitting(true);
    try {
      const result: CartResult<{ tradeIds: string[]; bundleId: string }> = await checkoutCart({
        bundleId:       cart.bundleId ?? bundleId,
        spAmountCents:  Math.round(spDiscount * 100),
        isSubscriber,
      });

      if (!result.success) {
        Alert.alert('Checkout Failed', result.error.message);
        return;
      }

      const tradeIds = result.data.tradeIds;
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

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Checkout" showBell={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </ScreenLayout>
    );
  }

  if (!cart || cart.items.length === 0) {
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

  return (
    <ScreenLayout variant="detail" title="Checkout" showBell={false}>
      <ScrollView contentContainerStyle={styles.scrollContent} testID="cart-checkout-scroll">
        {/* ── Items ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({cart.items.length})</Text>
          {cart.items.map((item) => (
            <View key={item.id} style={styles.itemRow} testID={`checkout-item-${item.listingId}`}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title ?? 'Item'}</Text>
              <Text style={styles.itemPrice}>${((item.price ?? 0)).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* ── SP Stepper (subscriber only) ── */}
        {isSubscriber && canSpendSP && spCapDollars > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Swap Points</Text>
            <Text style={styles.spLabel} testID="sp-discount-label">
              Using ${spDiscount.toFixed(2)} SP (max ${spCapDollars.toFixed(2)})
            </Text>
            <View style={styles.stepperRow} testID="sp-slider">
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleSpStep('down')}
                disabled={spDollars <= 0}
                testID="sp-decrease-button"
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>${spDollars.toFixed(2)}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleSpStep('up')}
                disabled={spDollars >= spCapDollars}
                testID="sp-increase-button"
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.spNote}>Max 50% of subtotal can be paid with SP</Text>
          </View>
        )}

        {/* ── Value Breakdown ── */}
        <View style={styles.section} testID="price-breakdown">
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal</Text>
            <Text style={styles.breakdownValue} testID="subtotal-amount">${subtotal.toFixed(2)}</Text>
          </View>

          {spDiscount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, styles.discountLabel]}>SP Discount</Text>
              <Text style={[styles.breakdownValue, styles.discountValue]} testID="sp-discount-amount">
                -${spDiscount.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Platform Fee</Text>
            <Text style={styles.breakdownValue} testID="platform-fee-amount">${platformFeeDollars.toFixed(2)}</Text>
          </View>

          <View style={[styles.breakdownRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue} testID="cash-total-amount">${cashTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={styles.ctaContainer}>
          <Button
            onPress={handleConfirm}
            disabled={submitting}
            testID="confirm-purchase-button"
          >
            {submitting ? 'Processing…' : `Confirm Purchase · $${cashTotal.toFixed(2)}`}
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    color: colors.neutral[900],
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  spLabel: {
    fontSize: 14,
    color: colors.primary[500],
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 8,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    color: colors.primary[600],
    fontWeight: '600',
    lineHeight: 28,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
    minWidth: 70,
    textAlign: 'center',
  },
  spNote: {
    fontSize: 12,
    color: colors.neutral[500],
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  ctaContainer: {
    gap: 12,
    marginTop: 8,
  },
});

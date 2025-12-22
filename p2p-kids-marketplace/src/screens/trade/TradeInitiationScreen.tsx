/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeInitiationScreen.tsx
 * TASK TRADE-V2-002: Initiate Trade with Subscription & SP Context
 * 
 * UI for initiating a trade:
 * - Shows item summary
 * - Shows SP wallet balance
 * - Allows SP discount selection (capped at 50%)
 * - Shows fee breakdown ($0.99 for subscribers, $2.99 for others)
 * - Handles trade initiation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { getItemById, Item } from '@/services/items';
import { getSubscriptionSummary, SubscriptionSummary } from '@/services/subscription';
import { getSPWalletSummary, SPWalletSummary } from '@/services/sp';
import { initiateTradeV2 } from '@/services/trade';
import { useAuth } from '@/hooks/useAuth';
import { getAdminConfig } from '@/services/adminConfig';

type TradeInitiationRouteProp = RouteProp<RootStackParamList, 'TradeInitiation'>;

export default function TradeInitiationScreen() {
  const route = useRoute<TradeInitiationRouteProp>();
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const user = session?.user;
  const { itemId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [wallet, setWallet] = useState<SPWalletSummary | null>(null);
  const [spAmount, setSpAmount] = useState(0);
  const [maxSpPercentage, setMaxSpPercentage] = useState(50);

  useEffect(() => {
    fetchData();
  }, [itemId, user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const [itemData, subData, walletData, config] = await Promise.all([
        getItemById(itemId),
        getSubscriptionSummary(user.id),
        getSPWalletSummary(user.id),
        getAdminConfig(),
      ]);

      if (!itemData) {
        Alert.alert('Error', 'Item not found');
        navigation.goBack();
        return;
      }

      setItem(itemData);
      setSubscription(subData);
      setWallet(walletData);
      if (config?.sp_max_percentage_per_purchase) {
        setMaxSpPercentage(config.sp_max_percentage_per_purchase);
      }
    } catch (error) {
      console.error('❌ Error fetching trade data:', error);
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !item || !subscription || !wallet) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Preparing your trade...</Text>
      </View>
    );
  }

  // Business Rules
  const isSubscriber = subscription.is_subscriber;
  const buyerFeeCents = isSubscriber ? 99 : 299;
  const itemPriceCents = Math.round(item.price * 100);
  
  // V2: 1 SP = $1.00 (100 cents)
  const spToCashRate = 100;
  const maxDiscountCents = Math.floor(itemPriceCents * (maxSpPercentage / 100));
  const maxSpAllowed = maxDiscountCents / spToCashRate;
  
  const availableSp = wallet.available_balance;
  const maxSpToUse = Math.min(maxSpAllowed, availableSp);
  
  // SP is only available for subscribers and if item accepts SP
  const canUseSp = isSubscriber && item.accepts_swap_points;

  const spDiscountCents = spAmount * spToCashRate;
  const cashAmountCents = itemPriceCents - spDiscountCents + buyerFeeCents;
  const cashAmount = cashAmountCents / 100;

  const handleInitiateTrade = async () => {
    try {
      setSubmitting(true);
      const result = await initiateTradeV2({
        item_id: item.id,
        sp_amount: spAmount,
      });

      if (result.success && result.trade_id) {
        // Navigate to success or payment screen
        // For now, we'll go to a success screen (to be implemented)
        navigation.replace('TradeSuccess', { tradeId: result.trade_id });
      } else {
        Alert.alert('Trade Failed', result.error || 'Could not initiate trade');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const incrementSp = () => {
    if (spAmount < maxSpToUse) {
      setSpAmount(prev => Math.min(prev + 1, maxSpToUse));
    }
  };

  const decrementSp = () => {
    if (spAmount > 0) {
      setSpAmount(prev => Math.max(prev - 1, 0));
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
        setSpAmount(Math.min(numericValue, maxSpToUse));
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Confirm Your Trade</Text>

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
            <Text style={styles.sectionTitle}>Swap Points Discount</Text>
            <Text style={styles.walletBalance}>Balance: {availableSp} SP</Text>
          </View>

          {!isSubscriber ? (
            <View style={styles.upgradeContainer}>
              <Text style={styles.upgradeText}>
                Swap Points are a Kids Club+ feature. Join now to save up to {maxSpPercentage}% on every trade!
              </Text>
              <Pressable 
                style={styles.upgradeButton}
                onPress={() => navigation.navigate('SubscriptionChoice')}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Kids Club+</Text>
              </Pressable>
            </View>
          ) : !item.accepts_swap_points ? (
            <Text style={styles.infoText}>
              This seller does not accept Swap Points for this item.
            </Text>
          ) : maxSpToUse === 0 ? (
            <Text style={styles.infoText}>
              {availableSp === 0 
                ? "You don't have any Swap Points yet." 
                : "This item is too cheap to use Swap Points."}
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
                {isSubscriber ? 'Kids Club+ Rate' : 'Standard Rate'}
              </Text>
            </View>
            <Text style={styles.breakdownValue}>${(buyerFeeCents / 100).toFixed(2)}</Text>
          </View>

          <View style={[styles.breakdownRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Cash Due</Text>
            <Text style={styles.totalValue}>${cashAmount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.disclaimer}>
            By confirming, you agree to the trade terms. Swap Points will be deducted immediately.
          </Text>
          <Pressable
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            onPress={handleInitiateTrade}
            disabled={submitting}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 20,
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

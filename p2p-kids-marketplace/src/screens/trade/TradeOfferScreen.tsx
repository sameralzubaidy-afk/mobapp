/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeOfferScreen.tsx
 * TASK FLOW-08-01: Trade Offer Screen - Whisk Design System
 * 
 * Redesigned with:
 * - Phosphor icons (ArrowsLeftRight, Coins, ShieldCheck)
 * - Two-column trade card layout
 * - Gold SP input (#FEF3C7 bg, #F59E0B accent)
 * - Green pill button (#5DBB8E)
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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { getItemById, Item } from '@/services/items';
import { initiateTradeV2 } from '@/services/trade';
import { useAuth, useSPWallet, useSubscriptionStatus } from '@/hooks/useAuth';
import { getAdminConfig } from '@/services/adminConfig';
import { calculateCategorySP } from '@/services/categoryService';
import WalletWarningBanner, { type WalletState } from '@/components/molecules/WalletWarningBanner';
import DisclaimerModal from '@/components/DisclaimerModal';
import { SPInfoTooltip } from '@/components/modals/SPInfoTooltip';
import { Modal, LoadingSpinner } from '@/components/ui';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import { ArrowsLeftRight, CaretLeft, Coins, ShieldCheck } from 'phosphor-react-native';

type TradeOfferRouteProp = RouteProp<RootStackParamList, 'TradeInitiation'>;

export default function TradeOfferScreen() {
  const route = useRoute<TradeOfferRouteProp>();
  const navigation = useNavigation<any>();
  const { session, refreshSession } = useAuth();
  const subStatus = useSubscriptionStatus();
  const walletStats = useSPWallet();

  const user = session?.user;
  const { itemId } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [spAmount, setSpAmount] = useState(0);
  const [maxSpAllowed, setMaxSpAllowed] = useState(0);
  const [maxSpPercentage, setMaxSpPercentage] = useState(50);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showSpInfoTooltip, setShowSpInfoTooltip] = useState(false);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string; isDuplicate?: boolean }>({
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
      const [itemData, config] = await Promise.all([
        getItemById(itemId),
        getAdminConfig(),
      ]);

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
      console.error('❌ Error fetching trade data:', error);
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  }, [itemId, navigation, refreshSession, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendOffer = async () => {
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = async (policyId: string) => {
    setShowDisclaimer(false);
    await handleInitiateTrade(policyId);
  };

  const handleInitiateTrade = async (_policyId?: string) => {
    if (!item) return;
    
    try {
      setSubmitting(true);

      const result = await initiateTradeV2({
        item_id: item.id,
        sp_amount: spAmount,
      });

      if (!result.success || !result.trade_id) {
        const failureMessage = result.error || 'Could not initiate trade';
        const isDuplicateOfferError = /active offer/i.test(failureMessage);

        setErrorModal({
          visible: true,
          title: isDuplicateOfferError ? 'Active Offer' : 'Trade Failed',
          message: failureMessage,
          isDuplicate: isDuplicateOfferError,
        });
        return;
      }

      navigation.replace('TradeSuccess', { tradeId: result.trade_id });
    } catch (error: any) {
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

  if (loading || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading offer...</Text>
        </View>
      </SafeAreaView>
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            testID="trade-offer-back-button"
          >
            <CaretLeft size={20} color="#1A1A1A" weight="bold" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

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
              {spAmount > 0 && (
                <Text style={styles.spUsedBadge}>{spAmount} SP applied</Text>
              )}
            </View>
          </View>

          {/* SP Offer Input */}
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
                />
                <Text style={styles.spUnit}>SP</Text>
              </View>
              <Text style={styles.spHint}>
                Max: {maxSpToUse} SP ({maxSpPercentage}% of price)
              </Text>
            </View>
          )}

          {/* Safety Disclaimer */}
          <View style={styles.disclaimerBox} testID="safety-disclaimer">
            <ShieldCheck size={20} color="#5DBB8E" weight="regular" style={{ marginRight: 8 }} />
            <Text style={styles.disclaimerText}>
              Trades are protected by our safety guidelines. Complete in-person exchanges only.
            </Text>
          </View>

          {/* Send Offer Button */}
          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleSendOffer}
            disabled={submitting}
            testID="send-offer-button"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send Offer</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavBar />

      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        onCancel={() => setShowDisclaimer(false)}
      />

      <SPInfoTooltip
        visible={showSpInfoTooltip}
        onClose={() => setShowSpInfoTooltip(false)}
      />

      <Modal
        visible={errorModal.visible}
        type="alert"
        title={errorModal.title}
        message={errorModal.message}
        primaryButtonText={errorModal.isDuplicate ? "Go to Trade History" : "OK"}
        secondaryButtonText={errorModal.isDuplicate ? "Dismiss" : undefined}
        onPrimaryPress={() => {
          setErrorModal({ ...errorModal, visible: false });
          if (errorModal.isDuplicate) {
            navigation.navigate('TradeList');
          }
        }}
        onSecondaryPress={() => setErrorModal({ ...errorModal, visible: false })}
        onClose={() => setErrorModal({ ...errorModal, visible: false })}
      />
    </SafeAreaView>
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
});

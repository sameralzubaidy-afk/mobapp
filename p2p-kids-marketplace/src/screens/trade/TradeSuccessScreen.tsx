/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeSuccessScreen.tsx
 * TASK FLOW-08-06: Trade Result Screen - Whisk Design System
 * TFV2-014: Buyer/Seller targeted CTAs on completion
 *
 * Redesigned with:
 * - Success state: CheckCircle 72px green (#5DBB8E), SP earned badge (#FEF3C7 bg)
 * - Failure state: XCircle 72px red (#E85D75), error message display
 * - D-14: Buyer CTAs: "Leave a Review", "View SP Earned"
 * - D-14: Seller CTAs: "List Another Item", "View Earnings", "Leave a Review"
 * - "View My Trades" button (primary), "Back to Home" button (outlined)
 * - Kids Club upsell as prominent primary CTA for free users
 * - Fee savings dynamically computed from admin_config (no hardcoded $2)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { CheckCircle, XCircle, Coins } from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';
import { getTransactionFeeSubscriberCents, getTransactionFeeNonSubscriberCents } from '@/services/adminConfig';
import { useAuth } from '@/hooks/useAuth';

type TradeSuccessRouteProp = RouteProp<RootStackParamList, 'TradeSuccess'>;

// TFV2-014: Completion CTA interface — drives all 7 buyer/seller × tier permutations
interface CompletionCTA {
  message: string;
  ctaLabel: string;
  onPress: () => void;
}

/** buildCompletionCTA — pure function, exactly per MODULE-15.1.2 spec */
function buildCompletionCTA(
  isBuyer: boolean,
  isSeller: boolean,
  isSubscriber: boolean,
  spUsedByBuyer: number,
  listingType: 'cash_only' | 'accept_sp' | 'donate',
  totalSpToSeller: number,
  releaseDays: number,
  remainingSP: number,
  spAmountDollars: number,
  navigation: any,
  feeSavingsCents: number,
  tradeStatus: 'initiated' | 'completed' = 'initiated',
): CompletionCTA {
  if (isBuyer) {
    if (!isSubscriber) {
      // Permutation 1: Free buyer — upsell Kids Club+
      const savingsDollars = (feeSavingsCents / 100).toFixed(2);
      return {
        message: `Kids Club+ would've saved you $${savingsDollars} on this trade — try it free for 30 days.`,
        ctaLabel: 'Try Kids Club+ Free — 30 Days',
        onPress: () => navigation.navigate('PlanComparison'),
      };
    } else if (spUsedByBuyer > 0) {
      // Permutation 2: Subscriber buyer, used SP
      return {
        message: `You saved $${spAmountDollars.toFixed(2)} using SP! You have ${remainingSP} SP left.`,
        ctaLabel: 'Keep Shopping',
        onPress: () => navigation.navigate('Discover'),
      };
    } else {
      // Permutation 3: Subscriber buyer, no SP used
      // Respect tradeStatus — "Trade complete!" only on completed trades
      const message =
        tradeStatus === 'completed'
          ? 'Trade complete! Consider using SP on your next purchase to save more.'
          : 'Consider using SP on your next purchase to save more.';
      return {
        message,
        ctaLabel: 'Browse Items',
        onPress: () => navigation.navigate('Discover'),
      };
    }
  }

  if (isSeller) {
    if (!isSubscriber) {
      // Permutation 4: Free seller — upsell Kids Club+
      return {
        message: 'Subscribe to earn Swap Points on your next sale — set "Accept SP" when listing.',
        ctaLabel: 'Try Kids Club+ Free — 30 Days',
        onPress: () => navigation.navigate('PlanComparison'),
      };
    } else if (listingType === 'cash_only') {
      // Permutation 5: Subscriber seller, cash_only listing
      return {
        message: 'Sold for cash! Try "Accept SP" on your next listing to also earn SP.',
        ctaLabel: 'Create New Listing',
        onPress: () => navigation.navigate('ItemCreate'),
      };
    } else if (spUsedByBuyer > 0) {
      // Permutation 6: Subscriber seller, accept_sp, SP used by buyer
      return {
        message: `${totalSpToSeller} SP releasing in ${releaseDays} days — added to your pending wallet.`,
        ctaLabel: 'View Wallet',
        onPress: () => navigation.navigate('SpWallet'),
      };
    } else {
      // Permutation 7: Subscriber seller, accept_sp, no SP used
      return {
        message: `${totalSpToSeller} SP releasing in ${releaseDays} days (platform reward).`,
        ctaLabel: 'View Wallet',
        onPress: () => navigation.navigate('SpWallet'),
      };
    }
  }

  return { message: 'Trade complete!', ctaLabel: 'Done', onPress: () => navigation.goBack() };
}

export default function TradeSuccessScreen() {
  const route = useRoute<TradeSuccessRouteProp>();
  const navigation = useNavigation<any>();
  const { tradeId } = route.params;
  const { session } = useAuth();
  const user = session?.user;

  // Determine state from params (default to success)
  const isSuccess = (route.params as any)?.success !== false;
  const spEarned = (route.params as any)?.spEarned || 0;
  const errorMessage = (route.params as any)?.errorMessage;
  // TFV2-014: role, subscription tier, and SP data for 7-permutation CTAs
  const role: 'buyer' | 'seller' = (route.params as any)?.role ?? 'buyer';
  // Distinguish initiation vs completion for correct title/message
  const tradeStatus: 'initiated' | 'completed' = (route.params as any)?.tradeStatus ?? 'initiated';
  // Derive subscription status from the actual session (not route params)
  // Callers only pass { tradeId } — without this, all users default to 'free'
  const subscriptionStatus: 'free' | 'subscriber' =
    session?.subscription_status && session.subscription_status !== 'free'
      ? 'subscriber'
      : 'free';
  const spUsed: number = (route.params as any)?.spUsed ?? 0;
  const listingType: 'cash_only' | 'accept_sp' | 'donate' = (route.params as any)?.listingType ?? 'cash_only';
  const totalSpToSeller: number = (route.params as any)?.totalSpToSeller ?? 0;
  const spPendingReleaseDays: number = (route.params as any)?.spPendingReleaseDays ?? 3;
  // Fallback to session available_points if route param not provided (e.g. from TradeDetailScreen completion flow)
  const remainingSP: number = (route.params as any)?.remainingSP ?? session?.available_points ?? 0;
  const spAmountDollars: number = (route.params as any)?.spAmountDollars ?? 0;

  // ── Dynamic fee savings from admin_config ──────────────────────────────
  const [feeSavingsCents, setFeeSavingsCents] = useState(200); // default $2
  const [loadingFee, setLoadingFee] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoadingFee(false);
      return;
    }
    let cancelled = false;
    const loadFee = async () => {
      try {
        // Fetch both fees independently of the user's tier
        const [subFee, nonSubFee] = await Promise.all([
          getTransactionFeeSubscriberCents(),
          getTransactionFeeNonSubscriberCents(),
        ]);
        if (!cancelled) {
          // Savings = non-subscriber fee - subscriber fee (e.g., 299 - 99 = 200 = $2.00)
          const savings = Math.max(0, nonSubFee - subFee);
          setFeeSavingsCents(savings);
        }
      } catch {
        // keep default $2 (200 cents)
      } finally {
        if (!cancelled) setLoadingFee(false);
      }
    };
    void loadFee();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handlePrimaryAction = () => {
    if (isSuccess) {
      navigation.navigate('TradeTimeline', { tradeId });
    } else {
      navigation.goBack();
    }
  };

  return (
    <ScreenLayout variant="detail" title="Trade Complete">
      <View style={styles.content}>
        {/* Icon */}
        {isSuccess ? (
          <CheckCircle size={72} color="#5DBB8E" weight="fill" testID="success-icon" />
        ) : (
          <XCircle size={72} color="#E85D75" weight="fill" testID="failure-icon" />
        )}

        {/* Title */}
        <Text style={[styles.title, !isSuccess && styles.titleError]}>
          {isSuccess
            ? role === 'seller'
              ? 'Sale Complete!'
              : tradeStatus === 'completed'
                ? 'Trade Complete!'
                : 'Trade Initiated!'
            : 'Trade Failed'}
        </Text>

        {/* Message */}
        <Text style={styles.message}>
          {isSuccess
            ? role === 'seller'
              ? 'Great news! Your item has been sold. Earnings will be processed shortly.'
              : tradeStatus === 'completed'
                ? 'Your item has been received. Thanks for confirming!'
                : 'Your trade request has been sent. You can track the status in your trades list.'
            : errorMessage || 'There was a problem initiating the trade. Please try again.'}
        </Text>

        {/* SP Earned Badge (success only) */}
        {isSuccess && spEarned > 0 && (
          <View style={styles.spBadge} testID="sp-earned-badge">
            <Coins size={16} color="#F59E0B" weight="regular" />
            <Text style={styles.spBadgeText}>You'll earn {spEarned} SP when complete</Text>
          </View>
        )}

        {/* TFV2-014: 7-permutation CTAs based on role + subscription tier */}
        {isSuccess ? (
          (() => {
            const isBuyer = role === 'buyer';
            const isSeller = role === 'seller';
            const isSubscriber = subscriptionStatus === 'subscriber';
            const cta = buildCompletionCTA(
              isBuyer,
              isSeller,
              isSubscriber,
              spUsed,
              listingType,
              totalSpToSeller,
              spPendingReleaseDays,
              remainingSP,
              spAmountDollars,
              navigation,
              feeSavingsCents,
              tradeStatus,
            );
            return (
              <View style={styles.ctaGroup}>
                {/* CTA contextual message */}
                <Text style={styles.ctaMessage} testID="cta-message">{cta.message}</Text>

                {/* Primary CTA button */}
                <Pressable
                  style={styles.primaryButton}
                  onPress={cta.onPress}
                  testID="cta-primary-button"
                >
                  <Text style={styles.primaryButtonText}>{cta.ctaLabel}</Text>
                </Pressable>

                {/* Rate Seller button (completion only) */}
                {tradeStatus === 'completed' && role === 'buyer' && (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      navigation.navigate('SubmitReview', {
                        tradeId,
                        revieweeId: (route.params as any)?.counterpartyId || '',
                        revieweeName: (route.params as any)?.counterpartyName || 'Seller',
                      })
                    }
                    testID="rate-seller-button"
                  >
                    <Text style={styles.secondaryButtonText}>Rate Seller</Text>
                  </Pressable>
                )}

                {/* View Trade Details button (both buyer and seller) */}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('TradeDetail', { tradeId })}
                  testID="cta-view-trade-details-button"
                >
                  <Text style={styles.secondaryButtonText}>View Trade Details</Text>
                </Pressable>

                {/* View My Trades button (replaces old "Done" text link) */}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('TradeList')}
                  testID="cta-view-trades-button"
                >
                  <Text style={styles.secondaryButtonText}>View My Trades</Text>
                </Pressable>
              </View>
            );
          })()
        ) : (
          /* Failure state */
          <View style={styles.ctaGroup}>
            <Pressable
              style={[styles.primaryButton, styles.primaryButtonError]}
              onPress={handlePrimaryAction}
              testID="primary-action-button"
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Back to Home — reset to Home tab (UserDashboard) instead of navigating
            to an existing stack that may be showing Discover tab */}
        <Pressable
          style={styles.backHomeButton}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
          testID="back-home-button"
        >
          <Text style={styles.backHomeButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5DBB8E',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  titleError: {
    color: '#E85D75',
  },
  message: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  spBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  spBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  ctaMessage: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaGroup: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonError: {
    backgroundColor: '#E85D75',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#5DBB8E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  backHomeButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#5DBB8E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  backHomeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5DBB8E',
  },
});


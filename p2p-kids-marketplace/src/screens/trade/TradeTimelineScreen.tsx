/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx
 * TASK FLOW-08-03: Active Trade Screen - Whisk Design System
 *
 * Redesigned with:
 * - Phosphor icons (Clock, ArrowsLeftRight, CheckCircle, XCircle, ChatCircle)
 * - Status banners with semantic colors
 * - Vertical timeline with circle indicators  
 * - Green pill button for confirm, red for cancel
 * - Secondary message button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { Trade, TradeStatus } from '@/types/trade';
import { completeTradeV2, cancelTradeV2 } from '@/services/trade';
import { canReviewUser, getTradeReviewStatus } from '@/services/review';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';
import { TradeConfirmationModal } from '@/components/molecules/TradeConfirmationModal';
import { AutoCompleteBanner } from '@/components/trade';
import { SafeMeetupCard } from '@/components/trade/SafeMeetupCard';
import { IssueReportModal } from './IssueReportModal';
import {
  Clock,
  CheckCircle,
  XCircle,
  ChatCircle,
  WarningCircle,
  ArrowsLeftRight,
  Star,
} from 'phosphor-react-native';
import { CancellationReasonModal, SELLER_INPROGRESS_REASONS } from '@/components/molecules/CancellationReasonModal';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import Avatar from '@/components/atoms/Avatar';
import ScreenLayout from '@/components/ScreenLayout';

type TradeTimelineRouteProp = RouteProp<RootStackParamList, 'TradeTimeline'>;

export default function TradeTimelineScreen() {
  const route = useRoute<TradeTimelineRouteProp>();
  const navigation = useNavigation<any>();
  const { session, refreshSession } = useAuth();
  const user = session?.user;
  const { tradeId } = route.params;

  // 🛡️ Guard: if tradeId is missing or not a valid UUID, redirect to trade list
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tradeId || !UUID_RE.test(tradeId)) {
    // Use setTimeout to avoid navigation during render
    setTimeout(() => navigation.replace('TradeList'), 0);
  }

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [notifModal, setNotifModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant?: 'accept' | 'decline' | 'default';
    confirmLabel?: string;
    onConfirm?: () => void;
  } | null>(null);
  // D-30: Payment pre-auth is handled at offer creation; no manual "Make Payment" step
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [otherUserReviewed, setOtherUserReviewed] = useState(false);
  const [counterpartyProfile, setCounterpartyProfile] = useState<any>(null);
  // Addendum C: bundle size for bundle-aware complete confirmation
  const [bundleSize, setBundleSize] = useState<number>(0);
  // TFV2-011: Issue report modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [nextStepsDismissed, setNextStepsDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const showNotif = (title: string, message: string, variant?: 'accept' | 'decline' | 'default', onConfirm?: () => void) => {
    setNotifModal({ visible: true, title, message, variant: variant || 'default', confirmLabel: 'OK', onConfirm });
  };

  const fetchTrade = useCallback(async () => {
    try {
      setLoading(true);

      // Step 1: Fetch trade row
      const { data: tradeDataRaw, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (tradeError) throw tradeError;
      const tradeData = tradeDataRaw as any;

      // Step 2: Fetch listing (item) + images separately — avoids FK join issues
      let listingData: any = null;
      if (tradeData.listing_id) {
        const { data: item, error: itemError } = await supabase
          .from('items')
          .select('id, title, price')
          .eq('id', tradeData.listing_id)
          .maybeSingle();

        if (!itemError && item) {
          const { data: images } = await supabase
            .from('item_images')
            .select('id, url, thumbnail_url, display_order')
            .eq('item_id', tradeData.listing_id)
            .order('display_order', { ascending: true });

          listingData = { ...item, images: images || [] };
        }
      }

      // Attach listing to trade for downstream consumption
      const enrichedTrade = { ...tradeData, listing: listingData };
      setTrade(enrichedTrade);

      const otherPersonId =
        user?.id === enrichedTrade.buyer_id ? enrichedTrade.seller_id : enrichedTrade.buyer_id;
      if (otherPersonId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url, verification:id_badge_verification_requests(status)')
          .eq('user_id', otherPersonId)
          .single();

        if (profile) {
          setCounterpartyProfile({
            ...profile,
            verification_status: (profile as any).verification?.[0]?.status || 'none',
          });
        }
      }

      if (user?.id && enrichedTrade.status === 'completed') {
        const reviewStatusResult = await getTradeReviewStatus(tradeId, user.id);
        if (reviewStatusResult.success) {
          setHasReviewed(reviewStatusResult.userReviewed);
          setOtherUserReviewed(reviewStatusResult.otherUserReviewed);

          const result = await canReviewUser(tradeId, user.id);
          if (result.success) {
            setCanReview(result.canReview === true);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching trade:', error);
      showNotif('Error', 'Failed to load trade', 'decline');
    } finally {
      setLoading(false);
    }
  }, [tradeId, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrade();
    setRefreshing(false);
  }, [fetchTrade]);

  useEffect(() => {
    fetchTrade();

    const channel = supabase
      .channel(`trade-timeline-${tradeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trades',
          filter: `id=eq.${tradeId}`,
        },
        () => {
          fetchTrade();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId, fetchTrade]);

  useFocusEffect(
    useCallback(() => {
      fetchTrade();
    }, [fetchTrade])
  );

  // Addendum C: fetch bundle sibling count when trade has a bundle_id.
  useEffect(() => {
    const bundleId = (trade as any)?.bundle_id;
    if (!bundleId) {
      setBundleSize(0);
      return;
    }
    let active = true;
    supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('bundle_id', bundleId)
      .then(({ count }: { count: number | null }) => {
        if (active) setBundleSize(count ?? 0);
      });
    return () => { active = false; };
  }, [(trade as any)?.bundle_id]);

  const handleComplete = async () => {
    if (hasUnresolvedDispute) {
      showNotif('Dispute Open', 'This trade has an unresolved dispute and cannot be completed yet.', 'decline');
      return;
    }

    // Addendum C: if all bundle siblings are also in_progress, offer "Confirm All" shortcut.
    const bundleId = (trade as any)?.bundle_id;
    if (bundleId) {
      try {
        const { data: siblings } = await supabase
          .from('trades')
          .select('id, status')
          .eq('bundle_id', bundleId)
          .neq('id', tradeId);
        const allInProgress =
          siblings && siblings.length > 0 &&
          siblings.every((s: any) => s.status === 'in_progress');
        if (allInProgress) {
          const total = (siblings?.length ?? 0) + 1;
          Alert.alert(
            `Confirm all ${total} items received?`,
            'All items from this seller are ready to confirm.',
            [
              {
                text: `Confirm All ${total}`,
                onPress: async () => {
                  setSubmitting(true);
                  try {
                    const allIds = [tradeId, ...(siblings?.map((s: any) => s.id) ?? [])];
                    for (const tid of allIds) {
                      await completeTradeV2(tid);
                    }
                    if (refreshSession) await refreshSession();
                    showNotif('Done!', `All ${total} items marked as completed.`, 'accept', () => {
                      setNotifModal(null);
                      navigation.goBack();
                    });
                  } catch {
                    showNotif('Error', 'Could not confirm all items. Try confirming each one.', 'decline');
                  } finally {
                    setSubmitting(false);
                  }
                },
              },
              {
                text: 'Just This One',
                style: 'cancel',
                onPress: () => setShowCompleteConfirm(true),
              },
            ]
          );
          return;
        }
      } catch {
        // Non-blocking: fall through to standard confirm modal on error.
      }
    }

    setShowCompleteConfirm(true);
  };

  const confirmCompleteTrade = async () => {
    try {
      setShowCompleteConfirm(false);
      setSubmitting(true);
      const result = await completeTradeV2(tradeId);

      if (result.success) {
        showNotif('Success', result.message || 'Trade marked as completed!', 'accept', () => {
          setNotifModal(null);
          fetchTrade();
        });
      } else {
        showNotif('Error', result.error || 'Failed to complete trade', 'decline');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setShowCancellationModal(true);
  };

  const handleReportProblem = () => {
    setShowIssueModal(true);
  };

  const handleCancellationConfirm = async (reason: string) => {
    // Capture trade state BEFORE cancellation for consequence logic.
    const wasInProgress = trade?.status === 'in_progress';
    const wasSeller = user?.id === trade?.seller_id;
    try {
      setIsCancelling(true);
      setShowCancellationModal(false);

      const result = await cancelTradeV2(tradeId, reason);
      if (result.success) {
        if (refreshSession) await refreshSession();

        // TFV2-023: tiered consequence toasts for seller post-acceptance cancellations.
        if (wasSeller && wasInProgress && result.consequenceLevel !== null && result.consequenceLevel !== undefined) {
          const level = result.consequenceLevel;
          if (level === 1) {
            showNotif('Trade Cancelled', 'Cancelling after payment is disappointing for buyers. This has been noted on your account.', 'default', () => {
              setNotifModal(null);
              navigation.goBack();
            });
          } else if (level === 2) {
            showNotif('Trade Cancelled — Warning', "You've now cancelled 2 trades after payment. A third cancellation may affect your selling privileges.", 'decline', () => {
              setNotifModal(null);
              navigation.goBack();
            });
          } else {
            // Level 3+
            showNotif('Trade Cancelled — Account Under Review', 'Your account is under review due to repeated post-payment cancellations. Our support team will be in touch.', 'decline', () => {
              setNotifModal(null);
              navigation.goBack();
            });
          }
        } else {
          showNotif('Trade Cancelled', 'Your trade has been cancelled. Any Swap Points have been refunded to your wallet.', 'default', () => {
            setNotifModal(null);
            navigation.goBack();
          });
        }
      } else {
        showNotif('Cancellation Failed', result.error || 'Failed to cancel trade. Please try again.', 'decline', () => {
          setNotifModal(null);
          setShowCancellationModal(true);
        });
      }
    } catch (error: any) {
      showNotif('Error', error.message || 'An unexpected error occurred', 'decline');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReviewPress = () => {
    if (!user?.id || !trade) return;

    const isBuyer = trade.buyer_id === user.id;
    const counterpartyId = isBuyer ? trade.seller_id : trade.buyer_id;
    const counterpartyName = isBuyer ? 'the seller' : 'the buyer';

    navigation.navigate('SubmitReview', {
      tradeId,
      revieweeId: counterpartyId,
      revieweeName: counterpartyName,
    });
  };

  const handleItemDetailsPress = () => {
    const listingId = (trade as any).listing?.id;
    if (listingId) {
      navigation.navigate('ListingDetail', { listing_id: listingId });
    }
  };

  const handleOpenChat = () => {
    navigation.navigate('Chat', { tradeId });
  };

  // D-30: No manual payment step — Stripe pre-auth is captured on seller accept via transactions-update EF.
  // The buyer goes directly from pending → in_progress and sees [I Got It].

  if (loading || !trade) {
    return (
      <ScreenLayout variant="detail" title="Trade Timeline">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading trade...</Text>
        </View>
      </ScreenLayout>
    );
  }

  const isBuyer = user?.id === trade.buyer_id;
  const isSeller = user?.id === trade.seller_id;
  // D-30: Payment is pre-authorized at offer creation, captured on seller accept — no manual payment step.
  const hasUnresolvedDispute = !!(trade as any).dispute_status && !['none', 'resolved'].includes((trade as any).dispute_status);
  const completeConfirmMessage =
    'Confirm you received the item as expected? This final step releases Swap Points or cash to the seller.';
  const listing = (trade as any).listing;
  const listingImages = Array.isArray(listing?.images) ? listing.images : [];
  const firstListingImage = listingImages.length
    ? [...listingImages].sort(
        (a: any, b: any) => (a?.display_order ?? 0) - (b?.display_order ?? 0)
      )[0]
    : null;
  const listingImageUri: string | null = firstListingImage
    ? (firstListingImage.thumbnail_url as string | null) || (firstListingImage.url as string)
    : null;
  const listingPriceNumber =
    typeof listing?.price === 'number' ? listing.price : Number(listing?.price ?? 0);

  return (
    <ScreenLayout variant="detail" title="Trade Timeline">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5DBB8E" />
        }>
        {/* Addendum C: bundle context banner */}
        {bundleSize > 1 && (
          <View style={styles.bundleBanner} testID="bundle-context-banner">
            <Text style={styles.bundleBannerText}>
              Part of a bundle · {bundleSize} items
            </Text>
          </View>
        )}

        <View style={[styles.statusBanner, getStatusBannerStyle(trade.status)]} testID="status-banner">
          {getStatusIcon(trade.status)}
          <View style={styles.statusBannerTextContainer}>
            <Text style={[styles.statusBannerLabel, getStatusTextStyle(trade.status)]}>
              {getStatusDisplay(trade.status)}
            </Text>
            {trade.status === 'cancelled' && trade.cancellation_reason && (
              <Text style={[styles.statusBannerSubtext, getStatusTextStyle(trade.status)]}>
                Reason: {trade.cancellation_reason}
              </Text>
            )}
          </View>
        </View>

        <Pressable style={styles.listingCard} onPress={handleItemDetailsPress}>
          <View style={styles.imageContainer}>
            {listingImageUri ? (
              <Image source={{ uri: listingImageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>📦</Text>
              </View>
            )}
          </View>

          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={2}>
              {listing?.title || 'Item'}
            </Text>
            <Text style={styles.listingSubtitle}>
              {isBuyer ? 'Buying' : 'Selling'}
              {Number.isFinite(listingPriceNumber) && listingPriceNumber > 0
                ? ` · $${listingPriceNumber.toFixed(2)}`
                : ''}
            </Text>
          </View>
        </Pressable>

        <View style={styles.timeline} testID="trade-timeline">
          {renderTimelineStep('pending', 'Initiated', trade.status, trade.auto_complete_at)}
          {/* D-30 FIX: Show "Awaiting Seller" when auto_complete_at IS NULL (pending acceptance) */}
          {renderTimelineStep(
            'in_progress',
            trade.auto_complete_at ? 'In Progress' : 'Awaiting Seller',
            trade.status,
            trade.auto_complete_at
          )}
          {renderTimelineStep('completed', 'Completed', trade.status, trade.auto_complete_at)}
        </View>

        {/* D-30 FIX: Show "Awaiting Seller" card for pending offers OR in_progress without auto_complete_at */}
        {(trade.status === 'pending' || (trade.status === 'in_progress' && !trade.auto_complete_at)) && (
          <View style={styles.pendingSellerCard} testID="pending-seller-card">
            <Clock size={20} color="#F59E0B" weight="regular" />
            <View style={styles.pendingSellerContent}>
              <Text style={styles.pendingSellerTitle}>Awaiting seller response</Text>
              <Text style={styles.pendingSellerDesc}>
                The seller has 48 hours to accept or decline your offer. You'll receive a notification when they respond.
              </Text>
            </View>
          </View>
        )}

        {/* What to do next — only shown AFTER seller accepts (auto_complete_at set) */}
        {trade.status === 'in_progress' && trade.auto_complete_at && (
          nextStepsDismissed ? (
            <Pressable
              style={styles.nextStepsCollapsed}
              onPress={() => setNextStepsDismissed(false)}
              testID="next-steps-toggle"
            >
              <CheckCircle size={18} color="#5DBB8E" weight="fill" />
              <Text style={styles.nextStepsCollapsedText}>What to do next</Text>
              <Text style={styles.nextStepsCollapsedChevron}>{'\u203A'}</Text>
            </Pressable>
          ) : (
            <View style={styles.nextStepsCard} testID="next-steps-card">
              <View style={styles.nextStepsHeader}>
                <View style={styles.nextStepsIconWrap}>
                  <CheckCircle size={18} color="#FFFFFF" weight="fill" />
                </View>
                <Text style={styles.nextStepsTitle}>What to do next</Text>
              </View>
              <View style={styles.nextStepsList}>
                {isBuyer ? (
                  <>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>1</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Message the seller</Text>
                        <Text style={styles.nextStepDesc}>Coordinate the meetup location and time</Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>2</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Meet up and inspect the item</Text>
                        <Text style={styles.nextStepDesc}>Make sure everything looks as described</Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>3</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Come back and tap "I Got It"</Text>
                        <Text style={styles.nextStepDesc}>This releases funds to the seller and completes the trade</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>1</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Message the buyer</Text>
                        <Text style={styles.nextStepDesc}>Coordinate a meetup time and place</Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>2</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Hand off the item</Text>
                        <Text style={styles.nextStepDesc}>Make sure the buyer is satisfied with their purchase</Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>3</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Wait for buyer confirmation</Text>
                        <Text style={styles.nextStepDesc}>Once the buyer confirms receipt, your payout will be released</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
              <Pressable
                style={styles.nextStepsCta}
                onPress={() => setNextStepsDismissed(true)}
                testID="next-steps-cta"
              >
                <CheckCircle size={16} color="#FFFFFF" weight="fill" style={{ marginRight: 6 }} />
                <Text style={styles.nextStepsCtaText}>Got it</Text>
              </Pressable>
            </View>
          )
        )}

        {/* Payout Hold Info Bar — seller only, after acceptance (in_progress with auto_complete_at set) */}
        {isSeller && trade.status === 'in_progress' && trade.auto_complete_at && (
          <View style={styles.payoutHoldCard}>
            <Text style={styles.payoutHoldEmoji}>💰</Text>
            <View style={styles.payoutHoldTextWrap}>
              <Text style={styles.payoutHoldTitle}>Your payout is on hold until trade completes</Text>
              <Text style={styles.payoutHoldDesc}>
                Funds are held securely and released once the buyer taps "I Got It"
              </Text>
            </View>
          </View>
        )}

        {/* Auto-complete timer with role-appropriate copy */}
        {/* Hidden when there's an unresolved dispute — no point showing a countdown if trade is frozen */}
        {trade.status === 'in_progress' && !hasUnresolvedDispute && (
          <AutoCompleteBanner autoCompleteAt={trade.auto_complete_at} status={trade.status} isSeller={isSeller} />
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cash Paid:</Text>
            <Text style={styles.value}>${(trade.cash_amount_cents / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Swap Points Used:</Text>
            <Text style={styles.value}>{trade.sp_amount} SP</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Platform Fee:</Text>
            <Text style={styles.value}>
              ${(trade.buyer_transaction_fee_cents / 100).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              ${((trade.cash_amount_cents + trade.buyer_transaction_fee_cents) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Hide message button for cancelled/expired trades — no active trade exists */}
        {trade.status !== 'cancelled' && (
        <Pressable style={styles.messageButton} onPress={handleOpenChat} testID="message-button">
          {counterpartyProfile ? (
            <Avatar
              imageUrl={counterpartyProfile.avatar_url}
              name={counterpartyProfile.name}
              size={24}
              verificationStatus={counterpartyProfile.verification_status}
            />
          ) : (
            <ChatCircle size={20} color="#5DBB8E" weight="regular" />
          )}
          <Text style={styles.messageButtonText}>Message {isBuyer ? 'Seller' : 'Buyer'}</Text>
        </Pressable>
        )}

        {/* TFV2-011 / D-26: Dispute status overlay banner */}
        {(trade as any).dispute_status === 'reported' && (
          <View style={styles.disputeBannerAmber} testID="dispute-banner-reported">
            <WarningCircle size={16} color="#92400E" weight="fill" />
            <Text style={styles.disputeBannerText}>
              Dispute reported — our team has been notified and will review shortly.
            </Text>
          </View>
        )}
        {(trade as any).dispute_status === 'under_review' && (
          <View style={styles.disputeBannerOrange} testID="dispute-banner-under-review">
            <WarningCircle size={16} color="#7C2D12" weight="fill" />
            <Text style={styles.disputeBannerTextOrange}>
              Dispute under review — our team is actively investigating.
            </Text>
          </View>
        )}

        {/* TFV2-020: Safe meetup tips (only after seller accepts, not for pending offers) */}
        {trade.status === 'in_progress' && trade.auto_complete_at && (
          <SafeMeetupCard tradeId={tradeId} />
        )}

        {/* D-30 FIX: Only show "I Got It" button when trade truly in progress (status='in_progress' AND auto_complete_at set)
            Hide for: status='pending' OR status='in_progress' with auto_complete_at=NULL */}
        {isBuyer && trade.status === 'in_progress' && trade.auto_complete_at && (
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.confirmButton,
                (submitting || hasUnresolvedDispute) && styles.disabledButton,
              ]}
              onPress={handleComplete}
              disabled={submitting || hasUnresolvedDispute}
              testID="confirm-trade-button"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.confirmButtonInner}>
                  <CheckCircle size={22} color="#FFFFFF" weight="fill" />
                  <View style={styles.confirmButtonTextWrap}>
                    <Text style={styles.confirmButtonText}>I Got It — Complete Trade</Text>
                    <Text style={styles.confirmButtonSub}>
                      Tap only after you've received and inspected your item
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>

            {!hasUnresolvedDispute && (
              <Pressable
                style={[styles.cancelButtonOutline, submitting && styles.disabledButton]}
                onPress={handleReportProblem}
                disabled={submitting}
                testID="report-problem-button"
              >
                <WarningCircle size={20} color="#E85D75" weight="regular" />
                <Text style={styles.cancelButtonOutlineText}>Report Problem</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Pending trade cancel (non-seller or zero-cash seller offer) */}
        {trade.status === 'pending' && (!isSeller || trade.cash_amount_cents === 0) && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.cancelButtonOutline, submitting && styles.disabledButton]}
              onPress={handleCancel}
              disabled={submitting}
              testID="cancel-trade-button"
            >
              <XCircle size={20} color="#E85D75" weight="regular" />
              <Text style={styles.cancelButtonOutlineText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {/* Addendum A (TFV2-023): seller can cancel an in_progress trade */}
        {isSeller && trade.status === 'in_progress' && !hasUnresolvedDispute && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.cancelButtonOutline, (submitting || isCancelling) && styles.disabledButton]}
              onPress={handleCancel}
              disabled={submitting || isCancelling}
              testID="seller-cancel-inprogress-button"
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#E85D75" />
              ) : (
                <XCircle size={20} color="#E85D75" weight="regular" />
              )}
              <Text style={styles.cancelButtonOutlineText}>Cancel Trade</Text>
            </Pressable>
          </View>
        )}

        {isSeller && trade.status === 'in_progress' && (
          <View style={styles.sellerCompletedBox} testID="seller-awaiting-payment-notice">
            <Clock size={20} color="#2563EB" weight="regular" style={{ marginRight: 8 }} />
            <Text style={styles.sellerCompletedText}>
              Trade accepted. Waiting for buyer payment confirmation.
            </Text>
          </View>
        )}

        {trade.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reviews</Text>
            <View style={styles.reviewStatusRow}>
              {hasReviewed ? (
                <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              ) : (
                <XCircle size={20} color="#E0E0E0" weight="regular" />
              )}
              <Text
                style={[styles.reviewStatusText, hasReviewed && styles.reviewStatusTextComplete]}
              >
                {`You ${hasReviewed ? 'have' : "haven't"} reviewed ${isBuyer ? 'the seller' : 'the buyer'}`}
              </Text>
            </View>
            <View style={[styles.reviewStatusRow, { marginTop: 8 }]}>
              {otherUserReviewed ? (
                <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              ) : (
                <XCircle size={20} color="#E0E0E0" weight="regular" />
              )}
              <Text
                style={[
                  styles.reviewStatusText,
                  otherUserReviewed && styles.reviewStatusTextComplete,
                ]}
              >
                {`${isBuyer ? 'The seller' : 'The buyer'} ${otherUserReviewed ? 'has' : "hasn't"} reviewed you`}
              </Text>
            </View>

            {canReview && !hasReviewed && (
              <Pressable
                style={[styles.reviewButton, { marginTop: 16 }]}
                onPress={handleReviewPress}
                testID="review-button"
              >
                <Star size={20} color="#FFFFFF" weight="regular" />
                <Text style={styles.confirmButtonText}>
                  Review {isBuyer ? 'the Seller' : 'the Buyer'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

      </ScrollView>
      <PersistentTabBar />

      <TradeConfirmationModal
        visible={showCompleteConfirm}
        title="Complete Trade"
        message={completeConfirmMessage}
        confirmLabel="Complete"
        variant="default"
        onConfirm={confirmCompleteTrade}
        onCancel={() => setShowCompleteConfirm(false)}
        loading={submitting}
      />

      {notifModal && (
        <TradeConfirmationModal
          visible={notifModal.visible}
          title={notifModal.title}
          message={notifModal.message}
          confirmLabel={notifModal.confirmLabel || 'OK'}
          variant={notifModal.variant || 'default'}
          onConfirm={() => notifModal.onConfirm ? notifModal.onConfirm() : setNotifModal(null)}
          onCancel={() => setNotifModal(null)}
          hideCancel
        />
      )}

      <CancellationReasonModal
        visible={showCancellationModal}
        itemTitle={listing?.title || 'Item'}
        onConfirm={handleCancellationConfirm}
        onCancel={() => setShowCancellationModal(false)}
        isLoading={isCancelling}
        reasons={isSeller && trade.status === 'in_progress' ? SELLER_INPROGRESS_REASONS : undefined}
      />

      {/* TFV2-011: Issue report modal (D-26 — does NOT cancel trade) */}
      <IssueReportModal
        visible={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onSubmit={async (reason, description) => {
          const { data, error } = await supabase.functions.invoke('open-dispute', {
            body: { trade_id: tradeId, reason, description },
          });
          if (error) {
            // Extract the actual error message from the FunctionsHttpError context
            // Supabase SDK puts the parsed response body in error.context
            const ctx = (error as any)?.context;
            const actualMsg = ctx?.error?.message || ctx?.message || (error as any)?.message || error.message;
            throw new Error(actualMsg);
          }
          if (data && !data.success) throw new Error(data.error?.message ?? 'Failed to report dispute');
          setShowIssueModal(false);
          fetchTrade();
        }}
      />
    </ScreenLayout>
  );
}

function renderTimelineStep(
  step: TradeStatus,
  label: string,
  currentStatus: TradeStatus,
  _autoCompleteAt?: string | null  // Prefixed with _ to indicate intentionally unused
): React.JSX.Element {
  const statusOrder: TradeStatus[] = ['pending', 'in_progress', 'completed'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepIndex = statusOrder.indexOf(step);

  const isActive = stepIndex === currentIndex;
  const isCompleted = stepIndex < currentIndex || currentStatus === 'completed';
  const isCancelled = currentStatus === 'cancelled';

  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineIconContainer}>
        <View
          style={[
            styles.timelineIcon,
            isCompleted && styles.timelineIconCompleted,
            isActive && styles.timelineIconActive,
            isCancelled && styles.timelineIconCancelled,
          ]}
        >
          {isCompleted && !isCancelled && <CheckCircle size={16} color="#FFFFFF" weight="fill" />}
          {isCancelled && <XCircle size={16} color="#FFFFFF" weight="fill" />}
        </View>
        {stepIndex < statusOrder.length - 1 && (
          <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text
          style={[styles.timelineLabel, (isActive || isCompleted) && styles.timelineLabelActive]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function getStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Awaiting Seller',  // D-30: More accurate - payment is pre-authorized, waiting for seller response
    payment_failed: 'Payment Failed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return statusMap[status] || status;
}

function getStatusBannerStyle(status: string): any {
  const styleMap: Record<string, any> = {
    pending: styles.statusBannerPending,
    payment_failed: styles.statusBannerFailed,
    in_progress: styles.statusBannerActive,
    completed: styles.statusBannerCompleted,
    cancelled: styles.statusBannerCancelled,
  };
  return styleMap[status] || {};
}

function getStatusTextStyle(status: string): any {
  const styleMap: Record<string, any> = {
    pending: { color: '#D97706' },
    payment_failed: { color: '#DC2626' },
    in_progress: { color: '#059669' },
    completed: { color: '#16A34A' },
    cancelled: { color: '#6B6B6B' },
  };
  return styleMap[status] || { color: '#1A1A1A' };
}

function getStatusIcon(status: string) {
  const iconProps = { size: 20, weight: 'regular' as const };
  switch (status) {
    case 'pending':
      return <Clock {...iconProps} color="#D97706" />;
    case 'payment_processing': /* D-30: deprecated */
      return <ArrowsLeftRight {...iconProps} color="#2563EB" />;
    case 'payment_failed':
      return <XCircle {...iconProps} color="#DC2626" />;
    case 'in_progress':
      return <ArrowsLeftRight {...iconProps} color="#059669" />;
    case 'completed':
      return <CheckCircle {...iconProps} color="#16A34A" />;
    case 'cancelled':
      return <XCircle {...iconProps} color="#6B6B6B" />;
    default:
      return <Clock {...iconProps} color="#6B6B6B" />;
  }
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  // Addendum C: bundle context banner style
  bundleBanner: {
    backgroundColor: '#EEF9F4',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  bundleBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5DBB8E',
  },
  // D-26: dispute status banners
  disputeBannerAmber: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  '#FFF9EC',
    borderWidth:      1,
    borderColor:      '#FDE68A',
    borderRadius:     8,
    padding:          12,
    marginBottom:     8,
    gap:              8,
  },
  disputeBannerOrange: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  '#FFF7ED',
    borderWidth:      1,
    borderColor:      '#FDBA74',
    borderRadius:     8,
    padding:          12,
    marginBottom:     8,
    gap:              8,
  },
  disputeBannerText: {
    flex:       1,
    fontSize:   13,
    fontFamily: 'Inter-Regular',
    color:      '#92400E',
    lineHeight: 18,
  },
  disputeBannerTextOrange: {
    flex:       1,
    fontSize:   13,
    fontFamily: 'Inter-Regular',
    color:      '#7C2D12',
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  statusBannerTextContainer: {
    flex: 1,
  },
  statusBannerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBannerSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBannerPending: { backgroundColor: '#FEF3C7' },
  statusBannerProcessing: { backgroundColor: '#DBEAFE' },
  statusBannerFailed: { backgroundColor: '#FEE2E2' },
  statusBannerActive: { backgroundColor: '#E8F5F0' },
  statusBannerCompleted: { backgroundColor: '#F0FDF4' },
  statusBannerCancelled: { backgroundColor: '#F0F0F0' },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 24,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  listingSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  timeline: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconActive: {
    backgroundColor: '#5DBB8E',
  },
  timelineIconCompleted: {
    backgroundColor: '#5DBB8E',
  },
  timelineIconCancelled: {
    backgroundColor: '#E85D75',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#5DBB8E',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 6,
  },
  timelineLabel: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  timelineLabelActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  value: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    marginBottom: 16,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  // What to do next card — collapsible, matching Trade Smart card style
  nextStepsCollapsed: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  nextStepsCollapsedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  nextStepsCollapsedChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  // D-30 FIX: Pending seller acceptance card
  pendingSellerCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pendingSellerContent: {
    flex: 1,
  },
  pendingSellerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  pendingSellerDesc: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  nextStepsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  nextStepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  nextStepsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  nextStepsList: {
    gap: 16,
    marginBottom: 20,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  nextStepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  nextStepDesc: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
    marginTop: 2,
  },
  nextStepsCta: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepsCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Payout Hold Info Bar (seller only)
  payoutHoldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: '#B6D4FC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 12,
  },
  payoutHoldEmoji: {
    fontSize: 22,
  },
  payoutHoldTextWrap: {
    flex: 1,
  },
  payoutHoldTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    lineHeight: 18,
  },
  payoutHoldDesc: {
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 16,
    marginTop: 2,
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  confirmButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmButtonTextWrap: {
    flex: 1,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmButtonSub: {
    fontSize: 12,
    color: '#D1FAE5',
    lineHeight: 16,
    marginTop: 2,
  },
  cancelButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#E85D75',
    borderRadius: 24,
    gap: 8,
  },
  cancelButtonOutlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E85D75',
  },
  reviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewStatusText: {
    fontSize: 14,
    color: '#6B6B6B',
    flex: 1,
  },
  reviewStatusTextComplete: {
    color: '#5DBB8E',
    fontWeight: '500',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#F59E0B',
    borderRadius: 26,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  sellerCompletedBox: {
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  sellerCompletedText: {
    color: '#1A1A1A',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  paymentInstructionText: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  paymentAmountText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentModeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentModeLoadingText: {
    color: '#6B6B6B',
    fontSize: 13,
  },
  paymentModeSelector: {
    gap: 8,
    marginBottom: 12,
  },
  paymentModeOption: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  paymentModeOptionSelected: {
    borderColor: '#5DBB8E',
    backgroundColor: '#E8F5F0',
  },
  paymentModeOptionDisabled: {
    opacity: 0.5,
  },
  paymentModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  paymentModeSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
  },
});

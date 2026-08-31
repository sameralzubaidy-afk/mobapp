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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { supabase } from '@/config/supabase';
import { Trade, TradeStatus } from '@/types/trade';
import { completeTradeV2, cancelTradeV2 } from '@/services/trade';
import { requestTradeExtension, respondToExtension } from '@/services/tradeServiceV2';
import { getPaymentMethod } from '@/services/subscription';
import { canReviewUser, getTradeReviewStatus } from '@/services/review';
import { getSPReleaseDays, getAdminConfig } from '@/services/adminConfig';
import { captureException } from '@/services/errorReporter';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';
import { TradeConfirmationModal } from '@/components/molecules/TradeConfirmationModal';
import { AutoCompleteBanner, createCountdownModel, formatCountdownLabel } from '@/components/trade';
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
import {
  CancellationReasonModal,
  SELLER_INPROGRESS_REASONS,
  BUYER_OFFER_REASONS,
} from '@/components/molecules/CancellationReasonModal';
import Avatar from '@/components/atoms/Avatar';
import ScreenLayout from '@/components/ScreenLayout';
import TaxBreakdownRow from '@/components/trade/TaxBreakdownRow';
import { useTaxCalculation } from '@/hooks/useTaxCalculation';

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
  // MODULE-15.1.2-TradeFlowV2 TC-L09: bundle siblings for expandable item list on buyer's timeline
  const [bundleSiblings, setBundleSiblings] = useState<any[]>([]);
  const [showBundleList, setShowBundleList] = useState(false);
  // Addendum C: bundle confirm all modal state (replaces native Alert for green button)
  const [bundleConfirmData, setBundleConfirmData] = useState<{
    total: number;
    allIds: string[];
  } | null>(null);
  // BUNDLE-CANCEL (2026-08-01): bundle cancel-all modal state — mirrors Addendum C confirm-all.
  const [bundleCancelData, setBundleCancelData] = useState<{
    total: number;
    allIds: string[];
    reason: string;
  } | null>(null);
  // TFV2-011: Issue report modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [nextStepsDismissed, setNextStepsDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [spReleaseDays, setSpReleaseDays] = useState(3);
  // Track previous trade status to detect transitions to 'completed'
  const previousStatusRef = useRef<string | null>(null);

  // R15 — Trade Extension (one-time, pickup window only)
  const [extensionSubmitting, setExtensionSubmitting] = useState(false);
  const [extensionConfirm, setExtensionConfirm] = useState<{
    visible: boolean;
    action: 'accept' | 'decline';
    processing?: boolean;
  } | null>(null);
  const [extensionNowMs, setExtensionNowMs] = useState(Date.now());

  // Navigate seller to TradeSuccessScreen only when trade status *changes* to completed
  const navigateSellerToSuccess = (currentTrade: Trade) => {
    const prevStatus = previousStatusRef.current;
    previousStatusRef.current = currentTrade.status;

    const isSeller = user?.id === currentTrade.seller_id;
    // Only navigate on transition to completed (prevStatus was tracked and not completed)
    // Skip on initial load (prevStatus === null) and when status hasn't changed
    if (
      !isSeller ||
      currentTrade.status !== 'completed' ||
      prevStatus === null ||
      prevStatus === 'completed'
    )
      return;
    const derivedListingType: 'cash_only' | 'accept_sp' | 'donate' =
      (currentTrade.payment_preference_snapshot as any) || 'cash_only';
    const totalSpToSeller = currentTrade.sp_earned_at_completion ?? currentTrade.sp_amount ?? 0;
    const spUsedByBuyer = currentTrade.sp_amount ?? 0;

    navigation.replace('TradeSuccess', {
      tradeId,
      role: 'seller',
      spUsed: spUsedByBuyer,
      spAmountDollars: spUsedByBuyer,
      remainingSP: session?.available_points ?? 0,
      listingType: derivedListingType,
      totalSpToSeller,
      spPendingReleaseDays: 3,
      tradeStatus: 'completed',
      counterpartyId: currentTrade.buyer_id ?? '',
      counterpartyName: 'the Buyer',
    });
  };

  const showNotif = (
    title: string,
    message: string,
    variant?: 'accept' | 'decline' | 'default',
    onConfirm?: () => void
  ) => {
    setNotifModal({
      visible: true,
      title,
      message,
      variant: variant || 'default',
      confirmLabel: 'OK',
      onConfirm,
    });
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
          .select('id, title, price, node_id, tax_category_id')
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

      // SEL-005-FALLBACK (2026-07-27): For trades where seller_transaction_fee_cents
      // is 0, null, or undefined (column doesn't exist on DB yet, or trade was created
      // before create-trade-offer populated it), calculate dynamically from admin_config.
      // SEL-FEE-BASE (2026-07-27): Fee is based on cash amount (after SP), not listing price.
      // SEL-FEE-SEMANTICS (2026-07-27): Config fields are absolute percentages per tier:
      // - platform_fee_seller_percentage = % for FREE users
      // - platform_fee_seller_discount_percentage_kids_club_plus = % for SUBSCRIBED users
      if ((enrichedTrade.seller_transaction_fee_cents ?? 0) === 0) {
        try {
          const config = await getAdminConfig();
          // Always use cash amount — fee is on what the seller actually receives in cash
          const cashAmountCents = tradeData.cash_amount_cents ?? 0;
          const subStatus = session?.subscription_status;
          // DEV-TASK-66 item 1: grace users keep the member seller-fee tier (R6-consistent).
          const isSubscriber =
            subStatus === 'active' ||
            subStatus === 'trial' ||
            subStatus === 'grace' ||
            subStatus === 'grace_period';
          // Use absolute percentage for the seller's tier
          const effectivePct = isSubscriber
            ? config.platform_fee_seller_discount_percentage_kids_club_plus
            : config.platform_fee_seller_percentage;
          enrichedTrade.seller_transaction_fee_cents = Math.round(
            (cashAmountCents * effectivePct) / 100
          );
        } catch (e) {
          console.warn('[TradeTimeline] Failed to calculate fallback seller fee:', e);
          // Keep 0 — display shows -$0.00, avoids crash
        }
      }

      setTrade(enrichedTrade);

      // TC-H03: Navigate seller to TradeSuccessScreen when trade is completed
      navigateSellerToSuccess(enrichedTrade as Trade);

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

        // Fetch SP release days when trade is completed and involves SP
        const totalSpForSeller =
          enrichedTrade.sp_earned_at_completion ?? enrichedTrade.sp_amount ?? 0;
        if (totalSpForSeller > 0) {
          try {
            const days = await getSPReleaseDays();
            setSpReleaseDays(days);
          } catch {
            // keep default 3
          }
        }
      }
    } catch (error) {
      captureException(error, {
        tags: { screen: 'TradeTimelineScreen', action: 'fetch_trade' },
      });
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

  // R15: live countdown while an extension request is pending (re-tick every 30s)
  useEffect(() => {
    if (trade?.extension_status !== 'requested') return;
    const id = setInterval(() => setExtensionNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, [trade?.extension_status]);

  useFocusEffect(
    useCallback(() => {
      fetchTrade();
    }, [fetchTrade])
  );

  // Addendum C + TC-L09: fetch bundle sibling count AND sibling listing data for expandable item list.
  useEffect(() => {
    const bundleId = (trade as any)?.bundle_id;
    if (!bundleId) {
      setBundleSize(0);
      setBundleSiblings([]);
      return;
    }
    let active = true;

    // Fetch sibling count
    supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('bundle_id', bundleId)
      .in('status', ['pending', 'payment_processing', 'in_progress'])
      .then(({ count }: { count: number | null }) => {
        if (active) setBundleSize(count ?? 0);
      });

    // Fetch sibling trade data with listing info for the expandable item list
    // BUNDLE-TOTAL (2026-07-30): also fetch buyer_transaction_fee_cents and tax_amount_cents
    // to compute bundle-level totals (deal total, fees, taxes) for buyer Payment Details.
    supabase
      .from('trades')
      .select(
        `
        id,
        listing_id,
        status,
        sp_amount,
        cash_amount_cents,
        buyer_transaction_fee_cents,
        tax_amount_cents,
        listing:items(id, title, price)
      `
      )
      .eq('bundle_id', bundleId)
      .neq('id', tradeId)
      .then(({ data: siblings }: { data: any }) => {
        if (!active) return;
        setBundleSiblings(siblings || []);
      });

    return () => {
      active = false;
    };
  }, [(trade as any)?.bundle_id, tradeId]);

  const handleComplete = async () => {
    if (hasUnresolvedDispute) {
      showNotif(
        'Dispute Open',
        'This trade has an unresolved dispute and cannot be completed yet.',
        'decline'
      );
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
          siblings && siblings.length > 0 && siblings.every((s: any) => s.status === 'in_progress');
        if (allInProgress) {
          const total = (siblings?.length ?? 0) + 1;
          const allIds = [tradeId, ...(siblings?.map((s: any) => s.id) ?? [])];
          setBundleConfirmData({ total, allIds });
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
        // Refresh wallet + trade data after completion. Run both in parallel and
        // do NOT block the success-screen navigation on them — the buyer is
        // replaced to TradeSuccess immediately so completion feels instant
        // (previously these ran sequentially before navigating, adding seconds
        // of latency after the Edge Function finished).
        const refreshP = (refreshSession
          ? refreshSession().catch((e) =>
              console.warn('[TradeTimeline] refreshSession after complete failed', e)
            )
          : Promise.resolve()) as Promise<unknown>;
        const tradeP = fetchTrade().catch((e) =>
          console.warn('[TradeTimeline] fetchTrade after complete failed', e)
        );

        // TC-H02: Navigate buyer to TradeSuccessScreen with SP/role params
        const isBuyer = user?.id === trade?.buyer_id;
        if (isBuyer) {
          const derivedListingType: 'cash_only' | 'accept_sp' | 'donate' =
            (trade?.payment_preference_snapshot as any) || 'cash_only';
          navigation.replace('TradeSuccess', {
            tradeId,
            role: 'buyer',
            spUsed: trade?.sp_amount ?? 0,
            spAmountDollars: trade?.sp_amount ?? 0,
            remainingSP: session?.available_points ?? 0,
            listingType: derivedListingType,
            tradeStatus: 'completed',
            counterpartyId: trade?.seller_id ?? '',
            counterpartyName: counterpartyProfile?.name || 'the Seller',
          });
          // TradeSuccess reads session.available_points reactively, so the
          // background refresh will re-render it with fresh data when done.
          void Promise.allSettled([refreshP, tradeP]);
        } else {
          // Seller path: wait for the refreshes so the success notification
          // reflects fresh data before dismissing the modal.
          await Promise.allSettled([refreshP, tradeP]);
          showNotif('Success', result.message || 'Trade marked as completed!', 'accept', () => {
            setNotifModal(null);
            fetchTrade();
          });
        }
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

  // Single-trade cancel (also the "Just This One" path for bundle cancels).
  const performSingleCancel = async (reason: string) => {
    try {
      setIsCancelling(true);

      const result = await cancelTradeV2(tradeId, reason);
      if (result.success) {
        if (refreshSession) await refreshSession();

        // DEPRECATED(TFV2-023): Seller-facing Level 1/2/3 consequence alerts removed.
        // The backend counter and admin flag still fire silently.
        showNotif(
          'Trade Cancelled',
          'Your trade has been cancelled. Any Swap Points have been refunded to your wallet.',
          'default',
          () => {
            setNotifModal(null);
            navigation.goBack();
          }
        );
      } else {
        showNotif(
          'Cancellation Failed',
          result.error || 'Failed to cancel trade. Please try again.',
          'decline',
          () => {
            setNotifModal(null);
            setShowCancellationModal(true);
          }
        );
      }
    } catch (error: any) {
      showNotif('Error', error.message || 'An unexpected error occurred', 'decline');
    } finally {
      setIsCancelling(false);
    }
  };

  // BUNDLE-CANCEL (2026-08-01): Mirror Addendum C "Confirm All" shortcut for cancels.
  // If this trade is part of a bundle with cancellable siblings, ask whether to cancel
  // the whole bundle or just this one. Disputes / Report-a-Problem stay per-trade
  // (TRADING-FLOW-V2 §11.3.1 Key invariant) — this prompt is cancel-only.
  const handleCancellationConfirm = async (reason: string) => {
    // Close the reason modal immediately; the bundle-scope prompt (if any) is next.
    setShowCancellationModal(false);

    const bundleId = (trade as any)?.bundle_id;
    if (bundleId) {
      try {
        const isBuyerRole = user?.id === trade?.buyer_id;
        const isSellerRole = user?.id === trade?.seller_id;
        const { data: siblings } = await supabase
          .from('trades')
          .select('id, status, cash_amount_cents')
          .eq('bundle_id', bundleId)
          .neq('id', tradeId);
        // Only include siblings the current user is actually allowed to cancel,
        // matching the cancel-button visibility rules on this screen.
        const cancellableSiblings = (siblings ?? []).filter((s: any) => {
          if (isBuyerRole) return s.status === 'pending';
          if (isSellerRole) {
            return (
              s.status === 'in_progress' ||
              (s.status === 'pending' && (s.cash_amount_cents ?? 0) === 0)
            );
          }
          return false;
        });
        if (cancellableSiblings.length > 0) {
          const total = cancellableSiblings.length + 1;
          const allIds = [tradeId, ...cancellableSiblings.map((s: any) => s.id)];
          setBundleCancelData({ total, allIds, reason });
          return;
        }
      } catch {
        // Non-blocking: fall through to single-trade cancel on error.
      }
    }

    await performSingleCancel(reason);
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

  // R15 — request ONE extension during the pickup window (buyer or seller)
  const handleRequestExtension = async () => {
    if (!trade) return;
    setExtensionSubmitting(true);
    try {
      await requestTradeExtension(tradeId);
      await fetchTrade();
    } catch (e) {
      showNotif('Could not request extension', (e as Error).message, 'decline');
    } finally {
      setExtensionSubmitting(false);
    }
  };

  // R15 — accept/decline a pending extension request (counterparty only).
  // Accept voids the old hold + places a FRESH authorization using the buyer's
  // saved card; decline releases the hold and auto-cancels via the shared R2 path.
  const handleRespondExtension = async (action: 'accept' | 'decline') => {
    setExtensionConfirm((prev) => (prev ? { ...prev, processing: true } : prev));
    setExtensionSubmitting(true);
    try {
      let paymentMethodId: string | undefined;
      if (action === 'accept') {
        const method = await getPaymentMethod();
        paymentMethodId = method?.id ?? undefined;
      }
      await respondToExtension(tradeId, action, paymentMethodId);
      await fetchTrade();
    } catch (e) {
      showNotif(
        action === 'accept' ? 'Could not accept extension' : 'Could not decline extension',
        (e as Error).message,
        'decline'
      );
    } finally {
      setExtensionSubmitting(false);
      setExtensionConfirm(null);
    }
  };

  // D-30: No manual payment step — Stripe pre-auth is captured on seller accept via transactions-update EF.
  // The buyer goes directly from pending → in_progress and sees [I Got It].

  // MODULE-15.3-PART3 TAX-011: live tax preview for in-progress trades; stored tax used for completed
  const sellerNodeId = ((trade as any)?.listing as any)?.node_id ?? null;
  // BP-37: tax is always on the full item price — cash_amount_cents already has SP subtracted, so it can't be used here
  const taxableAmountCents = Math.round((((trade as any)?.listing as any)?.price ?? 0) * 100);
  const taxPreview = useTaxCalculation({
    nodeId: sellerNodeId,
    taxableAmountCents: taxableAmountCents,
    taxCategoryId: ((trade as any)?.listing as any)?.tax_category_id ?? null,
    enabled: !trade || trade.status !== 'completed', // skip live calc for completed trades
  });

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
  const hasUnresolvedDispute =
    !!(trade as any).dispute_status &&
    !['none', 'resolved'].includes((trade as any).dispute_status);
  // Compute auto-complete countdown for the seller payout card
  const autoCompleteCountdownLabel = (() => {
    if (!trade.auto_complete_at) return '';
    const baseMs = Date.parse(trade.auto_complete_at) - 72 * 60 * 60 * 1000;
    const startIso = Number.isFinite(baseMs)
      ? new Date(baseMs).toISOString()
      : trade.auto_complete_at;
    const model = createCountdownModel(trade.auto_complete_at, startIso);
    return formatCountdownLabel(model);
  })();
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
        }
      >
        {/* Addendum C + TC-L09: bundle context banner with expandable item list (tap-able names) */}
        {bundleSize > 1 && (
          <View style={styles.bundleBanner} testID="bundle-context-banner">
            <Text style={styles.bundleBannerTitle}>Bundle offer · {bundleSize} items</Text>
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
                {/* Current trade item */}
                {(trade as any)?.listing && (
                  <TouchableOpacity
                    key={tradeId}
                    style={styles.bundleItemRow}
                    onPress={() => {
                      navigation.navigate('TradeDetail', { tradeId });
                    }}
                  >
                    <Text style={styles.bundleItemTitle} numberOfLines={1}>
                      {(trade as any).listing?.title || 'Item'}
                    </Text>
                    <View style={styles.bundleItemDetail}>
                      {(trade as any).sp_amount > 0 && (
                        <Text style={styles.bundleItemSp}>+{(trade as any).sp_amount} SP</Text>
                      )}
                      <Text style={styles.bundleItemPrice}>
                        ${((trade as any).cash_amount_cents / 100).toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                {/* Sibling items */}
                {bundleSiblings.map((sibling: any) => {
                  const listing = sibling.listing || {};
                  return (
                    <TouchableOpacity
                      key={sibling.id}
                      style={styles.bundleItemRow}
                      onPress={() => {
                        navigation.navigate('TradeDetail', { tradeId: sibling.id });
                      }}
                    >
                      <Text style={styles.bundleItemTitle} numberOfLines={1}>
                        {listing.title || 'Item'}
                      </Text>
                      <View style={styles.bundleItemDetail}>
                        {sibling.sp_amount > 0 && (
                          <Text style={styles.bundleItemSp}>+{sibling.sp_amount} SP</Text>
                        )}
                        <Text style={styles.bundleItemPrice}>
                          ${(sibling.cash_amount_cents / 100).toFixed(2)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {/* BUNDLE-TOTAL (2026-07-30): aggregated totals at bottom of expanded bundle item list.
                    Shows buyer the full deal total, total platform fees, and total tax across all items. */}
                {isBuyer &&
                  (() => {
                    const bundleCashCents =
                      (trade.cash_amount_cents ?? 0) +
                      bundleSiblings.reduce((s, o) => s + (o.cash_amount_cents ?? 0), 0);
                    const bundleFeeCents =
                      (trade.buyer_transaction_fee_cents ?? 0) +
                      bundleSiblings.reduce((s, o) => s + (o.buyer_transaction_fee_cents ?? 0), 0);
                    const bundleTaxCents =
                      (trade.tax_amount_cents ?? 0) +
                      bundleSiblings.reduce((s, o) => s + (o.tax_amount_cents ?? 0), 0);
                    return (
                      <View style={styles.bundleTotalsSection}>
                        <View style={styles.bundleTotalSeparator} />
                        <View style={styles.bundleTotalRow}>
                          <Text style={styles.bundleTotalLabel}>Items Total:</Text>
                          <Text style={styles.bundleTotalValue}>
                            ${(bundleCashCents / 100).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.bundleTotalRow}>
                          <Text style={styles.bundleTotalLabel}>Platform Fee:</Text>
                          <Text style={styles.bundleTotalValue}>
                            ${(bundleFeeCents / 100).toFixed(2)}
                          </Text>
                        </View>
                        {bundleTaxCents > 0 && (
                          <View style={styles.bundleTotalRow}>
                            <Text style={styles.bundleTotalLabel}>Sales Tax:</Text>
                            <Text style={styles.bundleTotalValue}>
                              ${(bundleTaxCents / 100).toFixed(2)}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.bundleTotalRow, styles.bundleTotalGrandRow]}>
                          <Text style={styles.bundleTotalGrandLabel}>Deal Total:</Text>
                          <Text style={styles.bundleTotalGrandValue}>
                            $
                            {((bundleCashCents + bundleFeeCents + bundleTaxCents) / 100).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
              </View>
            )}
          </View>
        )}

        <View
          style={[styles.statusBanner, getStatusBannerStyle(trade.status)]}
          testID="status-banner"
        >
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
        {(trade.status === 'pending' ||
          (trade.status === 'in_progress' && !trade.auto_complete_at)) && (
          <View style={styles.pendingSellerCard} testID="pending-seller-card">
            <Clock size={20} color="#F59E0B" weight="regular" />
            <View style={styles.pendingSellerContent}>
              <Text style={styles.pendingSellerTitle}>Awaiting seller response</Text>
              <Text style={styles.pendingSellerDesc}>
                The seller has 48 hours to accept or decline your offer. You'll receive a
                notification when they respond.
              </Text>
            </View>
          </View>
        )}

        {/* TFV2-011 / D-26: Dispute status card — moved ABOVE "What to do next" so a dispute
            is the first thing the user sees. Redesigned as an elevated alert card.
            DEV-TASK-42 (2026-08-29): warm amber palette per owner decision (kids-marketplace
            tone — friendly, not alarming red). Amber = reported, deeper amber/orange = under_review. */}
        {(trade as any).dispute_status === 'reported' && (
          <View style={styles.disputeCard} testID="dispute-banner-reported">
            <View style={styles.disputeCardHeader}>
              <View style={styles.disputeCardIconWrap}>
                <WarningCircle size={20} color="#FFFFFF" weight="fill" />
              </View>
              <View style={styles.disputeCardHeaderText}>
                <Text style={styles.disputeCardTitle}>Dispute in progress</Text>
                <View style={styles.disputeCardBadge}>
                  <View style={styles.disputeCardBadgeDot} />
                  <Text style={styles.disputeCardBadgeText}>Our team has been notified</Text>
                </View>
              </View>
            </View>
            <Text style={styles.disputeCardBody}>
              Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused.
            </Text>
            <Text style={styles.disputeCardNote}>
              Keep chatting with the other party — we'll notify you with the outcome.
            </Text>
          </View>
        )}
        {(trade as any).dispute_status === 'under_review' && (
          <View
            style={[styles.disputeCard, styles.disputeCardOrange]}
            testID="dispute-banner-under-review"
          >
            <View style={styles.disputeCardHeader}>
              <View style={[styles.disputeCardIconWrap, styles.disputeCardIconWrapOrange]}>
                <WarningCircle size={20} color="#FFFFFF" weight="fill" />
              </View>
              <View style={styles.disputeCardHeaderText}>
                <Text style={[styles.disputeCardTitle, styles.disputeCardTitleOrange]}>
                  Dispute under review
                </Text>
                <View style={styles.disputeCardBadge}>
                  <View style={[styles.disputeCardBadgeDot, styles.disputeCardBadgeDotOrange]} />
                  <Text style={[styles.disputeCardBadgeText, styles.disputeCardBadgeTextOrange]}>
                    Our team is investigating
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.disputeCardBody, styles.disputeCardBodyOrange]}>
              Your issue is being reviewed. Auto-complete stays paused while our team investigates.
            </Text>
            <Text style={[styles.disputeCardNote, styles.disputeCardNoteOrange]}>
              No action needed from you right now — we'll notify you as soon as there's an update.
            </Text>
          </View>
        )}

        {/* What to do next — only shown AFTER seller accepts (auto_complete_at set) */}
        {trade.status === 'in_progress' &&
          trade.auto_complete_at &&
          (nextStepsDismissed ? (
            <Pressable
              style={styles.nextStepsCollapsed}
              onPress={() => setNextStepsDismissed(false)}
              testID="next-steps-toggle"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Next steps toggle"
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
                        <Text style={styles.nextStepDesc}>
                          Coordinate the meetup location and time
                        </Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>2</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Meet up and inspect the item</Text>
                        <Text style={styles.nextStepDesc}>
                          Make sure everything looks as described
                        </Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>3</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Come back and tap "I Got It"</Text>
                        <Text style={styles.nextStepDesc}>
                          This releases funds to the seller and completes the trade
                        </Text>
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
                        <Text style={styles.nextStepDesc}>
                          Make sure the buyer is satisfied with their purchase
                        </Text>
                      </View>
                    </View>
                    <View style={styles.nextStepRow}>
                      <View style={styles.nextStepNumber}>
                        <Text style={styles.nextStepNumberText}>3</Text>
                      </View>
                      <View style={styles.nextStepContent}>
                        <Text style={styles.nextStepLabel}>Wait for buyer confirmation</Text>
                        <Text style={styles.nextStepDesc}>
                          Once the buyer confirms receipt, your payout will be released
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
              <Pressable
                style={styles.nextStepsCta}
                onPress={() => setNextStepsDismissed(true)}
                testID="next-steps-cta"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Next steps cta"
              >
                <CheckCircle size={16} color="#FFFFFF" weight="fill" style={{ marginRight: 6 }} />
                <Text style={styles.nextStepsCtaText}>Got it</Text>
              </Pressable>
            </View>
          ))}

        {/* Payout Hold Info Bar — seller only, after acceptance (in_progress with auto_complete_at set) */}
        {isSeller && trade.status === 'in_progress' && trade.auto_complete_at && (
          <View style={styles.payoutHoldCard}>
            <Text style={styles.payoutHoldEmoji}>💰</Text>
            <View style={styles.payoutHoldTextWrap}>
              <Text style={styles.payoutHoldTitle}>
                Your payout is on hold until trade completes
              </Text>
              <Text style={styles.payoutHoldDesc}>
                Funds are held securely and released once the buyer taps "I Got It"
                {autoCompleteCountdownLabel
                  ? `, or automatically in ${autoCompleteCountdownLabel} if no action is taken.`
                  : '.'}
              </Text>
            </View>
          </View>
        )}

        {/* Auto-complete timer — buyer only; seller sees the countdown in the payout card below */}
        {/* Hidden when there's an unresolved dispute — no point showing a countdown if trade is frozen */}
        {isBuyer && trade.status === 'in_progress' && !hasUnresolvedDispute && (
          <AutoCompleteBanner
            autoCompleteAt={trade.auto_complete_at}
            status={trade.status}
            isSeller={false}
          />
        )}

        {/* R15 — Trade Extension (one-time, pickup window only) */}
        {trade.status === 'in_progress' &&
          trade.auto_complete_at &&
          !hasUnresolvedDispute &&
          (() => {
            const extStatus = trade.extension_status;
            const isRequester =
              !!trade.extension_requested_by && trade.extension_requested_by === user?.id;

            // Pending request → requester sees a waiting banner; counterparty sees accept/decline
            if (extStatus === 'requested') {
              const extCountdown = trade.extension_request_expires_at
                ? formatCountdownLabel(
                    createCountdownModel(
                      trade.extension_request_expires_at,
                      trade.extension_requested_at ?? new Date().toISOString(),
                      extensionNowMs
                    )
                  )
                : '';
              if (isRequester) {
                return (
                  <View style={styles.extensionCardPending}>
                    <View style={styles.extensionCardHeader}>
                      <Clock size={20} color="#F59E0B" weight="regular" />
                      <Text style={styles.extensionCardTitle}>Extension request sent</Text>
                    </View>
                    <Text style={styles.extensionCardDesc}>
                      Waiting for the other party to respond. If they don't answer within{' '}
                      {extCountdown || 'the response window'}, the request expires and the trade is
                      cancelled.
                    </Text>
                  </View>
                );
              }
              return (
                <View style={styles.extensionCardPending}>
                  <View style={styles.extensionCardHeader}>
                    <Clock size={20} color="#F59E0B" weight="regular" />
                    <Text style={styles.extensionCardTitle}>Extension request</Text>
                  </View>
                  <Text style={styles.extensionCardDesc}>
                    The other party asked for more time to complete this trade. Respond within{' '}
                    {extCountdown || '4 hours'}, or the trade is cancelled.
                  </Text>
                  <View style={styles.extensionCardActions}>
                    <Pressable
                      style={styles.extensionDeclineButton}
                      onPress={() => setExtensionConfirm({ visible: true, action: 'decline' })}
                      disabled={extensionSubmitting}
                      testID="decline-extension-button"
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Decline extension button"
                    >
                      <Text style={styles.extensionDeclineText}>Decline</Text>
                    </Pressable>
                    <Pressable
                      style={styles.extensionAcceptButton}
                      onPress={() => setExtensionConfirm({ visible: true, action: 'accept' })}
                      disabled={extensionSubmitting}
                      testID="accept-extension-button"
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Accept extension button"
                    >
                      {extensionSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.extensionAcceptText}>Accept</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            }

            // Granted → show the extended pickup window
            if (extStatus === 'accepted') {
              return (
                <View style={styles.extensionCardGranted}>
                  <View style={styles.extensionCardHeader}>
                    <CheckCircle size={20} color="#16A34A" weight="fill" />
                    <Text style={styles.extensionCardTitle}>Pickup window extended</Text>
                  </View>
                  <Text style={styles.extensionCardDesc}>
                    You now have until{' '}
                    {trade.auto_complete_at
                      ? new Date(trade.auto_complete_at).toLocaleString()
                      : 'the new deadline'}{' '}
                    to complete the trade.
                  </Text>
                </View>
              );
            }

            // No extension used yet → offer the one-time "Request more time"
            if (!extStatus) {
              return (
                <View style={styles.extensionCard}>
                  <View style={styles.extensionCardHeader}>
                    <Clock size={20} color="#5DBB8E" weight="regular" />
                    <Text style={styles.extensionCardTitle}>Need more time?</Text>
                  </View>
                  <Text style={styles.extensionCardDesc}>
                    You can request one extension to extend the pickup window. The other party must
                    accept within 4 hours, or the trade is cancelled.
                  </Text>
                  <Pressable
                    style={styles.extensionRequestButton}
                    onPress={handleRequestExtension}
                    disabled={extensionSubmitting}
                    testID="request-extension-button"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Request extension button"
                  >
                    {extensionSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.extensionRequestText}>Request More Time</Text>
                    )}
                  </Pressable>
                </View>
              );
            }

            // denied / auto_denied / reauth_failed → trade is cancelled; the cancelled UI covers it.
            return null;
          })()}

        {/* SP Release Status — seller only, completed trade with SP involved */}
        {isSeller &&
          trade.status === 'completed' &&
          (() => {
            const totalSpForSeller = trade.sp_earned_at_completion ?? trade.sp_amount ?? 0;
            if (totalSpForSeller <= 0) return null;

            const isReleased = !!trade.sp_released_at;
            const releaseDate = trade.sp_released_at
              ? new Date(trade.sp_released_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null;

            // DEV-TASK-49 (UX): single source of truth for the pending release
            // time — trades.pending_sp_release_at (set by the completion trigger
            // to completed_at + pending_sp_release_days). Derive BOTH the
            // countdown and the explicit date from it. Fall back to the same
            // trigger formula (completed_at + spReleaseDays) only for legacy
            // trades whose pending_sp_release_at is NULL.
            const pendingReleaseAt = trade.pending_sp_release_at
              ? new Date(trade.pending_sp_release_at)
              : trade.completed_at
                ? new Date(new Date(trade.completed_at).getTime() + spReleaseDays * 86400000)
                : null;
            const pendingReleaseDays = pendingReleaseAt
              ? Math.max(0, Math.ceil((pendingReleaseAt.getTime() - Date.now()) / 86400000))
              : spReleaseDays;
            const pendingReleaseDateLabel = pendingReleaseAt
              ? pendingReleaseAt.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return (
              <View style={[styles.card, { backgroundColor: isReleased ? '#F0FDF4' : '#FFF9EC' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: isReleased ? '#DCFCE7' : '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isReleased ? (
                      <CheckCircle size={20} color="#16A34A" weight="fill" />
                    ) : (
                      <Clock size={20} color="#D97706" weight="regular" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 4 }]}>
                      {isReleased ? 'SP Released' : 'Swap Points Pending'}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 20 }}>
                      {isReleased
                        ? `${totalSpForSeller} SP released to your wallet${releaseDate ? ` on ${releaseDate}` : ''}.`
                        : `${totalSpForSeller} SP releasing in ${pendingReleaseDays} day${pendingReleaseDays === 1 ? '' : 's'} — added to your pending wallet${pendingReleaseDateLabel ? `. Releases ${pendingReleaseDateLabel}` : ''}.`}
                    </Text>
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isReleased ? '#5DBB8E' : '#F59E0B',
                        borderRadius: 20,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        marginTop: 12,
                        alignSelf: 'flex-start',
                        gap: 6,
                      }}
                      onPress={() => navigation.navigate('SpWallet')}
                      testID="sp-view-wallet-button"
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Sp view wallet button"
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                        View Wallet
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })()}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          {/* TAX-REFUND-INTEGRITY (2026-07-24): Buyer-facing wording changes.
              Before capture: "Payment authorized" — the card has an authorization hold, not a completed charge.
              After capture: "Paid" — Stripe confirmed the payment.
              Seller never sees the payment label (sellers see their own payout info). */}
          {isBuyer ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>
                  {trade.status === 'completed' || trade.status === 'cancelled'
                    ? 'Paid:'
                    : 'Payment authorized:'}
                </Text>
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
              {/* MODULE-15.3-PART3 TAX-011: sales tax row — buyer only, seller does not see tax.
                  TAX-REFUND-INTEGRITY (2026-07-24):
                  In-progress: "Estimated sales tax" (finalized at completion).
                  Completed: "Sales Tax" with stored snapshot. */}
              {trade.status === 'completed' ? (
                <TaxBreakdownRow
                  taxAmountCents={trade.tax_amount_cents ?? 0}
                  taxRate={trade.tax_rate_applied ?? 0}
                  jurisdiction={trade.tax_jurisdiction}
                  loading={false}
                  alwaysShow={!!trade.tax_amount_cents}
                  isTaxExempt={taxPreview.isTaxExempt}
                  label={trade.status === 'completed' ? 'Sales Tax' : 'Estimated Sales Tax'}
                  testID="timeline-payment-tax-row"
                />
              ) : (
                <TaxBreakdownRow
                  taxAmountCents={taxPreview.taxAmountCents}
                  taxRate={taxPreview.taxRate}
                  jurisdiction={taxPreview.jurisdiction}
                  loading={taxPreview.loading}
                  isTaxExempt={taxPreview.isTaxExempt}
                  label="Estimated Sales Tax"
                  testID="timeline-payment-tax-preview"
                />
              )}
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>
                  $
                  {(
                    (trade.cash_amount_cents +
                      trade.buyer_transaction_fee_cents +
                      (isBuyer
                        ? trade.status === 'completed'
                          ? (trade.tax_amount_cents ?? 0)
                          : taxPreview.taxAmountCents
                        : 0)) /
                    100
                  ).toFixed(2)}
                </Text>
              </View>
            </>
          ) : (
            /* Seller view: shows their payout info with the seller platform fee deducted.
               SEL-005 (2026-07-27): seller_transaction_fee_cents is stored at offer creation
               time from admin_config.platform_fee_seller_percentage (default 5%, discount
               applied per seller's subscription tier). New offers only — existing trades
               without the column default to 0. */
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Cash Amount:</Text>
                <Text style={styles.value}>${(trade.cash_amount_cents / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Swap Points Used:</Text>
                <Text style={styles.value}>{trade.sp_amount} SP</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Platform Fee:</Text>
                <Text style={styles.value}>
                  -${((trade.seller_transaction_fee_cents ?? 0) / 100).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>
                  $
                  {(
                    Math.max(
                      0,
                      trade.cash_amount_cents - (trade.seller_transaction_fee_cents ?? 0)
                    ) / 100
                  ).toFixed(2)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Hide message button for cancelled and pending trades — no active trade exists */}
        {trade.status !== 'cancelled' && trade.status !== 'pending' && (
          <Pressable
            style={styles.messageButton}
            onPress={handleOpenChat}
            testID="message-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Message"
          >
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
              accessible
              accessibilityRole="button"
              accessibilityLabel="Confirm trade button"
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
                accessible
                accessibilityRole="button"
                accessibilityLabel="Report problem button"
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
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cancel trade button"
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
              style={[
                styles.cancelButtonOutline,
                (submitting || isCancelling) && styles.disabledButton,
              ]}
              onPress={handleCancel}
              disabled={submitting || isCancelling}
              testID="seller-cancel-inprogress-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Seller cancel inprogress button"
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
              Buyer payment authorized. Awaiting pickup confirmation.
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
                accessible
                accessibilityRole="button"
                accessibilityLabel="Review button"
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

      <TradeConfirmationModal
        visible={showCompleteConfirm}
        title="Complete Trade"
        message={completeConfirmMessage}
        confirmLabel="Complete"
        variant="default"
        onConfirm={confirmCompleteTrade}
        onCancel={() => setShowCompleteConfirm(false)}
        loading={submitting}
        confirmTestID="complete-trade-confirm-button"
        cancelTestID="complete-trade-cancel-button"
      />

      {/* Addendum C: Bundle confirm all modal with app green color */}
      <TradeConfirmationModal
        visible={bundleConfirmData !== null}
        title={`Confirm all ${bundleConfirmData?.total ?? 0} items received?`}
        message="All items from this seller are ready to confirm."
        confirmLabel={`Confirm All ${bundleConfirmData?.total ?? 0}`}
        cancelLabel="Just This One"
        variant="accept"
        onConfirm={async () => {
          if (!bundleConfirmData) return;
          const data = bundleConfirmData;
          setSubmitting(true);
          setBundleConfirmData(null);
          try {
            // DT-63 (QA Task 7): complete all bundle siblings in PARALLEL. The
            // previous for-await loop ran each complete_trade_v2 serially, so N
            // trades took ~N× the single-trade latency (QA: two trades completed
            // 7s apart, "Done!" modal >3s). Each trade is an independent DB
            // transaction, so parallel calls are safe — Postgres row locks
            // serialize any shared wallet updates. Also check each result
            // (BP-35) and background the session refresh so the success modal
            // is not blocked on it (same pattern as the single-trade path).
            const results = await Promise.all(
              data.allIds.map((tid) => completeTradeV2(tid))
            );
            const failed = results.filter((r) => !r.success);
            if (refreshSession) {
              void refreshSession().catch(() => {
                console.warn('[TradeTimeline] refreshSession after confirm-all failed');
              });
            }
            if (failed.length > 0) {
              showNotif(
                'Error',
                'Some items could not be confirmed. Try confirming each one.',
                'decline'
              );
            } else {
              showNotif(
                'Done!',
                `All ${data.total} items marked as completed.`,
                'accept',
                () => {
                  setNotifModal(null);
                  navigation.goBack();
                }
              );
            }
          } catch {
            showNotif('Error', 'Could not confirm all items. Try confirming each one.', 'decline');
          } finally {
            setSubmitting(false);
          }
        }}
        onCancel={() => {
          setBundleConfirmData(null);
          setShowCompleteConfirm(true);
        }}
        loading={submitting}
        confirmTestID="confirm-all-trades-button"
        cancelTestID="confirm-all-cancel-button"
      />

      {/* BUNDLE-CANCEL (2026-08-01): Cancel-all modal for bundle members (mirrors Addendum C confirm-all). */}
      <TradeConfirmationModal
        visible={bundleCancelData !== null}
        title={`Cancel all ${bundleCancelData?.total ?? 0} items?`}
        message="All items from this seller will be cancelled and relisted."
        confirmLabel={`Cancel All ${bundleCancelData?.total ?? 0}`}
        cancelLabel="Just This One"
        variant="decline"
        onConfirm={async () => {
          if (!bundleCancelData) return;
          setSubmitting(true);
          const data = bundleCancelData;
          setBundleCancelData(null);
          try {
            for (const tid of data.allIds) {
              await cancelTradeV2(tid, data.reason);
            }
            if (refreshSession) await refreshSession();
            showNotif(
              'Trade Cancelled',
              'Your trades have been cancelled. Any Swap Points have been refunded to your wallet.',
              'default',
              () => {
                setNotifModal(null);
                navigation.goBack();
              }
            );
          } catch {
            showNotif('Error', 'Could not cancel all items. Try cancelling each one.', 'decline');
          } finally {
            setSubmitting(false);
          }
        }}
        onCancel={() => {
          const reason = bundleCancelData?.reason;
          setBundleCancelData(null);
          if (reason) performSingleCancel(reason);
        }}
        loading={submitting}
        confirmTestID="cancel-all-trades-button"
        cancelTestID="cancel-all-cancel-button"
      />

      {notifModal && (
        <TradeConfirmationModal
          visible={notifModal.visible}
          title={notifModal.title}
          message={notifModal.message}
          confirmLabel={notifModal.confirmLabel || 'OK'}
          variant={notifModal.variant || 'default'}
          onConfirm={() => (notifModal.onConfirm ? notifModal.onConfirm() : setNotifModal(null))}
          onCancel={() => setNotifModal(null)}
          hideCancel
          confirmTestID="notif-ok-button"
        />
      )}

      {/* R15 — Extension accept/decline confirmation */}
      {extensionConfirm && (
        <TradeConfirmationModal
          visible={extensionConfirm.visible}
          title={extensionConfirm.action === 'accept' ? 'Accept Extension?' : 'Decline Extension?'}
          message={
            extensionConfirm.action === 'accept'
              ? 'The pickup window will be extended and a new payment hold will be placed. Only one extension is allowed per trade.'
              : 'The trade will be cancelled and the payment hold released. This cannot be undone.'
          }
          confirmLabel={
            extensionConfirm.action === 'accept' ? 'Accept Extension' : 'Decline Extension'
          }
          cancelLabel="Cancel"
          variant={extensionConfirm.action === 'accept' ? 'accept' : 'decline'}
          onConfirm={() => handleRespondExtension(extensionConfirm.action)}
          onCancel={() => setExtensionConfirm(null)}
          loading={extensionConfirm.processing}
          confirmTestID={extensionConfirm.action === 'accept' ? 'extension-accept-button' : 'extension-decline-button'}
          cancelTestID="extension-cancel-button"
        />
      )}

      <CancellationReasonModal
        visible={showCancellationModal}
        itemTitle={listing?.title || 'Item'}
        onConfirm={handleCancellationConfirm}
        onCancel={() => setShowCancellationModal(false)}
        isLoading={isCancelling}
        reasons={
          isSeller && trade.status === 'in_progress'
            ? SELLER_INPROGRESS_REASONS
            : !isSeller && trade.status === 'pending'
              ? BUYER_OFFER_REASONS
              : undefined
        }
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
            const actualMsg =
              ctx?.error?.message || ctx?.message || (error as any)?.message || error.message;
            throw new Error(actualMsg);
          }
          if (data && !data.success)
            throw new Error(data.error?.message ?? 'Failed to report dispute');
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
  _autoCompleteAt?: string | null // Prefixed with _ to indicate intentionally unused
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
    pending: 'Awaiting Seller', // D-30: More accurate - payment is pre-authorized, waiting for seller response
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
    case 'payment_processing' /* D-30: deprecated */:
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
    // Clear the floating pill nav (PersistentTabBar overlays the stack content):
    // the pill top sits ~110pt from the bottom (safe-area + spacing.sm + pill
    // height), so bottom-anchored action buttons (Report Problem, I Got It,
    // Cancel Trade) must scroll fully above it to be reachable — QA E01 was
    // blocked because the report button sat behind the pill (BP-58).
    paddingBottom: 100,
  },
  // Addendum C + TC-L09: bundle context banner with expandable item list
  bundleBanner: {
    backgroundColor: '#EEF9F4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  bundleBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5DBB8E',
    marginBottom: 4,
  },
  bundleBannerToggle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5DBB8E',
    marginBottom: 4,
  },
  bundleItemsList: {
    marginTop: 6,
  },
  bundleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D9E6',
  },
  bundleItemTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  bundleItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4D4D4D',
  },
  bundleItemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bundleItemSp: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  // BUNDLE-TOTAL (2026-07-30): aggregated bundle totals section in the bundle context banner
  bundleTotalsSection: {
    marginTop: 8,
  },
  bundleTotalSeparator: {
    height: 1,
    backgroundColor: '#D1D9E6',
    marginBottom: 8,
  },
  bundleTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  bundleTotalLabel: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  bundleTotalValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4D4D4D',
  },
  bundleTotalGrandRow: {
    borderTopWidth: 1,
    borderTopColor: '#D1D9E6',
    marginTop: 4,
    paddingTop: 8,
  },
  bundleTotalGrandLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bundleTotalGrandValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  // D-26: Dispute status card — elevated alert card.
  // DEV-TASK-42 (2026-08-29): warm amber palette (owner decision — kids-marketplace tone,
  // not alarming red). Amber = reported, deeper amber/orange = under_review.
  disputeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  disputeCardOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  disputeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  disputeCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeCardIconWrapOrange: {
    backgroundColor: '#EA580C',
  },
  disputeCardHeaderText: {
    flex: 1,
  },
  disputeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 20,
  },
  disputeCardTitleOrange: {
    color: '#9A3412',
  },
  disputeCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  disputeCardBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  disputeCardBadgeDotOrange: {
    backgroundColor: '#EA580C',
  },
  disputeCardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  disputeCardBadgeTextOrange: {
    color: '#9A3412',
  },
  disputeCardBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#78350F',
  },
  disputeCardBodyOrange: {
    color: '#7C2D12',
  },
  disputeCardNote: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
  },
  disputeCardNoteOrange: {
    borderTopColor: '#FDBA74',
    color: '#9A3412',
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
  // R15 — Trade Extension
  extensionCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  extensionCardPending: {
    backgroundColor: '#FFF9EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  extensionCardGranted: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  extensionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  extensionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Inter-Bold',
  },
  extensionCardDesc: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  extensionCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  extensionAcceptButton: {
    flex: 1,
    backgroundColor: '#5DBB8E',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extensionAcceptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  extensionDeclineButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extensionDeclineText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  extensionRequestButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  extensionRequestText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

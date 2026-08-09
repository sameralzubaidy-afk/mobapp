/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeListScreen.tsx
 * TASK FLOW-08-04: Trade History Screen - Whisk Design System
 * 
 * Redesigned with:
 * - Phosphor icons (Receipt for empty state, CaretRight for chevrons)
 * - Tab navigation with #5DBB8E underline
 * - Status badges with semantic colors (pending=amber, active=green, disputed=red, completed=gray)
 * - Compact trade rows with 56×56px thumbnails
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Image,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { acceptBundleOffers, declineBundleOffers } from '@/services/tradeServiceV2';
import { Receipt, ArrowRight, ArrowsLeftRight, Check, CaretRight, ChatTeardropText } from 'phosphor-react-native';
import { OfferCountdownPill } from '@/components/trade';
import ScreenLayout from '@/components/ScreenLayout';

type TabType = 'active' | 'history';

// History tab loads this many trades per page, then appends more on scroll.
const HISTORY_PAGE_SIZE = 10;

interface PendingOffer {
  id: string;
  listing_id: string;
  sp_amount: number;
  cash_amount_cents: number;
  created_at: string;
  status: string;
  type: 'received' | 'submitted';
  bundle_id?: string | null;
  listing: {
    id: string;
    title: string;
    price: number;
    status?: string;
    images: { url: string; thumbnail_url?: string }[];
  };
  offer_expires_at?: string | null;
  auto_complete_at?: string | null;
}

export default function TradeListScreen({ navigation }: any) {
  const route = useRoute();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  // History tab is paginated so large trade histories load fast.
  const [historyTrades, setHistoryTrades] = useState<any[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [allOffers, setAllOffers] = useState<PendingOffer[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({ inProgress: 0, needsAction: 0, pendingOffers: 0, completed: 0 });
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'your_offers' | 'needs_action' | 'in_progress' | 'completed'>('all');
  // Track which bundle is being processed (prevents double-tap, grays out buttons)
  const [processingBundleId, setProcessingBundleId] = useState<string | null>(null);
  // Confirmation modal state for bundle Accept All / Decline All
  const [bundleConfirmModal, setBundleConfirmModal] = useState<{
    visible: boolean;
    action: 'accept' | 'decline';
    bundleId: string;
    offerIds: string[];
    title: string;
  }>({ visible: false, action: 'accept', bundleId: '', offerIds: [], title: '' });

  // TFV2-015: seller ignoring offers prompt (D-13)
  const [ignoredOfferItems, setIgnoredOfferItems] = useState<{ listing_id: string; title: string; count: number }[]>([]);
  const [showIgnoringModal, setShowIgnoringModal] = useState(false);
  const [ignoringModalItem, setIgnoringModalItem] = useState<{ listing_id: string; title: string } | null>(null);
  const [pausingListing, setPausingListing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // D-30: fetchPendingOffers runs AFTER fetchTrades completes so it has
      // access to the trades state (summary and list stay in sync).
      fetchTrades();
      void fetchAllOffers();
      void fetchSellerIgnoringStats();
      // Reset paginated history to the newest page on focus/tab change.
      void fetchHistoryPage(true);
    }, [userId, activeTab])
  );

  // TFV2-015: Handle notification-triggered ignore prompt modal
  useEffect(() => {
    const params = route.params as any;
    if (params?.showIgnorePrompt && params?.listingId) {
      setIgnoringModalItem({
        listing_id: params.listingId,
        title: params.listingTitle || 'your listing',
      });
      setShowIgnoringModal(true);
      // Clear params to prevent re-triggering on subsequent renders
      navigation.setParams({ showIgnorePrompt: undefined, listingId: undefined, listingTitle: undefined });
    }
  }, [route.params, navigation]);

  /** TFV2-015 (D-13): Load listings where seller has ≥2 unanswered offers */
  const fetchSellerIgnoringStats = async () => {
    if (!userId) {
      setIgnoredOfferItems([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('listing_offer_stats')
        .select('listing_id, unanswered_offer_count, items!inner(title, seller_id)')
        .gte('unanswered_offer_count', 2)
        .eq('items.seller_id', userId)
        .order('unanswered_offer_count', { ascending: false })
        .limit(5);

      if (data) {
        setIgnoredOfferItems(
          data.map((row: any) => ({
            listing_id: row.listing_id,
            title: row.items?.title ?? 'Your listing',
            count: row.unanswered_offer_count,
          }))
        );
      }
    } catch {
      // Non-blocking: banner is a nice-to-have
    }
  };

  /** TFV2-015: Pause a listing (status → 'paused') */
  const handlePauseListing = async (listingId: string) => {
    try {
      setPausingListing(true);
      await supabase.from('items').update({ status: 'paused' }).eq('id', listingId);
      setIgnoredOfferItems(prev => prev.filter(i => i.listing_id !== listingId));
      setShowIgnoringModal(false);
    } catch {
      Alert.alert('Error', 'Could not pause listing. Please try again.');
    } finally {
      setPausingListing(false);
    }
  };

  /** Shared helper: attach listing data (title + images) to offer/trade rows */
  const attachListingDataToOffers = useCallback(
    async (offers: any[]): Promise<any[]> => {
      const listingIds = [
        ...new Set(offers.map((o: any) => o.listing_id).filter(Boolean)),
      ];
      const listingMap: Record<string, any> = {};
      if (listingIds.length > 0) {
        // Fetch items without join to avoid FK issues
        const { data: items } = await supabase
          .from('items')
          .select('id, title, price')
          .in('id', listingIds);

        if (items) {
          for (const item of items) {
            listingMap[item.id] = { ...item, images: [] };
          }

          // Fetch images separately
          const { data: allImages } = await supabase
            .from('item_images')
            .select('item_id, id, url, thumbnail_url, display_order')
            .in('item_id', listingIds)
            .order('display_order', { ascending: true });

          if (allImages) {
            for (const img of allImages) {
              if (listingMap[img.item_id]) {
                listingMap[img.item_id].images.push({
                  id: img.id,
                  url: img.url,
                  thumbnail_url: img.thumbnail_url,
                  display_order: img.display_order,
                });
              }
            }
          }
        }
      }

      return offers.map((offer: any) => ({
        ...offer,
        listing: listingMap[offer.listing_id] || null,
      }));
    },
    []
  );

  const fetchPendingOffers = async (tradesData?: any[]) => {
    // D-30: Use passed-in tradesData to avoid stale closure over `trades` state.
    const source = tradesData ?? trades;
    // FIXED TC-B02: Exclude cancelled offers from "Needs Action" section
    const sellerNeedsAction = source.filter((t: any) =>
      t.seller_id === userId
      && t.status === 'pending'  // Only pending offers need action, NOT cancelled
      && !t.auto_complete_at
    );
    const offersWithType = await attachListingDataToOffers(
      sellerNeedsAction.map((offer: any) => ({ ...offer, type: 'received' as const }))
    );
    setPendingOffers(offersWithType);
  };

  const fetchAllOffers = async () => {
    if (!userId) {
      setAllOffers([]);
      return;
    }

    setLoading(true);
    try {
      // Get offers received (as seller) — no join, listing data attached separately
      const { data: receivedData, error: receivedError } = await supabase
        .from('trades')
        .select(`
          id,
          listing_id,
          sp_amount,
          cash_amount_cents,
          created_at,
          offer_expires_at,
          status,
          bundle_id,
          auto_complete_at
        `)
        .eq('seller_id', userId)
        // Only offer-status rows are ever displayed from allOffers (submitted/
        // received pending offers). This avoids re-fetching every completed/
        // cancelled trade + their images on every screen focus.
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (receivedError) throw receivedError;

      // Get offers submitted (as buyer)
      const { data: submittedData, error: submittedError } = await supabase
        .from('trades')
        .select(`
          id,
          listing_id,
          sp_amount,
          cash_amount_cents,
          created_at,
          offer_expires_at,
          status,
          bundle_id,
          auto_complete_at
        `)
        .eq('buyer_id', userId)
        // Same status narrowing as the received query above.
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (submittedError) throw submittedError;

      const received = await attachListingDataToOffers(
        (receivedData || []).map((offer: any) => ({ ...offer, type: 'received' as const }))
      );

      const submitted = await attachListingDataToOffers(
        (submittedData || []).map((offer: any) => ({ ...offer, type: 'submitted' as const }))
      );

      const combined = [...received, ...submitted].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAllOffers(combined);
    } catch (err) {
      console.warn('[TradeList] fetchAllOffers error', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async () => {
    if (!userId) {
      setTrades([]);
      return;
    }
    setLoading(true);
    try {
      // Step 1: Fetch ACTIVE trades only (pending/in_progress) — these are few
      // and drive the Active tab + Needs Action / In Progress / Your Offers
      // counts. History (completed/cancelled/payment_failed) is paginated
      // separately in fetchHistoryPage so large histories no longer block load.
      const { data: tradesRaw, error: tradesError } = await supabase
        .from('trades')
        .select(
          'id, status, created_at, buyer_id, seller_id, bundle_id, listing_id, cash_amount_cents, sp_amount, tax_amount_cents, auto_complete_at'
        )
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (tradesError) throw tradesError;

      // Step 1b: Recently completed (top 3) for the Active tab's
      // "Recently Completed" section.
      const { data: recentCompleted, error: recentError } = await supabase
        .from('trades')
        .select(
          'id, status, created_at, buyer_id, seller_id, bundle_id, listing_id, cash_amount_cents, sp_amount, tax_amount_cents, auto_complete_at'
        )
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3);
      if (recentError) throw recentError;

      // Step 1c: Accurate "Completed" count for the summary strip (head-only).
      const { count: completedCount, error: countError } = await supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'completed');
      if (countError) throw countError;

      const activeRaw = [...(tradesRaw || []), ...(recentCompleted || [])];
      // Dedupe by id (defensive — the active and recent-completed queries can overlap).
      const uniqueRaw = Array.from(new Map(activeRaw.map((t: any) => [t.id, t])).values());

      // Step 2: Fetch listing data separately (resilient to deleted/missing items).
      const attached = await attachListingDataToOffers(uniqueRaw);

      // D-09: Sort by total_value (cash + SP) DESC so highest-value trades appear first
      const sorted = [...attached].sort((a: any, b: any) => {
        const aVal = (a.cash_amount_cents ?? 0) / 100 + (a.sp_amount ?? 0);
        const bVal = (b.cash_amount_cents ?? 0) / 100 + (b.sp_amount ?? 0);
        return bVal - aVal;
      });

      setTrades(sorted);

      // Derive pending offers from the fresh data (not stale closure)
      // to keep Needs Action in sync with summary count.
      void fetchPendingOffers(sorted);

      // Calculate summary stats.
      // D-30: 'in_progress' with auto_complete_at IS NULL = needs action.
      //        Only count where current user is the SELLER (needs action on their side).
      //        'in_progress' with auto_complete_at IS NOT NULL = truly in progress (accepted).
      const needsActionCount = (tradesRaw || []).filter((t: any) =>
        t.seller_id === userId && ['pending', 'in_progress'].includes(t.status) && !t.auto_complete_at
      ).length || 0;
      // D-31: Count buyer's pending offers (submitted, awaiting seller acceptance)
      const pendingOfferCount = (tradesRaw || []).filter((t: any) =>
        t.buyer_id === userId && ['pending', 'in_progress'].includes(t.status) && !t.auto_complete_at
      ).length || 0;
      const inProgressCount = (tradesRaw || []).filter((t: any) =>
        t.status === 'in_progress' && t.auto_complete_at
      ).length || 0;

      setSummary(prev => ({
        ...prev,
        inProgress: inProgressCount,
        needsAction: needsActionCount,
        pendingOffers: pendingOfferCount,
        completed: completedCount ?? prev.completed,
      }));
    } catch (err) {
      console.warn('[TradeList] fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  /** Load one page of history trades (completed/cancelled/payment_failed), newest first. */
  const fetchHistoryPage = async (reset: boolean) => {
    if (!userId) {
      setHistoryTrades([]);
      setHistoryHasMore(false);
      return;
    }
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const start = reset ? 0 : historyTrades.length;
      const end = start + HISTORY_PAGE_SIZE - 1;
      const { data: historyRaw, error } = await supabase
        .from('trades')
        .select(
          'id, status, created_at, buyer_id, seller_id, bundle_id, listing_id, cash_amount_cents, sp_amount, tax_amount_cents, auto_complete_at'
        )
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in('status', ['completed', 'cancelled', 'payment_failed'])
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      const attached = await attachListingDataToOffers(historyRaw || []);
      // Keep newest-first ordering (matches the previous client-side sort).
      const sorted = [...attached].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setHistoryTrades(prev => {
        if (reset) return sorted;
        const seen = new Set(prev.map((t: any) => t.id));
        return [...prev, ...sorted.filter((t: any) => !seen.has(t.id))];
      });
      setHistoryHasMore((historyRaw?.length ?? 0) === HISTORY_PAGE_SIZE);
    } catch (err) {
      console.warn('[TradeList] fetchHistoryPage error', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  /** Load the next history page when the user taps "Load More". */
  const loadMoreHistory = () => {
    if (!userId || historyLoading || !historyHasMore) return;
    void fetchHistoryPage(false);
  };

  /** "Load More" button (or end-of-list text) rendered under history rows. */
  const renderHistoryLoadMore = () => {
    if (historyHasMore) {
      return (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={loadMoreHistory}
          disabled={historyLoading}
          testID="history-load-more"
        >
          {historyLoading ? (
            <ActivityIndicator size="small" color="#5DBB8E" />
          ) : (
            <Text style={styles.loadMoreButtonText}>Load More</Text>
          )}
        </TouchableOpacity>
      );
    }
    return <Text style={styles.historyEndText}>You're all caught up</Text>;
  };

  // D-31: Buyer's submitted offers awaiting seller acceptance
  // FIXED TC-B02: Exclude cancelled offers from "Your Offers" section
  const submittedOffers = useMemo(() => {
    return allOffers.filter((o) =>
      o.type === 'submitted' &&
      o.status !== 'cancelled' &&  // Exclude cancelled/expired offers
      (o.status === 'pending' || (o.status === 'in_progress' && !o.auto_complete_at))
    );
  }, [allOffers]);

  // Addendum D: group submitted (buyer) offers by bundle_id for the "Your Offers" section.
  // Buyer sees bundled offers as a single card (no Accept All / Decline All — those are seller actions).
  const groupedSubmittedOffers = useMemo(() => {
    type GroupRow =
      | { type: 'single'; offer: PendingOffer }
      | { type: 'bundle'; bundleId: string; offers: PendingOffer[] };
    const result: GroupRow[] = [];
    const bundleMap: Record<string, PendingOffer[]> = {};
    const seen = new Set<string>();

    for (const offer of submittedOffers) {
      if (offer.bundle_id) {
        if (!bundleMap[offer.bundle_id]) {
          bundleMap[offer.bundle_id] = [];
        }
        bundleMap[offer.bundle_id].push(offer);
        seen.add(offer.id);
      }
    }

    for (const offer of submittedOffers) {
      if (offer.bundle_id && bundleMap[offer.bundle_id] && !seen.has(`__bundle__${offer.bundle_id}`)) {
        seen.add(`__bundle__${offer.bundle_id}`);
        result.push({ type: 'bundle', bundleId: offer.bundle_id, offers: bundleMap[offer.bundle_id] });
      } else if (!offer.bundle_id) {
        result.push({ type: 'single', offer });
      }
    }

    return result;
  }, [submittedOffers]);

  // Addendum D: group received pending offers by bundle_id for the Offers tab.
  const groupedReceivedOffers = useMemo(() => {
    type GroupRow =
      | { type: 'single'; offer: PendingOffer }
      | { type: 'bundle'; bundleId: string; offers: PendingOffer[] };
    const result: GroupRow[] = [];
    const bundleMap: Record<string, PendingOffer[]> = {};
    const seen = new Set<string>();

    // D-30: received offers are 'in_progress' with auto_complete_at IS NULL
    // FIXED TC-B02: Exclude cancelled offers from grouped received offers
    const received = allOffers.filter((o) =>
      o.type === 'received' &&
      o.status !== 'cancelled' &&  // Exclude cancelled/expired offers
      (o.status === 'pending' || (o.status === 'in_progress' && !o.auto_complete_at))
    );
    for (const offer of received) {
      if (offer.bundle_id) {
        if (!bundleMap[offer.bundle_id]) {
          bundleMap[offer.bundle_id] = [];
        }
        bundleMap[offer.bundle_id].push(offer);
        seen.add(offer.id);
      }
    }

    for (const offer of received) {
      if (offer.bundle_id && bundleMap[offer.bundle_id] && !seen.has(`__bundle__${offer.bundle_id}`)) {
        seen.add(`__bundle__${offer.bundle_id}`);
        result.push({ type: 'bundle', bundleId: offer.bundle_id, offers: bundleMap[offer.bundle_id] });
      } else if (!offer.bundle_id) {
        result.push({ type: 'single', offer });
      }
    }

    return result;
  }, [allOffers]);

  // Addendum D: group in_progress trades by bundle_id.
  const inProgressBundles = useMemo(() => {
    const inProgress = trades.filter(
      (t: any) => t.status === 'in_progress' && t.bundle_id
    );
    const bundleMap: Record<string, any[]> = {};
    for (const t of inProgress) {
      const bid = (t as any).bundle_id;
      if (!bundleMap[bid]) bundleMap[bid] = [];
      bundleMap[bid].push(t);
    }
    return Object.entries(bundleMap)
      .filter(([, items]) => items.length > 1)
      .map(([bundleId, items]) => ({ bundleId, trades: items }));
  }, [trades]);

  // Collect all trade IDs that belong to a grouped bundle (for filtering out of individual list)
  const bundledTradeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bundle of inProgressBundles) {
      for (const trade of bundle.trades) {
        ids.add(trade.id);
      }
    }
    return ids;
  }, [inProgressBundles]);

  // D-30: only 'in_progress' with auto_complete_at IS NOT NULL is truly active (accepted).
  // Unaccepted offers (pending or in_progress with auto_complete_at IS NULL) go to Needs Action.
  const activeTrades = useMemo(() => {
    return trades.filter((t: any) =>
      t.status === 'in_progress' && t.auto_complete_at
    );
  }, [trades]);

  const recentlyCompleted = useMemo(() => {
    return trades.filter((t: any) => t.status === 'completed').slice(0, 3);
  }, [trades]);

  /** Show confirmation modal before accepting a bundle */
  const requestAcceptBundle = (bundleId: string, offerIds: string[], title: string) => {
    setBundleConfirmModal({ visible: true, action: 'accept', bundleId, offerIds, title });
  };

  /** Show confirmation modal before declining a bundle */
  const requestDeclineBundle = (bundleId: string, offerIds: string[], title: string) => {
    setBundleConfirmModal({ visible: true, action: 'decline', bundleId, offerIds, title });
  };

  /** Execute the confirmed bundle action */
  const executeBundleAction = async () => {
    const { action, bundleId, offerIds } = bundleConfirmModal;
    setBundleConfirmModal(prev => ({ ...prev, visible: false }));
    setProcessingBundleId(bundleId);
    try {
      if (action === 'accept') {
        await acceptBundleOffers(offerIds);
      } else {
        await declineBundleOffers(offerIds);
      }
      fetchAllOffers();
    } catch (err) {
      console.warn('[TradeList] executeBundleAction error', err);
    } finally {
      setProcessingBundleId(null);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
      /* D-30: payment_processing deprecated */
        return styles.statusBadgePending;
      case 'in_progress':
        return styles.statusBadgeActive;
      case 'completed':
        return styles.statusBadgeCompleted;
      case 'cancelled':
      case 'payment_failed':
        return styles.statusBadgeCancelled;
      default:
        return styles.statusBadgeDefault;
    }
  };

  const getStatusBadgeTextStyle = (status: string) => {
    switch (status) {
      case 'pending':
      /* D-30: payment_processing deprecated */
        return styles.statusBadgeTextPending;
      case 'in_progress':
        return styles.statusBadgeTextActive;
      case 'completed':
        return styles.statusBadgeTextCompleted;
      case 'cancelled':
      case 'payment_failed':
        return styles.statusBadgeTextCancelled;
      default:
        return styles.statusBadgeTextDefault;
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderTradeCard = ({ item }: { item: any }) => {
    const isBuyer = item.buyer_id === userId;
    const firstImage = item.listing?.images && item.listing.images.length > 0 ? item.listing.images[0] : null;

    return (
      <View style={styles.tradeCard} testID={`trade-row-${item.id}`}>
        <View style={styles.tradeCardMain}>
          <View style={styles.tradeCardImageContainer}>
            {firstImage ? (
              <Image
                source={{ uri: firstImage.thumbnail_url || firstImage.url }}
                style={styles.tradeCardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.tradeCardImagePlaceholder}>
                <Text style={styles.tradeCardImagePlaceholderText}>📦</Text>
              </View>
            )}
          </View>

          <View style={styles.tradeCardContent}>
            <View style={styles.tradeCardHeaderLine}>
              <Text style={styles.tradeCardTitle} numberOfLines={1}>{item.listing?.title || 'Untitled'}</Text>
              <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
                <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(item.status)]}>
                  {formatStatus(item.status)}
                </Text>
              </View>
            </View>

            <View style={styles.tradeCardMetaLine}>
              <View style={[styles.typeBadge, isBuyer ? styles.typeBadgeBuying : styles.typeBadgeSelling]}>
                <Text style={[styles.typeBadgeText, isBuyer ? styles.typeBadgeTextBuying : styles.typeBadgeTextSelling]}>
                  {isBuyer ? 'Buying' : 'Selling'}
                </Text>
              </View>
              <Text style={styles.tradeCardDate}>{formatDate(item.created_at)} · ${(item.cash_amount_cents / 100).toFixed(2)}</Text>
            </View>

            {item.status === 'pending' && item.offer_expires_at && (
              <View style={styles.expirationLine}>
                <View style={styles.expirationDot} />
                <Text style={styles.expirationText}>Offer expires in {getTimeAgoBrief(item.offer_expires_at)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.tradeCardDivider} />

        <View style={styles.tradeCardActions}>
          <TouchableOpacity 
            style={styles.tradeCardBtnSecondary}
            onPress={() => navigation.navigate('TradeDetail', { tradeId: item.id })}
          >
            <Text style={styles.tradeCardBtnSecondaryText}>View Trade</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tradeCardBtnSecondary}
            onPress={() => navigation.navigate('Chat', { tradeId: item.id })}
          >
            <ChatTeardropText size={18} color="#6B6B6B" weight="regular" />
            <Text style={styles.tradeCardBtnSecondaryText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCompactTradeRow = ({ item }: { item: any }) => {
    const isBuyer = item.buyer_id === userId;
    const firstImage = item.listing?.images && item.listing.images.length > 0 ? item.listing.images[0] : null;

    const getCompactBadge = () => {
      if (item.status === 'cancelled') {
        return {
          label: 'Cancelled',
          badgeStyle: styles.compactTypeBadgeCancelled,
          textStyle: styles.compactTypeBadgeTextCancelled,
        };
      }
      if (item.status === 'payment_failed') {
        return {
          label: 'Failed',
          badgeStyle: styles.compactTypeBadgeCancelled,
          textStyle: styles.compactTypeBadgeTextCancelled,
        };
      }
      return {
        label: isBuyer ? 'Bought' : 'Sold',
        badgeStyle: isBuyer ? styles.compactTypeBadgeBuying : styles.compactTypeBadgeSelling,
        textStyle: isBuyer ? styles.compactTypeBadgeTextBuying : styles.compactTypeBadgeTextSelling,
      };
    };

    const badge = getCompactBadge();

    return (
      <TouchableOpacity 
        style={styles.compactRow}
        onPress={() => navigation.navigate('TradeDetail', { tradeId: item.id })}
      >
        <View style={styles.compactImageContainer}>
          {firstImage ? (
            <Image
              source={{ uri: firstImage.thumbnail_url || firstImage.url }}
              style={styles.compactImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.compactImagePlaceholder}>
              <Text style={styles.compactImagePlaceholderText}>📦</Text>
            </View>
          )}
        </View>
        <View style={styles.compactContent}>
          <View style={styles.compactMain}>
            <Text style={styles.compactTitle} numberOfLines={1}>{item.listing?.title || 'Untitled'}</Text>
            <Text style={styles.compactDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.compactRight}>
            <Text style={styles.compactPrice}>${(item.cash_amount_cents / 100).toFixed(2)}</Text>
            <View style={[styles.compactTypeBadge, badge.badgeStyle]}>
              <Text style={[styles.compactTypeBadgeText, badge.textStyle]}>
                {badge.label}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getTimeAgoBrief = (dateString: string) => {
    const target = new Date(dateString);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${mins}m`;
  };

  const renderEmptyState = () => {
    let message: string;
    if (activeTab === 'history') {
      message = 'Your completed and cancelled trades will appear here.';
    } else if (selectedFilter === 'your_offers') {
      message = "You haven't sent any offers yet. Browse items and make an offer to get started.";
    } else if (selectedFilter === 'needs_action') {
      message = 'No pending offers from buyers right now. New offers will appear here.';
    } else if (selectedFilter === 'in_progress') {
      message = 'No trades in progress. Accepted offers will show up here.';
    } else if (selectedFilter === 'completed') {
      message = 'No completed trades yet. Your finished trades will show up here.';
    } else {
      message = "You don't have any active trades or offers right now.";
    }

    return (
      <View style={styles.emptyState} testID="trade-history-empty-state">
        <Receipt size={64} color="#E0E0E0" weight="regular" />
        <Text style={styles.emptyStateTitle}>No Trades Yet</Text>
        <Text style={styles.emptyStateText}>
          {message}
        </Text>
      </View>
    );
  };

  return (
    <ScreenLayout variant="detail" title="My Trades">
      {/* Summary Header — tappable to filter */}
      <View style={styles.summaryCard}>
        <Pressable
          style={styles.summaryItem}
          onPress={() => setSelectedFilter(prev => prev === 'your_offers' ? 'all' : 'your_offers')}
        >
          <Text style={[styles.summaryValue, selectedFilter === 'your_offers' && styles.summaryValueActive]}>{summary.pendingOffers}</Text>
          <Text style={styles.summaryLabel}>Your Offers</Text>
        </Pressable>
        <View style={styles.summaryDivider} />
        <Pressable
          style={styles.summaryItem}
          onPress={() => setSelectedFilter(prev => prev === 'in_progress' ? 'all' : 'in_progress')}
        >
          <Text style={[styles.summaryValue, selectedFilter === 'in_progress' && styles.summaryValueActive]}>{summary.inProgress}</Text>
          <Text style={styles.summaryLabel}>In Progress</Text>
        </Pressable>
        <View style={styles.summaryDivider} />
        <Pressable
          style={styles.summaryItem}
          onPress={() => setSelectedFilter(prev => prev === 'needs_action' ? 'all' : 'needs_action')}
        >
          <Text style={[styles.summaryValue, selectedFilter === 'needs_action' && styles.summaryValueActive]}>{summary.needsAction}</Text>
          <Text style={styles.summaryLabel}>Needs Action</Text>
        </Pressable>
        <View style={styles.summaryDivider} />
        <Pressable
          style={styles.summaryItem}
          onPress={() => setSelectedFilter(prev => prev === 'completed' ? 'all' : 'completed')}
        >
          <Text style={[styles.summaryValue, selectedFilter === 'completed' && styles.summaryValueActive]}>{summary.completed}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
          testID="tab-active"
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
          testID="tab-history"
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([fetchTrades(), fetchHistoryPage(true)]).finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {activeTab === 'active' ? (
          <>
            {/* Submitted Offers (Buyer) — grouped by bundle_id */}
            {groupedSubmittedOffers.length > 0 && (selectedFilter === 'all' || selectedFilter === 'your_offers') && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ArrowsLeftRight size={18} color="#5DBB8E" />
                  <Text style={styles.sectionTitle}>YOUR OFFERS</Text>
                </View>
                {groupedSubmittedOffers.map((row, idx) => {
                  if (row.type === 'bundle') {
                    // Bundle card — grouped offers share the same bundle_id
                    const bundleOffers = row.offers;
                    return (
                      <TouchableOpacity
                        key={`bundle-submitted-${row.bundleId}`}
                        style={[styles.tradeCard, { paddingBottom: 12 }]}
                        onPress={() => navigation.navigate('TradeDetail', { tradeId: bundleOffers[0].id })}
                      >
                        <View style={styles.tradeCardMain}>
                          <View style={styles.tradeCardContent}>
                            <View style={styles.tradeCardHeaderLine}>
                              <Text style={[styles.tradeCardTitle, { color: '#5DBB8E' }]} numberOfLines={1}>
                                📦 Bundle Offer · {bundleOffers.length} items
                              </Text>
                              <View style={[styles.statusBadge, styles.statusBadgePending]}>
                                <Text style={[styles.statusBadgeText, styles.statusBadgeTextPending]}>PENDING</Text>
                              </View>
                            </View>
                            <View style={styles.tradeCardMetaLine}>
                              <View style={[styles.typeBadge, styles.typeBadgeBuying]}>
                                <Text style={styles.typeBadgeTextBuying}>Buying</Text>
                              </View>
                              <Text style={styles.tradeCardDate}>
                                {formatDate(bundleOffers[0].created_at)}
                              </Text>
                            </View>
                            {bundleOffers.slice(0, 3).map((o, i) => (
                              <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: i === 0 ? 8 : 4 }}>
                                <Text style={{ fontSize: 13, color: '#333', flex: 1 }} numberOfLines={1}>
                                  {o.listing?.title || 'Untitled'}
                                </Text>
                                <Text style={{ fontSize: 13, color: '#6B6B6B' }}>
                                  ${(o.cash_amount_cents / 100).toFixed(2)}
                                  {o.sp_amount > 0 ? ` + ${o.sp_amount} SP` : ''}
                                </Text>
                              </View>
                            ))}
                            {bundleOffers.length > 3 && (
                              <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                +{bundleOffers.length - 3} more items
                              </Text>
                            )}
                            {bundleOffers[0]?.offer_expires_at && (
                              <View style={styles.expirationLine}>
                                <View style={styles.expirationDot} />
                                <Text style={styles.expirationText}>
                                  Offer expires in {getTimeAgoBrief(bundleOffers[0].offer_expires_at)}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.tradeCardDivider} />
                        <View style={[styles.tradeCardActions, { flexDirection: 'row' }]}>
                          <TouchableOpacity
                            style={[styles.tradeCardBtnSecondary, { flex: 1 }]}
                            onPress={() => navigation.navigate('TradeDetail', { tradeId: bundleOffers[0].id })}
                          >
                            <Text style={styles.tradeCardBtnSecondaryText}>View Details</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  // Single offer (not part of a bundle)
                  const offer = row.offer;
                  return (
                    <TouchableOpacity 
                      key={offer.id}
                      style={styles.tradeCard}
                      onPress={() => navigation.navigate('TradeDetail', { tradeId: offer.id })}
                    >
                      <View style={styles.tradeCardMain}>
                        <View style={styles.tradeCardImageContainer}>
                          {offer.listing?.images?.[0] ? (
                            <Image 
                              source={{ uri: offer.listing.images[0].thumbnail_url || offer.listing.images[0].url }} 
                              style={styles.tradeCardImage} 
                            />
                          ) : (
                            <View style={styles.tradeCardImagePlaceholder}><Text>📦</Text></View>
                          )}
                        </View>
                        <View style={styles.tradeCardContent}>
                          <View style={styles.tradeCardHeaderLine}>
                            <Text style={styles.tradeCardTitle} numberOfLines={1}>{offer.listing?.title || 'Untitled'}</Text>
                            <View style={[styles.statusBadge, offer.status === 'cancelled' ? styles.statusBadgeCancelled : styles.statusBadgePending]}>
                              <Text style={[styles.statusBadgeText, offer.status === 'cancelled' ? styles.statusBadgeTextCancelled : styles.statusBadgeTextPending]}>
                                {offer.status === 'cancelled' ? 'EXPIRED' : 'PENDING'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.tradeCardMetaLine}>
                            <View style={[styles.typeBadge, styles.typeBadgeBuying]}>
                              <Text style={styles.typeBadgeTextBuying}>Buying</Text>
                            </View>
                            <Text style={styles.tradeCardDate}>{formatDate(offer.created_at)} · ${(offer.cash_amount_cents / 100).toFixed(2)}</Text>
                          </View>
                          {offer.offer_expires_at && (
                            <View style={styles.expirationLine}>
                              <View style={styles.expirationDot} />
                              <Text style={styles.expirationText}>
                                {offer.status === 'cancelled' 
                                  ? (offer.listing?.status === 'available' ? 'Expired — Item still available' : 'Expired — Item no longer available')
                                  : `Offer expires in ${getTimeAgoBrief(offer.offer_expires_at)}`
                                }
                              </Text>
                            </View>
                          )}
                          {offer.sp_amount > 0 && (
                            <View style={styles.pointsRedemptionTag}>
                              <Text style={styles.pointsRedemptionTagText}>
                                Includes points redemption
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.tradeCardDivider} />
                      <View style={styles.tradeCardActions}>
                        {offer.status === 'cancelled' && offer.listing?.status === 'available' ? (
                          <TouchableOpacity 
                            style={styles.tradeCardBtnPrimary}
                            onPress={() => {
                              if (offer.listing?.id) {
                                navigation.navigate('ItemDetail', { itemId: offer.listing.id });
                              }
                            }}
                          >
                            <Text style={styles.tradeCardBtnPrimaryText}>View Item Again</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={styles.tradeCardBtnSecondary}
                            onPress={() => navigation.navigate('TradeDetail', { tradeId: offer.id })}
                          >
                            <Text style={styles.tradeCardBtnSecondaryText}>View Details</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Action Required (Received Offers - Seller) */}
            {groupedReceivedOffers.length > 0 && (selectedFilter === 'all' || selectedFilter === 'needs_action') && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ArrowsLeftRight size={18} color="#6B6B6B" />
                  <Text style={styles.sectionTitle}>NEEDS ACTION</Text>
                </View>
                {groupedReceivedOffers.map((row, idx) => {
                  if (row.type === 'bundle') {
                    const bundleOffers = row.offers;
                    return (
                      <View key={`bundle-${row.bundleId}`} style={[styles.tradeCard, { paddingBottom: 12 }]}>
                        {/* Bundle Header */}
                        <View style={styles.tradeCardMain}>
                          <View style={styles.tradeCardContent}>
                            <View style={styles.tradeCardHeaderLine}>
                              <Text style={[styles.tradeCardTitle, { color: '#5DBB8E' }]} numberOfLines={1}>
                                📦 Bundle Offer · {bundleOffers.length} items
                              </Text>
                              <View style={[styles.statusBadge, styles.statusBadgePending]}>
                                <Text style={[styles.statusBadgeText, styles.statusBadgeTextPending]}>OFFER</Text>
                              </View>
                            </View>
                            {bundleOffers.slice(0, 3).map((o, i) => (
                              <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: i === 0 ? 8 : 4 }}>
                                <Text style={{ fontSize: 13, color: '#333', flex: 1 }} numberOfLines={1}>
                                  {o.listing?.title || 'Untitled'}
                                </Text>
                                <Text style={{ fontSize: 13, color: '#6B6B6B' }}>
                                  ${(o.cash_amount_cents / 100).toFixed(2)}
                                  {o.sp_amount > 0 ? ` + ${o.sp_amount} SP` : ''}
                                </Text>
                              </View>
                            ))}
                            {bundleOffers.length > 3 && (
                              <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                +{bundleOffers.length - 3} more items
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.tradeCardDivider} />
                        {/* Bundle Actions */}
                        <View style={[styles.tradeCardActions, { flexDirection: 'row', gap: 8 }]}>
                          <TouchableOpacity
                            style={[styles.tradeCardBtnSecondary, { flex: 1 }, processingBundleId === row.bundleId && styles.tradeCardBtnDisabled]}
                            onPress={() => navigation.navigate('ReviewOffer', { tradeId: bundleOffers[0].id })}
                            disabled={processingBundleId === row.bundleId}
                          >
                            <Text style={[styles.tradeCardBtnSecondaryText, processingBundleId === row.bundleId && { opacity: 0.5 }]}>Review Each</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.tradeCardBtnPrimary, { flex: 1, backgroundColor: '#5DBB8E' }, processingBundleId === row.bundleId && styles.tradeCardBtnDisabled]}
                            onPress={() => requestAcceptBundle(row.bundleId, bundleOffers.map(o => o.id), `${bundleOffers.length} items`)}
                            disabled={processingBundleId === row.bundleId}
                          >
                            <Text style={[styles.tradeCardBtnPrimaryText, { color: '#fff' }]}>Accept All</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.tradeCardBtnSecondary, { flex: 1 }, processingBundleId === row.bundleId && styles.tradeCardBtnDisabled]}
                            onPress={() => requestDeclineBundle(row.bundleId, bundleOffers.map(o => o.id), `${bundleOffers.length} items`)}
                            disabled={processingBundleId === row.bundleId}
                          >
                            <Text style={[styles.tradeCardBtnSecondaryText, { color: '#E53E3E' }, processingBundleId === row.bundleId && { opacity: 0.5 }]}>Decline All</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }
                  // Single offer (not part of a bundle)
                  const offer = row.offer;
                  return (
                    <TouchableOpacity
                      key={offer.id}
                      style={styles.tradeCard}
                      onPress={() => navigation.navigate('ReviewOffer', { tradeId: offer.id })}
                    >
                      <View style={styles.tradeCardMain}>
                        <View style={styles.tradeCardImageContainer}>
                          {offer.listing?.images?.[0] ? (
                            <Image
                              source={{ uri: offer.listing.images[0].thumbnail_url || offer.listing.images[0].url }}
                              style={styles.tradeCardImage}
                            />
                          ) : (
                            <View style={styles.tradeCardImagePlaceholder}><Text>📦</Text></View>
                          )}
                        </View>
                        <View style={styles.tradeCardContent}>
                          <View style={styles.tradeCardHeaderLine}>
                            <Text style={styles.tradeCardTitle} numberOfLines={1}>{offer.listing?.title || 'Untitled'}</Text>
                            <View style={[styles.statusBadge, styles.statusBadgePending]}>
                              <Text style={[styles.statusBadgeText, styles.statusBadgeTextPending]}>OFFER</Text>
                            </View>
                          </View>
                          <View style={styles.tradeCardMetaLine}>
                            <View style={[styles.typeBadge, styles.typeBadgeSelling]}>
                              <Text style={styles.typeBadgeTextSelling}>Selling</Text>
                            </View>
                            <Text style={styles.tradeCardDate}>{formatDate(offer.created_at)} · ${(offer.cash_amount_cents / 100).toFixed(2)}</Text>
                          </View>
                          {offer.offer_expires_at && (
                            <View style={styles.expirationLine}>
                              <View style={styles.expirationDot} />
                              <Text style={styles.expirationText}>
                                {offer.status === 'cancelled' ? 'Expired' : `Offer expires in ${getTimeAgoBrief(offer.offer_expires_at)}`}
                              </Text>
                            </View>
                          )}
                          {offer.sp_amount > 0 && (
                            <View style={styles.pointsRedemptionTag}>
                              <Text style={styles.pointsRedemptionTagText}>
                                Includes points redemption
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.tradeCardDivider} />
                      <View style={styles.tradeCardActions}>
                        <TouchableOpacity
                          style={styles.tradeCardBtnSecondary}
                          onPress={() => navigation.navigate('ReviewOffer', { tradeId: offer.id })}
                        >
                          <Text style={styles.tradeCardBtnSecondaryText}>Review Offer</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* In Progress Section */}
            {activeTrades.length > 0 && (selectedFilter === 'all' || selectedFilter === 'in_progress') && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ArrowsLeftRight size={18} color="#6B6B6B" />
                  <Text style={styles.sectionTitle}>IN PROGRESS</Text>
                </View>
                {/* Bundled in-progress group (Addendum D / TC-L05) */}
                {inProgressBundles.map(bundle => (
                  <TouchableOpacity
                    key={`bundle-${bundle.bundleId}`}
                    style={styles.tradeCard}
                    onPress={() => navigation.navigate('TradeDetail', { tradeId: bundle.trades[0].id })}
                  >
                    <View style={styles.tradeCardMain}>
                      <View style={styles.tradeCardContent}>
                        <View style={styles.tradeCardHeaderLine}>
                          <Text style={[styles.tradeCardTitle, { color: '#5DBB8E' }]} numberOfLines={1}>
                            📦 Bundle · {bundle.trades.length} items
                          </Text>
                          <View style={[styles.statusBadge, styles.statusBadgeActive]}>
                            <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>IN PROGRESS</Text>
                          </View>
                        </View>
                        {bundle.trades.slice(0, 3).map((t: any, i: number) => (
                          <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: i === 0 ? 8 : 4 }}>
                            <Text style={{ fontSize: 13, color: '#333', flex: 1 }} numberOfLines={1}>
                              {t.listing?.title || 'Untitled'}
                            </Text>
                            <Text style={{ fontSize: 13, color: '#6B6B6B' }}>
                              ${(t.cash_amount_cents / 100).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                        {bundle.trades.length > 3 && (
                          <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            +{bundle.trades.length - 3} more items
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
                          <Text style={{ fontSize: 13, color: '#5DBB8E' }}>View →</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                {/* Individual (non-bundled) in-progress trades */}
                {activeTrades.filter((t: any) => !bundledTradeIds.has(t.id)).map(t => (
                  <View key={t.id}>
                    {renderTradeCard({ item: t })}
                  </View>
                ))}
              </View>
            )}

            {/* Completed Section (shown when filter is active) */}
            {selectedFilter === 'completed' && historyTrades.filter(t => t.status === 'completed').length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Check size={18} color="#6B6B6B" />
                  <Text style={styles.sectionTitle}>COMPLETED</Text>
                </View>
                {historyTrades.filter(t => t.status === 'completed').map(t => (
                  <View key={t.id}>
                    {renderCompactTradeRow({ item: t })}
                  </View>
                ))}
                {renderHistoryLoadMore()}
              </View>
            )}

            {/* Recently Completed (only show when no filter is selected) */}
            {selectedFilter === 'all' && recentlyCompleted.length > 0 && (
              <View style={styles.section}>
                <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Check size={18} color="#6B6B6B" />
                    <Text style={styles.sectionTitle}>RECENTLY COMPLETED</Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveTab('history')}>
                    <Text style={styles.seeAllText}>See all →</Text>
                  </TouchableOpacity>
                </View>
                {recentlyCompleted.map(t => (
                  <View key={t.id}>
                    {renderCompactTradeRow({ item: t })}
                  </View>
                ))}
              </View>
            )}

            {(() => {
              // Determine if we should show empty state based on active filter
              if (selectedFilter === 'your_offers') return groupedSubmittedOffers.length === 0;
              if (selectedFilter === 'needs_action') return groupedReceivedOffers.length === 0;
              if (selectedFilter === 'in_progress') return activeTrades.length === 0;
              if (selectedFilter === 'completed') return historyTrades.filter(t => t.status === 'completed').length === 0;
              return activeTrades.length === 0 && groupedReceivedOffers.length === 0 && submittedOffers.length === 0 && recentlyCompleted.length === 0;
            })() && renderEmptyState()}
          </>
        ) : (
          <View style={styles.section}>
            {historyLoading && historyTrades.length === 0 ? (
              <ActivityIndicator style={styles.historyLoading} color="#5DBB8E" />
            ) : historyTrades.length > 0 ? (
              <>
                {historyTrades.map(t => (
                  <View key={t.id}>
                    {renderCompactTradeRow({ item: t })}
                  </View>
                ))}
                {renderHistoryLoadMore()}
              </>
            ) : renderEmptyState()}
          </View>
        )}
      </ScrollView>

      {/* Bundle Accept/Decline Confirmation Modal */}
      <Modal
        visible={bundleConfirmModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setBundleConfirmModal(prev => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={styles.ignModalOverlay}
          onPress={() => setBundleConfirmModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={styles.ignModalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.ignModalTitle}>
              {bundleConfirmModal.action === 'accept' ? 'Accept All Offers?' : 'Decline All Offers?'}
            </Text>
            <Text style={styles.ignModalBody}>
              {bundleConfirmModal.action === 'accept'
                ? `This will accept all ${bundleConfirmModal.title} and charge the buyer's saved payment method.`
                : `This will decline all ${bundleConfirmModal.title}. The buyer won't be charged.`}
            </Text>
            <TouchableOpacity
              style={styles.ignModalBtnPrimary}
              onPress={executeBundleAction}
            >
              <Text style={styles.ignModalBtnPrimaryText}>
                {bundleConfirmModal.action === 'accept' ? 'Accept All' : 'Decline All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ignModalBtnDismiss}
              onPress={() => setBundleConfirmModal(prev => ({ ...prev, visible: false }))}
            >
              <Text style={styles.ignModalBtnDismissText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* TFV2-015: Seller Ignore Prompt Modal */}
      <Modal
        visible={showIgnoringModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIgnoringModal(false)}
      >
        <Pressable 
          style={styles.ignModalOverlay}
          onPress={() => setShowIgnoringModal(false)}
        >
          <Pressable style={styles.ignModalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.ignModalTitle}>Listing Feedback</Text>
            <Text style={styles.ignModalBody}>
              You're receiving offers but not responding on "{ignoringModalItem?.title || 'your listing'}". Want to pause this listing?
            </Text>
            <TouchableOpacity
              style={styles.ignModalBtnPrimary}
              onPress={() => {
                if (ignoringModalItem?.listing_id) {
                  void handlePauseListing(ignoringModalItem.listing_id);
                }
              }}
              disabled={pausingListing}
            >
              {pausingListing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ignModalBtnPrimaryText}>Pause Listing</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ignModalBtnDismiss}
              onPress={() => setShowIgnoringModal(false)}
            >
              <Text style={styles.ignModalBtnDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  // Summary Header
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#5DBB8E',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  content: { flex: 1, backgroundColor: '#FFFFFF' },
  // Section Headers
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  // Trade Card (Large)
  tradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tradeCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tradeCardImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  tradeCardImage: {
    width: '100%',
    height: '100%',
  },
  tradeCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeCardImagePlaceholderText: {
    fontSize: 24,
  },
  tradeCardContent: {
    flex: 1,
  },
  tradeCardHeaderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tradeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  tradeCardMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tradeCardDate: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  // Badges
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeBuying: {
    backgroundColor: '#EBF5FF',
  },
  typeBadgeSelling: {
    backgroundColor: '#F3F4F6',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadgeTextBuying: {
    color: '#3B82F6',
  },
  typeBadgeTextSelling: {
    color: '#4B5563',
  },
  expirationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  expirationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  expirationText: {
    fontSize: 12,
    color: '#F97316',
    fontWeight: '500',
  },
  pointsRedemptionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#EEF9F4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pointsRedemptionTagText: {
    fontSize: 11,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  tradeCardDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  tradeCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeCardBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  tradeCardBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  tradeCardBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5DBB8E',
    gap: 6,
  },
  tradeCardBtnDisabled: {
    opacity: 0.5,
  },
  tradeCardBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Compact Row (History)
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  compactImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactImagePlaceholderText: {
    fontSize: 18,
  },
  compactContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactMain: {
    flex: 1,
    marginRight: 12,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  compactDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  compactRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  compactPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  compactTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactTypeBadgeBuying: {
    backgroundColor: '#EBF5FF',
  },
  compactTypeBadgeSelling: {
    backgroundColor: '#F3F4F6',
  },
  compactTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  compactTypeBadgeTextBuying: {
    color: '#3B82F6',
  },
  compactTypeBadgeTextSelling: {
    color: '#4B5563',
  },
  // Cancelled compact badge
  compactTypeBadgeCancelled: {
    backgroundColor: '#FEF2F2',
  },
  compactTypeBadgeTextCancelled: {
    color: '#EF4444',
  },
  // Summary active filter indicator
  summaryValueActive: {
    color: '#D0D0D0',
  },
  // Status Badges
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#E8F5F0',
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeCompleted: {
    backgroundColor: '#F3F4F6',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeDefault: {
    backgroundColor: '#F5F5F5',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextActive: {
    color: '#5DBB8E',
  },
  statusBadgeTextPending: {
    color: '#D97706',
  },
  statusBadgeTextCompleted: {
    color: '#6B6B6B',
  },
  statusBadgeTextCancelled: {
    color: '#EF4444',
  },
  statusBadgeTextDefault: {
    color: '#666',
  },
  // Empty State
  emptyState: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyLoading: {
    marginTop: 24,
    marginBottom: 8,
  },
  historyEndText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 16,
    marginBottom: 8,
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#5DBB8E',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minWidth: 160,
  },
  loadMoreButtonText: {
    color: '#5DBB8E',
    fontSize: 14,
    fontWeight: '600',
  },
  // TFV2-015: Ignoring Offers Alert & Modal
  ignoredOffersAlertText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  ignoredOffersActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  ignoredOffersBtn: {
    backgroundColor: '#FF8C42',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ignoredOffersBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  ignModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ignModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  ignModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  ignModalBody: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  ignModalBtnPrimary: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  ignModalBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  ignModalBtnSecondary: {
    borderWidth: 1.5,
    borderColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  ignModalBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  ignModalBtnDismiss: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ignModalBtnDismissText: {
    fontSize: 15,
    color: '#6B7280',
  },
});


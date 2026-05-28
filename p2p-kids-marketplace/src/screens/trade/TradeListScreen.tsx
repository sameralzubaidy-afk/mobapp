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

import React, { useState, useCallback, useMemo } from 'react';
import {
  useFocusEffect,
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
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { Receipt, ArrowRight } from 'phosphor-react-native';
import { LoadingSpinner } from '@/components/ui';
import { OfferCountdownPill } from '@/components/trade';
import ScreenLayout from '@/components/ScreenLayout';

type TabType = 'all' | 'buying' | 'selling' | 'offers';

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
    title: string;
    price: number;
    images: { url: string; thumbnail_url?: string }[];
  };
  offer_expires_at?: string | null;
}

export default function TradeListScreen({ navigation }: any) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [allOffers, setAllOffers] = useState<PendingOffer[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  // TFV2-015: seller ignoring offers prompt (D-13)
  const [ignoredOfferItems, setIgnoredOfferItems] = useState<{ listing_id: string; title: string; count: number }[]>([]);
  const [showIgnoringModal, setShowIgnoringModal] = useState(false);
  const [ignoringModalItem, setIgnoringModalItem] = useState<{ listing_id: string; title: string } | null>(null);
  const [pausingListing, setPausingListing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'offers') {
        fetchAllOffers();
        void fetchSellerIgnoringStats();
      } else {
        fetchTrades();
        fetchPendingOffers();
        void fetchSellerIgnoringStats();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, activeTab])
  );

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
      await supabase.from('listings').update({ status: 'paused' }).eq('id', listingId);
      setIgnoredOfferItems(prev => prev.filter(i => i.listing_id !== listingId));
      setShowIgnoringModal(false);
    } catch {
      Alert.alert('Error', 'Could not pause listing. Please try again.');
    } finally {
      setPausingListing(false);
    }
  };

  const fetchPendingOffers = async () => {
    if (!userId) {
      setPendingOffers([]);
      return;
    }

    try {
      // Get pending offers on user's listings (where they are the seller)
      const { data, error } = await supabase
        .from('trades')
        .select(`
          id,
          listing_id,
          sp_amount,
          cash_amount_cents,
          created_at,
          offer_expires_at,
          status,
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `)
        .eq('seller_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const offersWithType = (data || []).map((offer: any) => ({
        ...offer,
        type: 'received' as const,
      }));

      setPendingOffers(offersWithType);
    } catch (err) {
      console.warn('[TradeList] fetchPendingOffers error', err);
    }
  };

  const fetchAllOffers = async () => {
    if (!userId) {
      setAllOffers([]);
      return;
    }

    setLoading(true);
    try {
      // Get offers received (as seller)
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
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `)
        .eq('seller_id', userId)
        .in('status', ['pending', 'payment_processing', 'payment_failed', 'in_progress', 'cancelled'])
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Get offers submitted (as buyer) — must match ACTIVE_OFFER_STATUSES in trade.ts
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
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `)
        .eq('buyer_id', userId)
        .in('status', ['pending', 'payment_processing', 'payment_failed', 'in_progress', 'cancelled'])
        .order('created_at', { ascending: false });

      if (submittedError) throw submittedError;

      const received = (receivedData || []).map((offer: any) => ({
        ...offer,
        type: 'received' as const,
      }));

      const submitted = (submittedData || []).map((offer: any) => ({
        ...offer,
        type: 'submitted' as const,
      }));

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
      const query = supabase
        .from('trades')
        .select(
          'id, status, created_at, buyer_id, seller_id, bundle_id, cash_amount_cents, sp_amount, tax_amount_cents, listing:items(title, price, images:item_images(id, url, thumbnail_url, display_order))'
        )
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Client-side filtering by tab
      let filteredData = data || [];
      if (activeTab === 'buying') {
        filteredData = filteredData.filter((t: any) => t.buyer_id === userId);
      } else if (activeTab === 'selling') {
        filteredData = filteredData.filter((t: any) => t.seller_id === userId);
      }

      // D-09: Sort by total_value (cash + SP) DESC so highest-value trades appear first
      filteredData = [...filteredData].sort((a: any, b: any) => {
        const aVal = (a.cash_amount_cents ?? 0) / 100 + (a.sp_amount ?? 0);
        const bVal = (b.cash_amount_cents ?? 0) / 100 + (b.sp_amount ?? 0);
        return bVal - aVal;
      });

      setTrades(filteredData);
    } catch (err) {
      console.warn('[TradeList] fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  // Addendum D: group received pending offers by bundle_id for the Offers tab.
  const groupedReceivedOffers = useMemo(() => {
    type GroupRow =
      | { type: 'single'; offer: PendingOffer }
      | { type: 'bundle'; bundleId: string; offers: PendingOffer[] };
    const result: GroupRow[] = [];
    const bundleMap: Record<string, PendingOffer[]> = {};
    const seen = new Set<string>();

    const received = allOffers.filter((o) => o.type === 'received' && o.status === 'pending');
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

  // Addendum D: group buyer in_progress trades by bundle_id for the Buying tab.
  const inProgressBundles = useMemo(() => {
    if (activeTab !== 'buying') return [];
    const inProgress = trades.filter(
      (t: any) => t.status === 'in_progress' && t.buyer_id === userId && t.bundle_id
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
  }, [trades, activeTab, userId]);

  const handleAcceptBundle = async (offerIds: string[]) => {
    try {
      for (const id of offerIds) {
        await supabase
          .from('trades')
          .update({ status: 'payment_processing', updated_at: new Date().toISOString() })
          .eq('id', id);
      }
      fetchAllOffers();
    } catch (err) {
      console.warn('[TradeList] handleAcceptBundle error', err);
    }
  };

  const handleDeclineBundle = async (offerIds: string[]) => {
    try {
      for (const id of offerIds) {
        await supabase
          .from('trades')
          .update({ status: 'cancelled', cancellation_reason: 'Seller declined offer', updated_at: new Date().toISOString() })
          .eq('id', id);
      }
      fetchAllOffers();
    } catch (err) {
      console.warn('[TradeList] handleDeclineBundle error', err);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
      case 'payment_processing':
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
      case 'payment_processing':
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

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.tradeRow}
      onPress={() => navigation.navigate('TradeDetail', { tradeId: item.id })}
      testID={`trade-row-${item.id}`}
    >
      <View style={styles.tradeThumbContainer}>
        {Array.isArray(item.listing?.images) && item.listing.images.length > 0 ? (
          <Image
            source={{ uri: item.listing.images[0].thumbnail_url || item.listing.images[0].url }}
            style={styles.tradeThumb}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.tradeThumbPlaceholder}>
            <Text style={styles.tradeThumbPlaceholderText}>📦</Text>
          </View>
        )}
      </View>
      <View style={styles.tradeInfo}>
        <Text style={styles.tradeTitle} numberOfLines={1}>
          {item.listing?.title || 'Untitled'}
        </Text>
        <Text style={styles.tradeDate}>{formatDate(item.created_at)}</Text>
        {/* MODULE-15.3-PART3 TAX-012: show tax line on completed trades with tax > 0 */}
        {item.status === 'completed' && item.tax_amount_cents > 0 && (
          <Text style={styles.tradeTaxLine} testID={`trade-row-tax-${item.id}`}>
            Tax ${(item.tax_amount_cents / 100).toFixed(2)}
          </Text>
        )}
      </View>
      <View style={styles.tradeStatusContainer}>
        <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
          <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(item.status)]}>
            {formatStatus(item.status)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState} testID="trade-history-empty-state">
      <Receipt size={64} color="#E0E0E0" weight="regular" />
      <Text style={styles.emptyStateTitle}>No Trades Yet</Text>
      <Text style={styles.emptyStateText}>
        {activeTab === 'buying'
          ? "You haven't bought any items yet"
          : activeTab === 'selling'
            ? "You haven't sold any items yet"
            : 'Start buying or selling to see your trade history'}
      </Text>
    </View>
  );

  return (
    <ScreenLayout variant="detail" title="My Trades">
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'offers' && styles.tabActive]}
          onPress={() => setActiveTab('offers')}
          testID="tab-offers"
        >
          <Text style={[styles.tabText, activeTab === 'offers' && styles.tabTextActive]}>
            Offers
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
          testID="tab-all"
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'buying' && styles.tabActive]}
          onPress={() => setActiveTab('buying')}
          testID="tab-buying"
        >
          <Text style={[styles.tabText, activeTab === 'buying' && styles.tabTextActive]}>
            Buying
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'selling' && styles.tabActive]}
          onPress={() => setActiveTab('selling')}
          testID="tab-selling"
        >
          <Text style={[styles.tabText, activeTab === 'selling' && styles.tabTextActive]}>
            Selling
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Pending Offers Section (Sellers Only) - Show only on All/Buying/Selling tabs */}
        {activeTab !== 'offers' && pendingOffers.length > 0 && (
          <View style={styles.offersSection}>
            <View style={styles.offersSectionHeader}>
              <View style={styles.sectionHeaderInner}>
                <Text style={styles.offersSectionTitle}>Action Required</Text>
                <View style={styles.offerCountBadge}>
                  <Text style={styles.offerCountBadgeText}>{pendingOffers.length}</Text>
                </View>
              </View>
              <Text style={styles.offersSectionSubtitle}>
                Review your {pendingOffers.length === 1 ? 'pending offer' : 'pending offers'} to confirm the trade
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.offersScrollContent}
            >
              {pendingOffers.map((offer) => (
                <TouchableOpacity
                  key={offer.id}
                  style={styles.offerCard}
                  onPress={() => navigation.navigate('ReviewOffer', { tradeId: offer.id })}
                >
                  <View style={styles.offerImageContainer}>
                    {Array.isArray(offer.listing?.images) && offer.listing.images.length > 0 ? (
                      <Image
                        source={{
                          uri: offer.listing.images[0].thumbnail_url || offer.listing.images[0].url,
                        }}
                        style={styles.offerImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.offerImagePlaceholder}>
                        <Text style={styles.offerImagePlaceholderText}>📦</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.offerCardContent}>
                    <Text style={styles.offerCardTitle} numberOfLines={2}>
                      {offer.listing?.title || 'Untitled'}
                    </Text>
                    <View style={styles.offerCardAmount}>
                      <View style={styles.offerPriceRow}>
                        <Text style={styles.offerCardPrice}>
                          ${(offer.cash_amount_cents / 100).toFixed(2)}
                        </Text>
                        {offer.sp_amount > 0 && (
                          <View style={styles.spBadgeSmall}>
                            <Text style={styles.spBadgeSmallText}>{offer.sp_amount} SP</Text>
                          </View>
                        )}
                      </View>
                      {offer.status === 'pending' && offer.offer_expires_at ? (
                        <OfferCountdownPill
                          offerExpiresAt={offer.offer_expires_at}
                          createdAt={offer.created_at}
                          style={styles.offerCountdownPill}
                        />
                      ) : null}
                    </View>
                    <View style={styles.offerCardAction}>
                      <Text style={styles.offerCardActionText}>Review Offer</Text>
                      <ArrowRight size={14} color="#FFFFFF" weight="bold" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section Title for Main List */}
        {activeTab !== 'offers' && trades.length > 0 && (
          <View style={styles.mainListHeader}>
            <Text style={styles.mainListTitle}>
              {activeTab === 'all' ? 'All Activity' : activeTab === 'buying' ? 'Your Purchases' : 'Your Sales'}
            </Text>
          </View>
        )}

        {/* TFV2-015 (D-13): Seller ignoring offers prompt */}
        {ignoredOfferItems.length > 0 && (
          <TouchableOpacity
            style={styles.ignoredOffersAlert}
            onPress={() => {
              setIgnoringModalItem(ignoredOfferItems[0]);
              setShowIgnoringModal(true);
            }}
            activeOpacity={0.8}
            testID="ignoring-offers-banner"
          >
            <Text style={styles.ignoredOffersAlertText}>
              You have {ignoredOfferItems.reduce((sum, r) => sum + r.count, 0)} unanswered{' '}
              {ignoredOfferItems.reduce((sum, r) => sum + r.count, 0) === 1 ? 'offer' : 'offers'}{' '}
              across {ignoredOfferItems.length}{' '}
              {ignoredOfferItems.length === 1 ? 'listing' : 'listings'}. Reply to keep buyers engaged.
            </Text>
            <View style={styles.ignoredOffersActions}>
              <Pressable
                style={styles.ignoredOffersBtn}
                onPress={() => setActiveTab('offers')}
              >
                <Text style={styles.ignoredOffersBtnText}>Review Offers</Text>
              </Pressable>
            </View>
          </TouchableOpacity>
        )}

        {/* TFV2-015: Ignoring Offers Modal */}
        <Modal
          visible={showIgnoringModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowIgnoringModal(false)}
        >
          <View style={styles.ignModalOverlay}>
            <View style={styles.ignModalSheet}>
              <Text style={styles.ignModalTitle}>Unanswered Offers</Text>
              <Text style={styles.ignModalBody}>
                {ignoringModalItem?.title
                  ? `"${ignoringModalItem.title}" has multiple unanswered offers.`
                  : 'You have multiple unanswered offers.'}{' '}
                Buyers may lose interest. Would you like to pause the listing or respond now?
              </Text>
              <TouchableOpacity
                style={styles.ignModalBtnPrimary}
                onPress={() => ignoringModalItem && handlePauseListing(ignoringModalItem.listing_id)}
                disabled={pausingListing}
                testID="pause-listing-btn"
              >
                {pausingListing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.ignModalBtnPrimaryText}>Pause Listing</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ignModalBtnSecondary}
                onPress={() => { setShowIgnoringModal(false); setActiveTab('offers'); }}
                testID="ill-respond-btn"
              >
                <Text style={styles.ignModalBtnSecondaryText}>I'll Respond</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ignModalBtnDismiss}
                onPress={() => setShowIgnoringModal(false)}
                testID="dismiss-ignoring-modal-btn"
              >
                <Text style={styles.ignModalBtnDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {activeTab === 'offers' ? (
          // Offers Tab View
          loading ? (
            <View style={styles.loadingContainer}>
              <LoadingSpinner />
            </View>
          ) : allOffers.length === 0 ? (
            <View style={styles.emptyState} testID="offers-empty-state">
              <Receipt size={64} color="#E0E0E0" weight="regular" />
              <Text style={styles.emptyStateTitle}>No Offers</Text>
              <Text style={styles.emptyStateText}>
                You haven't received or submitted any offers yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={groupedReceivedOffers.length > 0
                ? groupedReceivedOffers as any[]
                : allOffers.filter((o) => o.type !== 'received' || o.status !== 'pending') as any[]}
              keyExtractor={(row: any) =>
                row.type === 'bundle' ? `bundle-${row.bundleId}` : row.type === 'single' ? row.offer.id : row.id
              }
              renderItem={({ item }: { item: any }) => {
                // Addendum D: bundle row
                if (item.type === 'bundle') {
                  const bundleOffers: PendingOffer[] = item.offers;
                  const totalCash = bundleOffers.reduce((s: number, o: PendingOffer) => s + o.cash_amount_cents, 0);
                  const offerIds = bundleOffers.map((o: PendingOffer) => o.id);
                  return (
                    <View style={styles.bundleOfferRow} testID={`bundle-row-${item.bundleId}`}>
                      <Text style={styles.bundleOfferTitle}>
                        Bundle · {bundleOffers.length} items · ${(totalCash / 100).toFixed(2)}
                      </Text>
                      <View style={styles.bundleOfferActions}>
                        <TouchableOpacity
                          style={styles.bundleAcceptButton}
                          onPress={() => handleAcceptBundle(offerIds)}
                          testID="bundle-accept-all"
                        >
                          <Text style={styles.bundleAcceptButtonText}>Accept All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.bundleReviewButton}
                          onPress={() =>
                            navigation.navigate('ReviewOffer', { tradeId: bundleOffers[0].id })
                          }
                          testID="bundle-review-each"
                        >
                          <Text style={styles.bundleReviewButtonText}>Review Each</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.bundleDeclineButton}
                          onPress={() => handleDeclineBundle(offerIds)}
                          testID="bundle-decline-all"
                        >
                          <Text style={styles.bundleDeclineButtonText}>Decline All</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                // Single offer row (original render logic)
                const offer: PendingOffer = item.type === 'single' ? item.offer : item;
                return (
                  <TouchableOpacity
                    style={styles.offerRow}
                    onPress={() => {
                      if (offer.type === 'received' && offer.status === 'pending') {
                        navigation.navigate('ReviewOffer', { tradeId: offer.id });
                      } else {
                        navigation.navigate('TradeDetail', { tradeId: offer.id });
                      }
                    }}
                  >
                    <View style={styles.offerRowImageContainer}>
                      {Array.isArray(offer.listing?.images) && offer.listing.images.length > 0 ? (
                        <Image
                          source={{
                            uri: offer.listing.images[0].thumbnail_url || offer.listing.images[0].url,
                          }}
                          style={styles.offerRowImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.offerRowImagePlaceholder}>
                          <Text style={styles.offerRowImagePlaceholderText}>📦</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.offerDetails}>
                      <View style={styles.offerDetailsTop}>
                        <Text style={styles.offerTitle} numberOfLines={2}>
                          {offer.listing?.title || 'Untitled'}
                        </Text>
                      </View>
                      <View style={styles.offerDetailsBottom}>
                        <View
                          style={[
                            styles.offerTypeBadge,
                            offer.type === 'received'
                              ? styles.offerTypeBadgeReceived
                              : styles.offerTypeBadgeSubmitted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.offerTypeBadgeText,
                              offer.type === 'received'
                                ? styles.offerTypeBadgeTextReceived
                                : styles.offerTypeBadgeTextSubmitted,
                            ]}
                          >
                            {offer.type === 'received' ? 'Received' : 'Submitted'}
                          </Text>
                        </View>
                        <View style={styles.offerPriceContainer}>
                          <Text style={styles.offerPrice}>
                            ${(offer.cash_amount_cents / 100).toFixed(2)}
                          </Text>
                          {offer.sp_amount > 0 && (
                            <Text style={styles.offerSP}> + {offer.sp_amount} SP</Text>
                          )}
                        </View>
                      </View>
                      {offer.status === 'pending' && offer.offer_expires_at ? (
                        <OfferCountdownPill
                          offerExpiresAt={offer.offer_expires_at}
                          createdAt={offer.created_at}
                          style={styles.offerRowCountdownPill}
                        />
                      ) : null}
                    </View>
                    <View style={styles.offerStatusContainer}>
                      <View style={[styles.statusBadge, getStatusBadgeStyle(offer.status)]}>
                        <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(offer.status)]}>
                          {formatStatus(offer.status)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.listContent}
            />
          )
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <LoadingSpinner />
          </View>
        ) : trades.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {/* Addendum D: in_progress bundle section in buying tab */}
            {inProgressBundles.length > 0 && (
              <View style={styles.bundleSection} testID="inprogress-bundles">
                <Text style={styles.bundleSectionTitle}>Active Bundles</Text>
                {inProgressBundles.map(({ bundleId, trades: bundleTrades }) => (
                  <View key={bundleId} style={styles.inProgressBundleRow}>
                    <Text style={styles.bundleOfferTitle}>
                      Bundle · {bundleTrades.length} items
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('TradeTimeline', { tradeId: bundleTrades[0].id })
                      }
                    >
                      <Text style={styles.bundleBannerToggle}>View →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <FlatList
              data={trades}
              keyExtractor={(t) => t.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
      </View>
      <PersistentTabBar />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#5DBB8E',
  },
  tabText: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  content: { flex: 1 },
  offersSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  offersSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  offersSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  offersSectionSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  offersScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  offerCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8F5F0',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  offerImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F5',
  },
  offerImage: {
    width: '100%',
    height: '100%',
  },
  offerImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerImagePlaceholderText: {
    fontSize: 32,
  },
  offerCardContent: {
    padding: 12,
  },
  offerCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    minHeight: 36,
    lineHeight: 18,
  },
  offerCardAmount: {
    marginBottom: 12,
  },
  offerCountdownPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  offerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  offerCardPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  spBadgeSmall: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  spBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  offerCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#5DBB8E',
    borderRadius: 10,
    gap: 6,
  },
  offerCardActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  offerCountBadge: {
    backgroundColor: '#E85D75',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  offerCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mainListHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9F9F9',
    marginTop: 8,
  },
  mainListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // TFV2-015 seller ignoring offers banner
  ignoredOffersAlert: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF8C42',
    padding: 12,
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tradeThumbContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  tradeThumb: {
    width: '100%',
    height: '100%',
  },
  tradeThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeThumbPlaceholderText: {
    fontSize: 20,
  },
  tradeInfo: { flex: 1 },
  tradeTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  tradeDate: { color: '#6B6B6B', fontSize: 13 },
  tradeTaxLine: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  tradeStatusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgePending: { backgroundColor: '#FEF3C7' },
  statusBadgeTextPending: { color: '#D97706' },
  statusBadgeActive: { backgroundColor: '#E8F5F0' },
  statusBadgeTextActive: { color: '#5DBB8E' },
  statusBadgeCompleted: { backgroundColor: '#F0F0F0' },
  statusBadgeTextCompleted: { color: '#6B6B6B' },
  statusBadgeCancelled: { backgroundColor: '#FEE2E2' },
  statusBadgeTextCancelled: { color: '#E85D75' },
  statusBadgeDefault: { backgroundColor: '#F0F0F0' },
  statusBadgeTextDefault: { color: '#1A1A1A' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Addendum D: bundle styles
  bundleOfferRow: {
    backgroundColor: '#EEF9F4',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
  },
  bundleOfferTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  bundleOfferActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bundleAcceptButton: {
    flex: 1,
    backgroundColor: '#5DBB8E',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  bundleAcceptButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bundleReviewButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5DBB8E',
  },
  bundleReviewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  bundleDeclineButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E85D75',
  },
  bundleDeclineButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E85D75',
  },
  bundleSection: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  bundleSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5DBB8E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inProgressBundleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF9F4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  bundleBannerToggle: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  offerRowImageContainer: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  offerRowImage: {
    width: '100%',
    height: '100%',
  },
  offerRowImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  offerRowImagePlaceholderText: {
    fontSize: 28,
  },
  offerDetails: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 72,
  },
  offerDetailsTop: {
    marginBottom: 8,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  offerDetailsBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  offerTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  offerTypeBadgeReceived: {
    backgroundColor: '#E8F5F0',
  },
  offerTypeBadgeSubmitted: {
    backgroundColor: '#EFF6FF',
  },
  offerTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  offerTypeBadgeTextReceived: {
    color: '#5DBB8E',
  },
  offerTypeBadgeTextSubmitted: {
    color: '#3B82F6',
  },
  offerPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  offerSP: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  offerStatusContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  offerRowCountdownPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  // TFV2-015: Ignoring Offers Modal styles
  ignModalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  ignModalSheet: {
    backgroundColor:      '#fff',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    padding:              24,
    paddingBottom:        36,
  },
  ignModalTitle: {
    fontSize:     18,
    fontFamily:   'Inter-SemiBold',
    color:        '#111827',
    marginBottom: 8,
  },
  ignModalBody: {
    fontSize:     14,
    fontFamily:   'Inter-Regular',
    color:        '#6B7280',
    lineHeight:   22,
    marginBottom: 20,
  },
  ignModalBtnPrimary: {
    backgroundColor: '#5DBB8E',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    10,
  },
  ignModalBtnPrimaryText: {
    fontSize:   16,
    fontFamily: 'Inter-SemiBold',
    color:      '#fff',
  },
  ignModalBtnSecondary: {
    borderWidth:     1.5,
    borderColor:     '#5DBB8E',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    10,
  },
  ignModalBtnSecondaryText: {
    fontSize:   16,
    fontFamily: 'Inter-SemiBold',
    color:      '#5DBB8E',
  },
  ignModalBtnDismiss: {
    paddingVertical: 12,
    alignItems:      'center',
  },
  ignModalBtnDismissText: {
    fontSize:   15,
    fontFamily: 'Inter-Regular',
    color:      '#9CA3AF',
  },
});

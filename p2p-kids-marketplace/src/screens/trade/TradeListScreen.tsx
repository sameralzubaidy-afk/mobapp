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

import React, { useState, useCallback } from 'react';
import {
  useFocusEffect } from '@react-navigation/native'; import { View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import { Receipt, ArrowRight } from 'phosphor-react-native';
import { LoadingSpinner } from '@/components/ui';
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
  listing: {
    title: string;
    price: number;
    images: { url: string; thumbnail_url?: string }[];
  };
}

export default function TradeListScreen({ navigation }: any) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [allOffers, setAllOffers] = useState<PendingOffer[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'offers') {
        fetchAllOffers();
      } else {
        fetchTrades();
        fetchPendingOffers();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, activeTab])
  );

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
          status,
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `)
        .eq('seller_id', userId)
        .in('status', ['pending', 'payment_processing', 'cancelled'])
        .order('created_at', { ascending: false });

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
          status,
          listing:items(
            title,
            price,
            images:item_images(url, thumbnail_url)
          )
        `)
        .eq('buyer_id', userId)
        .in('status', ['pending', 'payment_processing', 'cancelled'])
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
          'id, status, created_at, buyer_id, seller_id, listing:items(title, price, images:item_images(id, url, thumbnail_url, display_order))'
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

      setTrades(filteredData);
    } catch (err) {
      console.warn('[TradeList] fetch error', err);
    } finally {
      setLoading(false);
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
              data={allOffers}
              keyExtractor={(offer) => offer.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.offerRow}
                  onPress={() => {
                    if (item.type === 'received' && item.status === 'pending') {
                      navigation.navigate('ReviewOffer', { tradeId: item.id });
                    } else {
                      navigation.navigate('TradeDetail', { tradeId: item.id });
                    }
                  }}
                >
                  <View style={styles.offerRowImageContainer}>
                    {Array.isArray(item.listing?.images) && item.listing.images.length > 0 ? (
                      <Image
                        source={{
                          uri: item.listing.images[0].thumbnail_url || item.listing.images[0].url,
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
                        {item.listing?.title || 'Untitled'}
                      </Text>
                    </View>
                    <View style={styles.offerDetailsBottom}>
                      <View
                        style={[
                          styles.offerTypeBadge,
                          item.type === 'received'
                            ? styles.offerTypeBadgeReceived
                            : styles.offerTypeBadgeSubmitted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.offerTypeBadgeText,
                            item.type === 'received'
                              ? styles.offerTypeBadgeTextReceived
                              : styles.offerTypeBadgeTextSubmitted,
                          ]}
                        >
                          {item.type === 'received' ? 'Received' : 'Submitted'}
                        </Text>
                      </View>
                      <View style={styles.offerPriceContainer}>
                        <Text style={styles.offerPrice}>
                          ${(item.cash_amount_cents / 100).toFixed(2)}
                        </Text>
                        {item.sp_amount > 0 && (
                          <Text style={styles.offerSP}> + {item.sp_amount} SP</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.offerStatusContainer}>
                    <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
                      <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(item.status)]}>
                        {formatStatus(item.status)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
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
          <FlatList
            data={trades}
            keyExtractor={(t) => t.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
      <BottomNavBar />
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
});

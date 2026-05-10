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
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
  Image,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import { Receipt, CaretLeft } from 'phosphor-react-native';

type TabType = 'all' | 'buying' | 'selling';

export default function TradeListScreen({ navigation }: any) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useFocusEffect(
    useCallback(() => {
      fetchTrades();
    }, [userId, activeTab])
  );

  const fetchTrades = async () => {
    if (!userId) {
      setTrades([]);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
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
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} testID="back-button">
          <CaretLeft size={24} color="#1A1A1A" weight="regular" />
        </Pressable>
        <Text style={styles.navTitle}>Trade History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5DBB8E" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
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
});

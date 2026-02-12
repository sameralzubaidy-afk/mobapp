/**
 * File: p2p-kids-marketplace/src/screens/home/CategoryBrowseScreen.tsx
 * MODULE-05-DISCOVERY-V2: Category Browsing with SP Filter
 * Task: DISCOVERY-V2-003
 * 
 * Screen for browsing items by category with SP-eligible filter toggle.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Image,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { fetchListingsByCategory } from '../../services/discovery';
import { CategoryResult } from '../../types/discovery';
import { trackEvent } from '../../services/analytics';
import Avatar from '../../components/atoms/Avatar';

type ParamList = {
  CategoryBrowse: {
    category: string;
  };
};

export default function CategoryBrowseScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ParamList, 'CategoryBrowse'>>();
  const { category } = route.params;

  const [listings, setListings] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spEligibleOnly, setSpEligibleOnly] = useState(false);

  useEffect(() => {
    loadListings();
  }, [category, spEligibleOnly]);

  const loadListings = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    try {
      const data = await fetchListingsByCategory(category, spEligibleOnly);
      setListings(data);
      
      trackEvent('view_category_results', {
        category,
        sp_eligible_only: spEligibleOnly,
        result_count: data.length,
      });
    } catch (error) {
      console.error('[CategoryBrowseScreen] Error loading listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadListings(true);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{category}</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.filterInfo}>
          <Text style={styles.filterLabel}>Show only SP-eligible</Text>
          <Text style={styles.filterSublabel}>Items you can buy with Swap Points</Text>
        </View>
        <Switch
          value={spEligibleOnly}
          onValueChange={setSpEligibleOnly}
          trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: CategoryResult }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => (navigation as any).navigate('ItemDetailScreen', { listing_id: item.id })}
    >
      <View style={styles.imagePlaceholder}>
        <Text style={styles.placeholderEmoji}>📦</Text>
        {item.seller && (
          <View style={styles.sellerAvatarOverlay}>
            <Avatar
              imageUrl={item.seller.avatar_url || undefined}
              name={item.seller.name}
              size={32}
              verificationStatus={item.seller.verification_status}
            />
          </View>
        )}
      </View>
      
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
        
        {item.accepts_swap_points && (
          <View style={styles.spBadge}>
            <Text style={styles.spBadgeText}>✓ SP Eligible</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No items found</Text>
      <Text style={styles.emptyText}>
        {spEligibleOnly 
          ? `There are no SP-eligible items in ${category} right now.`
          : `Be the first to list something in ${category}!`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
  },
  filterInfo: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  filterSublabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  itemCard: {
    flex: 0.48,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: '#e5e7eb',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  sellerAvatarOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 2,
  },
  itemDetails: {
    padding: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    height: 40,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  spBadge: {
    marginTop: 6,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  spBadgeText: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

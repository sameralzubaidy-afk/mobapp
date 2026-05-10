/**
 * File: p2p-kids-marketplace/src/screens/home/CategoryBrowseScreen.tsx
 * MODULE-15.1-UI-REDESIGN: Category Browse Screen
 * Task: FLOW-06 Discovery & Search - Category Browsing
 *
 * Screen for browsing items by category.
 * Redesigned with Phosphor icons and Whisk design system.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { fetchListingsByCategory } from '../../services/discovery';
import { CategoryResult } from '../../types/discovery';
import { trackEvent } from '../../services/analytics';
import { ItemCard } from '../../components/molecules';
import BottomNavBar from '../../components/organisms/BottomNavBar';
import {
  TShirt,
  Sneaker,
  Backpack,
  GameController,
  BookOpen,
  CaretLeft,
} from 'phosphor-react-native';

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

  // Map category name to Phosphor icon
  const getCategoryIcon = () => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('cloth') || categoryLower.includes('apparel')) {
      return <TShirt size={32} color="#5DBB8E" weight="regular" />;
    }
    if (categoryLower.includes('shoe') || categoryLower.includes('sneaker')) {
      return <Sneaker size={32} color="#5DBB8E" weight="regular" />;
    }
    if (categoryLower.includes('book')) {
      return <BookOpen size={32} color="#5DBB8E" weight="regular" />;
    }
    if (categoryLower.includes('game') || categoryLower.includes('toy')) {
      return <GameController size={32} color="#5DBB8E" weight="regular" />;
    }
    // Default icon
    return <Backpack size={32} color="#5DBB8E" weight="regular" />;
  };

  useEffect(() => {
    loadListings();
  }, [category]);

  const loadListings = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    try {
      const data = await fetchListingsByCategory(category, false);
      setListings(data);

      trackEvent('view_category_results', {
        category,
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
    <View style={styles.header} testID="category-browse-header">
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
          testID="category-back-button"
        >
          <CaretLeft size={24} color="#1A1A1A" weight="regular" />
        </Pressable>
        <View style={styles.categoryHeader}>
          <View testID="category-icon">{getCategoryIcon()}</View>
          <Text style={styles.title}>{category}</Text>
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: CategoryResult }) => {
    const mainImageUrl = item.images && item.images.length > 0 ? item.images[0].url : null;

    return (
      <ItemCard
        id={item.id}
        title={item.title}
        price={Number(item.price)}
        imageUrl={mainImageUrl}
        isFavorite={false}
        acceptsSwapPoints={item.accepts_swap_points}
        onPress={() => (navigation as any).navigate('ListingDetail', { listing_id: item.id })}
        onFavoritePress={() => {
          console.log('[CategoryBrowseScreen] Favorite toggled:', item.id);
        }}
        onSharePress={() => {
          console.log('[CategoryBrowseScreen] Share pressed:', item.id);
        }}
        testID={`category-item-${item.id}`}
      />
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No items found</Text>
      <Text style={styles.emptyText}>
        Be the first to list something in {category}!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5DBB8E" />
        </View>
      ) : (
        <FlatList
          testID="category-browse-list"
          data={listings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5DBB8E" />
          }
        />
      )}
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

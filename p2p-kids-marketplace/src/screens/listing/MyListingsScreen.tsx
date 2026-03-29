/**
 * File: p2p-kids-marketplace/src/screens/listing/MyListingsScreen.tsx
 * MODULE-04 LISTING-V2-003: My listings with edit/delete actions
 * 
 * Features:
 * - List all user's listings (active, sold, pending)
 * - Summary stats (total active, total sold, total earnings)
 * - Edit and delete actions per listing
 * - SP Eligible badge on listings that accept SP
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { getMyListings, getListingSummary, deleteListing } from '../../services/listing';
import { Listing, ListingSummary } from '../../types/listing';
import BottomNavBar from '../../components/organisms/BottomNavBar';

export default function MyListingsScreen({ navigation }: any) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<ListingSummary | null>(null);

  const loadListings = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const [listingsData, summaryData] = await Promise.all([
        getMyListings(session.user.id),
        getListingSummary(session.user.id),
      ]);
      setListings(listingsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('[MyListings] loadListings error:', error);
      Alert.alert('Error', 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Reload listings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadListings();
    setRefreshing(false);
  };

  const handleEditListing = (listing: Listing) => {
    navigation.navigate('EditListing', { listing_id: listing.id });
  };

  const handleDeleteListing = (listing: Listing) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${listing.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!session?.user?.id) return;
              await deleteListing(listing.id, session.user.id);
              Alert.alert('Success', 'Listing deleted successfully');
              loadListings(); // Reload listings
            } catch (error: any) {
              console.error('[MyListings] handleDeleteListing error:', error);
              Alert.alert('Error', error.message || 'Failed to delete listing');
            }
          },
        },
      ]
    );
  };

  const handleOpenListing = (listing: Listing) => {
    if (listing.status === 'flagged' || listing.status === 'rejected') {
      navigation.navigate('ListingSafetyReview', { listing_id: listing.id });
      return;
    }

    navigation.navigate('ListingDetail', { listing_id: listing.id });
  };

  const renderListingItem = ({ item }: { item: Listing }) => {
    const isActive = item.status === 'available';
    const isSold = item.status === 'sold';
    const firstImage = item.images && item.images.length > 0 ? item.images[0] : null;
    const firstImageUrl = firstImage
      ? firstImage.thumbnail_url || firstImage.url
      : null;

    return (
      <View style={styles.listingCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenListing(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}`}
        >
        <View style={styles.listingImageContainer}>
          {firstImageUrl ? (
            <Image source={{ uri: firstImageUrl }} style={styles.listingImage} resizeMode="cover" />
          ) : (
            <View style={styles.listingImagePlaceholder}>
              <Text style={styles.listingImagePlaceholderText}>📷 No Image</Text>
            </View>
          )}
        </View>

        <View style={styles.listingHeader}>
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle}>{item.title}</Text>
            <Text style={styles.listingPrice}>${item.price.toFixed(2)}</Text>
            {item.accepts_swap_points && (
              <View style={styles.spBadge}>
                <Text style={styles.spBadgeText}>✓ SP Eligible</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, isSold && styles.statusBadgeSold, !isActive && !isSold && styles.statusBadgeOther]}>
            <Text style={[styles.statusText, isSold && styles.statusTextSold, !isActive && !isSold && styles.statusTextOther]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.listingDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.listingMeta}>
          <Text style={styles.metaText}>Condition: {item.condition || 'N/A'}</Text>
          <Text style={styles.metaText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        </TouchableOpacity>

        {isActive && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButtonEdit}
              onPress={() => handleEditListing(item)}
            >
              <Text style={styles.actionButtonTextEdit}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButtonDelete}
              onPress={() => handleDeleteListing(item)}
            >
              <Text style={styles.actionButtonTextDelete}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your listings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
    <View style={styles.container}>
      {/* Summary Header */}
      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.total_active}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.total_sold}</Text>
            <Text style={styles.summaryLabel}>Sold</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${summary.total_earnings_dollars.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
          </View>
        </View>
      )}

      {/* Listings List */}
      {listings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No listings yet</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateListing')}
          >
            <Text style={styles.createButtonText}>Create Your First Listing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Floating Create Button */}
      {listings.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateListing')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Unified Navigation Bar */}
      <BottomNavBar />
    </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
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
    color: '#007AFF',
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
  listContent: {
    padding: 16,
  },
  listingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listingImageContainer: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  listingImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingImagePlaceholderText: {
    color: '#8c8c8c',
    fontSize: 12,
    fontWeight: '600',
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  spBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    marginTop: 4,
  },
  spBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
  },
  statusBadgeSold: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeOther: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  statusTextSold: {
    color: '#E65100',
  },
  statusTextOther: {
    color: '#666',
  },
  listingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonEdit: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  actionButtonTextEdit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonDelete: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#fff',
  },
  actionButtonTextDelete: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  // Quick Links
  quickLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  quickLink: {
    alignItems: 'center',
  },
  quickLinkEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickLinkLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
  },
});

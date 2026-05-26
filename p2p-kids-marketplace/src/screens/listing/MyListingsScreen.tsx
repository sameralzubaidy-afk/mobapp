/**
 * File: p2p-kids-marketplace/src/screens/listing/MyListingsScreen.tsx
 * MODULE-04 LISTING-V2-003: My listings with edit/delete actions
 * MODULE-04 LISTING-V3-007: Added Drafts tab + FAB bottom sheet
 *
 * Features:
 * - List all user's listings (active, sold, pending)
 * - Summary stats (total active, total sold, total earnings)
 * - Edit and delete actions per listing
 * - SP Eligible badge on listings that accept SP
 * - Drafts tab with swipe-to-discard
 * - FAB bottom sheet (List One Item / Bulk Upload)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DotsThree, PencilSimple, Storefront, Trash, Receipt } from 'phosphor-react-native';
import { useAuth } from '../../hooks/useAuth';
import { getMyListings, getListingSummary, deleteListing } from '../../services/listing';
import { getActiveDrafts, deleteDraft } from '../../services/draftService';
import { Listing, ListingSummary, ItemDraft } from '../../types/listing';
import { ListingImage } from '../../components/atoms';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

type StatusFilter = 'all' | 'pending' | 'needs_edits' | 'rejected' | 'available' | 'sold';
type TabType = 'listings' | 'drafts';

export default function MyListingsScreen({ navigation }: any) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [summary, setSummary] = useState<ListingSummary | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [selectedTab, setSelectedTab] = useState<TabType>('listings');
  const [isFABSheetVisible, setIsFABSheetVisible] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalTitle, setSuccessModalTitle] = useState('Success');
  const [successModalMessage, setSuccessModalMessage] = useState('Action completed successfully.');

  const loadListings = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const [listingsData, summaryData, draftsData] = await Promise.all([
        getMyListings(session.user.id),
        getListingSummary(session.user.id),
        getActiveDrafts(session.user.id),
      ]);
      setListings(listingsData);
      setSummary(summaryData);
      setDrafts(draftsData);
    } catch (error) {
      console.error('[MyListings] loadListings error:', error);
      Alert.alert('Error', 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Compute filtered listings based on selected status
  const filteredListings = useMemo(() => {
    if (selectedStatus === 'all') {
      return listings;
    }
    return listings.filter((listing) => listing.status === selectedStatus);
  }, [listings, selectedStatus]);

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
              setSuccessModalTitle('Listing Deleted');
              setSuccessModalMessage('Your listing was deleted successfully.');
              setShowSuccessModal(true);
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
    if (
      listing.status === 'flagged' ||
      listing.status === 'rejected' ||
      listing.status === 'needs_edits'
    ) {
      navigation.navigate('ListingSafetyReview', { listing_id: listing.id });
      return;
    }

    navigation.navigate('ListingDetail', { listing_id: listing.id });
  };

  const handleResumeDraft = (draft: ItemDraft) => {
    if (draft.bulk_upload_id) {
      navigation.navigate('BulkListingCreate', { draftId: draft.id });
    } else {
      navigation.navigate('ItemCreate', { draftId: draft.id });
    }
  };

  const handleDiscardDraft = (draft: ItemDraft) => {
    Alert.alert(
      'Discard Draft',
      'Are you sure you want to discard this draft? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(draft.id);
              setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
            } catch (error) {
              console.error('[MyListings] handleDiscardDraft error:', error);
              Alert.alert('Error', 'Failed to discard draft');
            }
          },
        },
      ]
    );
  };

  const handleFABPress = () => {
    setIsFABSheetVisible(true);
  };

  const handleCreateSingle = () => {
    setIsFABSheetVisible(false);
    navigation.navigate('ItemCreate');
  };

  const handleCreateBulk = () => {
    setIsFABSheetVisible(false);
    navigation.navigate('BulkListingCreate');
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusStyles = (status: Listing['status']) => {
    if (status === 'available') {
      return {
        badge: styles.statusBadgeActive,
        text: styles.statusTextActive,
        label: 'ACTIVE',
      };
    }

    if (status === 'sold') {
      return {
        badge: styles.statusBadgeSold,
        text: styles.statusTextSold,
        label: 'SOLD',
      };
    }

    if (status === 'pending') {
      return {
        badge: styles.statusBadgePending,
        text: styles.statusTextPending,
        label: 'PENDING',
      };
    }

    return {
      badge: styles.statusBadgeDefault,
      text: styles.statusTextDefault,
      label: status.toUpperCase(),
    };
  };

  const renderListingItem = ({ item }: { item: Listing }) => {
    const isActive = item.status === 'available';
    const firstImage = item.images && item.images.length > 0 ? item.images[0] : null;
    const firstImageUrl = firstImage ? firstImage.thumbnail_url || firstImage.url : null;
    const statusStyles = getStatusStyles(item.status);

    return (
      <View style={styles.listingCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenListing(item)}
          style={styles.listingRow}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}`}
        >
          <View style={styles.listingImageContainer}>
            <ListingImage
              url={firstImageUrl}
              containerStyle={styles.listingImage}
              imageStyle={styles.listingImage}
            />
          </View>

          <View style={styles.listingMainContent}>
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle}>{item.title}</Text>
              <Text style={styles.listingPrice}>${item.price.toFixed(2)}</Text>
              <Text style={styles.listingDateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            <View style={[styles.statusBadge, statusStyles.badge]}>
              <Text style={[styles.statusText, statusStyles.text]}>{statusStyles.label}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {item.description && (
          <Text style={styles.listingDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {item.accepts_swap_points && (
          <View style={styles.spBadge}>
            <Text style={styles.spBadgeText}>SP Eligible</Text>
          </View>
        )}

        {isActive && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconActionButton} onPress={() => handleEditListing(item)}>
              <PencilSimple size={20} color="#6B6B6B" weight="regular" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconActionButton} onPress={() => handleDeleteListing(item)}>
              <Trash size={20} color="#6B6B6B" weight="regular" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconActionButton} onPress={() => handleOpenListing(item)}>
              <DotsThree size={20} color="#6B6B6B" weight="regular" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderDraftItem = ({ item }: { item: ItemDraft }) => {
    const draftData = item.draft_data as any;
    const title = draftData?.title || 'Untitled Draft';
    const photoCount = item.photo_urls?.length || 0;
    const isBulk = !!item.bulk_upload_id;
    const timeAgo = getTimeAgo(item.updated_at || item.created_at);

    return (
      <View style={styles.draftCard} testID={`draft-card-${item.id}`}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleResumeDraft(item)}
          style={styles.draftContent}
          testID={`draft-resume-button-${item.id}`}
        >
          <View style={styles.draftInfo}>
            <Text style={styles.draftTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.draftMeta}>
              {isBulk ? '📦 Bulk Upload' : '📝 Single Item'} • {photoCount} photo
              {photoCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.draftTime}>{timeAgo}</Text>
          </View>

          <View style={styles.draftActions}>
            <TouchableOpacity
              style={styles.resumeButton}
              onPress={() => handleResumeDraft(item)}
              testID={`draft-resume-${item.id}`}
            >
              <Text style={styles.resumeButtonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.discardButton}
              onPress={() => handleDiscardDraft(item)}
              testID={`draft-discard-${item.id}`}
            >
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Guard skipped during pull-to-refresh to prevent blank screen flash.
  if (loading && !refreshing) {
    return (
      <ScreenLayout variant="detail" title="My Listings">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading your listings...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="My Listings">
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <View style={styles.container}>
          <View style={styles.screenHeader}>
            <View style={styles.screenHeaderLeft}>
              <Storefront size={24} color="#5DBB8E" weight="regular" />
              <Text style={styles.screenHeaderTitle}>My Listings</Text>
            </View>
            <TouchableOpacity
              style={styles.myTradeButton}
              onPress={() => navigation.navigate('TradeList')}
              accessibilityLabel="View My Trade"
            >
              <Receipt size={22} color="#FFFFFF" weight="fill" />
              <Text style={styles.myTradeButtonText}>My Trade</Text>
            </TouchableOpacity>
          </View>

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
                <Text style={styles.summaryValue}>
                  ${summary.total_earnings_dollars.toFixed(2)}
                </Text>
                <Text style={styles.summaryLabel}>Total Earnings</Text>
              </View>
            </View>
          )}

          {/* Tab Switcher - LISTING-V3-007 */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'listings' && styles.tabActive]}
              onPress={() => setSelectedTab('listings')}
              testID="tab-listings"
            >
              <Text style={[styles.tabText, selectedTab === 'listings' && styles.tabTextActive]}>
                Listings ({listings.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'drafts' && styles.tabActive]}
              onPress={() => setSelectedTab('drafts')}
              testID="tab-drafts"
            >
              <Text style={[styles.tabText, selectedTab === 'drafts' && styles.tabTextActive]}>
                Drafts ({drafts.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Listings Tab Content */}
          {selectedTab === 'listings' && (
            <>
              {/* Status Filter */}
              <View style={styles.filterWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterContainer}
                  contentContainerStyle={styles.filterContentContainer}
                >
                  {(
                    [
                      'all',
                      'available',
                      'pending',
                      'needs_edits',
                      'rejected',
                      'sold',
                    ] as StatusFilter[]
                  ).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterButton,
                        selectedStatus === status && styles.filterButtonActive,
                      ]}
                      onPress={() => setSelectedStatus(status)}
                      testID={`filter-${status}`}
                    >
                      <Text
                        style={[
                          styles.filterButtonText,
                          selectedStatus === status && styles.filterButtonTextActive,
                        ]}
                      >
                        {status === 'all'
                          ? 'All'
                          : status === 'needs_edits'
                            ? 'Needs Edits'
                            : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Listings List */}
              {filteredListings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Storefront size={64} color="#E0E0E0" weight="regular" />
                  <Text style={styles.emptyText}>
                    {listings.length === 0 ? 'No listings yet' : 'No listings with this status'}
                  </Text>
                  {listings.length === 0 && (
                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={() => navigation.navigate('ItemCreate')}
                      testID="create-first-listing-button"
                    >
                      <Text style={styles.createButtonText}>Create Listing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <FlatList
                  data={filteredListings}
                  keyExtractor={(item) => item.id}
                  renderItem={renderListingItem}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                  }
                  testID="listings-flatlist"
                />
              )}
            </>
          )}

          {/* Drafts Tab Content - LISTING-V3-007 */}
          {selectedTab === 'drafts' && (
            <>
              {drafts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No drafts yet</Text>
                  <Text style={styles.emptySubtext}>
                    Start creating a listing and it will be saved here automatically
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={drafts}
                  keyExtractor={(item) => item.id}
                  renderItem={renderDraftItem}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                  }
                  testID="drafts-flatlist"
                />
              )}
            </>
          )}

          {/* LISTING-V3-007: FAB with Bottom Sheet */}
          <TouchableOpacity style={styles.fab} onPress={handleFABPress} testID="fab-button">
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>

          {/* LISTING-V3-007: FAB Bottom Sheet Modal */}
          <Modal
            visible={isFABSheetVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setIsFABSheetVisible(false)}
            testID="fab-bottom-sheet-modal"
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setIsFABSheetVisible(false)}
              testID="modal-overlay"
            >
              <View style={styles.bottomSheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Create New Listing</Text>

                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleCreateSingle}
                  testID="sheet-option-single"
                >
                  <Text style={styles.sheetOptionIcon}>📝</Text>
                  <View style={styles.sheetOptionContent}>
                    <Text style={styles.sheetOptionTitle}>List One Item</Text>
                    <Text style={styles.sheetOptionDescription}>
                      Create a single listing with photos and details
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleCreateBulk}
                  testID="sheet-option-bulk"
                >
                  <Text style={styles.sheetOptionIcon}>📦</Text>
                  <View style={styles.sheetOptionContent}>
                    <Text style={styles.sheetOptionTitle}>Bulk Upload</Text>
                    <Text style={styles.sheetOptionDescription}>
                      Upload multiple items at once with AI assistance
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetCancel}
                  onPress={() => setIsFABSheetVisible(false)}
                  testID="sheet-cancel"
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          <Modal
            visible={showSuccessModal}
            transparent
            animationType="fade"
            onRequestClose={handleSuccessModalClose}
          >
            <View style={styles.successModalBackdrop}>
              <View style={styles.successModalCard}>
                <View style={styles.successIconBadge}>
                  <Text style={styles.successIconText}>✓</Text>
                </View>
                <Text style={styles.successModalTitle}>{successModalTitle}</Text>
                <Text style={styles.successModalMessage}>{successModalMessage}</Text>

                <TouchableOpacity
                  style={styles.successModalButton}
                  onPress={handleSuccessModalClose}
                  testID="my-listings-success-ok"
                >
                  <Text style={styles.successModalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Unified Navigation Bar */}
          <PersistentTabBar />
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  screenHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenHeaderTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  myTradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#5DBB8E',
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  myTradeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
  listContent: {
    padding: 16,
  },
  listingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listingImageContainer: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginRight: 12,
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
  listingMainContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listingInfo: {
    flex: 1,
    paddingRight: 8,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    lineHeight: 20,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  listingDateText: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  spBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginTop: 4,
  },
  spBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D97706',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#E8F5F0',
  },
  statusBadgeSold: {
    backgroundColor: '#F5F5F5',
  },
  statusBadgeExpired: {
    backgroundColor: '#FEF9C3',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeDefault: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#5DBB8E',
  },
  statusTextSold: {
    color: '#6B6B6B',
  },
  statusTextExpired: {
    color: '#CA8A04',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextDefault: {
    color: '#666',
  },
  listingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
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
    marginTop: 8,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B6B6B',
    marginTop: 16,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 26,
    minHeight: 52,
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  // Status Filter Styles
  filterWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  filterContainer: {
    flexGrow: 0,
  },
  filterContentContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
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
  // LISTING-V3-007: Tab Switcher Styles
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
    color: '#5DBB8E',
    fontWeight: '600',
  },
  // LISTING-V3-007: Draft Card Styles
  draftCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  draftContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  draftInfo: {
    flex: 1,
    marginRight: 12,
  },
  draftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  draftMeta: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 4,
  },
  draftTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  draftActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resumeButton: {
    minWidth: 104,
    minHeight: 44,
    backgroundColor: '#5DBB8E',
    borderRadius: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  discardButton: {
    borderWidth: 1,
    borderColor: '#6B6B6B',
    minWidth: 104,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  discardButtonText: {
    color: '#6B6B6B',
    fontSize: 15,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  // LISTING-V3-007: Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sheetOptionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  sheetOptionContent: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sheetOptionDescription: {
    fontSize: 14,
    color: '#666',
  },
  sheetCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  successModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  successIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successIconText: {
    fontSize: 28,
    color: '#14805E',
    fontWeight: '700',
  },
  successModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  successModalMessage: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 18,
    lineHeight: 24,
    color: '#4B5563',
    textAlign: 'center',
  },
  successModalButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

/**
 * File: p2p-kids-marketplace/src/screens/home/ItemDetailScreen.tsx
 * MODULE-04 LISTING-V2-005: Listing Detail View with SP Context
 * Enhanced with TASK-ITEM-DETAILS-001: Seller Masking & Contact Flow
 * 
 * Features:
 * - Full item details (name, description, price, images, condition)
 * - SP payment eligibility display
 * - Buyer's subscription context: show fee disclosure ($2.99 vs $0.99)
 * - "Buy Now" button navigates to trade initiation (MODULE-06)
 * - Seller info masking: only show seller name if active trade exists
 * - Show seller rating regardless of trade status
 * - Contact seller button navigates to messaging (MODULE-07)
 * - Proper error handling and loading states
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUserStore } from '@/stores/userStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { getListingById } from '@/services/listing';
import { getSubscriptionSummary } from '@/services/subscription';
import { hasActiveTradeBetween, getSellerRating } from '@/services/trade';
import { Listing } from '@/types/listing';
import { trackEvent } from '@/services/analytics';
import { RootStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import StarRating from '@/components/molecules/StarRating';
import Avatar from '@/components/atoms/Avatar';
import { idBadgeService } from '@/services/idBadge';

type ItemDetailScreenRouteProp = RouteProp<RootStackParamList, 'ListingDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SellerRatingInfo {
  averageRating: number | null;
  totalReviews: number;
  ratingBreakdown?: Record<number, number>;
}

export default function ItemDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { listing_id } = route.params;
  const { user: storeUser } = useUserStore();
  const { session } = useAuth();
  const user = session?.user || storeUser;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Buyer subscription context (MODULE-11 dependency)
  const [buyerCanSpendSP, setBuyerCanSpendSP] = useState(false);
  const [buyerIsSubscriber, setBuyerIsSubscriber] = useState(false);
  const [buyerSubLoading, setBuyerSubLoading] = useState(true);

  // Seller info masking (TASK-ITEM-DETAILS-001)
  const [hasActiveTrade, setHasActiveTrade] = useState(false);
  const [sellerRating, setSellerRating] = useState<SellerRatingInfo | null>(null);
  const [sellerVerificationStatus, setSellerVerificationStatus] = useState<string | null>(null);
  const [loadingSellerInfo, setLoadingSellerInfo] = useState(false);

  useEffect(() => {
    loadListing();
    loadBuyerSubscription();
  }, [listing_id]);

  // Load trade status and seller rating when listing/user changes
  useEffect(() => {
    if (listing && user?.id) {
      loadTradeStatusAndRating();
    }
  }, [listing, user?.id]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [listing?.id]);

  const loadTradeStatusAndRating = async () => {
    try {
      if (!listing || !user?.id) return;

      setLoadingSellerInfo(true);

      // Check for active trade
      const hasActive = await hasActiveTradeBetween(user.id, listing.seller_id);
      setHasActiveTrade(hasActive);

      // Get seller rating (always shown)
      const rating = await getSellerRating(listing.seller_id);
      setSellerRating(rating);

      // Get seller verification status
      const vStatus = await idBadgeService.getVerificationStatus(listing.seller_id);
      setSellerVerificationStatus(vStatus?.status || null);
    } catch (err) {
      console.error('[ItemDetailScreen] Error loading trade status/rating:', err);
    } finally {
      setLoadingSellerInfo(false);
    }
  };

  const loadListing = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[ItemDetailScreen] 🔄 Loading listing:', listing_id);
      const data = await getListingById(listing_id);

      if (!data) {
        console.error('[ItemDetailScreen] ❌ Listing fetch returned null');
        setError('Listing not found');
        setListing(null);
        return;
      }

      console.log('[ItemDetailScreen] ✅ Listing loaded:', {
        id: data.id,
        title: data.title,
        hasSeller: !!data.seller,
        sellerName: data.seller?.name,
        hasCategory: !!data.category,
        categoryName: data.category?.name,
        price: data.price,
      });

      setListing(data);

      // Track analytics event
      await trackEvent('listing_viewed', {
        listing_id: data.id,
        seller_id: data.seller_id,
        price: data.price,
        accepts_swap_points: data.accepts_swap_points,
      });
    } catch (err) {
      console.error('[ItemDetailScreen] ❌ Fatal error loading listing:', err);
      setError('Failed to load listing');
    } finally {
      setLoading(false);
    }
  };

  const loadBuyerSubscription = async () => {
    try {
      // If we have a session, use the subscription data from it directly
      if (session) {
        console.log('[ItemDetailScreen] 📊 Using session subscription data:', {
          status: session.subscription_status,
          can_spend_sp: session.can_spend_sp
        });
        setBuyerIsSubscriber(session.subscription_status === 'trial' || session.subscription_status === 'active');
        setBuyerCanSpendSP(session.can_spend_sp);
        setBuyerSubLoading(false);
        return;
      }

      if (!user?.id) {
        console.log('[ItemDetailScreen] 📊 No user, defaulting to free');
        setBuyerIsSubscriber(false);
        setBuyerCanSpendSP(false);
        return;
      }

      console.log('[ItemDetailScreen] 🔄 Loading buyer subscription for:', user.id);
      const sub = await getSubscriptionSummary(user.id);
      console.log('[ItemDetailScreen] ✅ Buyer subscription loaded:', {
        user_id: user.id,
        is_subscriber: sub.is_subscriber,
        can_spend_sp: sub.can_spend_sp,
        status: sub.status,
      });

      const fee = sub.is_subscriber ? 0.99 : 2.99;
      console.log('[ItemDetailScreen] 💰 Fee calculated:', { is_subscriber: sub.is_subscriber, fee_dollars: fee });

      setBuyerIsSubscriber(sub.is_subscriber);
      setBuyerCanSpendSP(sub.can_spend_sp);
    } catch (err) {
      console.error('[ItemDetailScreen] ❌ Error loading buyer subscription:', err);
      setBuyerIsSubscriber(false);
      setBuyerCanSpendSP(false);
    } finally {
      setBuyerSubLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (!user?.id) {
      Alert.alert('Login Required', 'Please login to purchase items.');
      return;
    }

    if (!listing?.id) {
      Alert.alert('Error', 'This listing is unavailable right now. Please try again.');
      return;
    }

    try {
      // Navigate to trade initiation screen (MODULE-06)
      navigation.navigate('TradeInitiation', { itemId: String(listing.id) });
    } catch (err) {
      console.error('[ItemDetailScreen] Failed to navigate to TradeInitiation:', err);
      Alert.alert('Error', 'Unable to open checkout right now. Please try again.');
    }
  };

  const handleContactSeller = () => {
    if (!user?.id) {
      Alert.alert('Login Required', 'Please login to contact the seller.');
      return;
    }

    if (!listing) return;

    // Check if there's an active trade (TASK-ITEM-DETAILS-001)
    if (!hasActiveTrade) {
      Alert.alert(
        'Start a Trade First',
        'You must have an active trade with this seller to contact them via messaging. Click "Buy Now" to start a trade.'
      );
      return;
    }

    // Find the active trade and navigate to chat
    const fetchTradeAndNavigate = async () => {
      try {
        const { data, error } = await supabase
          .from('trades')
          .select('id')
          .eq('buyer_id', user.id)
          .eq('seller_id', listing.seller_id)
          .in('status', ['pending', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          Alert.alert('Error', 'Could not find active trade. Please try again.');
          return;
        }

        // Navigate to chat with trade ID (MODULE-07)
        navigation.navigate('Chat', { tradeId: data.id });
      } catch (err) {
        console.error('[ItemDetailScreen] Error finding trade:', err);
        Alert.alert('Error', 'Failed to open messaging. Please try again.');
      }
    };

    fetchTradeAndNavigate();
  };

  const handleViewSellerProfile = () => {
    if (!user?.id) {
      Alert.alert('Login Required', 'Please login to view seller profiles.');
      return;
    }

    if (!listing) return;

    // Same logic as contact seller: only show profile if active trade
    if (!hasActiveTrade) {
      Alert.alert(
        'Start a Trade First',
        'You can only view full seller profiles if you have an active trade with them.'
      );
      return;
    }

    // Navigate to seller profile
    navigation.navigate('Profile', { userId: listing.seller_id });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading item...</Text>
          </View>
          <BottomNavBar />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>❌ {error || 'Listing not found'}</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Go Back</Text>
            </TouchableOpacity>
          </View>
          <BottomNavBar />
        </View>
      </SafeAreaView>
    );
  }

  // V2: Fee disclosure based on buyer subscription status
  const platformFee = buyerIsSubscriber ? 0.99 : 2.99;
  const totalPrice = listing.price + platformFee;

  console.log('[ItemDetailScreen] 💰 Fee calculation:', {
    buyerIsSubscriber,
    platformFee,
    itemPrice: listing.price,
    totalPrice,
  });

  // Determine seller name display (TASK-ITEM-DETAILS-001)
  const shouldShowSellerName = hasActiveTrade;
  const sellerDisplayName = shouldShowSellerName 
    ? (listing.seller?.name || 'Seller')
    : '🔒 Seller Info Hidden';
  const listingImages = [...(listing.images ?? [])].sort((a, b) => a.display_order - b.display_order);
  const activeImage = listingImages[activeImageIndex] ?? listingImages[0] ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView>
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Item Details</Text>
            <View style={{ width: 60 }} />
          </View>

          {activeImage ? (
            <View style={styles.imageGallery}>
              <Image source={{ uri: activeImage.url }} style={styles.mainImage} />
              <View style={styles.imageCountBadge}>
                <Text style={styles.imageCountBadgeText}>{`${activeImageIndex + 1}/${listingImages.length}`}</Text>
              </View>

              {listingImages.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsContainer}>
                  {listingImages.map((image, index) => (
                    <TouchableOpacity
                      key={image.id}
                      style={[
                        styles.thumbnailButton,
                        activeImageIndex === index && styles.thumbnailButtonActive,
                      ]}
                      onPress={() => setActiveImageIndex(index)}
                    >
                      <Image
                        source={{ uri: image.thumbnail_url || image.url }}
                        style={styles.thumbnailImage}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>📷 No Image</Text>
              <Text style={styles.imagePlaceholderSubtext}>No listing photos available</Text>
            </View>
          )}

          {/* Item Info Section */}
          <View style={styles.section}>
            {/* Title */}
            <Text style={styles.itemTitle}>{listing.title}</Text>

            {/* Price & Badges */}
            <View style={styles.priceRow}>
              <Text style={styles.itemPrice}>${listing.price.toFixed(2)}</Text>

              {/* MODULE-04 LISTING-V2-005: SP Eligibility Badge */}
              {listing.accepts_swap_points && (
                <View style={styles.spBadge}>
                  <Text style={styles.spBadgeText}>⚡ Swap Points Accepted</Text>
                </View>
              )}
            </View>

            {/* Condition */}
            {listing.condition && (
              <View style={styles.conditionRow}>
                <Text style={styles.conditionLabel}>Condition:</Text>
                <Text style={styles.conditionValue}>
                  {listing.condition.charAt(0).toUpperCase() + listing.condition.slice(1).replace('_', ' ')}
                </Text>
              </View>
            )}

            {/* Category */}
            {listing.category && (
              <View style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>Category:</Text>
                <Text style={styles.categoryValue}>
                  {listing.category.icon} {listing.category.name}
                </Text>
              </View>
            )}

            {/* Description */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>
                {listing.description || 'No description provided.'}
              </Text>
            </View>
          </View>

          {/* MODULE-04 LISTING-V2-005: SP Context for Buyer */}
          {listing.accepts_swap_points && !buyerSubLoading && (
            <View style={styles.section}>
              <View style={styles.spContextCard}>
                <Text style={styles.spContextTitle}>💫 Swap Points Eligible</Text>
                {buyerCanSpendSP ? (
                  <Text style={styles.spContextMessage}>
                    You can use your Swap Points as partial payment for this item!
                  </Text>
                ) : (
                  <>
                    <Text style={styles.spContextMessage}>
                      Subscribe to Kids Club+ to use Swap Points on this item.
                    </Text>
                    <TouchableOpacity
                      style={styles.upgradeButton}
                      onPress={() => navigation.navigate('SubscriptionChoice')}
                    >
                      <Text style={styles.upgradeButtonText}>Upgrade to Kids Club+</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}

          {/* MODULE-04 LISTING-V2-005: Fee Disclosure */}
          <View style={styles.section}>
            <View style={styles.feeCard}>
              <Text style={styles.feeCardTitle}>💰 Price Breakdown</Text>
              
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Item Price</Text>
                <Text style={styles.feeValue}>${listing.price.toFixed(2)}</Text>
              </View>

              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>
                  Transaction Fee {buyerIsSubscriber ? '(Subscriber Rate)' : '(Non-Subscriber)'}
                </Text>
                <Text style={[styles.feeValue, buyerIsSubscriber && styles.feeValueSubscriber]}>
                  ${platformFee.toFixed(2)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.feeRow}>
                <Text style={styles.feeTotalLabel}>Total (before SP discount)</Text>
                <Text style={styles.feeTotalValue}>${totalPrice.toFixed(2)}</Text>
              </View>

              {!buyerIsSubscriber && (
                <View style={styles.savingsNote}>
                  <Text style={styles.savingsNoteText}>
                    💡 Save $2.00 on fees! Subscribe to Kids Club+ and pay only $0.99 per transaction.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Seller Info Section (TASK-ITEM-DETAILS-001: Masking & Ratings) */}
          {listing.seller && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>👤 Seller Info</Text>
                {(sellerVerificationStatus === 'approved' || sellerVerificationStatus === 'verified') && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#1d4ed8" />
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color="#2563EB"
                      style={styles.verifiedIcon}
                    />
                    <View style={styles.verifiedTextBlock}>
                      <Text style={styles.verifiedBadgeTitle}>Trusted Seller</Text>
                      <Text style={styles.verifiedBadgeSubtitle}>ID verified</Text>
                    </View>
                  </View>
                  )}
              </View>
              <View style={styles.sellerCard}>
                <Avatar 
                  imageUrl={listing.seller.avatar_url || undefined} 
                  size={50} 
                  verificationStatus={sellerVerificationStatus as any}
                  name={shouldShowSellerName ? listing.seller.name : 'Seller'}
                />
                
                <View style={styles.sellerInfo}>
                  {/* Seller Name (Masked if no active trade) */}
                  <Text style={[
                    styles.sellerName,
                    !shouldShowSellerName && styles.sellerNameMasked
                  ]}>
                    {sellerDisplayName}
                  </Text>

                  {/* Seller Rating (Always shown) */}
                  {loadingSellerInfo ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : sellerRating ? (
                    <StarRating
                      averageRating={sellerRating.averageRating}
                      totalReviews={sellerRating.totalReviews}
                      ratingBreakdown={sellerRating.ratingBreakdown}
                      size="medium"
                    />
                  ) : (
                    <Text style={styles.noRatingText}>No rating yet</Text>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.sellerActionButtons}>
                    <TouchableOpacity 
                      style={styles.contactButton}
                      onPress={handleContactSeller}
                    >
                      <Text style={styles.contactButtonText}>💬 Contact Seller</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.profileButton}
                      onPress={handleViewSellerProfile}
                    >
                      <Text style={styles.profileButtonText}>👤 View Profile</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Info message if no active trade */}
                  {!shouldShowSellerName && (
                    <Text style={styles.sellerInfoNote}>
                      {user?.id === listing.seller_id 
                        ? 'You cannot view your own seller profile here.' 
                        : 'Start a trade to see seller details and contact them.'}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Fallback Seller Section if seller data failed to load */}
          {!listing.seller && listing.seller_id && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👤 Seller</Text>
              <View style={styles.sellerCard}>
                <View style={styles.sellerAvatarPlaceholder}>
                  <Text style={styles.sellerAvatarText}>?</Text>
                </View>
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>Seller</Text>
                  <TouchableOpacity onPress={handleContactSeller}>
                    <Text style={styles.contactSellerLink}>Contact Seller →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* MODULE-04 LISTING-V2-005: Buy Now Button (fixed at bottom) */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.buyNowButton} onPress={handleBuyNow}>
            <Text style={styles.buyNowButtonText}>🛍️ Buy Now</Text>
          </TouchableOpacity>
        </View>
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  imagePlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGallery: {
    width: '100%',
    backgroundColor: '#f2f2f2',
  },
  mainImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#e0e0e0',
  },
  imageCountBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  thumbnailButton: {
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailButtonActive: {
    borderColor: '#007AFF',
  },
  thumbnailImage: {
    width: 64,
    height: 64,
    backgroundColor: '#ddd',
  },
  imagePlaceholderText: {
    fontSize: 48,
    color: '#999',
  },
  imagePlaceholderSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  itemTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 12,
  },
  spBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  spBadgeText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '700',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  conditionValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  categoryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  spContextCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  spContextTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 8,
  },
  spContextMessage: {
    fontSize: 14,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  upgradeButton: {
    marginTop: 12,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  feeCard: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  feeCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 13,
    color: '#78350f',
  },
  feeValue: {
    fontSize: 14,
    color: '#78350f',
    fontWeight: '600',
  },
  feeValueSubscriber: {
    color: '#16a34a',
  },
  divider: {
    height: 1,
    backgroundColor: '#fbbf24',
    marginVertical: 8,
  },
  feeTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#78350f',
  },
  feeTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
  },
  savingsNote: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fbbf24',
  },
  savingsNoteText: {
    fontSize: 12,
    color: '#78350f',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  verifiedIcon: {
    marginLeft: 6,
    marginRight: 4,
  },
  verifiedTextBlock: {
    marginLeft: 2,
  },
  verifiedBadgeTitle: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
    lineHeight: 14,
  },
  verifiedBadgeSubtitle: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: '600',
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  verifiedText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    marginTop: 2,
  },
  sellerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  sellerAvatarText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  sellerNameMasked: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  noRatingText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sellerActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  profileButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  profileButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  sellerInfoNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 16,
  },
  contactSellerLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  bottomActions: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  buyNowButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyNowButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});

/**
 * File: p2p-kids-marketplace/src/screens/home/ItemDetailScreen.tsx
 * MODULE-15.1-UI-REDESIGN: Item Detail Screen
 * Task: FLOW-06 Discovery & Search - Item Detail View
 *
 * Redesigned with Whisk design system and Phosphor icons.
 * Features:
 * - Full item details with Heart/Share overlay on images
 * - SP earn badge with Coins icon (gold chip)
 * - ShieldCheck verified badge on seller card
 * - Sticky "Buy Now" button (green pill, 52px)
 * - "Add to Cart" button (secondary outlined, above Buy Now)
 * - Seller info masking + rating display
 * - Contact seller button navigates to messaging
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
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
import { getSubscriptionSummary, getTransactionFee } from '@/services/subscription';
import {
  getTransactionFeeNonSubscriberCents,
  getTransactionFeeSubscriberCents,
} from '@/services/adminConfig';
import { hasActiveOfferForItem, hasActiveTradeBetween, getSellerRating } from '@/services/trade';
import { Listing } from '@/types/listing';
import { trackEvent } from '@/services/analytics';
import { RootStackParamList } from '@/navigation/types';
import { formatPrice } from '@/utils/formatPrice';
import {
  Heart,
  HeartStraight,
  Share,
  Coins,
  ShieldCheck,
  ShoppingCart,
  Lock,
  ChatCircle,
  User,
} from 'phosphor-react-native';
import { Modal } from '@/components/ui';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import StarRating from '@/components/molecules/StarRating';
import Avatar from '@/components/atoms/Avatar';
import { ListingImage } from '@/components/atoms';
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
  const [transactionFeeCents, setTransactionFeeCents] = useState(0);
  const [subscriberFeeCents, setSubscriberFeeCents] = useState(0);
  const [nonSubscriberFeeCents, setNonSubscriberFeeCents] = useState(0);
  const [buyerSubLoading, setBuyerSubLoading] = useState(true);
  const [checkingActiveTrade, setCheckingActiveTrade] = useState(false);
  const [showDuplicateOfferModal, setShowDuplicateOfferModal] = useState(false);

  // Seller info masking (TASK-ITEM-DETAILS-001)
  const [hasActiveTrade, setHasActiveTrade] = useState(false);
  const [sellerRating, setSellerRating] = useState<SellerRatingInfo | null>(null);
  const [sellerVerificationStatus, setSellerVerificationStatus] = useState<string | null>(null);
  const [loadingSellerInfo, setLoadingSellerInfo] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

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
      if (!user?.id) {
        console.log('[ItemDetailScreen] 📊 No user, defaulting to free');
        const [subscriberFee, nonSubscriberFee] = await Promise.all([
          getTransactionFeeSubscriberCents(true),
          getTransactionFeeNonSubscriberCents(true),
        ]);
        setSubscriberFeeCents(Number.isFinite(subscriberFee) ? subscriberFee : 0);
        setNonSubscriberFeeCents(Number.isFinite(nonSubscriberFee) ? nonSubscriberFee : 0);
        setBuyerIsSubscriber(false);
        setBuyerCanSpendSP(false);
        setTransactionFeeCents(Number.isFinite(nonSubscriberFee) ? nonSubscriberFee : 0);
        return;
      }

      console.log('[ItemDetailScreen] 🔄 Loading buyer subscription for:', user.id);
      const [sub, userFeeCents, subscriberFee, nonSubscriberFee] = await Promise.all([
        getSubscriptionSummary(user.id),
        getTransactionFee(user.id),
        getTransactionFeeSubscriberCents(true),
        getTransactionFeeNonSubscriberCents(true),
      ]);
      console.log('[ItemDetailScreen] ✅ Buyer subscription loaded:', {
        user_id: user.id,
        is_subscriber: sub.is_subscriber,
        can_spend_sp: sub.can_spend_sp,
        status: sub.status,
      });

      setSubscriberFeeCents(Number.isFinite(subscriberFee) ? subscriberFee : 0);
      setNonSubscriberFeeCents(Number.isFinite(nonSubscriberFee) ? nonSubscriberFee : 0);
      setTransactionFeeCents(Number.isFinite(userFeeCents) ? userFeeCents : 0);

      console.log('[ItemDetailScreen] 💰 Fee loaded:', {
        is_subscriber: sub.is_subscriber,
        fee_cents: userFeeCents,
      });

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

  const handleMakeOffer = async () => {
    if (!user?.id) {
      Alert.alert('Login Required', 'Please login to purchase items.');
      return;
    }

    if (!listing?.id) {
      Alert.alert('Error', 'This listing is unavailable right now. Please try again.');
      return;
    }

    try {
      setCheckingActiveTrade(true);
      // Only block if buyer already has an active offer for this specific item.
      const hasActive = await hasActiveOfferForItem(user.id, String(listing.id));
      
      if (hasActive) {
        setShowDuplicateOfferModal(true);
        return;
      }

      // Navigate to trade offer screen (FLOW-08) through TradeInitiation route.
      navigation.navigate('TradeInitiation', { itemId: String(listing.id) });
    } catch (err) {
      console.error('[ItemDetailScreen] Failed to navigate to TradeInitiation:', err);
      Alert.alert('Error', 'Unable to open checkout right now. Please try again.');
    } finally {
      setCheckingActiveTrade(false);
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
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
          </View>
          <BottomNavBar />
        </View>
      </SafeAreaView>
    );
  }

  // V2: Fee disclosure based on buyer subscription status (admin-config / RPC driven)
  const platformFee = transactionFeeCents / 100;
  const totalPrice = listing.price + platformFee;
  const savingsDollars = Math.max(0, (nonSubscriberFeeCents - subscriberFeeCents) / 100);

  console.log('[ItemDetailScreen] 💰 Fee calculation:', {
    buyerIsSubscriber,
    platformFee,
    itemPrice: listing.price,
    totalPrice,
  });

  // Determine seller name display (TASK-ITEM-DETAILS-001)
  const shouldShowSellerName = hasActiveTrade;
  const sellerDisplayName = shouldShowSellerName
    ? listing.seller?.name || 'Seller'
    : 'Seller Info Hidden';
  const listingImages = [...(listing.images ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  const activeImage = listingImages[activeImageIndex] ?? listingImages[0] ?? null;
  const requestedCategoryName = listing.requested_category_name?.trim() || '';
  const colorValues = Array.isArray(listing.color) ? listing.color.filter(Boolean) : [];

  const formatValue = (value: string) =>
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const ageGroupLabel = listing.age_group ? `${listing.age_group} years` : null;
  const conditionLabel = listing.condition ? formatValue(listing.condition) : null;
  const genderLabel = listing.gender ? formatValue(listing.gender) : null;
  const categoryLabel = listing.category?.name || null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView>
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Item Details</Text>
            <View style={{ width: 60 }} />
          </View>

          {activeImage ? (
            <View style={styles.imageGallery}>
              <ListingImage
                url={activeImage.url}
                containerStyle={styles.mainImage}
                imageStyle={styles.mainImage}
                resizeMode="contain"
              />
              
              {/* Heart/Share overlay - top right */}
              <View style={styles.imageOverlayIcons}>
                <Pressable
                  onPress={() => setIsFavorite(!isFavorite)}
                  style={styles.overlayIconButton}
                  hitSlop={8}
                >
                  {isFavorite ? (
                    <HeartStraight size={24} color="#5DBB8E" weight="fill" />
                  ) : (
                    <Heart size={24} color="#1A1A1A" weight="regular" />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    console.log('[ItemDetailScreen] Share item:', listing.id);
                    trackEvent('share_item', { item_id: listing.id });
                  }}
                  style={styles.overlayIconButton}
                  hitSlop={8}
                >
                  <Share size={24} color="#1A1A1A" weight="regular" />
                </Pressable>
              </View>

              <View style={styles.imageCountBadge}>
                <Text
                  style={styles.imageCountBadgeText}
                >{`${activeImageIndex + 1}/${listingImages.length}`}</Text>
              </View>

              {listingImages.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbnailsContainer}
                >
                  {listingImages.map((image, index) => (
                    <TouchableOpacity
                      key={image.id}
                      style={[
                        styles.thumbnailButton,
                        activeImageIndex === index && styles.thumbnailButtonActive,
                      ]}
                      onPress={() => setActiveImageIndex(index)}
                    >
                      <ListingImage
                        url={image.url}
                        containerStyle={styles.thumbnailImage}
                        imageStyle={styles.thumbnailImage}
                        resizeMode="cover"
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

            {/* Price & SP Earn Badge */}
            <View style={styles.priceRow}>
              <Text style={styles.itemPrice}>${listing.price.toFixed(2)}</Text>
            </View>

            {/* SP Accepted Badge (below price if not subscriber) */}
            {listing.accepts_swap_points && !buyerIsSubscriber && (
              <View style={styles.spAcceptedBadge}>
                <Coins size={14} color="#5DBB8E" weight="regular" />
                <Text style={styles.spAcceptedText}>Swap Points Accepted (Kids Club+ only)</Text>
              </View>
            )}

            {/* Item specifics */}
            <View style={styles.specsCard}>
              <Text style={styles.specsTitle}>Item specifics</Text>

              {conditionLabel && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Condition</Text>
                  <Text style={styles.specValue}>{conditionLabel}</Text>
                </View>
              )}

              {categoryLabel && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Category</Text>
                  <Text style={styles.specValue}>{categoryLabel}</Text>
                </View>
              )}

              {requestedCategoryName.length > 0 && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Requested category</Text>
                  <Text style={styles.specValue}>{requestedCategoryName}</Text>
                </View>
              )}

              {listing.brand && listing.brand.trim().length > 0 && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Brand</Text>
                  <Text style={styles.specValue}>{listing.brand.trim()}</Text>
                </View>
              )}

              {ageGroupLabel && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Age group</Text>
                  <Text style={styles.specValue}>{ageGroupLabel}</Text>
                </View>
              )}

              {genderLabel && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Gender</Text>
                  <Text style={styles.specValue}>{genderLabel}</Text>
                </View>
              )}

              {colorValues.length > 0 && (
                <View style={styles.specRowStack}>
                  <Text style={styles.specLabel}>Colors</Text>
                  <View style={styles.colorPillsRow}>
                    {colorValues.map((colorName) => (
                      <View key={colorName} style={styles.colorPill}>
                        <Text style={styles.colorPillText}>{formatValue(colorName)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

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
                    💡 Save ${savingsDollars.toFixed(2)} on fees! Subscribe to Kids Club+ and pay
                    only {formatPrice(subscriberFeeCents)} per transaction.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Seller Info Section (TASK-ITEM-DETAILS-001: Masking & Ratings) */}
          {listing.seller && (
            <View style={styles.section}>
              <View style={styles.sellerHeaderRow}>
                <Text style={[styles.sectionTitle, styles.sellerSectionTitle]}>Seller Info</Text>
                {(sellerVerificationStatus === 'approved' ||
                  sellerVerificationStatus === 'verified') && (
                  <View style={styles.verifiedBadge}>
                    <ShieldCheck size={16} color="#5DBB8E" weight="fill" />
                    <Text style={styles.verifiedBadgeText}>Verified Seller</Text>
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
                  {shouldShowSellerName ? (
                    <Text style={styles.sellerName}>{sellerDisplayName}</Text>
                  ) : (
                    <View style={styles.sellerNameMaskedRow}>
                      <Lock size={18} color="#9CA3AF" weight="regular" />
                      <Text style={[styles.sellerName, styles.sellerNameMasked]}>
                        {sellerDisplayName}
                      </Text>
                    </View>
                  )}

                  {/* Seller Rating (Always shown) */}
                  {loadingSellerInfo ? (
                    <ActivityIndicator size="small" color="#5DBB8E" />
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
                    <TouchableOpacity style={styles.contactButton} onPress={handleContactSeller}>
                      <View style={styles.sellerButtonContent}>
                        <ChatCircle size={18} color="#FFFFFF" weight="fill" />
                        <Text style={styles.contactButtonText}>Contact Seller</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.profileButton}
                      onPress={handleViewSellerProfile}
                    >
                      <View style={styles.sellerButtonContent}>
                        <User size={18} color="#1A1A1A" weight="regular" />
                        <Text style={styles.profileButtonText}>View Profile</Text>
                      </View>
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
              <Text style={styles.sectionTitle}>Seller</Text>
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

        {/* MODULE-15.1: Sticky Bottom Actions - Add to Cart + Make Offer */}
        <View style={styles.stickyBottomActions}>
          <Pressable
            style={styles.addToCartButton}
            onPress={() => {
              console.log('[ItemDetailScreen] Add to cart:', listing.id);
              trackEvent('add_to_cart', { item_id: listing.id });
              Alert.alert('Added to Cart', 'Item added to your cart successfully!');
            }}
          >
            <ShoppingCart size={20} color="#5DBB8E" weight="regular" />
            <Text style={styles.addToCartButtonText}>Add to Cart</Text>
          </Pressable>
          
          <Pressable
            style={[styles.buyNowButton, (loading || checkingActiveTrade) && { opacity: 0.7 }]}
            onPress={handleMakeOffer}
            disabled={loading || checkingActiveTrade}
            testID="make-offer-button"
          >
            {checkingActiveTrade ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buyNowButtonText}>Make Offer</Text>
            )}
          </Pressable>
        </View>

        {/* Duplicate Trade Modal - Design System Modal */}
        <Modal
          visible={showDuplicateOfferModal}
          type="alert"
          title="Active Offer"
          message="You already have an active offer on this item. Open Trade History to view your current trades."
          primaryButtonText="Go to Trade History"
          secondaryButtonText="Dismiss"
          onPrimaryPress={() => {
            setShowDuplicateOfferModal(false);
            navigation.navigate('TradeList');
          }}
          onSecondaryPress={() => setShowDuplicateOfferModal(false)}
          onClose={() => setShowDuplicateOfferModal(false)}
        />

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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#5DBB8E',
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
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#e0e0e0',
  },
  imageOverlayIcons: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  overlayIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    gap: 12,
    marginBottom: 16,
  },
  itemPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  spAcceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  spAcceptedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5DBB8E',
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
  specsCard: {
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 4,
  },
  specsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  specRowStack: {
    marginBottom: 8,
  },
  specLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  specValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  colorPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  colorPill: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  colorPillText: {
    fontSize: 12,
    color: '#374151',
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
    color: '#1A1A1A',
    marginBottom: 12,
  },
  sellerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sellerSectionTitle: {
    marginBottom: 0,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
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
    color: '#1A1A1A',
    marginBottom: 6,
  },
  sellerNameMaskedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sellerNameMasked: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 0,
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
  sellerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#5DBB8E',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  profileButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  profileButtonText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  sellerInfoNote: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
    lineHeight: 18,
  },
  contactSellerLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  stickyBottomActions: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 10,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#5DBB8E',
    backgroundColor: '#FFFFFF',
  },
  addToCartButtonText: {
    fontSize: 16,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  buyNowButton: {
    backgroundColor: '#5DBB8E',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

/**
 * File: p2p-kids-marketplace/src/screens/home/ItemDetailScreen.tsx
 * MODULE-04 LISTING-V2-005: Listing Detail View with SP Context
 * 
 * Features:
 * - Full item details (name, description, price, images, condition)
 * - SP payment eligibility display
 * - Buyer's subscription context: show fee disclosure ($2.99 vs $0.99)
 * - "Buy Now" button navigates to trade initiation (MODULE-06)
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
import { getListingById } from '@/services/listing';
import { getSubscriptionSummary } from '@/services/subscription';
import { Listing } from '@/types/listing';
import { trackEvent } from '@/services/analytics';
import { RootStackParamList } from '@/navigation/types';
import BottomNavBar from '@/components/organisms/BottomNavBar';

type ItemDetailScreenRouteProp = RouteProp<RootStackParamList, 'ListingDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ItemDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { listing_id } = route.params;
  const { user } = useUserStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buyer subscription context (MODULE-11 dependency)
  const [buyerCanSpendSP, setBuyerCanSpendSP] = useState(false);
  const [buyerIsSubscriber, setBuyerIsSubscriber] = useState(false);
  const [buyerSubLoading, setBuyerSubLoading] = useState(true);

  useEffect(() => {
    loadListing();
    loadBuyerSubscription();
  }, [listing_id]);

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

    if (!listing) return;

    // TODO(MODULE-06): Navigate to trade initiation screen
    Alert.alert(
      'Coming Soon',
      'Trade flow (MODULE-06) is not yet implemented. This will navigate to checkout/trade initiation.'
    );
    // navigation.navigate('InitiateTrade', { listing_id: listing.id });
  };

  const handleContactSeller = () => {
    if (!user?.id) {
      Alert.alert('Login Required', 'Please login to contact the seller.');
      return;
    }

    if (!listing) return;

    // TODO(MODULE-07): Navigate to messaging screen
    Alert.alert(
      'Coming Soon',
      'Messaging (MODULE-07) is not yet implemented. This will open a chat with the seller.'
    );
    // navigation.navigate('Chat', { recipientId: listing.seller_id });
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

        {/* Image Placeholder */}
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>📷 No Image</Text>
          <Text style={styles.imagePlaceholderSubtext}>
            {listing.images && listing.images.length > 0
              ? `${listing.images.length} images`
              : 'Image upload coming soon'}
          </Text>
        </View>

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

        {/* Seller Info Section */}
        {listing.seller && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Seller</Text>
            <View style={styles.sellerCard}>
              {listing.seller.avatar_url ? (
                <Image source={{ uri: listing.seller.avatar_url }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Text style={styles.sellerAvatarText}>
                    {listing.seller.name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{listing.seller.name || 'Anonymous Seller'}</Text>
                <TouchableOpacity onPress={handleContactSeller}>
                  <Text style={styles.contactSellerLink}>Contact Seller →</Text>
                </TouchableOpacity>
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
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  sellerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    marginBottom: 4,
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

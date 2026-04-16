/**
 * File: p2p-kids-marketplace/src/components/organisms/RecommendationsCarousel/index.tsx
 * MODULE-05-DISCOVERY-V2: Recommendations Carousel
 * Task: DISCOVERY-V2-002 - Subscriber-Personalized Recommendations
 * 
 * Displays personalized recommendations for user based on:
 * - SP eligibility (subscribers see SP items prioritized)
 * - SP balance affordability
 * - Subscription status
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getRecommendations } from '../../../services/discovery';
import { Recommendation } from '../../../types/discovery';
import { useAuth } from '../../../hooks/useAuth';

interface RecommendationsCarouselProps {
  /** Number of recommendations to fetch */
  limit?: number;
  /** Custom title for the carousel */
  title?: string;
}

export default function RecommendationsCarousel({
  limit = 10,
  title = 'Recommended for You',
}: RecommendationsCarouselProps) {
  const { session } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // BUG FIX #1: Call the hook to detect screen focus
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether we have already loaded once so the focus-based reload
  // effect does NOT double-fire on initial mount (fixes analytics triple-fire).
  const hasLoadedOnMountRef = useRef(false);

  // Load recommendations on initial mount or when user / limit changes.
  useEffect(() => {
    hasLoadedOnMountRef.current = false; // reset so focus effect allows next reload
    loadRecommendations();
  }, [session?.user?.id, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when screen returns to focus (e.g. navigate back from ItemDetail).
  // CRITICAL FIX: skip the very first focused=true triggered by mounting,
  // because the effect above already covers that case.
  useEffect(() => {
    if (!isFocused) return;
    if (!session?.user?.id) return;
    if (!hasLoadedOnMountRef.current) {
      // First focus event after mount - data already fetched above, just mark done.
      hasLoadedOnMountRef.current = true;
      return;
    }
    loadRecommendations();
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecommendations = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getRecommendations(session.user.id, limit);
      setRecommendations(data);
    } catch (err) {
      console.error('[RecommendationsCarousel] Error loading:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (itemId: string) => {
    // Navigate to item detail screen with correct parameter name
    (navigation as any).navigate('ListingDetail', { listing_id: itemId });
  };

  // Don't render if no user session
  if (!session?.user?.id) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadRecommendations}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Empty state
  if (recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No recommendations available</Text>
        </View>
      </View>
    );
  }

  // Render carousel
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        horizontal
        data={recommendations}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => handleItemPress(item.id)}
          >
            <View style={styles.cardImageContainer}>
              {item.images && item.images.length > 0 ? (
                <Image
                  source={{ uri: item.images[0].thumbnail_url || item.images[0].url }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cardImagePlaceholder}>
                  <Text style={styles.cardImagePlaceholderText}>📷</Text>
                </View>
              )}
            </View>
            <View style={styles.cardContent}>
              {/* Item Title */}
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>

              {/* Price */}
              <Text style={styles.itemPrice}>
                ${(item.price || 0).toFixed(2)}
              </Text>

              {/* SP Eligible Badge */}
              {item.accepts_swap_points && (
                <View style={styles.spBadge}>
                  <Text style={styles.spBadgeText}>✓ SP Eligible</Text>
                </View>
              )}

              {/* Condition */}
              {item.condition && (
                <Text style={styles.itemCondition}>
                  {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                </Text>
              )}

              {/* Dev Mode: Show score */}
              {__DEV__ && (
                <Text style={styles.debugScore}>
                  Score: {item.score?.toFixed(1) ?? 'N/A'}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 16,
    color: '#1f2937',
  },
  listContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 200,
    marginHorizontal: 6,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 110,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 10,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 22,
  },
  cardContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 8,
  },
  spBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  spBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  itemCondition: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  debugScore: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 8,
    fontStyle: 'italic',
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

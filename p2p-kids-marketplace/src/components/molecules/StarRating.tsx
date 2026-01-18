/**
 * File: p2p-kids-marketplace/src/components/molecules/StarRating.tsx
 * Star rating component for displaying seller ratings with visual stars
 * 
 * Features:
 * - Display 1-5 stars based on average rating
 * - Show review count
 * - Optional: show rating breakdown bar
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StarRatingProps {
  averageRating: number | null;
  totalReviews: number;
  ratingBreakdown?: Record<number, number>;
  showBreakdown?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function StarRating({
  averageRating,
  totalReviews,
  ratingBreakdown,
  showBreakdown = false,
  size = 'medium',
}: StarRatingProps) {
  if (averageRating === null || totalReviews === 0) {
    return <Text style={styles.noRating}>No rating yet</Text>;
  }

  const starSize = size === 'small' ? 14 : size === 'large' ? 24 : 18;
  
  // Generate star display (e.g., "★★★★☆")
  const fullStars = Math.floor(averageRating);
  const hasHalfStar = averageRating % 1 >= 0.5;
  
  const stars = '★'.repeat(fullStars) + (hasHalfStar ? '⭐' : '') + '☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0));

  return (
    <View style={styles.container}>
      <View style={styles.ratingRow}>
        <Text style={[styles.stars, { fontSize: starSize }]}>
          {stars}
        </Text>
        <View style={styles.ratingInfo}>
          <Text style={styles.ratingValue}>
            {averageRating.toFixed(1)}
          </Text>
          <Text style={styles.reviewCount}>
            {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      </View>

      {/* Optional: Show breakdown bar */}
      {showBreakdown && ratingBreakdown && (
        <View style={styles.breakdownContainer}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = ratingBreakdown[rating] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            
            return (
              <View key={rating} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{rating}★</Text>
                <View style={styles.breakdownBarContainer}>
                  <View
                    style={[
                      styles.breakdownBar,
                      { width: `${percentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    color: '#fbbf24',
    lineHeight: 24,
  },
  ratingInfo: {
    flexDirection: 'column',
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reviewCount: {
    fontSize: 12,
    color: '#666',
  },
  noRating: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  
  // Breakdown bar styles
  breakdownContainer: {
    marginTop: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownLabel: {
    width: 24,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  breakdownBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 3,
  },
  breakdownCount: {
    width: 24,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
});

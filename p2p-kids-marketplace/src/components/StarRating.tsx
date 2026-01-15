// File: p2p-kids-marketplace/src/components/StarRating.tsx
// Star rating component for MODULE-08-REVIEWS-RATINGS (TASK REVIEW-001)

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  editable?: boolean;
  size?: number;
  color?: string;
}

export function StarRating({
  rating,
  onRatingChange,
  editable = false,
  size = 32,
  color = '#FCD34D',
}: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  const handleStarPress = (star: number) => {
    if (editable && onRatingChange) {
      onRatingChange(star);
    }
  };

  return (
    <View style={styles.container}>
      {stars.map((star) => {
        const filled = star <= rating;
        const StarComponent = editable ? TouchableOpacity : View;

        return (
          <StarComponent
            key={star}
            onPress={() => handleStarPress(star)}
            style={styles.star}
            disabled={!editable}
            activeOpacity={editable ? 0.7 : 1}
            testID={`star-${star}`}
          >
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? color : '#D1D5DB'}
              testID={`star-icon-${star}`}
            />
          </StarComponent>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: 8,
  },
});

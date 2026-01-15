// File: p2p-kids-marketplace/src/components/ReviewCard.tsx
// MODULE-08-REVIEWS-RATINGS (TASK REVIEW-002)
// Component for displaying a single review

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Review } from '@/services/review';
import { StarRating } from '@/components/StarRating';

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const reviewerName = review.is_anonymous
    ? 'Anonymous User'
    : review.reviewer?.first_name
    ? `${review.reviewer.first_name} ${review.reviewer.last_name || ''}`.trim()
    : 'User';

  const reviewerImage = review.is_anonymous
    ? null
    : review.reviewer?.profile_image_url;

  const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {reviewerImage ? (
          <Image source={{ uri: reviewerImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {reviewerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text style={styles.reviewerName}>{reviewerName}</Text>
          <StarRating rating={review.rating} size={16} />
        </View>

        <Text style={styles.date}>{reviewDate}</Text>
      </View>

      {review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  headerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  comment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
});

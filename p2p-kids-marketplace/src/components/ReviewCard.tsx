// File: p2p-kids-marketplace/src/components/ReviewCard.tsx
// MODULE-08-REVIEWS-RATINGS (TASK REVIEW-002, REVIEW-006)
// Component for displaying a single review with report functionality

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Review, reportReview } from '@/services/review';
import { StarRating } from '@/components/StarRating';
import Avatar from '@/components/atoms/Avatar';

interface ReviewCardProps {
  review: Review;
  currentUserId?: string;
  showReportMenu?: boolean;
}

export function ReviewCard({ review, currentUserId, showReportMenu = true }: ReviewCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const reviewerName = review.is_anonymous
    ? 'Anonymous User'
    : review.reviewer?.first_name
      ? `${review.reviewer.first_name} ${review.reviewer.last_name || ''}`.trim()
      : 'User';

  const reviewerImage = review.is_anonymous ? null : review.reviewer?.profile_image_url;

  const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Don't show report menu if:
  // - showReportMenu is false
  // - No current user
  // - User is not the reviewee (ONLY the person the review is about can report it)
  const canReport =
    showReportMenu &&
    currentUserId &&
    review.reviewee_id &&
    String(currentUserId).trim().toLowerCase() === String(review.reviewee_id).trim().toLowerCase();

  const handleReportPress = (reason: 'spam' | 'offensive' | 'false_info' | 'other') => {
    const reasonLabels = {
      spam: 'Spam',
      offensive: 'Offensive Content',
      false_info: 'False Information',
      other: 'Other',
    };

    Alert.alert('Report Review', `Report this review as ${reasonLabels[reason]}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => handleReport(reason),
      },
    ]);
    setMenuVisible(false);
  };

  const handleReport = async (reason: 'spam' | 'offensive' | 'false_info' | 'other') => {
    if (!currentUserId) return;

    setIsReporting(true);
    try {
      const result = await reportReview({
        reviewId: review.id,
        reporterId: currentUserId,
        reason,
        description: null,
      });

      if (result.success) {
        // DEV-TASK-75 (2026-08-31): confirmation copy aligned to the manual-testing
        // guide (TRD-TC-Q15) — "Review reported. Thank you!" (was "Thank you for
        // reporting. We will review this content.").
        Alert.alert('Success', 'Review reported. Thank you!');
      } else {
        Alert.alert('Error', result.error || 'Failed to report review');
      }
    } catch (_error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar
          imageUrl={reviewerImage || undefined}
          name={reviewerName}
          size={40}
          verificationStatus={
            (review.is_anonymous ? 'none' : review.reviewer?.verification_status) as any
          }
          style={{ marginRight: 12 }}
        />

        <View style={styles.headerInfo}>
          <Text style={styles.reviewerName}>{reviewerName}</Text>
          <StarRating rating={review.rating} size={16} />
        </View>

        <Text style={styles.date}>{reviewDate}</Text>

        {canReport && (
          <TouchableOpacity
            onPress={() => setMenuVisible(!menuVisible)}
            style={styles.menuButton}
            disabled={isReporting}
            testID="review-menu-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Review options"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {review.comment && <Text style={styles.comment}>{review.comment}</Text>}

      {/* Simple dropdown menu */}
      {menuVisible && canReport && (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => handleReportPress('spam')} testID="review-report-spam" accessible accessibilityRole="button" accessibilityLabel="Report as Spam">
            <Ionicons name="flag-outline" size={16} color="#6B7280" />
            <Text style={styles.menuItemText}>Report as Spam</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => handleReportPress('offensive')} testID="review-report-offensive" accessible accessibilityRole="button" accessibilityLabel="Report as Offensive">
            <Ionicons name="warning-outline" size={16} color="#6B7280" />
            <Text style={styles.menuItemText}>Report as Offensive</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => handleReportPress('false_info')} testID="review-report-false-info" accessible accessibilityRole="button" accessibilityLabel="Report False Information">
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.menuItemText}>Report False Information</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* DEV-TASK-75 (2026-08-31): 4th report reason 'Other' to match the guide (TRD-TC-Q15). */}
          <TouchableOpacity style={styles.menuItem} onPress={() => handleReportPress('other')} testID="review-report-other" accessible accessibilityRole="button" accessibilityLabel="Report Other">
            <Ionicons name="ellipsis-horizontal-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.menuItemText}>Report Other</Text>
          </TouchableOpacity>
        </View>
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
    marginRight: 8,
  },
  menuButton: {
    padding: 4,
  },
  comment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  menu: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
});

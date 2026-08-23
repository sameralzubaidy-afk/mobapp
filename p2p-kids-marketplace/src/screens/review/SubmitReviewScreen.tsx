// File: p2p-kids-marketplace/src/screens/review/SubmitReviewScreen.tsx
// Review submission screen for MODULE-08-REVIEWS-RATINGS (TASK REVIEW-001)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { submitReview, canReviewUser, skipReview } from '@/services/review';
import { captureException } from '@/services/errorReporter';
import { StarRating } from '@/components/StarRating';
// import { logEvent } from '@/services/analytics'; // TODO: uncomment when analytics service is available
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import { theme } from '@/theme';

type SubmitReviewRouteProp = RouteProp<RootStackParamList, 'SubmitReview'>;
type SubmitReviewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SubmitReview'>;

export function SubmitReviewScreen() {
  const route = useRoute<SubmitReviewRouteProp>();
  const navigation = useNavigation<SubmitReviewNavigationProp>();
  const { user } = useAuth();
  const { tradeId, revieweeId, revieweeName } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    checkCanReview();
  }, []);

  const checkCanReview = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      navigation.goBack();
      return;
    }

    const result = await canReviewUser(tradeId, user.id);

    if (!result.success || !result.canReview) {
      Alert.alert('Cannot Submit Review', result.reason || 'You cannot review this trade', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    setCanSubmit(true);
    setLoading(false);
  };

  const handleSubmit = async () => {
    // CRITICAL: Check rating FIRST before any async operations
    if (!rating || rating === 0) {
      console.log('[SubmitReviewScreen] Rating not selected. rating:', rating);
      Alert.alert('Rating Required', 'Please select a star rating before submitting.', [
        { text: 'OK' },
      ]);
      return; // EXIT here, don't continue
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitReview({
        tradeId,
        reviewerId: user.id,
        revieweeId,
        rating,
        comment: comment.trim() || null,
        isAnonymous,
      });

      if (result.success) {
        // TODO: Track review submission for analytics when logEvent service is available
        // await logEvent(REVIEW_EVENTS.REVIEW_SUBMITTED, {
        //   trade_id: tradeId,
        //   rating,
        //   has_comment: !!comment.trim(),
        //   is_anonymous: isAnonymous,
        // });

        Alert.alert('Success', 'Your review has been submitted!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to submit review. Please try again.');
      }
    } catch (error) {
      captureException(error, {
        tags: { screen: 'SubmitReviewScreen', action: 'submit_review' },
      });
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!user?.id) {
      console.log('[handleSkip] No user ID, navigating back');
      navigation.goBack();
      return;
    }

    try {
      // Track skip event for review completion rate analytics
      console.log('[handleSkip] User skipped review', { tradeId, userId: user.id });

      await skipReview({
        tradeId,
        userId: user.id,
      });

      // TODO: Add analytics tracking when logEvent service is available
      // await logEvent(REVIEW_EVENTS.REVIEW_SKIPPED, { trade_id: tradeId });

      // Navigate back without blocking the user
      console.log('[handleSkip] Navigating back after skip');
      navigation.goBack();
    } catch (error) {
      captureException(error, {
        tags: { screen: 'SubmitReviewScreen', action: 'skip' },
      });
      // Even if there's an error, navigate back
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title={`Review ${revieweeName}`}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Checking review eligibility...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!canSubmit) {
    return null; // Alert will show and navigate back
  }

  return (
    <ScreenLayout variant="detail" title={`Review ${revieweeName}`}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          testID="submit-review-screen"
        >
          <Text style={styles.title}>Review {revieweeName}</Text>
          <Text style={styles.subtitle}>Share your experience with this trade</Text>

          {/* Rating Section */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Rating <Text style={styles.required}>*</Text>
            </Text>
            <StarRating rating={rating} onRatingChange={setRating} editable size={40} />
          </View>

          {/* Comment Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience with this trade..."
              placeholderTextColor="#9CA3AF"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
              textAlignVertical="top"
              testID="comment-input"
            />
            <Text style={styles.charCount} testID="char-count">
              {comment.length}/500 characters
            </Text>
          </View>

          {/* Anonymous Option */}
          <TouchableOpacity
            style={styles.anonymousToggle}
            onPress={() => setIsAnonymous(!isAnonymous)}
            testID="anonymous-checkbox"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Anonymous checkbox"
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
              {isAnonymous && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.anonymousLabel}>Post anonymously</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (rating === 0 || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            testID="submit-review-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Submit review button"
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Review</Text>
            )}
          </TouchableOpacity>

          {/* Skip Button - TASK REVIEW-004 */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={submitting}
            testID="skip-review-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Skip review button"
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          {/* Info Note */}
          <Text style={styles.note}>You can edit your review within 24 hours of submission.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: theme.backgroundColors.card,
  },
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColors.card,
  },
  contentContainer: {
    padding: 20,
    flexGrow: 1,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.backgroundColors.card,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.neutral[700],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.error[500],
  },
  commentInput: {
    // Design system §4.3: filled style — no border, #F0F0F0 fill, 12px radius
    backgroundColor: theme.backgroundColors.input,
    borderRadius: 12,
    padding: theme.spacing.md,
    fontSize: 16,
    minHeight: 120,
    color: theme.colors.neutral[900],
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.neutral[500],
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.colors.neutral[300],
    borderRadius: 6,
    marginRight: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.backgroundColors.card,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  checkmark: {
    color: theme.textColors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  anonymousLabel: {
    fontSize: 16,
    color: theme.colors.neutral[900],
  },
  submitButton: {
    // Design system §4.1: pill primary CTA — 52px tall, brand green #5DBB8E
    backgroundColor: theme.colors.primary[500],
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.neutral[300],
  },
  submitButtonText: {
    color: theme.textColors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    // Design system §4.2: text-only secondary variant
    backgroundColor: 'transparent',
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  skipButtonText: {
    color: theme.colors.neutral[700],
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: theme.colors.neutral[500],
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
});

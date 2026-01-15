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
import { submitReview, canReviewUser } from '@/services/review';
import { StarRating } from '@/components/StarRating';

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
    
    // Set up navigation header with back button
    navigation.setOptions({
      headerShown: true,
      headerTitle: `Review ${revieweeName}`,
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
      },
      headerTintColor: '#3B82F6',
      headerBackTitle: 'Back',
      headerLeftContainerStyle: {
        paddingLeft: 8,
      },
    });
  }, [navigation, revieweeName]);

  const checkCanReview = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      navigation.goBack();
      return;
    }

    const result = await canReviewUser(tradeId, user.id);
    
    if (!result.success || !result.canReview) {
      Alert.alert(
        'Cannot Submit Review',
        result.reason || 'You cannot review this trade',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    setCanSubmit(true);
    setLoading(false);
  };

  const handleSubmit = async () => {
    // CRITICAL: Check rating FIRST before any async operations
    if (!rating || rating === 0) {
      console.log('[SubmitReviewScreen] Rating not selected. rating:', rating);
      Alert.alert(
        'Rating Required',
        'Please select a star rating before submitting.',
        [{ text: 'OK' }]
      );
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
        Alert.alert(
          'Success',
          'Your review has been submitted!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit review. Please try again.');
      }
    } catch (error) {
      console.error('Submit review error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Checking review eligibility...</Text>
      </View>
    );
  }

  if (!canSubmit) {
    return null; // Alert will show and navigate back
  }

  return (
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
        <Text style={styles.subtitle}>
          Share your experience with this trade
        </Text>

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Rating <Text style={styles.required}>*</Text>
          </Text>
          <StarRating
            rating={rating}
            onRatingChange={setRating}
            editable
            size={40}
          />
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
          activeOpacity={0.7}
        >
          <View
            style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}
          >
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
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Review</Text>
          )}
        </TouchableOpacity>

        {/* Info Note */}
        <Text style={styles.note}>
          You can edit your review within 24 hours of submission.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  required: {
    color: '#EF4444',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    color: '#111827',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  anonymousLabel: {
    fontSize: 16,
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

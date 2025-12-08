---

## Prompt Addendum: Anti-Brigading, Cooldowns, Dispute Flags

### AI Prompt for Cursor (Ratings Safety)
```typescript
/*
TASK: Add safeguards to reviews/ratings

REQUIREMENTS:
1. Anti-duplication: one review per trade; prevent multiple reviews by same user for same counterparty within 30 days.
2. Cooldown: 24h delay before review can be posted to reduce impulsive ratings.
3. Dispute flags: allow users to flag a review; queue for moderator with evidence upload.
4. Moderation hooks: text moderation service checks for harassment; auto-hide pending review when flagged.

FILES:
- src/services/reviews.ts (enforce constraints)
- admin/app/reviews/moderation/page.tsx (moderation queue)
*/
```

### Acceptance Criteria
- Duplicate and rapid-fire reviews blocked by constraints
- Users can flag reviews; moderators can act
- Moderation service filters abusive content

# MODULE 08: REVIEWS & RATINGS

**Total Tasks:** 7  
**Estimated Time:** ~17 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-06 (Trade Flow)

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

Add this preamble to each AI prompt block when running in Claude Sonnet 4.5 mode. It guides the agent to reason, verify, and produce tests alongside code.

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

## TASK REVIEW-001: Create Review Submission UI (Star Rating + Comment)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** TRADE-006 (Trade completion)

### Description
Create review submission screen with 1-5 star rating and optional comment. User can review after trade completes. Show review prompt after trade completion. Validate rating is required, comment is optional (max 500 chars).

---

### AI Prompt for Cursor (Generate Review Submission UI)

```typescript
/*
TASK: Implement review submission UI

CONTEXT:
After trade completion, users can review each other.
Star rating (1-5) required, comment optional.

REQUIREMENTS:
1. Create reviews database table
2. Review submission screen
3. Star rating component (1-5 stars)
4. Optional comment field (max 500 chars)
5. Submit review to database
6. Show review prompt after trade completion

==================================================
FILE 1: Database migration for reviews
==================================================
*/

-- filepath: supabase/migrations/030_reviews.sql

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one review per user per trade
  CONSTRAINT unique_review_per_trade UNIQUE (trade_id, reviewer_id)
);

CREATE INDEX reviews_reviewer_id_idx ON reviews(reviewer_id);
CREATE INDEX reviews_reviewee_id_idx ON reviews(reviewee_id);
CREATE INDEX reviews_trade_id_idx ON reviews(trade_id);

-- RLS policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can view reviews about themselves
CREATE POLICY "Users can view reviews about them"
  ON reviews FOR SELECT
  USING (reviewee_id = auth.uid());

-- Users can view reviews they wrote
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid());

-- Users can create reviews for completed trades
CREATE POLICY "Users can create reviews for own trades"
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_id
      AND trades.status = 'completed'
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
      AND trades.completed_at IS NOT NULL
    )
  );

-- Users can update own reviews (within 24 hours)
CREATE POLICY "Users can update own reviews within 24h"
  ON reviews FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  )
  WITH CHECK (reviewer_id = auth.uid());

-- Auto-update updated_at timestamp
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

/*
==================================================
FILE 2: Review service
==================================================
*/

// filepath: src/services/review.ts

import { createClient } from '@/lib/supabase';

export interface Review {
  id: string;
  trade_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
  reviewer?: {
    first_name: string;
    profile_image_url: string;
  };
}

export interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_breakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export async function submitReview(
  tradeId: string,
  reviewerId: string,
  revieweeId: string,
  rating: number,
  comment: string | null,
  isAnonymous: boolean = false
): Promise<Review | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        trade_id: tradeId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        rating,
        comment: comment?.trim() || null,
        is_anonymous: isAnonymous,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Submit review error:', error);
    return null;
  }
}

export async function getUserReviews(userId: string): Promise<Review[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        users!reviewer_id(first_name, profile_image_url)
      `)
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((review) => ({
      ...review,
      reviewer: review.users,
    }));
  } catch (error) {
    console.error('Get user reviews error:', error);
    return [];
  }
}

export async function getReviewStats(userId: string): Promise<ReviewStats> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId);

    if (error) throw error;

    const reviews = data || [];
    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        average_rating: 0,
        total_reviews: 0,
        rating_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = sum / totalReviews;

    const breakdown = reviews.reduce(
      (acc, r) => {
        acc[r.rating as keyof typeof acc]++;
        return acc;
      },
      { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    );

    return {
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: totalReviews,
      rating_breakdown: breakdown,
    };
  } catch (error) {
    console.error('Get review stats error:', error);
    return {
      average_rating: 0,
      total_reviews: 0,
      rating_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
}

export async function canReviewUser(
  tradeId: string,
  reviewerId: string
): Promise<boolean> {
  const supabase = createClient();

  try {
    // Check if trade is completed
    const { data: trade } = await supabase
      .from('trades')
      .select('status, completed_at')
      .eq('id', tradeId)
      .single();

    if (!trade || trade.status !== 'completed') return false;

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('trade_id', tradeId)
      .eq('reviewer_id', reviewerId)
      .single();

    return !existingReview;
  } catch (error) {
    console.error('Can review user error:', error);
    return false;
  }
}

/*
==================================================
FILE 3: Review submission screen
==================================================
*/

// filepath: src/screens/review/SubmitReviewScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { submitReview } from '@/services/review';
import { StarRating } from '@/components/StarRating';

type SubmitReviewRouteProp = RouteProp<
  { SubmitReview: { tradeId: string; revieweeId: string; revieweeName: string } },
  'SubmitReview'
>;

export function SubmitReviewScreen() {
  const route = useRoute<SubmitReviewRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { tradeId, revieweeId, revieweeName } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }

    if (!user?.id) return;

    setSubmitting(true);

    try {
      const review = await submitReview(
        tradeId,
        user.id,
        revieweeId,
        rating,
        comment,
        isAnonymous
      );

      if (review) {
        Alert.alert('Success', 'Review submitted!');
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Failed to submit review. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review {revieweeName}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Rating *</Text>
        <StarRating rating={rating} onRatingChange={setRating} editable />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Comment (optional)</Text>
        <TextInput
          style={styles.commentInput}
          placeholder="Share your experience..."
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{comment.length}/500</Text>
      </View>

      <TouchableOpacity
        style={styles.anonymousToggle}
        onPress={() => setIsAnonymous(!isAnonymous)}
      >
        <View
          style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}
        >
          {isAnonymous && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.anonymousLabel}>Post anonymously</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, (rating === 0 || submitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={rating === 0 || submitting}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        You can edit your review within 24 hours of submission.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
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
  },
});

/*
==================================================
FILE 4: Star rating component
==================================================
*/

// filepath: src/components/StarRating.tsx

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  editable?: boolean;
  size?: number;
}

export function StarRating({
  rating,
  onRatingChange,
  editable = false,
  size = 32,
}: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.container}>
      {stars.map((star) => {
        const filled = star <= rating;

        if (editable) {
          return (
            <TouchableOpacity
              key={star}
              onPress={() => onRatingChange?.(star)}
              style={styles.star}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={size}
                color={filled ? '#FBBF24' : '#D1D5DB'}
              />
            </TouchableOpacity>
          );
        }

        return (
          <Ionicons
            key={star}
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? '#FBBF24' : '#D1D5DB'}
            style={styles.star}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  star: {
    marginRight: 8,
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Reviews table created with RLS policies
✓ Star rating component (1-5 stars)
✓ Optional comment field (max 500 chars)
✓ Anonymous review option
✓ Submit review to database
✓ One review per user per trade
✓ Edit review within 24 hours

==================================================
NEXT TASK
==================================================

REVIEW-002: Implement mutual review flow
*/
```

---

### Output Files

1. **supabase/migrations/030_reviews.sql** - Reviews table and RLS policies
2. **src/services/review.ts** - Review service functions
3. **src/screens/review/SubmitReviewScreen.tsx** - Review submission UI
4. **src/components/StarRating.tsx** - Star rating component

---

### Testing Steps

1. **Test review submission:**
   - Complete trade → Review prompt appears
   - Select star rating → Add comment → Submit
   - Verify review saved to database

2. **Test validation:**
   - Submit without rating → Error shown
   - Enter 501 character comment → Limited to 500

3. **Test anonymous option:**
   - Check anonymous box → Submit review
   - Verify reviewer name hidden

4. **Test duplicate prevention:**
   - Submit review twice for same trade → Error

5. **Test 24-hour edit window:**
   - Submit review → Edit within 24h → Success
   - Try edit after 24h → Error

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create reviews table migration | 30 min |
| Build review service | 60 min |
| Create review submission UI | 60 min |
| Build star rating component | 30 min |
| **Total** | **~3 hours** |

---

## TASK REVIEW-002: Implement Mutual Review Flow (Both Users Review Each Other)

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** REVIEW-001 (Review submission)

### Description
After trade completion, both buyer and seller can review each other. Show review status (pending, completed) for each party. Display "Review [User]" button if review pending. Show completed reviews on profile.

---

### AI Prompt for Cursor (Generate Mutual Review Flow)

```typescript
/*
TASK: Implement mutual review flow

CONTEXT:
Buyer reviews seller, seller reviews buyer.
Show review status for each party.

REQUIREMENTS:
1. Check if user has reviewed other party
2. Check if other party has reviewed user
3. Show review prompt for pending reviews
4. Display completed reviews on profile
5. Badge/indicator for mutual reviews

FILE: src/services/review.ts (UPDATE)
- Add getTradeReviewStatus()
- Returns: user_reviewed, other_reviewed

FILE: src/screens/trade/TradeDetailsScreen.tsx (UPDATE)
- Show review button if trade completed
- Check review status
- Navigate to SubmitReviewScreen

FILE: src/screens/profile/UserProfileScreen.tsx (UPDATE)
- Display user's received reviews
- Show average rating and total count
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK REVIEW-003: Implement Anonymous Review Option

**Duration:** 1.5 hours  
**Priority:** Medium  
**Dependencies:** REVIEW-001 (Review submission)

### Description
Allow users to post reviews anonymously. Hide reviewer name/photo if anonymous. Display "Anonymous User" instead of name. Add `is_anonymous` boolean field to reviews table (already in REVIEW-001).

---

### AI Prompt for Cursor (Generate Anonymous Review Display)

```typescript
/*
TASK: Implement anonymous review display

CONTEXT:
Reviews can be anonymous (hide reviewer identity).
Already added is_anonymous column in REVIEW-001.

REQUIREMENTS:
1. Display "Anonymous User" if is_anonymous = true
2. Hide reviewer profile image
3. Show anonymous indicator badge
4. Update review list UI

FILE: src/components/ReviewCard.tsx (NEW)
- Display single review
- Show anonymous user if applicable
- Star rating display
- Comment display

FILE: src/screens/profile/UserProfileScreen.tsx (UPDATE)
- Use ReviewCard component
- Handle anonymous reviews
*/
```

### Time Breakdown: **~1.5 hours**

---

## TASK REVIEW-004: Allow Users to Skip Leaving Reviews (Optional)

**Duration:** 1 hour  
**Priority:** Low  
**Dependencies:** REVIEW-002 (Mutual review flow)

### Description
Make reviews optional. Add "Skip" button on review prompt. Don't block user from continuing if they skip review. Track review completion rate in analytics.

---

### AI Prompt for Cursor (Generate Skip Review Option)

```typescript
/*
TASK: Make reviews optional with skip option

CONTEXT:
Users can skip leaving a review.
Reviews encouraged but not required.

REQUIREMENTS:
1. Add "Skip" button to review prompt
2. Dismiss review prompt on skip
3. Track review completion rate
4. Don't show review prompt again for same trade

FILE: src/screens/review/SubmitReviewScreen.tsx (UPDATE)
- Add "Skip" button
- Track skip event in analytics

FILE: src/services/review.ts (UPDATE)
- Add skipReview() function
- Track skipped reviews in analytics
*/
```

### Time Breakdown: **~1 hour**

---

## TASK REVIEW-005: Display Average Rating and Reviews on User Profile

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** REVIEW-001 (Review submission)

### Description
Display user's average rating (1-5 stars) on profile. Show total review count. List recent reviews (5-10 most recent). Show rating breakdown (5 stars: X%, 4 stars: Y%, etc.).

---

### AI Prompt for Cursor (Generate Profile Rating Display)

```typescript
/*
TASK: Display reviews on user profile

CONTEXT:
Show average rating, total count, rating breakdown.
Display recent reviews with pagination.

REQUIREMENTS:
1. Calculate average rating
2. Count total reviews
3. Rating breakdown chart
4. List recent reviews (paginated)
5. Display on profile header

==================================================
FILE 1: Update review service with stats
==================================================
*/

// filepath: src/services/review.ts (ALREADY IMPLEMENTED IN REVIEW-001)

// getReviewStats() already implemented:
// - average_rating
// - total_reviews
// - rating_breakdown

/*
==================================================
FILE 2: Profile rating display
==================================================
*/

// filepath: src/screens/profile/UserProfileScreen.tsx (UPDATE)

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { getUserReviews, getReviewStats, ReviewStats, Review } from '@/services/review';
import { StarRating } from '@/components/StarRating';
import { ReviewCard } from '@/components/ReviewCard';

type UserProfileRouteProp = RouteProp<{ UserProfile: { userId: string } }, 'UserProfile'>;

export function UserProfileScreen() {
  const route = useRoute<UserProfileRouteProp>();
  const { userId } = route.params;

  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [userId]);

  const loadReviews = async () => {
    setLoading(true);
    const [statsData, reviewsData] = await Promise.all([
      getReviewStats(userId),
      getUserReviews(userId),
    ]);
    setStats(statsData);
    setReviews(reviewsData);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Rating summary */}
      {stats && stats.total_reviews > 0 && (
        <View style={styles.ratingSection}>
          <View style={styles.ratingHeader}>
            <Text style={styles.averageRating}>{stats.average_rating.toFixed(1)}</Text>
            <View style={styles.ratingDetails}>
              <StarRating rating={Math.round(stats.average_rating)} size={24} />
              <Text style={styles.totalReviews}>
                {stats.total_reviews} {stats.total_reviews === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          </View>

          {/* Rating breakdown */}
          <View style={styles.breakdown}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = stats.rating_breakdown[stars as keyof typeof stats.rating_breakdown];
              const percentage = stats.total_reviews > 0
                ? (count / stats.total_reviews) * 100
                : 0;

              return (
                <View key={stars} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{stars} ★</Text>
                  <View style={styles.breakdownBar}>
                    <View
                      style={[styles.breakdownFill, { width: `${percentage}%` }]}
                    />
                  </View>
                  <Text style={styles.breakdownCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Reviews list */}
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No reviews yet</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  ratingSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  averageRating: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
    marginRight: 16,
  },
  ratingDetails: {
    flex: 1,
  },
  totalReviews: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  breakdown: {
    marginTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    width: 40,
    fontSize: 14,
    color: '#374151',
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: '#FBBF24',
  },
  breakdownCount: {
    width: 30,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 32,
  },
});

/*
==================================================
FILE 3: Review card component
==================================================
*/

// filepath: src/components/ReviewCard.tsx

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
    : review.reviewer?.first_name || 'User';

  const reviewerImage = review.is_anonymous
    ? null
    : review.reviewer?.profile_image_url;

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

        <Text style={styles.date}>
          {new Date(review.created_at).toLocaleDateString()}
        </Text>
      </View>

      {review.comment && <Text style={styles.comment}>{review.comment}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
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

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Average rating displayed on profile
✓ Total review count shown
✓ Rating breakdown chart (5-1 stars)
✓ Recent reviews listed
✓ Anonymous reviews handled correctly

==================================================
NEXT TASK
==================================================

REVIEW-006: Implement review reporting
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK REVIEW-006: Implement Review Reporting and Flagging

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** REVIEW-001 (Review submission)

### Description
Allow users to report/flag inappropriate reviews. Report reasons: spam, offensive, false info. Create review_reports table. Admin can review flagged reviews. Auto-hide reviews with multiple reports (e.g., 3+).

---

### AI Prompt for Cursor (Generate Review Reporting)

```typescript
/*
TASK: Implement review reporting system

CONTEXT:
Users can flag inappropriate reviews.
Admins review flagged content.

REQUIREMENTS:
1. Create review_reports table
2. Report review UI (select reason)
3. Store report in database
4. Auto-hide reviews with 3+ reports
5. Admin moderation queue

==================================================
FILE 1: Review reports table
==================================================
*/

-- filepath: supabase/migrations/031_review_reports.sql

CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'false_info', 'other')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One report per user per review
  CONSTRAINT unique_report_per_review UNIQUE (review_id, reporter_id)
);

CREATE INDEX review_reports_review_id_idx ON review_reports(review_id);
CREATE INDEX review_reports_reporter_id_idx ON review_reports(reporter_id);

-- RLS policies
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create review reports"
  ON review_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- Users can view own reports
CREATE POLICY "Users can view own reports"
  ON review_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- Add is_hidden column to reviews
ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN report_count INTEGER DEFAULT 0;

-- Function to auto-hide reviews with 3+ reports
CREATE OR REPLACE FUNCTION check_review_reports()
RETURNS TRIGGER AS $$
BEGIN
  -- Update report count
  UPDATE reviews
  SET report_count = (
    SELECT COUNT(*) FROM review_reports WHERE review_id = NEW.review_id
  )
  WHERE id = NEW.review_id;

  -- Auto-hide if 3+ reports
  UPDATE reviews
  SET is_hidden = TRUE
  WHERE id = NEW.review_id
    AND report_count >= 3;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_report_insert
  AFTER INSERT ON review_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_review_reports();

/*
==================================================
FILE 2: Review reporting service
==================================================
*/

// filepath: src/services/review.ts (UPDATE)

export async function reportReview(
  reviewId: string,
  reporterId: string,
  reason: 'spam' | 'offensive' | 'false_info' | 'other',
  description: string | null
): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('review_reports')
      .insert({
        review_id: reviewId,
        reporter_id: reporterId,
        reason,
        description: description?.trim() || null,
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Report review error:', error);
    return false;
  }
}

// Update getUserReviews to exclude hidden reviews
export async function getUserReviews(userId: string): Promise<Review[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        users!reviewer_id(first_name, profile_image_url)
      `)
      .eq('reviewee_id', userId)
      .eq('is_hidden', false) // Exclude hidden reviews
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((review) => ({
      ...review,
      reviewer: review.users,
    }));
  } catch (error) {
    console.error('Get user reviews error:', error);
    return [];
  }
}

/*
==================================================
FILE 3: Report review UI
==================================================
*/

// filepath: src/components/ReviewCard.tsx (UPDATE)

// Add report button to ReviewCard
import { Menu } from 'react-native-paper'; // Or custom menu

// Inside ReviewCard component:
const [menuVisible, setMenuVisible] = useState(false);

const handleReport = async (reason: string) => {
  const success = await reportReview(review.id, currentUserId, reason, null);
  if (success) {
    Alert.alert('Success', 'Review reported. Thank you!');
  } else {
    Alert.alert('Error', 'Failed to report review.');
  }
  setMenuVisible(false);
};

// Add menu to ReviewCard header:
<Menu
  visible={menuVisible}
  onDismiss={() => setMenuVisible(false)}
  anchor={
    <TouchableOpacity onPress={() => setMenuVisible(true)}>
      <Ionicons name="ellipsis-horizontal" size={24} color="#6B7280" />
    </TouchableOpacity>
  }
>
  <Menu.Item onPress={() => handleReport('spam')} title="Report as spam" />
  <Menu.Item onPress={() => handleReport('offensive')} title="Report as offensive" />
  <Menu.Item onPress={() => handleReport('false_info')} title="Report false information" />
</Menu>

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Users can report reviews
✓ Report reasons: spam, offensive, false info
✓ One report per user per review
✓ Auto-hide reviews with 3+ reports
✓ Hidden reviews excluded from display

==================================================
NEXT TASK
==================================================

REVIEW-007: Create admin moderation queue
*/
```

### Time Breakdown: **~3 hours**

---

## TASK REVIEW-007: Create Admin Moderation Queue for Reported Reviews

**Duration:** 3.5 hours  
**Priority:** Low  
**Dependencies:** REVIEW-006 (Review reporting)

### Description
Create admin panel to view reported reviews. Show report count, reasons, and reporter info. Admin actions: approve (unhide), delete review, ban user. Filter by report reason. Pagination for large lists.

---

### AI Prompt for Cursor (Generate Admin Moderation Queue)

```typescript
/*
TASK: Create admin moderation queue for reviews

CONTEXT:
Admins review flagged content.
Take action: approve, delete, ban user.

REQUIREMENTS:
1. Admin panel for reported reviews
2. Show report count and reasons
3. Admin actions: approve, delete, ban
4. Filter by reason
5. Pagination

==================================================
FILE 1: Admin RLS policies
==================================================
*/

-- filepath: supabase/migrations/032_review_admin_policies.sql

-- Admin policy for review_reports
CREATE POLICY "Admins can view all review reports"
  ON review_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin policy for reviews (view hidden)
CREATE POLICY "Admins can view all reviews"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can update reviews (approve/delete)
CREATE POLICY "Admins can update reviews"
  ON reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

/*
==================================================
FILE 2: Admin review service
==================================================
*/

// filepath: src/services/admin/reviewModeration.ts

import { createClient } from '@/lib/supabase';

export interface ReportedReview {
  review: Review;
  reports: Array<{
    reporter_id: string;
    reason: string;
    description: string;
    created_at: string;
  }>;
  report_count: number;
}

export async function getReportedReviews(): Promise<ReportedReview[]> {
  const supabase = createClient();

  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        users!reviewer_id(first_name, profile_image_url),
        review_reports(reporter_id, reason, description, created_at)
      `)
      .eq('is_hidden', true)
      .order('report_count', { ascending: false });

    if (error) throw error;

    return (reviews || []).map((review) => ({
      review: {
        ...review,
        reviewer: review.users,
      },
      reports: review.review_reports,
      report_count: review.report_count,
    }));
  } catch (error) {
    console.error('Get reported reviews error:', error);
    return [];
  }
}

export async function approveReview(reviewId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('reviews')
      .update({ is_hidden: false, report_count: 0 })
      .eq('id', reviewId);

    if (error) throw error;

    // Delete all reports for this review
    await supabase
      .from('review_reports')
      .delete()
      .eq('review_id', reviewId);

    return true;
  } catch (error) {
    console.error('Approve review error:', error);
    return false;
  }
}

export async function deleteReview(reviewId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Delete review error:', error);
    return false;
  }
}

/*
==================================================
FILE 3: Admin moderation screen
==================================================
*/

// filepath: src/screens/admin/ReviewModerationScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  getReportedReviews,
  approveReview,
  deleteReview,
  ReportedReview,
} from '@/services/admin/reviewModeration';
import { ReviewCard } from '@/components/ReviewCard';

export function ReviewModerationScreen() {
  const [reportedReviews, setReportedReviews] = useState<ReportedReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportedReviews();
  }, []);

  const loadReportedReviews = async () => {
    setLoading(true);
    const reviews = await getReportedReviews();
    setReportedReviews(reviews);
    setLoading(false);
  };

  const handleApprove = async (reviewId: string) => {
    Alert.alert(
      'Approve Review',
      'This will unhide the review and delete all reports.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            const success = await approveReview(reviewId);
            if (success) {
              Alert.alert('Success', 'Review approved');
              loadReportedReviews();
            } else {
              Alert.alert('Error', 'Failed to approve review');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteReview(reviewId);
            if (success) {
              Alert.alert('Success', 'Review deleted');
              loadReportedReviews();
            } else {
              Alert.alert('Error', 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const renderReportedReview = ({ item }: { item: ReportedReview }) => {
    return (
      <View style={styles.reportedItem}>
        <ReviewCard review={item.review} />

        <View style={styles.reportInfo}>
          <Text style={styles.reportCount}>
            {item.report_count} {item.report_count === 1 ? 'report' : 'reports'}
          </Text>

          {item.reports.map((report, index) => (
            <View key={index} style={styles.reportDetail}>
              <Text style={styles.reportReason}>• {report.reason}</Text>
              {report.description && (
                <Text style={styles.reportDescription}>{report.description}</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item.review.id)}
          >
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.review.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review Moderation</Text>

      <FlatList
        data={reportedReviews}
        keyExtractor={(item) => item.review.id}
        renderItem={renderReportedReview}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No reported reviews</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    padding: 20,
  },
  reportedItem: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    padding: 16,
  },
  reportInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reportCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  reportDetail: {
    marginBottom: 8,
  },
  reportReason: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  reportDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 12,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 32,
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin panel shows reported reviews
✓ Display report count and reasons
✓ Admin can approve reviews (unhide)
✓ Admin can delete reviews
✓ Reports deleted on approval

==================================================
MODULE 08 COMPLETE
==================================================
*/
```

### Time Breakdown: **~3.5 hours**

---

---

## MODULE 08 SUMMARY

**Total Tasks:** 7  
**Estimated Time:** ~17 hours

### Task Breakdown

| Task | Description | Duration | Status |
|------|-------------|----------|--------|
| REVIEW-001 | Review submission UI (stars + comment) | 3h | ✅ Documented |
| REVIEW-002 | Mutual review flow | 2.5h | ✅ Documented |
| REVIEW-003 | Anonymous review option | 1.5h | ✅ Documented |
| REVIEW-004 | Optional reviews (skip) | 1h | ✅ Documented |
| REVIEW-005 | Display ratings on profile | 2.5h | ✅ Documented |
| REVIEW-006 | Review reporting system | 3h | ✅ Documented |
| REVIEW-007 | Admin moderation queue | 3.5h | ✅ Documented |

---

### Key Features

**Review Submission:**
- 1-5 star rating (required)
- Optional comment (max 500 chars)
- Anonymous option
- Submit after trade completion
- Edit within 24 hours

**Mutual Reviews:**
- Buyer reviews seller
- Seller reviews buyer
- Review status tracking
- Both reviews independent

**Profile Display:**
- Average rating (1-5 stars)
- Total review count
- Rating breakdown chart
- Recent reviews list
- Anonymous reviews handled

**Content Moderation:**
- Report inappropriate reviews
- Report reasons: spam, offensive, false info
- Auto-hide after 3+ reports
- Admin moderation queue
- Admin actions: approve, delete

---

### Database Tables

1. **reviews** - User reviews with ratings and comments
2. **review_reports** - Flagged reviews for moderation

---

### Security Considerations

**RLS Policies:**
- Users can view reviews about themselves
- Users can view reviews they wrote
- Users can create reviews for completed trades only
- Users can edit own reviews within 24 hours
- One review per user per trade
- Admins can view/update all reviews

**Content Moderation:**
- Auto-hide reviews with 3+ reports
- Admin review before permanent deletion
- Report abuse prevention (one report per user per review)

**Privacy:**
- Anonymous reviews hide reviewer identity
- Reviewer name replaced with "Anonymous User"
- Profile image hidden for anonymous reviews

---

### Analytics Events

1. `review_submitted` - User submitted review
2. `review_skipped` - User skipped review
3. `review_reported` - User reported review
4. `review_auto_hidden` - Review auto-hidden (3+ reports)
5. `review_approved` - Admin approved review
6. `review_deleted` - Admin deleted review

---

### Testing Checklist

**Review Submission:**
- [ ] Submit review with rating only → Success
- [ ] Submit review with rating + comment → Success
- [ ] Submit without rating → Error
- [ ] Submit with 501 char comment → Limited to 500
- [ ] Submit duplicate review → Error
- [ ] Edit review within 24h → Success
- [ ] Edit review after 24h → Error

**Mutual Reviews:**
- [ ] Complete trade → Both users can review
- [ ] Buyer reviews seller → Success
- [ ] Seller reviews buyer → Success
- [ ] Reviews independent (one doesn't block other)

**Anonymous Reviews:**
- [ ] Submit anonymous review → Name hidden
- [ ] View anonymous review → "Anonymous User" shown
- [ ] Profile image hidden for anonymous

**Profile Display:**
- [ ] Average rating calculated correctly
- [ ] Total review count accurate
- [ ] Rating breakdown chart displays
- [ ] Recent reviews listed
- [ ] Hidden reviews excluded

**Content Moderation:**
- [ ] Report review → Saved to database
- [ ] 3rd report → Review auto-hidden
- [ ] Admin approve → Review unhidden
- [ ] Admin delete → Review removed
- [ ] Duplicate reports prevented

---

### Future Enhancements (Post-MVP)

1. **Review Responses** - Allow reviewees to respond to reviews
2. **Verified Reviews** - Badge for verified trade reviews
3. **Review Photos** - Attach photos to reviews
4. **Review Helpfulness** - "Was this review helpful?" votes
5. **Review Trends** - Rating trends over time
6. **Seller Metrics** - Response rate, avg. ship time, etc.
7. **Review Templates** - Quick review templates
8. **Review Reminders** - Nudge users to leave reviews

---

**MODULE 08: REVIEWS & RATINGS - COMPLETE**

Both modules documented! Next steps:
1. Create verification reports (MODULE-07-VERIFICATION.md and MODULE-08-VERIFICATION.md)
2. Continue with remaining modules (09-15)?
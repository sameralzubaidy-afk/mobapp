# MODULE 08 VERIFICATION: REVIEWS & RATINGS

**Module:** MODULE-08-REVIEWS-RATINGS  
**Total Tasks:** 7  
**Estimated Time:** ~17 hours  
**Status:** ✅ Ready for Implementation

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

## DELIVERABLES CHECKLIST

### Database Migrations

- [ ] **030_reviews.sql** - Reviews table with RLS policies
  - reviews table (id, trade_id, reviewer_id, reviewee_id, rating, comment, is_anonymous, created_at)
  - RLS policies for viewing and creating reviews
  - Unique constraint: one review per user per trade
  - Indexes on reviewer_id, reviewee_id, trade_id
  - Trigger for updated_at timestamp

- [ ] **031_review_reports.sql** - Review reporting system
  - review_reports table (id, review_id, reporter_id, reason, description, created_at)
  - RLS policies for creating and viewing reports
  - Add is_hidden and report_count to reviews table
  - Function: `check_review_reports()` - Auto-hide after 3+ reports
  - Trigger on report insert

- [ ] **032_review_admin_policies.sql** - Admin moderation policies
  - Admin RLS policy to view all review_reports
  - Admin RLS policy to view hidden reviews
  - Admin RLS policy to update reviews

### Backend Services

- [ ] **src/services/review.ts** - Review service
  - `submitReview()` - Submit review with rating and comment
  - `getUserReviews()` - Fetch user's received reviews
  - `getReviewStats()` - Calculate average rating and breakdown
  - `canReviewUser()` - Check if user can review
  - `reportReview()` - Report inappropriate review

- [ ] **src/services/admin/reviewModeration.ts** - Admin moderation service
  - `getReportedReviews()` - Fetch all reported reviews
  - `approveReview()` - Unhide review and delete reports
  - `deleteReview()` - Permanently delete review

### Frontend Components

- [ ] **src/screens/review/SubmitReviewScreen.tsx** - Review submission UI
  - Star rating selector (1-5)
  - Optional comment field (max 500 chars)
  - Anonymous option checkbox
  - Submit button with validation
  - Character count for comment

- [ ] **src/components/StarRating.tsx** - Star rating component
  - Display 1-5 stars
  - Editable mode for selection
  - Read-only mode for display
  - Customizable size

- [ ] **src/components/ReviewCard.tsx** - Review display component
  - Display review with rating and comment
  - Show reviewer name (or "Anonymous User")
  - Reviewer profile image (hidden if anonymous)
  - Timestamp
  - Report menu (3-dot menu)

- [ ] **src/screens/profile/UserProfileScreen.tsx** - Profile with reviews
  - Average rating display
  - Total review count
  - Rating breakdown chart
  - Recent reviews list
  - Pagination for large lists

- [ ] **src/screens/admin/ReviewModerationScreen.tsx** - Admin moderation panel
  - List of reported reviews
  - Show report count and reasons
  - Approve/Delete actions
  - Filter by reason
  - Pagination

### Trade Flow Integration

- [ ] **src/screens/trade/TradeDetailsScreen.tsx** - Review prompt
  - Show "Review" button after trade completion
  - Check if user already reviewed
  - Navigate to SubmitReviewScreen

---

## FEATURE FLOWS

### 1. Submit Review Flow

**User Journey:**
1. Trade completes → Review prompt appears
2. User taps "Review [User Name]"
3. Selects star rating (1-5)
4. Optionally enters comment (max 500 chars)
5. Optionally checks "Anonymous" box
6. Taps "Submit Review"
7. Review saved to database
8. Confirmation message shown

**Technical Steps:**
1. Trade status set to `completed` → `completed_at` timestamp saved
2. App shows review button if `canReviewUser()` returns true
3. User navigates to `SubmitReviewScreen` with:
   - `tradeId`
   - `revieweeId`
   - `revieweeName`
4. User selects rating → `setRating(1-5)`
5. User enters comment → `setComment(text)`
6. User checks anonymous → `setIsAnonymous(true)`
7. Tap Submit → Call `submitReview(tradeId, reviewerId, revieweeId, rating, comment, isAnonymous)`
8. Insert into `reviews` table
9. RLS policy verifies:
   - `reviewer_id = auth.uid()`
   - Trade is completed
   - No existing review for this trade
10. Review saved → Navigate back

**Database Implications:**
- Insert into `reviews` table
- Unique constraint prevents duplicate reviews
- RLS enforces trade completion and user participation

---

### 2. Mutual Review Flow

**User Journey:**
1. Buyer completes trade → Can review seller
2. Seller completes trade → Can review buyer
3. Both reviews independent (one doesn't block other)
4. Both reviews visible on respective profiles

**Technical Steps:**
1. Trade completes → Both `buyer_id` and `seller_id` can review
2. Buyer reviews seller:
   - `reviewer_id = buyer_id`
   - `reviewee_id = seller_id`
3. Seller reviews buyer:
   - `reviewer_id = seller_id`
   - `reviewee_id = buyer_id`
4. Both reviews saved independently
5. `canReviewUser()` checks for existing review:
   - Query `reviews` where `trade_id = X AND reviewer_id = Y`
   - Return false if review exists
6. Review button shown only if no review yet

**Database Implications:**
- Two separate rows in `reviews` table (one per direction)
- Unique constraint on (trade_id, reviewer_id) prevents duplicates

---

### 3. Anonymous Review Flow

**User Journey:**
1. User submits review with "Anonymous" checked
2. Review saved with `is_anonymous = true`
3. Review displays "Anonymous User" instead of name
4. Reviewer profile image hidden

**Technical Steps:**
1. User checks anonymous checkbox → `setIsAnonymous(true)`
2. Submit review with `is_anonymous = true`
3. `ReviewCard` component checks `review.is_anonymous`:
   - If true: Display "Anonymous User" + generic avatar
   - If false: Display `review.reviewer.first_name` + profile image
4. RLS policies still enforce access control (reviewee can see review)

**Database Implications:**
- `is_anonymous` column in `reviews` table
- No impact on RLS policies (reviewer ID still stored)

---

### 4. Display Reviews on Profile Flow

**User Journey:**
1. User views another user's profile
2. Average rating displayed at top (e.g., 4.5 ★)
3. Total review count shown (e.g., "23 reviews")
4. Rating breakdown chart (5★: 60%, 4★: 30%, etc.)
5. Recent reviews listed below
6. Scroll to load more reviews (pagination)

**Technical Steps:**
1. Load user profile → Call `getReviewStats(userId)` and `getUserReviews(userId)`
2. `getReviewStats()`:
   - Query all reviews for `reviewee_id = userId`
   - Calculate average: `SUM(rating) / COUNT(*)`
   - Calculate breakdown: `COUNT(*) GROUP BY rating`
3. Display stats in profile header:
   - Large number: "4.5"
   - Star rating component: `<StarRating rating={4.5} />`
   - Total count: "23 reviews"
4. Display breakdown chart:
   - For each star level (5-1):
     - Calculate percentage: `count / total * 100`
     - Display bar with width = percentage
5. Display recent reviews using `ReviewCard` component
6. Pagination: Load 10 reviews at a time, infinite scroll

**Database Implications:**
- Query `reviews` table filtered by `reviewee_id`
- Exclude hidden reviews: `is_hidden = false`
- Order by `created_at DESC`

---

### 5. Report Review Flow

**User Journey:**
1. User sees inappropriate review
2. Taps 3-dot menu on review
3. Selects "Report" → Choose reason (spam, offensive, false info)
4. Optionally enters description
5. Taps "Submit Report"
6. Review flagged for moderation
7. After 3 reports, review auto-hidden

**Technical Steps:**
1. User taps menu icon → Show dropdown menu
2. Tap "Report" → Show reason selector
3. User selects reason → `setReason('spam')`
4. Optionally enters description → `setDescription(text)`
5. Submit → Call `reportReview(reviewId, reporterId, reason, description)`
6. Insert into `review_reports` table
7. Trigger `check_review_reports()` runs:
   - Update `reviews.report_count = COUNT(review_reports)`
   - If `report_count >= 3`: Set `reviews.is_hidden = true`
8. Hidden reviews excluded from `getUserReviews()`

**Database Implications:**
- Insert into `review_reports` table
- Unique constraint prevents duplicate reports from same user
- Trigger updates `reviews` table with report count
- Auto-hide logic in trigger

---

### 6. Admin Moderation Flow

**User Journey:**
1. Admin opens Review Moderation screen
2. Sees list of reported reviews (sorted by report count)
3. Reviews details: rating, comment, report reasons
4. Admin actions:
   - **Approve:** Unhide review, delete all reports
   - **Delete:** Permanently remove review
5. Confirmation prompt before action
6. Review removed from moderation queue

**Technical Steps:**
1. Admin navigates to `ReviewModerationScreen`
2. Call `getReportedReviews()`:
   - Query `reviews` where `is_hidden = true`
   - Join with `review_reports` to get report details
   - Order by `report_count DESC`
3. Display list of reported reviews with:
   - Review content (rating, comment)
   - Report count and reasons
   - Approve/Delete buttons
4. **Approve action:**
   - Call `approveReview(reviewId)`
   - Update `reviews` set `is_hidden = false, report_count = 0`
   - Delete all reports: `DELETE FROM review_reports WHERE review_id = X`
5. **Delete action:**
   - Call `deleteReview(reviewId)`
   - Delete review: `DELETE FROM reviews WHERE id = X`
   - Cascade deletes all reports (ON DELETE CASCADE)
6. Refresh moderation queue

**Database Implications:**
- Admin RLS policies allow viewing/updating all reviews
- Approve action resets review to visible state
- Delete action permanently removes review (cascade deletes reports)

---

## DATABASE SCHEMA VERIFICATION

### Reviews Table

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  report_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_review_per_trade UNIQUE (trade_id, reviewer_id)
);
```

**Indexes:**
- `reviews_reviewer_id_idx` - Fast lookup by reviewer
- `reviews_reviewee_id_idx` - Fast lookup by reviewee
- `reviews_trade_id_idx` - Fast lookup by trade

**RLS Policies:**
- Users can view reviews about themselves (`reviewee_id = auth.uid()`)
- Users can view reviews they wrote (`reviewer_id = auth.uid()`)
- Users can create reviews for completed trades
- Users can update own reviews within 24 hours
- Admins can view/update all reviews

---

### Review Reports Table

```sql
CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'false_info', 'other')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_report_per_review UNIQUE (review_id, reporter_id)
);
```

**Indexes:**
- `review_reports_review_id_idx` - Fast lookup by review
- `review_reports_reporter_id_idx` - Fast lookup by reporter

**RLS Policies:**
- Users can create reports (`reporter_id = auth.uid()`)
- Users can view own reports (`reporter_id = auth.uid()`)
- Admins can view all reports

---

## TESTING CHECKLIST

### Unit Tests

- [ ] **review.ts service tests**
  - `submitReview()` - Creates review with correct fields
  - `getUserReviews()` - Excludes hidden reviews
  - `getReviewStats()` - Calculates average and breakdown correctly
  - `canReviewUser()` - Returns false if review exists or trade incomplete
  - `reportReview()` - Creates report with correct reason

- [ ] **reviewModeration.ts service tests**
  - `getReportedReviews()` - Returns only hidden reviews
  - `approveReview()` - Unhides review and deletes reports
  - `deleteReview()` - Permanently deletes review

### Integration Tests

- [ ] **Review submission**
  - Submit review → Saved to database
  - Submit without rating → Error
  - Submit duplicate review → Error
  - Submit for incomplete trade → Error
  - Edit review within 24h → Success
  - Edit review after 24h → Error

- [ ] **Mutual reviews**
  - Buyer reviews seller → Success
  - Seller reviews buyer → Success
  - Both reviews independent
  - Both reviews visible on profiles

- [ ] **Anonymous reviews**
  - Submit anonymous review → `is_anonymous = true`
  - View anonymous review → "Anonymous User" displayed
  - Profile image hidden

- [ ] **Profile display**
  - Average rating calculated correctly
  - Total review count accurate
  - Rating breakdown percentages correct
  - Recent reviews listed in order
  - Hidden reviews excluded

- [ ] **Review reporting**
  - Report review → Saved to database
  - 3rd report → Review auto-hidden
  - Duplicate report prevented
  - Hidden reviews excluded from profile

- [ ] **Admin moderation**
  - Admin views reported reviews
  - Approve review → Unhidden, reports deleted
  - Delete review → Permanently removed
  - Non-admin cannot access moderation screen

### UI/UX Tests

- [ ] **SubmitReviewScreen**
  - Star rating selectable (1-5)
  - Comment field accepts text (max 500 chars)
  - Character counter updates
  - Anonymous checkbox toggles
  - Submit button disabled without rating
  - Validation errors shown

- [ ] **UserProfileScreen**
  - Average rating displayed prominently
  - Total review count shown
  - Rating breakdown chart displays correctly
  - Recent reviews listed
  - Anonymous reviews handled correctly
  - Pagination works for large lists

- [ ] **ReviewCard**
  - Rating stars displayed correctly
  - Comment text wrapped properly
  - Reviewer name shown (or "Anonymous User")
  - Profile image shown (or placeholder)
  - Timestamp formatted correctly
  - Report menu accessible via 3-dot icon

- [ ] **ReviewModerationScreen (Admin)**
  - Reported reviews listed
  - Report count and reasons shown
  - Approve button works
  - Delete button works
  - Confirmation prompts displayed
  - List updates after action

### RLS Policy Tests

- [ ] **Review visibility**
  - Users can view reviews about themselves
  - Users can view reviews they wrote
  - Users cannot view others' reviews (except on profiles)
  - Admins can view all reviews

- [ ] **Review creation**
  - Trade participants can create reviews
  - Non-participants cannot create reviews
  - Only for completed trades
  - One review per user per trade

- [ ] **Report creation**
  - Any user can report reviews
  - One report per user per review
  - Admins can view all reports

### Performance Tests

- [ ] **Review stats calculation**
  - Calculate stats for 1000+ reviews in < 500ms
  - Breakdown query optimized with proper indexes

- [ ] **Review list loading**
  - Load 100+ reviews in < 1 second
  - Pagination improves performance
  - Smooth scrolling with large lists

---

## SECURITY CONSIDERATIONS

**Review Integrity:**
- One review per user per trade (unique constraint)
- Can only review completed trades
- 24-hour edit window prevents abuse
- RLS policies enforce access control

**Anonymous Reviews:**
- Reviewer ID still stored (for moderation)
- Display name/image hidden on frontend
- Abuse prevention: report system applies

**Content Moderation:**
- Auto-hide after 3 reports
- Admin review before permanent deletion
- Report reasons categorized
- Duplicate reports prevented

**Privacy:**
- Users can only view reviews about themselves or reviews they wrote
- Admins have full access (for moderation)
- No public review feed (privacy-first)

---

## ANALYTICS & MONITORING

**Events to Track:**
1. `review_submitted` - User submitted review
2. `review_skipped` - User skipped review
3. `review_reported` - User reported review
4. `review_auto_hidden` - Review auto-hidden (3+ reports)
5. `review_approved` - Admin approved review
6. `review_deleted` - Admin deleted review

**Metrics to Monitor:**
- Review completion rate (% of completed trades with review)
- Average rating across platform
- Report rate (% of reviews reported)
- Auto-hide rate (% of reviews auto-hidden)
- Admin action rate (approve vs. delete)

---

## COST ANALYSIS

**Database Storage:**
- Average review: ~200 bytes (rating + comment)
- 1000 reviews/month × 200 bytes = 200KB
- **Estimated:** Negligible storage cost

**Compute:**
- Review stats calculation: Lightweight query
- Report checking: Triggered on each report insert
- **Estimated:** Negligible compute cost

**Total:** ~$0/month (covered by Supabase free tier)

---

## KNOWN LIMITATIONS & POST-MVP

**Current Limitations:**
- Reviews cannot be edited after 24 hours
- No review responses (reviewee cannot reply)
- No photo attachments in reviews
- No "helpful" voting on reviews
- Admin moderation manual (no auto-moderation AI)

**Future Enhancements:**
1. **Review Responses** - Allow reviewees to respond
2. **Verified Reviews** - Badge for verified trades
3. **Review Photos** - Attach photos to reviews
4. **Helpful Voting** - "Was this helpful?" votes
5. **Review Trends** - Rating trends over time
6. **Seller Metrics** - Response rate, ship time, etc.
7. **Review Templates** - Quick review templates
8. **Review Reminders** - Nudge users to leave reviews
9. **AI Moderation** - Auto-detect inappropriate content
10. **Review Insights** - Sentiment analysis for sellers

**Known Issues:**
- Large review lists may impact performance (optimize with pagination)
- Review stats recalculated on each query (consider caching)
- Anonymous reviews may reduce trust (consider verification system)

---

## ROLLOUT PLAN

**Phase 1: Core Reviews (Week 1)**
- REVIEW-001: Review submission UI
- REVIEW-002: Mutual review flow
- REVIEW-005: Display on profile
- Test with small user group

**Phase 2: Privacy & Moderation (Week 2)**
- REVIEW-003: Anonymous reviews
- REVIEW-004: Optional reviews (skip)
- REVIEW-006: Review reporting
- Test moderation workflow

**Phase 3: Admin Tools (Week 3)**
- REVIEW-007: Admin moderation queue
- Train admins on moderation guidelines
- Test admin actions

**Phase 4: Optimization (Week 4)**
- Performance tuning (caching, indexes)
- Bug fixes
- User feedback incorporation

---

## VERIFICATION COMPLETE ✅

**Ready for Implementation:** All tasks documented with clear requirements, acceptance criteria, and test plans.

**Next Steps:**
1. Review with team
2. Set up moderation guidelines
3. Train admins on moderation tools
4. Begin implementation with REVIEW-001

**Estimated Total Time:** ~17 hours for complete implementation

---

**MODULE 08 VERIFICATION - COMPLETE**

# MODULE-04 VERIFICATION CHECKLIST (V2)

**Module:** Item Listing & Catalog Management  
**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Last Updated:** [Auto-generated timestamp]

---

## PURPOSE

This checklist ensures that MODULE-04 (Item Listing & Catalog Management V2) has been fully implemented with:
1. All database migrations and schema changes.
2. All TypeScript types and service functions.
3. All UI components for listing creation, editing, and browsing.
4. All admin tools for listing management.
5. Full test coverage.
6. Cross-module integration with MODULE-11 (Subscriptions) and MODULE-06 (Trade Flow).

---

## VERIFICATION CHECKLIST

### 1. DATABASE & SCHEMA (LISTING-V2-001)

- [ ] **Migration `040_listings_v2.sql` applied** to production database
  - [ ] Column `accepts_swap_points` added (BOOLEAN, default FALSE)
  - [ ] Column `seller_subscription_status_at_creation` added (TEXT, nullable)
  - [ ] Column `last_edited_at` added (TIMESTAMPTZ, default NOW)
  - [ ] Index on `accepts_swap_points` created for SP filtering
  - [ ] Index on `seller_id` created for "my listings" queries

- [ ] **TypeScript types updated** (`src/types/listing.ts`)
  - [ ] `ListingStatus` type includes: `active`, `paused`, `sold`, `deleted`
  - [ ] `Listing` interface matches V2 schema with all new fields

- [ ] **Database constraints verified**
  - [ ] `price_cents` must be > 0
  - [ ] `status` defaults to `active` on creation
  - [ ] `accepts_swap_points` defaults to FALSE for backward compatibility

---

### 2. CREATE LISTING WITH SP PREFERENCE (LISTING-V2-002)

- [ ] **Service function `createListingV2` implemented** (`src/services/listing.ts`)
  - [ ] Validates `priceCents` > 0
  - [ ] Calls `getSubscriptionSummary(sellerId)` from MODULE-11
  - [ ] Validates: if `acceptsSwapPoints = true`, requires `can_spend_sp = true`
  - [ ] Throws error if non-subscriber tries to enable SP payment
  - [ ] Creates listing with `seller_subscription_status_at_creation` for audit
  - [ ] Sets `status = active`, `created_at`, and `last_edited_at` timestamps
  - [ ] Returns created listing object

- [ ] **UI: CreateListingScreen** (`src/screens/CreateListingScreen.tsx`)
  - [ ] Form fields: item name, description, price, category, condition, image upload
  - [ ] SP payment toggle shown only to subscribers (`can_spend_sp = true`)
  - [ ] Non-subscribers see upgrade CTA instead of SP toggle
  - [ ] "Create Listing" button calls `createListingV2` and navigates to "My Listings"

- [ ] **Integration with MODULE-11 verified**
  - [ ] `getSubscriptionSummary` returns correct `can_spend_sp` for trial/active users
  - [ ] Non-subscribers (free, grace_period, expired) cannot enable SP payment

- [ ] **Unit tests passing**
  - [ ] Test: Active subscriber can enable SP payment → `accepts_swap_points = true`
  - [ ] Test: Non-subscriber enabling SP payment → throws error
  - [ ] Test: Listing created with seller subscription status captured

---

### 3. EDIT & DELETE LISTING (LISTING-V2-003)

- [ ] **Service function `updateListingV2` implemented** (`src/services/listing.ts`)
  - [ ] Fetches listing to verify ownership (`seller_id === userId`)
  - [ ] Checks for active trades (pending, payment_processing, in_progress)
  - [ ] Throws error if active trades exist (integrity constraint)
  - [ ] If updating `acceptsSwapPoints`, re-validates seller subscription
  - [ ] Updates listing with new fields and `last_edited_at` timestamp
  - [ ] Returns updated listing object

- [ ] **Service function `deleteListingV2` implemented** (`src/services/listing.ts`)
  - [ ] Fetches listing to verify ownership
  - [ ] Soft-deletes by setting `status = deleted`
  - [ ] Updates `last_edited_at` timestamp
  - [ ] Does NOT hard-delete row (audit trail preserved)

- [ ] **UI: Edit/Delete actions** (in ListingDetailScreen or MyListingsScreen)
  - [ ] Edit button navigates to EditListingScreen with pre-filled form
  - [ ] Delete button shows confirmation dialog before calling `deleteListingV2`
  - [ ] Error messages shown if edit/delete fails (active trades, ownership)

- [ ] **Tests passing**
  - [ ] Test: Owner can edit listing (no active trades) → success
  - [ ] Test: Owner cannot edit listing with active trade → throws error
  - [ ] Test: Non-owner cannot edit/delete listing → throws error
  - [ ] Test: Delete soft-deletes listing → `status = deleted`

---

### 4. BROWSE & FILTER SP-ELIGIBLE LISTINGS (LISTING-V2-004)

- [ ] **Service function `fetchListings` implemented** (`src/services/listing.ts`)
  - [ ] Accepts filters: `category`, `minPriceCents`, `maxPriceCents`, `condition`, `spEligibleOnly`
  - [ ] Filters for `status = active` (excludes deleted/sold)
  - [ ] If `spEligibleOnly = true`, adds filter `accepts_swap_points = true`
  - [ ] Returns array of listings ordered by `created_at` descending

- [ ] **UI: BrowseListingsScreen** (`src/screens/BrowseListingsScreen.tsx`)
  - [ ] Toggle filter: "Show only SP-eligible listings"
  - [ ] Category dropdown filter (optional)
  - [ ] Price range slider (optional)
  - [ ] Listings display with "✓ SP Eligible" badge if `accepts_swap_points = true`
  - [ ] Tapping listing navigates to ListingDetailScreen

- [ ] **Real-time updates** (optional)
  - [ ] Supabase subscription for `listings` table updates
  - [ ] New listings appear in catalog without refresh

- [ ] **Tests passing**
  - [ ] Test: Fetch all active listings → returns only `status = active`
  - [ ] Test: Fetch SP-eligible only → returns only `accepts_swap_points = true`
  - [ ] Test: Filter by category → returns matching category

---

### 5. LISTING DETAIL VIEW WITH SP CONTEXT (LISTING-V2-005)

- [ ] **UI: ListingDetailScreen** (`src/screens/ListingDetailScreen.tsx`)
  - [ ] Displays item name, description, price, images, condition
  - [ ] Shows "✓ Swap Points Accepted" badge if `accepts_swap_points = true`
  - [ ] If buyer is subscriber with SP: "You can use Swap Points as partial payment!"
  - [ ] If buyer is non-subscriber: "Subscribe to Kids Club+ to use Swap Points on this item."
  - [ ] Transaction fee disclosure: $0.99 for subscribers, $2.99 for non-subscribers
  - [ ] Total price calculation: `item_price + fee` (before SP discount)
  - [ ] "Buy Now" button navigates to InitiateTradeScreen (MODULE-06)

- [ ] **Integration with buyer subscription**
  - [ ] Fetches buyer's subscription via `getSubscriptionSummary(userId)`
  - [ ] Fee amount computed: `isSubscriber ? 0.99 : 2.99`

- [ ] **Tests passing**
  - [ ] Test: Subscriber sees SP usage prompt if listing accepts SP
  - [ ] Test: Non-subscriber sees upgrade prompt if listing accepts SP
  - [ ] Test: Fee disclosure matches buyer subscription status

---

### 6. ADMIN TOOLS (LISTING-V2-006)

- [ ] **Admin Listing Search UI** (`src/admin/components/ListingSearch.tsx`)
  - [ ] Search by listing ID, seller ID, or item name
  - [ ] Filter by status (all, active, paused, sold, deleted)
  - [ ] Results display: listing ID, item name, status, SP eligibility

- [ ] **Admin Listing Detail View** (`src/admin/components/ListingDetail.tsx`)
  - [ ] Full listing details
  - [ ] Seller subscription status at creation vs current (audit trail)
  - [ ] Action buttons: Force Delete (with reason input)

- [ ] **Admin RPC `admin_force_delete_listing` deployed**
  - [ ] Updates listing `status = deleted`
  - [ ] Logs admin action in `admin_action_logs` table with reason
  - [ ] Security: Only admin users can call (via RLS or service role key)

- [ ] **Analytics Dashboard** (optional)
  - [ ] SP-eligible listing adoption rate (% of listings with `accepts_swap_points = true`)
  - [ ] Average listing price by category
  - [ ] Most popular categories

- [ ] **Tests passing**
  - [ ] Test: Admin can search and filter listings
  - [ ] Test: Admin force-delete logs action with reason

---

### 7. TESTS & MODULE SUMMARY (LISTING-V2-007)

- [ ] **Unit tests implemented** (`src/services/listing.test.ts`)
  - [ ] `createListingV2` tests (4+ test cases):
    - [ ] Subscriber enables SP payment → success
    - [ ] Non-subscriber enables SP payment → throws error
    - [ ] Listing created with audit fields
  - [ ] `updateListingV2` tests (3+ test cases):
    - [ ] Owner edits listing (no active trades) → success
    - [ ] Owner edits listing with active trade → throws error
    - [ ] Non-owner edits listing → throws error
  - [ ] `deleteListingV2` tests (2+ test cases):
    - [ ] Owner deletes listing → soft-delete success
    - [ ] Non-owner deletes listing → throws error
  - [ ] `fetchListings` tests (3+ test cases):
    - [ ] Fetch all active listings
    - [ ] Filter SP-eligible only
    - [ ] Filter by category

- [ ] **Integration tests implemented** (optional)
  - [ ] E2E: Create listing → browse catalog → view detail → buy now
  - [ ] Admin: Search → force-delete → verify audit log

- [ ] **Module summary document complete** (included in MODULE-04-ITEM-LISTING-V2.md)
  - [ ] Listing lifecycle state diagram
  - [ ] Cross-module contracts (MODULE-11, MODULE-06)
  - [ ] API surface documented
  - [ ] Key rules summarized

- [ ] **All tests passing in CI/CD**
  - [ ] Unit tests pass
  - [ ] Integration tests pass (if applicable)
  - [ ] Test coverage >= 80% for listing services

---

## CROSS-MODULE INTEGRATION VERIFICATION

### Integration with MODULE-11 (Subscriptions)

- [ ] **`getSubscriptionSummary(userId)` called correctly:**
  - [ ] Returns `can_spend_sp`, `is_subscriber`, `status`
  - [ ] Used to gate SP payment option in CreateListingScreen
  - [ ] Used to validate `acceptsSwapPoints` in `createListingV2` and `updateListingV2`

- [ ] **SP gating verified:**
  - [ ] Only `trial` and `active` subscribers can enable `accepts_swap_points`
  - [ ] Users in `grace_period`, `expired`, or `free` cannot enable SP payment

### Integration with MODULE-06 (Trade Flow)

- [ ] **Listing `accepts_swap_points` field used in trade initiation:**
  - [ ] If `accepts_swap_points = false`, buyer cannot use SP (or UI hides SP option)
  - [ ] If `accepts_swap_points = true`, buyer can apply SP discount (if subscriber)

- [ ] **Trade integrity constraints:**
  - [ ] Listings with active trades (pending, in_progress) cannot be edited or deleted
  - [ ] This prevents price manipulation mid-trade

---

## DEPLOYMENT CHECKLIST

- [ ] **Database migrations applied to production**
  - [ ] `040_listings_v2.sql` migration run successfully
  - [ ] `041_admin_force_delete_listing.sql` migration run successfully

- [ ] **Environment variables configured**
  - [ ] (No new environment variables needed for this module)

- [ ] **Mobile app deployed**
  - [ ] CreateListingScreen live
  - [ ] BrowseListingsScreen live
  - [ ] ListingDetailScreen live
  - [ ] EditListingScreen live (if separate from Create)

- [ ] **Admin dashboard deployed**
  - [ ] Listing search and detail views accessible to admin users
  - [ ] Force-delete action restricted to admin roles

---

## ACCEPTANCE SIGN-OFF

- [ ] **Product Owner Approval**
  - [ ] Listing creation flow matches V2 requirements (SP payment option for subscribers)
  - [ ] Catalog browsing with SP filter approved

- [ ] **Engineering Lead Approval**
  - [ ] All code reviewed and merged
  - [ ] Test coverage meets standards
  - [ ] Performance benchmarks met

- [ ] **QA Sign-Off**
  - [ ] All test cases passed
  - [ ] Edge cases validated (edit constraints, SP gating, etc.)
  - [ ] No critical bugs outstanding

---

## NOTES

- **SP Payment Adoption**: Track adoption rate of `accepts_swap_points` to measure V2 feature success.
- **Listing Edit Constraints**: Prevent mid-trade edits to maintain trade integrity; future enhancement could allow price edits for paused listings.
- **Soft Delete Rationale**: Preserve audit trail for completed trades referencing deleted listings.
- **Image Upload**: Image handling (upload to S3/Supabase Storage) is assumed implemented; not specified in detail here.

---

## CHANGELOG

| Date       | Author | Change Description                          |
|------------|--------|---------------------------------------------|
| [Date]     | AI     | Initial V2 verification checklist created   |

---

**End of MODULE-04-VERIFICATION-V2.md**

# MODULE-05 VERIFICATION CHECKLIST (V2)

**Module:** Search & Discovery  
**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Last Updated:** [Auto-generated timestamp]

---

## VERIFICATION CHECKLIST

### 1. FULL-TEXT SEARCH (DISCOVERY-V2-001)

- [ ] Migration `050_listings_search_index.sql` applied
  - [ ] `search_vector` tsvector column added to listings table
  - [ ] GIN index created on `search_vector`
  - [ ] Search weights: item_name (A), description (B), category (C)

- [ ] RPC `search_listings` deployed
  - [ ] Returns results ranked by relevance (ts_rank)
  - [ ] SP-eligible filter works correctly
  - [ ] Limit parameter enforced

- [ ] Service `searchListings` implemented
  - [ ] Calls `search_listings` RPC
  - [ ] Returns SearchResult array

- [ ] Tests passing
  - [ ] Search returns relevant results
  - [ ] SP filter excludes non-SP items
  - [ ] Search performance < 100ms

### 2. PERSONALIZED RECOMMENDATIONS (DISCOVERY-V2-002)

- [ ] RPC `get_recommendations` deployed
  - [ ] Fetches user SP balance and subscription status
  - [ ] Scores SP-eligible items higher for subscribers
  - [ ] Suggests items within user's SP budget
  - [ ] Randomization within score tiers

- [ ] Service `getRecommendations` implemented

- [ ] UI `RecommendationsCarousel` component
  - [ ] Displays on home screen
  - [ ] Shows "SP Eligible" badge

- [ ] Tests passing
  - [ ] Subscribers see SP-eligible items prioritized
  - [ ] Recommendations within SP balance range

### 3. CATEGORY BROWSING (DISCOVERY-V2-003)

- [ ] Service `fetchListingsByCategory` implemented
  - [ ] Filters by category and SP eligibility

- [ ] UI `CategoryBrowseScreen`
  - [ ] SP toggle filter
  - [ ] Categories: Toys, Books, Clothes, Games, Sports, Electronics

### 4. SEARCH UI & TESTS (DISCOVERY-V2-004)

- [ ] UI `SearchScreen` implemented
  - [ ] Search input with real-time results
  - [ ] SP-eligible toggle
  - [ ] Relevance score displayed (dev mode)

- [ ] All tests passing in CI/CD

---

**End of MODULE-05-VERIFICATION-V2.md**
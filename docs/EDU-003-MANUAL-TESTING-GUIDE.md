# EDU-003 Manual Testing Guide

**Module:** MODULE-18 TRADING EDUCATION V1  
**Task:** EDU-003 Backend Services — Content + Example + SP Calculator + Analytics  
**Date:** May 3, 2026  
**Tester:** _____________________

## Prerequisites

Before testing, ensure:
- [ ] Migrations 000018-000021 applied to Supabase staging
- [ ] Seed data present (4 published sections + 3 examples)
- [ ] At least one active category with `sp_earning_multiplier > 1.10` (bonus category)
- [ ] Test user profile exists with `user_id` = `test-user-edu`

## Test Cases

### TC-EDU-003-001: Content Service — Get Published Sections

**Objective:** Verify getPublishedSections() returns only published sections ordered correctly

**Steps:**
1. Open React Native Debugger / Chrome DevTools
2. In mobile app console:
   ```javascript
   import { getPublishedSections } from './src/services/educationContentService';
   const sections = await getPublishedSections();
   console.log(sections);
   ```

**Expected Results:**
- [ ] Returns array of 4+ sections
- [ ] All have `is_published: true`
- [ ] Ordered by `display_order` (ascending)
- [ ] Each section has: `id, title, body, section_type, image_url, published_at, created_at`

---

### TC-EDU-003-002: Content Service — Get Section By Type

**Objective:** Verify getSectionByType() returns single published section

**Steps:**
1. In mobile app console:
   ```javascript
   import { getSectionByType } from './src/services/educationContentService';
   const section = await getSectionByType('sp_definition');
   console.log(section);
   ```

**Expected Results:**
- [ ] Returns single section object (not array)
- [ ] `section_type === 'sp_definition'`
- [ ] `is_published === true`
- [ ] Title and body are non-empty strings

---

### TC-EDU-003-003: Example Service — Calculate Example SP

**Objective:** Verify calculateExampleSP() delegates to MODULE-12 V3 correctly

**Steps:**
1. Get a valid active category ID from Supabase dashboard:
   ```sql
   SELECT id, name FROM categories WHERE is_active = true LIMIT 1;
   ```
2. In mobile app console:
   ```javascript
   import { calculateExampleSP } from './src/services/educationExampleService';
   const result = await calculateExampleSP(20, '<category-id>');
   console.log(result);
   ```

**Expected Results:**
- [ ] Returns object with: `{ earn_sp, max_use_sp, cash_paid, fee, is_bonus, category_name }`
- [ ] `earn_sp` is a rounded integer (e.g., 22 for baseline 1.10 × 20)
- [ ] `max_use_sp` is floored integer (e.g., 14 for 70% of 20)
- [ ] `fee` === 2 (10% of 20)
- [ ] `is_bonus` matches whether category multiplier > 1.10

**Test with null category:**
3. Test null category:
   ```javascript
   const nullResult = await calculateExampleSP(20, null);
   console.log(nullResult); // Should be null
   ```

**Expected:** Returns `null`

---

### TC-EDU-003-004: SP Calculator Service — Sell Mode

**Objective:** Verify calculateSP() delegates to MODULE-12 V3 and returns correct sell shape

**Steps:**
1. Get a bonus category (sp_earning_multiplier > 1.10):
   ```sql
   SELECT id, name, sp_earning_multiplier 
   FROM categories 
   WHERE sp_earning_multiplier > 1.10 
   LIMIT 1;
   ```
2. In mobile app console:
   ```javascript
   import { calculateSP } from './src/services/spCalculatorService';
   const result = await calculateSP(25, '<bonus-category-id>', 'sell');
   console.log(result);
   ```

**Expected Results:**
- [ ] `mode === 'sell'`
- [ ] `earn_sp` matches Math.round(25 × multiplier)
- [ ] `is_bonus === true`
- [ ] `category_name` is correct
- [ ] No hardcoded rates (verify source code has NO literals like `1.10`, `1.30`, `70`, etc.)

---

### TC-EDU-003-005: SP Calculator Service — Buy Mode

**Objective:** Verify buy mode calculates cash/fee correctly

**Steps:**
1. Using same category as above:
   ```javascript
   const result = await calculateSP(25, '<category-id>', 'buy', 10);
   console.log(result);
   ```

**Expected Results:**
- [ ] `mode === 'buy'`
- [ ] `sp_to_use === 10`
- [ ] `cash_paid === 15` (25 - 10)
- [ ] `fee === 2.5` (10% of 25)
- [ ] `total_cost === 17.5` (15 + 2.5)
- [ ] `max_sp_usable` is floored value (e.g., 17 for 70% cap)

---

### TC-EDU-003-006: SP Calculator — Get Bonus Categories

**Objective:** Verify getBonusCategories() delegates to MODULE-12 V3

**Steps:**
1. In mobile app console:
   ```javascript
   import { getBonusCategories } from './src/services/spCalculatorService';
   const bonusCategories = await getBonusCategories();
   console.log(bonusCategories);
   ```

**Expected Results:**
- [ ] Returns array of categories
- [ ] ALL have `sp_earning_multiplier > 1.10`
- [ ] Ordered by `sp_earning_multiplier` descending
- [ ] Each has: `id, name, icon, sp_earning_multiplier, sp_spending_cap_percent`

---

### TC-EDU-003-007: Analytics Service — Track Event (Fire-and-Forget)

**Objective:** Verify trackEducationEvent() never throws

**Steps:**
1. In mobile app console:
   ```javascript
   import { trackEducationEvent } from './src/services/educationAnalyticsService';
   
   // Test successful insert
   await trackEducationEvent('help_view', { section_type: 'sp_definition' });
   
   // Test with invalid event type (should still not throw)
   await trackEducationEvent('invalid_event' as any);
   ```
2. Check Supabase dashboard > `education_analytics` table:
   ```sql
   SELECT * FROM education_analytics 
   WHERE event_type = 'help_view' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Expected Results:**
- [ ] No exceptions thrown in console
- [ ] Event exists in DB with correct `user_id`, `event_type`, `event_data`
- [ ] Invalid event fails silently (logs warning, no throw)

---

### TC-EDU-003-008: Analytics Service — Onboarding State Machine

**Objective:** Verify shouldShowOnboarding() state machine

**Setup:**
```sql
-- Reset test user profile
UPDATE user_profiles 
SET onboarding_completed_at = NULL, 
    onboarding_skipped_at = NULL 
WHERE user_id = 'test-user-edu';
```

**Steps:**
1. Test initial state (both null):
   ```javascript
   import { shouldShowOnboarding } from './src/services/educationAnalyticsService';
   const shouldShow = await shouldShowOnboarding('test-user-edu');
   console.log(shouldShow); // Should be true
   ```

2. Mark completed:
   ```javascript
   import { markOnboardingComplete } from './src/services/educationAnalyticsService';
   await markOnboardingComplete('test-user-edu');
   const shouldShowAfter = await shouldShowOnboarding('test-user-edu');
   console.log(shouldShowAfter); // Should be false
   ```

3. Reset and test skip:
   ```sql
   UPDATE user_profiles 
   SET onboarding_completed_at = NULL, onboarding_skipped_at = NULL 
   WHERE user_id = 'test-user-edu';
   ```
   ```javascript
   import { markOnboardingSkipped } from './src/services/educationAnalyticsService';
   await markOnboardingSkipped('test-user-edu');
   const shouldShowAfterSkip = await shouldShowOnboarding('test-user-edu');
   console.log(shouldShowAfterSkip); // Should be false
   ```

**Expected Results:**
- [ ] Initial state: `shouldShowOnboarding() === true`
- [ ] After complete: `shouldShowOnboarding() === false`
- [ ] After skip: `shouldShowOnboarding() === false`

---

### TC-EDU-003-009: Analytics Service — Prompt State Machine

**Objective:** Verify shouldShowPrompt() + markPromptSeen() idempotency

**Setup:**
```sql
UPDATE user_profiles 
SET education_prompts_seen = '[]'::jsonb,
    education_prompts_suppressed_at = NULL
WHERE user_id = 'test-user-edu';
```

**Steps:**
1. Check unseen prompt:
   ```javascript
   import { shouldShowPrompt } from './src/services/educationAnalyticsService';
   const shouldShow = await shouldShowPrompt('test-user-edu', 'seller_first_listing');
   console.log(shouldShow); // Should be true
   ```

2. Mark seen:
   ```javascript
   import { markPromptSeen } from './src/services/educationAnalyticsService';
   await markPromptSeen('test-user-edu', 'seller_first_listing');
   const shouldShowAfter = await shouldShowPrompt('test-user-edu', 'seller_first_listing');
   console.log(shouldShowAfter); // Should be false
   ```

3. Mark same prompt again (idempotent):
   ```javascript
   await markPromptSeen('test-user-edu', 'seller_first_listing');
   // Should not add duplicate to array
   ```

4. Check DB:
   ```sql
   SELECT education_prompts_seen FROM user_profiles WHERE user_id = 'test-user-edu';
   ```

**Expected Results:**
- [ ] Unseen prompt: `shouldShowPrompt() === true`
- [ ] After marking seen: `shouldShowPrompt() === false`
- [ ] Array contains only one instance of key (no duplicates)
- [ ] `education_prompts_seen === ["seller_first_listing"]`

---

### TC-EDU-003-010: Analytics Service — Auto-Suppress After 3 Prompts

**Objective:** Verify auto-suppression when onboarding skipped + 3 prompts seen

**Setup:**
```sql
UPDATE user_profiles 
SET onboarding_skipped_at = NOW(),
    education_prompts_seen = '["prompt1", "prompt2", "prompt3"]'::jsonb,
    education_prompts_suppressed_at = NULL
WHERE user_id = 'test-user-edu';
```

**Steps:**
1. Check new prompt (should auto-suppress):
   ```javascript
   const shouldShow = await shouldShowPrompt('test-user-edu', 'new_prompt');
   console.log(shouldShow); // Should be false
   ```

2. Verify suppression flag set:
   ```sql
   SELECT education_prompts_suppressed_at FROM user_profiles WHERE user_id = 'test-user-edu';
   ```

**Expected Results:**
- [ ] `shouldShowPrompt() === false`
- [ ] `education_prompts_suppressed_at` is now set (NOT NULL)

---

## Admin Portal Tests

### TC-EDU-003-011: Admin Content Service — Publish Section RPC

**Objective:** Verify publishSection() calls RPC (not direct UPDATE)

**Steps:**
1. In admin portal console (or Node.js):
   ```javascript
   import { publishSection } from '@/lib/educationContentService';
   
   // Get a draft section ID from DB
   await publishSection('<draft-section-id>');
   ```

2. Check code: Open `p2p-kids-admin/src/lib/educationContentService.ts`
   ```bash
   grep -n "is_published: true" p2p-kids-admin/src/lib/educationContentService.ts
   ```

**Expected Results:**
- [ ] No direct `UPDATE ... SET is_published = true` in service code
- [ ] Uses `.rpc('publish_section', { section_id: ... })`
- [ ] Section is published in DB
- [ ] Previous published section of same type is unpublished (atomic swap)

---

### TC-EDU-003-012: Admin Example Service — Delete Guard

**Objective:** Verify deleteExample() refuses when is_published = true

**Setup:**
```sql
-- Create a published example
INSERT INTO education_examples (item_name, item_price, is_published, display_order)
VALUES ('Test Item', 15, true, 99)
RETURNING id;
```

**Steps:**
1. Try to delete:
   ```javascript
   import { deleteExample } from '@/lib/educationExampleService';
   
   try {
     await deleteExample('<published-example-id>');
   } catch (error) {
     console.log(error.code); // Should be 'EXAMPLE_IS_PUBLISHED'
   }
   ```

**Expected Results:**
- [ ] Throws `ContentValidationError`
- [ ] Error code: `'EXAMPLE_IS_PUBLISHED'`
- [ ] Example still exists in DB (not deleted)

---

### TC-EDU-003-013: Admin Analytics Service — Aggregations

**Objective:** Verify getEducationAnalytics() returns correct aggregations

**Steps:**
1. Seed some analytics events:
   ```sql
   INSERT INTO education_analytics (user_id, event_type, created_at)
   VALUES 
     ('user1', 'onboarding_start', '2026-05-01 10:00:00'),
     ('user1', 'onboarding_complete', '2026-05-01 10:05:00'),
     ('user2', 'onboarding_start', '2026-05-01 11:00:00'),
     ('user2', 'onboarding_skip', '2026-05-01 11:01:00'),
     ('user1', 'help_view', '2026-05-01 12:00:00'),
     ('user1', 'calculator_use', '2026-05-01 13:00:00');
   ```

2. Fetch analytics:
   ```javascript
   import { getEducationAnalytics } from '@/lib/educationAnalyticsService';
   
   const analytics = await getEducationAnalytics({
     startDate: '2026-05-01T00:00:00Z',
     endDate: '2026-05-02T00:00:00Z',
   });
   console.log(analytics);
   ```

**Expected Results:**
- [ ] `onboarding.started === 2`
- [ ] `onboarding.completed === 1`
- [ ] `onboarding.skipped === 1`
- [ ] `onboarding.completionRate === 0.5` (1 / (1 + 1))
- [ ] `help.views === 1`
- [ ] `calculator.uses === 1`
- [ ] `calculator.uniqueUsers === 1`

---

## Test Summary

**Total Tests:** 13  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

**Issues Found:**
1. _____________________
2. _____________________

**Sign-off:**  
Tester: _____________________ Date: _____  
Developer: _____________________ Date: _____

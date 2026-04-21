# MODULE 13: SAFETY & COMPLIANCE - VERIFICATION REPORT

**Module:** Safety & Compliance  
**Total Tasks:** 12  
**Estimated Time:** ~32 hours  
**Status:** Ready for Implementation

---

## DELIVERABLES CHECKLIST

### Database Schema
- [ ] `cpsc_recalls` table created with full-text search
- [ ] `cpsc_import_log` table for tracking imports
- [ ] `item_safety_flags` table for flagged items
- [ ] `ai_moderation_logs` table for all AI checks
- [ ] `check_cpsc_recalls()` database function
- [ ] pg_trgm extension enabled for similarity matching
- [ ] Indexes created for search performance

### Edge Functions
- [ ] `import-cpsc-recalls` - Daily batch import
- [ ] `check-item-safety` - Check listing against recalls
- [ ] `moderate-image` - Google Vision Safe Search
- [ ] `moderate-text` - Custom AI + GPT-4 fallback

### Scheduled Jobs
- [ ] Daily CPSC import job (pg_cron)
- [ ] Scheduled re-moderation of low-confidence items

### UI Components
- [ ] Safety flag display on listings
- [ ] Seller appeal form
- [ ] Resubmit listing flow
- [ ] Admin review interface
- [ ] Safety disclaimer on checkout

### Admin Panel
- [ ] CPSC recall management UI
- [ ] AI moderation logs viewer
- [ ] Flagged items queue
- [ ] Manual review workflow
- [ ] Override false positives

---

## FEATURE FLOWS TO TEST

### 1. CPSC Recall Import (Daily Batch)
**Flow:**
1. pg_cron triggers `import-cpsc-recalls` at 2:00 AM daily
2. Edge Function calls CPSC API: `https://www.saferproducts.gov/RestWebServices/Recall`
3. Parse XML/JSON response
4. For each recall:
   - Extract: title, brand, hazard, recall_date, product_type
   - Insert into `cpsc_recalls` table if not exists
5. Log import: total_imported, total_skipped, errors
6. On completion → Check all active listings for matches

**Expected Results:**
- ✓ Import runs daily without fail
- ✓ Duplicates skipped (based on recall_number)
- ✓ All recalls stored with full-text search enabled
- ✓ Import logs visible to admin
- ✓ Errors logged if API down

**Edge Cases:**
- CPSC API down → Retry 3x, log failure, alert admin
- Malformed data → Skip record, log error
- 1000+ new recalls → Process all, may take 5-10 minutes
- Database connection lost → Transaction rolled back

---

### 2. CPSC Matching on Listing Creation
**Flow:**
1. User submits new item listing
2. Before saving, call `check_cpsc_recalls()` function
3. Function performs full-text search on:
   - item.title + item.description
   - Matched against cpsc_recalls.title + brand + product_type
4. Use pg_trgm similarity for fuzzy matching (threshold: 0.3)
5. If match found:
   - Insert into `item_safety_flags` (status='flagged', reason='cpsc_match')
   - Set item.status = 'under_review'
   - Notify seller: "Item flagged for safety review"
6. If no match:
   - Proceed to AI image moderation

**Expected Results:**
- ✓ Exact brand matches flagged (e.g., "Fisher-Price")
- ✓ Similar product names flagged (similarity > 0.3)
- ✓ False positives minimized
- ✓ Flagged items blocked from going live
- ✓ Seller notified immediately

**Edge Cases:**
- Generic brand (e.g., "Unknown Brand") → No match
- Common words (e.g., "toy car") → Many false positives, require admin review
- Listing updated after approval → Re-check on edit
- Admin manually approves flagged item → Override flag

---

### 3. AI Image Moderation (Google Vision)
**Flow:**
1. User uploads images for listing
2. Call `moderate-image` Edge Function for each image
3. Edge Function sends image to Google Vision Safe Search API
4. API returns scores (0-5) for:
   - Adult content
   - Violence
   - Racy content
   - Medical content
   - Spoof
5. If any score >= 3 (POSSIBLE or higher):
   - Insert into `ai_moderation_logs` (result='flagged', confidence=score)
   - Set item.status = 'under_review'
   - Notify seller: "Image flagged for review"
6. If all scores <= 2:
   - Log as 'approved'
   - Proceed to text moderation

**Expected Results:**
- ✓ Inappropriate images flagged
- ✓ Clean images approved automatically
- ✓ Confidence scores logged
- ✓ Low confidence (score=3) → Admin review
- ✓ High confidence (score=5) → Auto-reject

**Edge Cases:**
- Google Vision API down → Queue for retry
- Image unreadable (corrupted) → Reject with error
- Multiple images → All must pass
- Update listing with new image → Re-moderate

---

### 4. AI Text Moderation (Custom Agent + GPT-4)
**Flow:**
1. User submits item listing (title + description)
2. Call `moderate-text` Edge Function
3. **Stage 1: Custom AI Agent** (fast, low-cost)
   - Check for keywords: profanity, weapons, drugs, prohibited items
   - If flagged → Confidence = HIGH, skip GPT-4
   - If low confidence → Proceed to Stage 2
4. **Stage 2: GPT-4 Fallback** (for nuanced cases)
   - Send title + description to GPT-4
   - Prompt: "Is this listing appropriate for a family-friendly marketplace? Flag if: weapons, drugs, adult content, hate speech, prohibited items."
   - GPT-4 returns: {approved: true/false, reason: "..."}
   - If flagged → Log reason, set status='under_review'
5. If approved by both stages → Item goes live

**Expected Results:**
- ✓ Obvious violations caught by custom agent (fast)
- ✓ Nuanced cases handled by GPT-4 (accurate)
- ✓ Multi-stage reduces API costs
- ✓ All checks logged with confidence
- ✓ Seller notified if flagged

**Edge Cases:**
- GPT-4 API down → Fallback to admin review queue
- Ambiguous listing (e.g., "vintage adult book") → Flagged, admin reviews
- False positive → Seller can appeal
- Listing in non-English → GPT-4 handles multilingual

---

### 5. Admin Review Workflow
**Flow:**
1. Admin opens "Moderation Queue"
2. Queue shows all items with status='under_review'
3. For each item, admin sees:
   - Item details (title, images, description)
   - Flagging reason (CPSC match, AI image flag, AI text flag)
   - Confidence score
   - Moderation logs
4. Admin actions:
   - **Approve** → Set status='active', clear flags
   - **Reject** → Set status='rejected', notify seller with reason
   - **Request Edits** → Notify seller, set status='needs_edits'
5. All actions logged in `admin_activity_log`

**Expected Results:**
- ✓ All flagged items visible in queue
- ✓ Sorted by priority (high confidence first)
- ✓ Admin can approve/reject in bulk
- ✓ Seller notified of decision
- ✓ Reasons provided for rejections

**Edge Cases:**
- 1000+ items in queue → Paginated, filters available
- Multiple admins reviewing → No conflicts (row locking)
- Admin indecisive → "Defer" option for later review

---

### 6. Seller Appeal & Resubmit
**Flow:**
1. Seller receives rejection notification
2. Clicks "Appeal" button
3. Appeal form shown:
   - Reason for appeal (text input)
   - Option to edit listing (title, description, images)
   - Resubmit button
4. On resubmit:
   - Item re-enters moderation queue
   - All AI checks run again
   - Admin reviews with appeal context
5. Admin approves or provides final rejection

**Expected Results:**
- ✓ Seller can appeal within 7 days
- ✓ Appeal reason logged
- ✓ Edits trigger re-moderation
- ✓ Admin sees appeal context
- ✓ Final decision binding

**Edge Cases:**
- Multiple appeals → Max 3 appeals allowed
- No edits made → Admin auto-rejects
- Seller edits to circumvent check → Flagged again

---

### 7. Safety Disclaimers (TOS, Privacy, Liability)
**Flow:**
1. User opens app → "Terms of Service" link in footer
2. TOS page displayed (static placeholder content)
3. Highlights:
   - Platform liability disclaimers
   - Safety is seller's responsibility
   - Recall checking is best-effort, not guaranteed
   - User agreement to inspect items before purchase
4. Privacy Policy and Liability Disclaimer accessible

**Expected Results:**
- ✓ All legal pages accessible
- ✓ Clear language on platform responsibilities
- ✓ User acknowledges TOS on signup (checkbox)

**Edge Cases:**
- TOS updated → Users notified, re-acceptance required
- Legal compliance varies by region → Placeholder allows customization

---

### 8. Override False Positives (Admin)
**Flow:**
1. Admin reviews CPSC-flagged item
2. Determines it's a false positive (e.g., different product, same brand)
3. Clicks "Override Flag"
4. Enters reason: "False positive - different product model"
5. Flag cleared, item approved
6. Override logged in `admin_activity_log`

**Expected Results:**
- ✓ Admin can override any flag
- ✓ Reason required for audit trail
- ✓ Item goes live immediately
- ✓ Override logged permanently

**Edge Cases:**
- Overridden item later recalled → Admin notified, re-flagged
- Bulk overrides → Admin can select multiple items

---

### 9. Re-Moderation of Low Confidence Items
**Flow:**
1. Weekly cron job queries items with:
   - ai_moderation_logs.confidence BETWEEN 40 AND 60
   - status = 'active'
   - created_at < 7 days ago
2. Re-run AI checks (Google Vision, GPT-4)
3. If new confidence > 80 → Auto-flag
4. If still ambiguous → Add to admin review queue

**Expected Results:**
- ✓ Low confidence items re-checked weekly
- ✓ Improved AI models catch previously missed issues
- ✓ Admin queue updated with re-flagged items

**Edge Cases:**
- AI models improved → More accurate re-checks
- Item edited by seller → Re-moderation triggered

---

### 10. CPSC Recall Alerts (Existing Listings)
**Flow:**
1. Daily after CPSC import, run batch check:
2. Query all active listings
3. Call `check_cpsc_recalls()` for each
4. If new match found:
   - Insert into `item_safety_flags`
   - Set status='under_review'
   - Notify seller: "Your item matches a new recall"
   - Notify buyers (if item in active trades)
5. Admin reviews and approves/rejects

**Expected Results:**
- ✓ New recalls flagged on existing listings
- ✓ Sellers notified immediately
- ✓ Buyers notified if trade active
- ✓ Admin reviews within 24 hours

**Edge Cases:**
- 1000+ listings match → Batch processing
- Seller already removed item → Skip notification
- Buyer already received item → Notify only, no action required

---

### 11. Prohibited Items List
**Flow:**
1. Maintain list in `admin_config` table:
   - prohibited_items = ["weapons", "drugs", "alcohol", "tobacco", "adult content"]
2. Custom AI agent checks listing against list
3. If match → Auto-flag
4. Admin can edit list via admin panel

**Expected Results:**
- ✓ Prohibited items blocked automatically
- ✓ Admin can add/remove categories
- ✓ All checks logged

**Edge Cases:**
- Toy weapons → Allowed (context-aware)
- Prescription medications → Flagged
- Alcohol-themed items (e.g., beer mugs) → Flagged, admin reviews

---

### 12. Safety Statistics Dashboard (Admin)
**Flow:**
1. Admin opens "Safety Analytics"
2. Displays metrics:
   - Total CPSC recalls imported
   - Total items flagged (CPSC, AI image, AI text)
   - False positive rate
   - Average review time
   - Items approved vs rejected
3. Charts show trends over time
4. Export data to CSV

**Expected Results:**
- ✓ All metrics accurate
- ✓ Charts show trends
- ✓ CSV export works
- ✓ Admin can identify patterns (e.g., spike in flagged items)

**Edge Cases:**
- No data → Show 0 with message
- Very high false positive rate → Alert admin to review rules

---

## DATABASE SCHEMA VERIFICATION

### cpsc_recalls table
```sql
CREATE TABLE cpsc_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  brand TEXT,
  product_type TEXT,
  hazard TEXT,
  recall_date DATE,
  description TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(brand, '') || ' ' || COALESCE(product_type, ''))
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX cpsc_recalls_search_idx ON cpsc_recalls USING GIN(search_vector);
CREATE INDEX cpsc_recalls_brand_idx ON cpsc_recalls(brand);
CREATE INDEX cpsc_recalls_recall_date_idx ON cpsc_recalls(recall_date DESC);
```

**Verify:**
- [ ] Table created
- [ ] Full-text search vector generated automatically
- [ ] GIN index created for fast search
- [ ] Unique constraint on recall_number prevents duplicates

---

### cpsc_import_log table
```sql
CREATE TABLE cpsc_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date DATE NOT NULL,
  total_imported INTEGER,
  total_skipped INTEGER,
  errors TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX cpsc_import_log_import_date_idx ON cpsc_import_log(import_date DESC);
```

**Verify:**
- [ ] Table created
- [ ] Logs visible in admin panel
- [ ] Errors captured for debugging

---

### item_safety_flags table
```sql
CREATE TABLE item_safety_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL, -- 'cpsc_match', 'ai_image', 'ai_text', 'user_report'
  reason TEXT,
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX item_safety_flags_item_id_idx ON item_safety_flags(item_id);
CREATE INDEX item_safety_flags_status_idx ON item_safety_flags(status);
```

**Verify:**
- [ ] Table created
- [ ] All flag types supported
- [ ] Status tracked for admin workflow
- [ ] Reviewed_by tracks admin accountability

---

### ai_moderation_logs table
```sql
CREATE TABLE ai_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  moderation_type TEXT NOT NULL, -- 'image', 'text'
  service TEXT NOT NULL, -- 'google_vision', 'custom_agent', 'gpt4'
  result TEXT NOT NULL, -- 'approved', 'flagged'
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  details JSONB, -- Full API response
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ai_moderation_logs_item_id_idx ON ai_moderation_logs(item_id);
CREATE INDEX ai_moderation_logs_result_idx ON ai_moderation_logs(result);
CREATE INDEX ai_moderation_logs_confidence_idx ON ai_moderation_logs(confidence);
```

**Verify:**
- [ ] Table created
- [ ] All AI services logged
- [ ] Full API response stored in JSONB (for debugging)
- [ ] Indexed for fast queries

---

### check_cpsc_recalls() function
```sql
CREATE OR REPLACE FUNCTION check_cpsc_recalls(
  p_title TEXT,
  p_description TEXT
) RETURNS TABLE(recall_id UUID, recall_title TEXT, similarity REAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    title,
    similarity(COALESCE(brand, '') || ' ' || COALESCE(title, ''), p_title || ' ' || p_description)
  FROM cpsc_recalls
  WHERE 
    search_vector @@ plainto_tsquery('english', p_title || ' ' || p_description)
    OR similarity(COALESCE(brand, '') || ' ' || COALESCE(title, ''), p_title || ' ' || p_description) > 0.3
  ORDER BY similarity DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
```

**Verify:**
- [ ] Function created
- [ ] Full-text search working
- [ ] pg_trgm similarity working
- [ ] Returns top 10 matches sorted by relevance

---

## TESTING CHECKLIST

### Unit Tests
- [ ] `check_cpsc_recalls()` - Returns matches for known recalls
- [ ] `check_cpsc_recalls()` - Returns empty for safe items
- [ ] Similarity threshold (0.3) - Tuned to minimize false positives

### Integration Tests
- [ ] CPSC import → Recalls stored in database
- [ ] Listing creation → CPSC check runs
- [ ] Image upload → Google Vision check runs
- [ ] Text moderation → GPT-4 fallback if custom agent uncertain
- [ ] Flagged item → Admin review workflow

### E2E Tests
- [ ] User creates listing with recalled product → Flagged
- [ ] User uploads inappropriate image → Flagged
- [ ] User submits prohibited text → Flagged
- [ ] Admin approves flagged item → Goes live
- [ ] Seller appeals rejection → Re-moderation triggered

### Performance Tests
- [ ] CPSC import (1000 recalls) → Completes in <5 minutes
- [ ] CPSC matching on listing → <500ms
- [ ] Google Vision API → <2s per image
- [ ] GPT-4 moderation → <3s per listing
- [ ] Batch re-check (10K listings) → Completes in <30 minutes

---

## COST ANALYSIS

**Google Vision API:**
- $1.50 per 1,000 images (Safe Search)
- Estimated usage: 30,000 images/month
- **Cost: ~$45/month**

**OpenAI GPT-4:**
- $0.03 per 1K input tokens, $0.06 per 1K output tokens
- Estimated usage: 2,000 text moderations/month (avg 200 tokens)
- **Cost: ~$60/month** (combined input/output)

**CPSC API:**
- Free (public API)
- **Cost: $0**

**Total: ~$105/month**

**Cost Optimization:**
- Use custom agent for 90% of cases → Reduces GPT-4 calls by 80%
- Batch image moderation → Reduces API overhead
- Cache recall matches → Reduces database queries

---

## ANALYTICS EVENTS

Track these events in Amplitude:

1. `listing_flagged_cpsc` - CPSC match found
2. `listing_flagged_ai_image` - Image flagged by Google Vision
3. `listing_flagged_ai_text` - Text flagged by custom agent or GPT-4
4. `listing_approved_auto` - Passed all checks automatically
5. `listing_approved_manual` - Admin approved after review
6. `listing_rejected_manual` - Admin rejected
7. `seller_appealed` - Seller submitted appeal
8. `cpsc_import_completed` - Daily import finished
9. `false_positive_override` - Admin overrode false flag

---

## MIGRATION SCRIPT SUMMARY

**Migration Files:**
1. `044_cpsc_recalls.sql` - CPSC recalls table + search
2. `045_cpsc_import_log.sql` - Import logging
3. `046_item_safety_flags.sql` - Safety flags table
4. `047_cpsc_matching_function.sql` - check_cpsc_recalls()
5. `048_ai_moderation_logs.sql` - AI moderation logs

**Rollback Plan:**
```sql
DROP FUNCTION IF EXISTS check_cpsc_recalls(TEXT, TEXT);
DROP TABLE IF EXISTS ai_moderation_logs;
DROP TABLE IF EXISTS item_safety_flags;
DROP TABLE IF EXISTS cpsc_import_log;
DROP TABLE IF EXISTS cpsc_recalls;
DROP EXTENSION IF EXISTS pg_trgm;
```

---

## KNOWN LIMITATIONS

1. **CPSC Coverage** - US only, no international recalls
2. **AI Accuracy** - Not 100%, requires admin review for edge cases
3. **Language Support** - English only for text moderation
4. **Recall Lag** - 24-hour delay between CPSC publish and import
5. **False Positives** - Similarity matching may flag unrelated items

---

## POST-MVP ENHANCEMENTS

1. **International Recalls** - Integrate EU RAPEX, Canada recalls
2. **Machine Learning** - Train custom model on platform data
3. **User Reporting** - Allow users to flag unsafe items
4. **Automated Takedowns** - High-confidence flags auto-reject
5. **Seller Reputation** - Track safety violations, penalize repeat offenders
6. **Recall Notifications** - Email buyers if purchased item recalled
7. **Image OCR** - Extract text from images for deeper moderation
8. **Video Moderation** - Extend to video listings
9. **Real-Time Moderation** - WebSocket-based instant checks
10. **Compliance Certifications** - ISO, CE marking verification

---

## SIGN-OFF CHECKLIST

**Before marking module complete:**
- [ ] All database migrations run successfully
- [ ] pg_trgm extension enabled
- [ ] CPSC recalls table created with full-text search
- [ ] CPSC import Edge Function deployed
- [ ] Daily import job scheduled (pg_cron)
- [ ] check_cpsc_recalls() function working
- [ ] Image moderation (Google Vision) working
- [ ] Text moderation (custom + GPT-4) working
- [ ] Admin review workflow functional
- [ ] Seller appeal form accessible
- [ ] Safety flags display on items
- [ ] All unit tests passing
- [ ] Integration tests passing (AI checks)
- [ ] E2E tests passing (full moderation flow)
- [ ] Performance acceptable (<500ms for CPSC check)
- [ ] API keys configured (Google Vision, OpenAI)
- [ ] Legal disclaimers (TOS, Privacy, Liability) published
- [ ] Analytics events firing
- [ ] Documentation complete

---

**Module Status:** ✅ READY FOR IMPLEMENTATION  
**Blocker Issues:** Requires Google Vision and OpenAI API keys  
**Dependencies:** MODULE-04 (Item Listing), MODULE-12 (Admin Panel)  
**Next Module:** MODULE-14 (Notifications)

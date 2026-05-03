-- Migration: 20260420000020_create_education_analytics_and_seed.sql
-- Module: MODULE-18 TRADING EDUCATION V1 (EDU-001)
-- Description: Create education_analytics table, add profile columns, seed initial content
-- Dependencies: 20260420000018, 20260420000019, profiles table
-- Idempotent: YES (uses IF NOT EXISTS, ON CONFLICT DO NOTHING for seed)

-- ============================================================================
-- PART 1: CREATE TABLE education_analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.education_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Nullable user_id (allows anonymous onboarding-start events)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event tracking
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_education_analytics_event_type 
    CHECK (event_type IN (
      'onboarding_start',
      'onboarding_complete',
      'onboarding_skip',
      'section_expand',
      'section_collapse',
      'calculator_use',
      'prompt_view',
      'prompt_dismiss',
      'prompt_action'
    ))
);

-- Add table comment
COMMENT ON TABLE public.education_analytics IS 
  'MODULE-18: Append-only analytics for education content engagement (no PII in event_data)';

COMMENT ON COLUMN public.education_analytics.user_id IS 
  'Nullable to allow anonymous onboarding-start; populated once authenticated';

COMMENT ON COLUMN public.education_analytics.event_data IS 
  'JSONB payload (category_id, section_type, price_bucket) — NEVER exact prices or PII';

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_education_analytics_event_type 
  ON public.education_analytics (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_education_analytics_user 
  ON public.education_analytics (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- PART 3: ENABLE RLS
-- ============================================================================

ALTER TABLE public.education_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: CREATE RLS POLICIES (INSERT-only for authenticated, SELECT for admin)
-- ============================================================================

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS education_analytics_insert_authenticated ON public.education_analytics;
DROP POLICY IF EXISTS education_analytics_select_admin ON public.education_analytics;

-- Policy 1: Authenticated users can INSERT their own analytics events
CREATE POLICY education_analytics_insert_authenticated
  ON public.education_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

COMMENT ON POLICY education_analytics_insert_authenticated ON public.education_analytics IS 
  'Allow authenticated users to insert analytics (user_id must match auth.uid or be NULL)';

-- Policy 2: Admins can SELECT all analytics
CREATE POLICY education_analytics_select_admin
  ON public.education_analytics
  FOR SELECT
  USING (public.edu_is_admin(auth.uid()));

COMMENT ON POLICY education_analytics_select_admin ON public.education_analytics IS 
  'Admins can view all analytics for dashboard aggregations';

-- NOTE: NO UPDATE/DELETE policies — effectively blocks those operations (audit-grade)

-- ============================================================================
-- PART 5: ALTER profiles TABLE — ADD EDUCATION COLUMNS
-- ============================================================================

-- Note: onboarding_completed_at already exists from AUTH-V2; safe to add IF NOT EXISTS
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS education_prompts_seen JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education_prompts_suppressed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 
  'MODULE-18: When user completed the education onboarding carousel';

COMMENT ON COLUMN public.profiles.onboarding_skipped_at IS 
  'MODULE-18: When user skipped the education onboarding carousel';

COMMENT ON COLUMN public.profiles.education_prompts_seen IS 
  'MODULE-18: Array of prompt keys seen (e.g. ["seller_first_listing", "buyer_first_purchase"])';

COMMENT ON COLUMN public.profiles.education_prompts_suppressed_at IS 
  'MODULE-18: When prompts were permanently suppressed (after skip + 3 dismissals)';

-- ============================================================================
-- PART 6: SEED INITIAL CONTENT (4 sections + 3 examples)
-- ============================================================================

-- Seed education sections (sp_definition, sp_earning, sp_spending, safety)
-- Using ON CONFLICT DO NOTHING for idempotency
INSERT INTO public.education_sections (
  title,
  body,
  image_url,
  display_order,
  section_type,
  is_published,
  published_at,
  published_by
) VALUES
  -- Section 1: SP Definition
  (
    'What are Swap Points?',
    E'Swap Points (SP) are our community currency that make trading more fun! You earn SP when you sell items, and you can use them to get discounts on future purchases.\n\nThink of SP like reward points at your favorite store — the more you participate, the more you earn!',
    NULL,
    1,
    'sp_definition',
    true,
    now(),
    NULL
  ),
  
  -- Section 2: Earning SP
  (
    'How do I earn Swap Points?',
    E'You earn SP every time you successfully sell an item! The amount you earn depends on:\n\n• Item Price: Higher-priced items earn more SP\n• Item Category: Some categories give bonus SP (look for the ⭐ badge!)\n• Subscription: Only Kids Club+ members can earn and use SP\n\nYour earned SP will be "pending" for 3 days after the sale completes. This protects you in case of returns.',
    NULL,
    2,
    'sp_earning',
    true,
    now(),
    NULL
  ),
  
  -- Section 3: Spending SP
  (
    'How do I spend Swap Points?',
    E'You can use your available SP to get discounts when buying items! Here''s how it works:\n\n• Use up to 50% of an item''s price in SP\n• The platform fee is always paid in cash\n• Sellers choose if they accept SP or cash only\n• Your SP balance shows "Available" vs "Pending"\n\nTip: Look for the SP calculator on item pages to see how much you can save!',
    NULL,
    3,
    'sp_spending',
    true,
    now(),
    NULL
  ),
  
  -- Section 4: Safety
  (
    'Safety & Community Guidelines',
    E'Trading should be safe and fun for everyone! Here are our key safety rules:\n\n• Only trade locally within your community node\n• Meet in safe, public places for exchanges\n• Parents must approve all trades for kids under 13\n• Report any safety concerns immediately\n• All items are checked for safety recalls\n\nRemember: If something feels wrong, trust your instincts and contact support!',
    NULL,
    4,
    'safety',
    true,
    now(),
    NULL
  )
ON CONFLICT DO NOTHING;

-- Seed education examples (LEGO Set, Kids Book, Toy Car)
-- category_id = NULL (admin will link via CMS after launch)
INSERT INTO public.education_examples (
  item_name,
  item_price,
  category_id,
  display_order,
  is_published
) VALUES
  ('LEGO Star Wars Set', 20.00, NULL, 1, false),
  ('Kids Book Collection', 10.00, NULL, 2, false),
  ('Toy Race Car', 15.00, NULL, 3, false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing in Supabase SQL Editor)
-- ============================================================================

-- Verify table exists
-- SELECT to_regclass('public.education_analytics') IS NOT NULL AS analytics_table_exists;

-- Verify RLS is enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname='education_analytics';
-- Expected: relrowsecurity = t

-- Verify NO UPDATE/DELETE policies exist (only INSERT + SELECT)
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='education_analytics';
-- Expected: 2 rows — INSERT (authenticated), SELECT (admin)

-- Verify profiles columns added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name='profiles'
--   AND column_name IN (
--     'onboarding_completed_at',
--     'onboarding_skipped_at',
--     'education_prompts_seen',
--     'education_prompts_suppressed_at'
--   )
-- ORDER BY column_name;
-- Expected: 4 rows

-- Verify seeded sections (should have 4 published rows)
-- SELECT section_type, is_published, title FROM public.education_sections
-- WHERE is_published = true
-- ORDER BY display_order;
-- Expected: 4 rows (sp_definition, sp_earning, sp_spending, safety)

-- Verify seeded examples (should have 3 draft rows)
-- SELECT item_name, item_price, is_published, category_id FROM public.education_examples
-- ORDER BY display_order;
-- Expected: 3 rows (all with is_published=false, category_id=NULL)

-- Test INSERT as authenticated user
-- INSERT INTO public.education_analytics (user_id, event_type, event_data)
-- VALUES (auth.uid(), 'onboarding_start', '{"screen": "welcome"}'::jsonb);

-- Test UPDATE attempt (should be blocked by RLS — no policy grants it)
-- UPDATE public.education_analytics SET event_type='test' WHERE id='<some-id>';
-- Expected: 0 rows affected (no error, but silently blocked)

-- Test DELETE attempt (should be blocked by RLS — no policy grants it)
-- DELETE FROM public.education_analytics WHERE id='<some-id>';
-- Expected: 0 rows affected (no error, but silently blocked)

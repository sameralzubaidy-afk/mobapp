-- =====================================================
-- FILE: supabase/migrations/306_ai_moderation_logs_table.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-004 - Google Vision API Image Moderation
-- DESCRIPTION:
--   Create ai_moderation_logs table for tracking AI moderation results
--   from Google Vision API Safe Search and future AI moderation services.
-- MODE: Idempotent (safe to re-run)
-- =====================================================

-- =============================================================================
-- STEP 1: CREATE ai_moderation_logs TABLE (OR ALTER IF EXISTS)
-- =============================================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  moderation_type TEXT NOT NULL CHECK (moderation_type IN ('image', 'text')) DEFAULT 'image',
  service TEXT NOT NULL CHECK (service IN ('google_vision', 'custom_agent', 'gpt4', 'openai')) DEFAULT 'google_vision',
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'flagged', 'rejected')) DEFAULT 'approved',
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
  details JSONB, -- Store full API response (safe_search scores, categories, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add missing columns if table already existed with old schema
DO $$
BEGIN
  -- Add moderation_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'moderation_type'
  ) THEN
    ALTER TABLE ai_moderation_logs 
    ADD COLUMN moderation_type TEXT NOT NULL CHECK (moderation_type IN ('image', 'text')) DEFAULT 'image';
  END IF;

  -- Add service column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'service'
  ) THEN
    ALTER TABLE ai_moderation_logs 
    ADD COLUMN service TEXT NOT NULL CHECK (service IN ('google_vision', 'custom_agent', 'gpt4', 'openai')) DEFAULT 'google_vision';
  END IF;

  -- Add decision column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'decision'
  ) THEN
    ALTER TABLE ai_moderation_logs 
    ADD COLUMN decision TEXT NOT NULL CHECK (decision IN ('approved', 'flagged', 'rejected')) DEFAULT 'approved';
  END IF;

  -- Add confidence_score column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE ai_moderation_logs 
    ADD COLUMN confidence_score DECIMAL(5,4);
  END IF;

  -- Add flagged column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'flagged'
  ) THEN
    ALTER TABLE ai_moderation_logs 
    ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Add details column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'details'
  ) THEN
    ALTER TABLE ai_moderation_logs 
    ADD COLUMN details JSONB;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_moderation_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ai_moderation_logs
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_moderation_logs_item_id ON ai_moderation_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_ai_moderation_logs_decision ON ai_moderation_logs(decision);
CREATE INDEX IF NOT EXISTS idx_ai_moderation_logs_flagged ON ai_moderation_logs(flagged);
CREATE INDEX IF NOT EXISTS idx_ai_moderation_logs_service ON ai_moderation_logs(service);
CREATE INDEX IF NOT EXISTS idx_ai_moderation_logs_created_at ON ai_moderation_logs(created_at DESC);

-- =============================================================================
-- STEP 2: CREATE RLS POLICIES FOR ai_moderation_logs
-- =============================================================================

ALTER TABLE ai_moderation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all moderation logs
DROP POLICY IF EXISTS "Admins can view moderation logs" ON ai_moderation_logs;
CREATE POLICY "Admins can view moderation logs"
  ON ai_moderation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Policy: Service role can insert moderation logs (for Edge Functions)
DROP POLICY IF EXISTS "Service role can insert logs" ON ai_moderation_logs;
CREATE POLICY "Service role can insert logs"
  ON ai_moderation_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================

-- Check table exists
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_moderation_logs' 
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'ai_moderation_logs';

-- Check RLS policies
-- SELECT policyname, cmd, permissive, roles, qual 
-- FROM pg_policies 
-- WHERE tablename = 'ai_moderation_logs';

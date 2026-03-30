-- =====================================================
-- FILE: supabase/migrations/20260329000002_fix_ai_moderation_logs_schema_drift.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-004 - ai_moderation_logs schema drift hotfix
-- MODE: B (idempotent rerunnable migration)
-- =====================================================

-- BLOCK 1 - Schema
-- 1) Ensure table exists
-- 2) Ensure required columns exist
-- 3) Backfill image_url from legacy columns where possible

CREATE TABLE IF NOT EXISTS public.ai_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  moderation_type TEXT NOT NULL CHECK (moderation_type IN ('image', 'text')) DEFAULT 'image',
  service TEXT NOT NULL CHECK (service IN ('google_vision', 'custom_agent', 'gpt4', 'openai')) DEFAULT 'google_vision',
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'flagged', 'rejected')) DEFAULT 'approved',
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score DECIMAL(5,4),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DO $$
DECLARE
  v_has_url BOOLEAN;
  v_has_image_uri BOOLEAN;
  v_null_image_url_count BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'ai_moderation_logs'
      AND c.column_name = 'image_url'
  ) THEN
    ALTER TABLE public.ai_moderation_logs ADD COLUMN image_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'ai_moderation_logs'
      AND c.column_name = 'item_id'
  ) THEN
    ALTER TABLE public.ai_moderation_logs ADD COLUMN item_id UUID;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'ai_moderation_logs'
      AND c.column_name = 'url'
  ) INTO v_has_url;

  IF v_has_url THEN
    EXECUTE '
      UPDATE public.ai_moderation_logs aml
      SET image_url = aml.url
      WHERE aml.image_url IS NULL
        AND aml.url IS NOT NULL
    ';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'ai_moderation_logs'
      AND c.column_name = 'image_uri'
  ) INTO v_has_image_uri;

  IF v_has_image_uri THEN
    EXECUTE '
      UPDATE public.ai_moderation_logs aml
      SET image_url = aml.image_uri
      WHERE aml.image_url IS NULL
        AND aml.image_uri IS NOT NULL
    ';
  END IF;

  SELECT COUNT(*)
  INTO v_null_image_url_count
  FROM public.ai_moderation_logs aml
  WHERE aml.image_url IS NULL;

  IF v_null_image_url_count = 0 THEN
    ALTER TABLE public.ai_moderation_logs
      ALTER COLUMN image_url SET NOT NULL;
  END IF;
END $$;

-- BLOCK 2 - Security + Performance
-- Keep this block rerunnable and force PostgREST schema cache refresh.

CREATE INDEX IF NOT EXISTS idx_ai_moderation_logs_image_url
  ON public.ai_moderation_logs(image_url);

NOTIFY pgrst, 'reload schema';

-- Verification queries
-- SELECT c.column_name, c.data_type, c.is_nullable
-- FROM information_schema.columns c
-- WHERE c.table_schema = 'public' AND c.table_name = 'ai_moderation_logs'
-- ORDER BY c.ordinal_position;

-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'ai_moderation_logs';

-- filepath: supabase/migrations/303_cpsc_recalls_schema.sql
-- SAFETY-001: CPSC Recalls Schema
-- Mode: idempotent (safe to re-run)

-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- STEP 1: Create cpsc_recalls table (or alter if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cpsc_recalls') THEN
    CREATE TABLE public.cpsc_recalls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recall_number TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      product_description TEXT,
      manufacturer TEXT,
      hazard TEXT,
      remedy TEXT,
      recall_date DATE NOT NULL,
      images JSONB DEFAULT '[]'::jsonb,
      source_url TEXT,
      product_codes TEXT[],
      keywords TSVECTOR,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  ELSE
    -- Table exists, ensure ALL required columns are added (idempotent)
    ALTER TABLE public.cpsc_recalls 
      ADD COLUMN IF NOT EXISTS recall_number TEXT,
      ADD COLUMN IF NOT EXISTS product_name TEXT,
      ADD COLUMN IF NOT EXISTS product_description TEXT,
      ADD COLUMN IF NOT EXISTS manufacturer TEXT,
      ADD COLUMN IF NOT EXISTS hazard TEXT,
      ADD COLUMN IF NOT EXISTS remedy TEXT,
      ADD COLUMN IF NOT EXISTS recall_date DATE,
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS product_codes TEXT[],
      ADD COLUMN IF NOT EXISTS keywords TSVECTOR,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    -- Ensure recall_number is UNIQUE (idempotent)
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'cpsc_recalls_recall_number_key'
      AND n.nspname = 'public'
      AND t.relname = 'cpsc_recalls'
    ) THEN
      ALTER TABLE public.cpsc_recalls
        ADD CONSTRAINT cpsc_recalls_recall_number_key UNIQUE (recall_number);
    END IF;
  END IF;
END $$;

-- STEP 2: Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_recall_number ON public.cpsc_recalls(recall_number);
CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_recall_date ON public.cpsc_recalls(recall_date DESC);
CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_product_name_trgm ON public.cpsc_recalls USING gin(product_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_keywords ON public.cpsc_recalls USING gin(keywords);

-- STEP 3: Create import log table
CREATE TABLE IF NOT EXISTS public.cpsc_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  status TEXT CHECK (status IN ('success', 'failed', 'partial')) NOT NULL,
  recalls_imported INTEGER DEFAULT 0,
  recalls_updated INTEGER DEFAULT 0,
  error_message TEXT,
  duration_seconds INTEGER,
  total_processed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cpsc_import_log_date ON public.cpsc_import_log(import_date DESC);
CREATE INDEX IF NOT EXISTS idx_cpsc_import_log_status ON public.cpsc_import_log(status);

-- STEP 4: Auto-update trigger for cpsc_recalls
CREATE OR REPLACE FUNCTION update_cpsc_recalls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cpsc_recalls_updated_at ON public.cpsc_recalls;
CREATE TRIGGER update_cpsc_recalls_updated_at
  BEFORE UPDATE ON public.cpsc_recalls
  FOR EACH ROW
  EXECUTE FUNCTION update_cpsc_recalls_updated_at();

-- STEP 5: Auto-generate keywords from product_name and description
CREATE OR REPLACE FUNCTION update_cpsc_recalls_keywords()
RETURNS TRIGGER AS $$
BEGIN
  NEW.keywords = to_tsvector('english', 
    COALESCE(NEW.product_name, '') || ' ' || 
    COALESCE(NEW.product_description, '') || ' ' ||
    COALESCE(NEW.manufacturer, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cpsc_recalls_keywords ON public.cpsc_recalls;
CREATE TRIGGER update_cpsc_recalls_keywords
  BEFORE INSERT OR UPDATE ON public.cpsc_recalls
  FOR EACH ROW
  EXECUTE FUNCTION update_cpsc_recalls_keywords();

-- STEP 6: Enable RLS
ALTER TABLE public.cpsc_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpsc_import_log ENABLE ROW LEVEL SECURITY;

-- STEP 7: Drop existing policies (idempotent reset)
DROP POLICY IF EXISTS "cpsc_public_select" ON public.cpsc_recalls;
DROP POLICY IF EXISTS "cpsc_admin_manage" ON public.cpsc_recalls;
DROP POLICY IF EXISTS "cpsc_service_role_all" ON public.cpsc_recalls;
DROP POLICY IF EXISTS "cpsc_import_log_admin_select" ON public.cpsc_import_log;
DROP POLICY IF EXISTS "cpsc_import_log_service_role_all" ON public.cpsc_import_log;

-- STEP 8: Create RLS policies

-- Anyone can view recalls (public safety data)
CREATE POLICY "cpsc_public_select"
  ON public.cpsc_recalls FOR SELECT
  USING (true);

-- Admins can manage recalls
CREATE POLICY "cpsc_admin_manage"
  ON public.cpsc_recalls FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Service role has full access (for Edge Function imports)
CREATE POLICY "cpsc_service_role_all"
  ON public.cpsc_recalls FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view import logs
CREATE POLICY "cpsc_import_log_admin_select"
  ON public.cpsc_import_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Service role can insert logs
CREATE POLICY "cpsc_import_log_service_role_all"
  ON public.cpsc_import_log FOR ALL
  USING (auth.role() = 'service_role');

-- STEP 9: Grant necessary permissions
GRANT SELECT ON public.cpsc_recalls TO anon, authenticated;
GRANT ALL ON public.cpsc_recalls TO service_role;
GRANT SELECT ON public.cpsc_import_log TO authenticated;
GRANT ALL ON public.cpsc_import_log TO service_role;

/*
==================================================
VERIFICATION QUERIES (run after migration)
==================================================
*/

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('cpsc_recalls', 'cpsc_import_log');

-- Verify indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('cpsc_recalls', 'cpsc_import_log');

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN ('cpsc_recalls', 'cpsc_import_log');

-- Verify policies exist
-- SELECT policyname, tablename FROM pg_policies 
-- WHERE tablename IN ('cpsc_recalls', 'cpsc_import_log');

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ cpsc_recalls table created with all required columns
✓ cpsc_import_log table created
✓ Indexes created for fast search (recall_number, date, trgm, tsvector)
✓ Auto-update triggers for updated_at and keywords
✓ RLS enabled with public read, admin manage policies
✓ Service role has full access for imports

==================================================
NEXT STEP
==================================================

Deploy Edge Function: supabase/functions/import-cpsc-recalls/index.ts
Then run: supabase functions deploy import-cpsc-recalls
Then schedule daily cron job
*/

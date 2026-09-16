-- Step 1: Update trades table and admin_config

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS authorization_id varchar(255),
  ADD COLUMN IF NOT EXISTS authorization_amount numeric,
  ADD COLUMN IF NOT EXISTS authorization_expires_at timestamptz;

ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS offer_timeout_hours integer DEFAULT 48;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_offer_timeout_hours'
  ) THEN
    ALTER TABLE public.admin_config 
      ADD CONSTRAINT check_offer_timeout_hours CHECK (offer_timeout_hours BETWEEN 1 AND 168);
  END IF;
END $$;

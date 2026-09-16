-- Step 3: Cron job RPC for offer timeouts

CREATE OR REPLACE FUNCTION public.invoke_check_offer_timeouts()
RETURNS void AS $$
DECLARE
  v_edge_function_url text;
  v_service_role_key text;
  v_request_id text;
BEGIN
  -- Use similar pattern as invoke_grace_period_cron
  -- Get the Supabase API URL and service role key securely (or construct URL)
  v_edge_function_url := current_setting('custom.edge_function_base_url', true) || '/check-offer-timeouts';
  v_service_role_key := current_setting('custom.service_role_key', true);

  IF v_edge_function_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := '{}'::jsonb
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run every hour
SELECT cron.schedule(
  'check-offer-timeouts',
  '0 * * * *',
  'SELECT public.invoke_check_offer_timeouts();'
);

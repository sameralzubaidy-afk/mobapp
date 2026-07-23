-- TFV2-016: Notification cron job — every 5 minutes

-- Cron: Check for notification-eligible trades every 5 minutes
SELECT cron.schedule(
  'trade-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := COALESCE(
      NULLIF(current_setting('app.edge_function_base_url', true), ''),
      NULLIF(current_setting('app.supabase_url', true), '') || '/functions/v1'
    ) || '/check-trade-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || NULLIF(current_setting('app.service_role_key', true), '')
    ),
    body    := '{}'::jsonb
  );
  $$
);

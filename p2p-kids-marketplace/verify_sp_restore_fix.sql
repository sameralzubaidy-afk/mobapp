-- Verify that the trigger exists and is active
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'trigger_release_sp_on_cancel';

-- Verify the credit_sp_for_cancelled_trade RPC exists
SELECT 
  proname AS function_name,
  pronargs AS num_args,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'credit_sp_for_cancelled_trade';

# Fidelity gate — every named exception (FIX-Task-40 phase 3, 2026-09-16)

Generated from `/tmp/fidelity-report.json` by `scripts/migrations/fidelity-check.mjs`.

**Rules:** 1) SUBSET — every staging object must exist in the replay. 2) EXPLAINED — every replay-only object must have provenance (a migration that creates it). 3) CONFLICT — no object present on both sides may differ.

**Counts:** subset misses **119** · explained replay-only **60** · unexplained (NO CREATOR) **0** · conflicts **114**.

**Why these exist:** staging was built partly out-of-band and is not at the repo head (see the phase-3 report §5). They are enumerated here so a passing check can never be read as "no diff".


---

## 1 · SUBSET — staging objects MISSING from the replay (119)


### COLUMN (26)

- `ai_moderation_logs.model`
- `ai_moderation_logs.result`
- `ai_moderation_logs.confidence`
- `auto_complete_runs.triggered_by`
- `auto_complete_runs.details`
- `cpsc_recalls.description`
- `debug_logs.user_id`
- `debug_logs.error_message`
- `email_logs.email_type`
- `email_logs.notification_category`
- `email_logs.is_critical`
- `email_logs.unsubscribe_token`
- `email_logs.failed_at`
- `email_logs.metadata`
- `faq_items.yes_count`
- `faq_items.no_count`
- `profiles.auto_filled_from_provider`
- `subscription_tiers.price_monthly`
- `subscription_tiers.max_active_listings`
- `subscription_tiers.max_boost_listings`
- `subscription_tiers.priority_support`
- `subscription_tiers.early_access_features`
- `trade_events.event_type`
- `trade_events.actor_id`
- `user_subscriptions.referral_extensions_used`
- `user_subscriptions.trial_used_at`

### CONSTRAINT (9)

- `email_logs.email_logs_status_check`
- `email_logs.email_logs_unsubscribe_token_key`
- `id_badge_verification_requests.id_badge_verification_requests_node_id_fkey`
- `items.items_node_id_fkey`
- `profiles.profiles_node_id_fkey`
- `referral_codes.code_length`
- `referrals.referrals_no_self_referral`
- `trades.trades_disclaimer_policy_id_fkey`
- `trades.trades_dispute_resolved_by_fkey`

### INDEX (21)

- `debug_logs.debug_logs_created_at_idx`
- `debug_logs.debug_logs_process_name_idx`
- `debug_logs.debug_logs_user_id_idx`
- `email_logs.email_logs_unsubscribe_token_key`
- `email_logs.idx_email_logs_email_type`
- `email_logs.idx_email_logs_unsubscribe`
- `nodes.idx_nodes_location`
- `trade_events.idx_trade_events_event_type`
- `trades.idx_trades_buyer_id`
- `trades.idx_trades_cancelled_at`
- `trades.idx_trades_created_at`
- `trades.idx_trades_dispute_status`
- `trades.idx_trades_item_id`
- `trades.idx_trades_payout_status`
- `trades.idx_trades_seller_id`
- `trades.idx_trades_status_created_seller_marked`
- `trades.idx_trades_status`
- `zip_waitlist.idx_zip_waitlist_created_at`
- `zip_waitlist.idx_zip_waitlist_requested_zip`
- `zip_waitlist.idx_zip_waitlist_status`
- `zip_waitlist.idx_zip_waitlist_user_id`

### TRIGGER (4)

- `nodes.update_nodes_updated_at`
- `profiles.trg_profiles_ensure_referral_code_ins`
- `profiles.trg_profiles_ensure_referral_code_upd`
- `trades.update_trades_updated_at`

### FUNCTION (21)

- `bytea_to_text.data bytea`
- `http_delete.uri character varying, content character varying, content_type character varying`
- `http_delete.uri character varying`
- `http_get.uri character varying, data jsonb`
- `http_get.uri character varying`
- `http_header.field character varying, value character varying`
- `http_head.uri character varying`
- `http_list_curlopt.`
- `http_patch.uri character varying, content character varying, content_type character varying`
- `http_post.uri character varying, content character varying, content_type character varying`
- `http_post.uri character varying, data jsonb`
- `http_put.uri character varying, content character varying, content_type character varying`
- `http_reset_curlopt.`
- `http_set_curlopt.curlopt character varying, value character varying`
- `http.request http_request`
- `is_in_quiet_hours.p_user_id uuid`
- `resolve_active_node_for_signup.requested_zip text, user_lat double precision, user_lng double precision`
- `text_to_bytea.data text`
- `urlencode.data jsonb`
- `urlencode.string bytea`
- `urlencode.string character varying`

### POLICY (38)

- `admin_config.admin_config_authenticated_read`
- `ai_moderation_logs.ai_logs_admin_select`
- `ai_moderation_logs.ai_logs_system_create`
- `email_logs.email_logs_select_own`
- `email_logs.email_logs_service_role`
- `items.Items visibility based on status`
- `items.items_anon_select`
- `items.items_insert_own_seller`
- `items.items_update_own_seller`
- `nodes.nodes_admin_manage`
- `nodes.nodes_public_active`
- `profiles.Service role can update profiles`
- `profiles.profiles_anon_insert`
- `profiles.profiles_anon_select`
- `profiles.profiles_anon_update`
- `referrals.referrals_anon_insert`
- `referrals.referrals_anon_select`
- `referrals.referrals_anon_update`
- `referrals.referrals_insert`
- `referrals.referrals_select_own`
- `seller_payout_methods.Service role bypass - seller_payout_methods`
- `seller_payouts.Service role bypass - seller_payouts`
- `subscription_tiers.subscription_tiers_admin`
- `subscription_tiers.subscription_tiers_public`
- `subscriptions.subscriptions_anon_insert`
- `subscriptions.subscriptions_anon_select`
- `subscriptions.subscriptions_anon_update`
- `trade_events.trade_events_service`
- `trade_events.trade_events_user_read`
- `trades.trades_admin_select`
- `trades.trades_insert_own`
- `trades.trades_update_own`
- `user_notifications.user_notifications_anon_insert`
- `user_notifications.user_notifications_anon_select`
- `user_notifications.user_notifications_anon_update`
- `zip_waitlist.zip_waitlist_user_insert`
- `zip_waitlist.zip_waitlist_user_select`
- `zip_waitlist.zip_waitlist_user_update`

---

## 2 · EXPLAINED — replay-only objects WITH provenance (60)

Each is created by a migration in the chain (column 2 = the first creator file). Accepted by design: staging is behind head.


### COLUMN (12)

- `admin_config.offer_timeout_hours` — creator `20250113_create_admin_config.sql`
- `dispute_costs.evidence_status` — creator `20260810000005_r4_dispute_cost_accounting.sql`
- `dispute_costs.evidence_staged_at` — creator `20260810000005_r4_dispute_cost_accounting.sql`
- `dispute_costs.evidence_file_id` — creator `20260810000005_r4_dispute_cost_accounting.sql`
- `dispute_costs.evidence_error` — creator `20260810000005_r4_dispute_cost_accounting.sql`
- `dispute_costs.evidence_json` — creator `20260810000005_r4_dispute_cost_accounting.sql`
- `nodes.launch_date` — creator `20241213000001_add_auth_module_tables.sql`
- `nodes.member_count` — creator `20241213000001_add_auth_module_tables.sql`
- `trade_events.event_name` — creator `20260528000010_trade_events.sql`
- `trade_events.user_id` — creator `20260528000010_trade_events.sql`
- `trades.authorization_id` — creator `20241213000003_base_schema_repair_node_ids_and_trades.sql`
- `trades.authorization_amount` — creator `20241213000003_base_schema_repair_node_ids_and_trades.sql`

### CONSTRAINT (11)

- `admin_config.check_offer_timeout_hours` — creator `20250113_create_admin_config.sql`
- `ai_moderation_logs.ai_moderation_logs_item_id_fkey` — creator `20260329000002_fix_ai_moderation_logs_schema_drift.sql`
- `dispute_costs.dispute_costs_evidence_status_check` — creator `20260810000005_r4_dispute_cost_accounting.sql`
- `email_logs.email_status_check` — creator `209_email_notifications_tracking.sql`
- `items.items_seller_id_fkey` — creator `20251217000002_create_items_table_node_filtering.sql`
- `nodes.nodes_member_count_check` — creator `20241213000001_add_auth_module_tables.sql`
- `nodes.nodes_radius_miles_check` — creator `20241213000001_add_auth_module_tables.sql`
- `profiles.fk_profiles_node_id` — creator `20241213000001_add_auth_module_tables.sql`
- `referral_codes.referral_codes_code_length` — creator `20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql`
- `referrals.referrals_referrer_profile_fkey` — creator `20241213000002_add_referral_system_tables.sql`
- `trade_events.trade_events_user_id_fkey` — creator `20260528000010_trade_events.sql`

### INDEX (2)

- `nodes.idx_nodes_member_count` — creator `20241213000001_add_auth_module_tables.sql`
- `trade_events.idx_trade_events_event_name` — creator `20260528000010_trade_events.sql`

### FUNCTION (11)

- `complete_trade_v2.p_trade_id uuid, p_user_id uuid` — creator `061_sp_ledger_and_trade_rpcs.sql`
- `get_admin_sp_economy_summary.p_start_date timestamp with time zone, p_end_date timestamp with time zone` — creator `20260606000002_deprecate_payment_processing.sql`
- `get_payout_fee_config.` — creator `074_admin_payout_fee_config.sql`
- `get_sp_wallet_balance.p_user_id uuid` — creator `20260510000002_sp_hold_enum.sql`
- `invoke_check_offer_timeouts.` — creator `20260510000003_offer_timeout_rpc.sql`
- `is_admin.` — creator `20251219_admin_listing_view_policy.sql`
- `rpc_process_auto_complete.p_batch_size integer` — creator `20260528000005_auto_complete_cron.sql`
- `rpc_record_dispute_evidence.p_dispute_id text, p_status text, p_file_id text, p_error text, p_evidence jsonb` — creator `20260810000011_n3_dispute_evidence.sql`
- `search_listings.p_query text, p_sp_eligible_only boolean, p_limit integer` — creator `20251220000002_search_listings_rpc.sql`
- `send_parental_consent_email.p_user_id uuid, p_parent_email text` — creator `20251215100001_auth_v2_rpc_functions.sql`
- `upsert_admin_config_setting.p_key text, p_value text, p_category admin_config_category, p_data_type text, p_is_secret boolean, p_is_active boolean` — creator `020_upsert_admin_config_rpc.sql`

### POLICY (24)

- `admin_config.Admins can update config` — creator `20250113_create_admin_config.sql`
- `admin_config.Admins can view config` — creator `20250113_create_admin_config.sql`
- `admin_config.admin_config_read_all` — creator `20250113_create_admin_config.sql`
- `admin_config.admin_config_write_service_role` — creator `20250113_create_admin_config.sql`
- `badge_audit_logs.Admins can insert audit logs` — creator `20260111000000_badge_admin_config.sql`
- `badge_audit_logs.Admins can view audit logs` — creator `20260111000000_badge_admin_config.sql`
- `badge_config_history.Admins can view config history` — creator `20260111000000_badge_admin_config.sql`
- `badges.Admins can insert badges` — creator `20260110000000_badges_v2.sql`
- `items.Admins can delete items` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.Admins can update items` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.Admins can view all items` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.Anyone or trade participants can view items` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.Buyers can view items they are purchasing` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.Sellers can update own items` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.Sellers can view own items` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.items_insert_pending_review` — creator `20251217000002_create_items_table_node_filtering.sql`
- `items.items_select_same_node_or_own` — creator `20251217000002_create_items_table_node_filtering.sql`
- `referrals.referrals_service_role` — creator `20241213000002_add_referral_system_tables.sql`
- `review_reports.Admins can delete review reports` — creator `031_review_reports.sql`
- `review_reports.Admins can view all review reports` — creator `031_review_reports.sql`
- `trade_events.Admin role read trade_events` — creator `20260528000010_trade_events.sql`
- `trades.Users can insert trades` — creator `20241213000003_base_schema_repair_node_ids_and_trades.sql`
- `trades.Users can update their trades` — creator `20241213000003_base_schema_repair_node_ids_and_trades.sql`
- `trades.Users can view own trades` — creator `20241213000003_base_schema_repair_node_ids_and_trades.sql`

---

## 3 · UNEXPLAINED — replay-only with NO CREATOR (0)

**None.** Every replay-only object has provenance.


---

## 4 · CONFLICT — same object, different definition (114)

Format: object · staging definition · replayed definition.


### COLUMN (18)

- `ai_moderation_logs.item_id`
  - staging: `ai_moderation_logs|-|item_id|uuid|uuid|-|-|-|YES|-`
  - replay : `ai_moderation_logs|-|item_id|uuid|uuid|-|-|-|NO|-`
- `auto_complete_runs.id`
  - staging: `auto_complete_runs|-|id|bigint|int8|-|64|0|NO|nextval('auto_complete_runs_id_seq'::regclass)`
  - replay : `auto_complete_runs|-|id|integer|int4|-|32|0|NO|nextval('auto_complete_runs_id_seq'::regclass)`
- `auto_complete_runs.errors_count`
  - staging: `auto_complete_runs|-|errors_count|integer|int4|-|32|0|NO|-`
  - replay : `auto_complete_runs|-|errors_count|integer|int4|-|32|0|NO|0`
- `cpsc_recalls.recall_date`
  - staging: `cpsc_recalls|-|recall_date|date|date|-|-|-|YES|-`
  - replay : `cpsc_recalls|-|recall_date|date|date|-|-|-|NO|-`
- `cpsc_recalls.recall_number`
  - staging: `cpsc_recalls|-|recall_number|text|text|-|-|-|YES|-`
  - replay : `cpsc_recalls|-|recall_number|text|text|-|-|-|NO|-`
- `email_logs.created_at`
  - staging: `email_logs|-|created_at|timestamp with time zone|timestamptz|-|-|-|NO|now()`
  - replay : `email_logs|-|created_at|timestamp with time zone|timestamptz|-|-|-|YES|now()`
- `nodes.id`
  - staging: `nodes|-|id|uuid|uuid|-|-|-|NO|GEN_RANDOM_UUID()`
  - replay : `nodes|-|id|uuid|uuid|-|-|-|NO|-`
- `nodes.city`
  - staging: `nodes|-|city|text|text|-|-|-|YES|-`
  - replay : `nodes|-|city|character varying|varchar|100|-|-|YES|-`
- `nodes.state`
  - staging: `nodes|-|state|text|text|-|-|-|YES|-`
  - replay : `nodes|-|state|character varying|varchar|2|-|-|YES|-`
- `nodes.zip_code`
  - staging: `nodes|-|zip_code|text|text|-|-|-|YES|-`
  - replay : `nodes|-|zip_code|character varying|varchar|5|-|-|YES|-`
- `nodes.latitude`
  - staging: `nodes|-|latitude|double precision|float8|-|53|-|YES|-`
  - replay : `nodes|-|latitude|numeric|numeric|-|10|8|YES|-`
- `nodes.longitude`
  - staging: `nodes|-|longitude|double precision|float8|-|53|-|YES|-`
  - replay : `nodes|-|longitude|numeric|numeric|-|11|8|YES|-`
- `nodes.updated_at`
  - staging: `nodes|-|updated_at|timestamp with time zone|timestamptz|-|-|-|NO|now()`
  - replay : `nodes|-|updated_at|timestamp with time zone|timestamptz|-|-|-|YES|now()`
- `referrals.referrer_user_id`
  - staging: `referrals|-|referrer_user_id|uuid|uuid|-|-|-|YES|-`
  - replay : `referrals|-|referrer_user_id|uuid|uuid|-|-|-|NO|-`
- `referrals.referred_user_id`
  - staging: `referrals|-|referred_user_id|uuid|uuid|-|-|-|YES|-`
  - replay : `referrals|-|referred_user_id|uuid|uuid|-|-|-|NO|-`
- `referrals.referral_code`
  - staging: `referrals|-|referral_code|text|text|-|-|-|YES|-`
  - replay : `referrals|-|referral_code|text|text|-|-|-|NO|-`
- `referrals.status`
  - staging: `referrals|-|status|text|text|-|-|-|YES|'pending'::text`
  - replay : `referrals|-|status|text|text|-|-|-|NO|'pending'::text`
- `trade_events.created_at`
  - staging: `trade_events|-|created_at|timestamp with time zone|timestamptz|-|-|-|NO|now()`
  - replay : `trade_events|-|created_at|timestamp with time zone|timestamptz|-|-|-|YES|now()`

### CONSTRAINT (3)

- `email_logs.email_logs_user_id_fkey`
  - staging: `email_logs|email_logs_user_id_fkey|f|FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`
  - replay : `email_logs|email_logs_user_id_fkey|f|FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `items.items_status_check`
  - staging: `items|items_status_check|c|CHECK ((status = ANY (ARRAY['draft'::text, 'available'::text, 'pending'::text, 'sold'::text, 'deleted'::text, 'paused'::text, 'flagged'::text, 'rejected'::text, 'needs_edits'::text])))`
  - replay : `items|items_status_check|c|CHECK ((status = ANY (ARRAY['draft'::text, 'available'::text, 'pending'::text, 'sold'::text, 'deleted'::text, 'paused'::text, 'flagged'::text, 'rejected'::text])))`
- `sp_ledger.sp_ledger_transaction_type_check`
  - staging: `sp_ledger|sp_ledger_transaction_type_check|c|CHECK ((transaction_type = ANY (ARRAY['earn_starter_pack'::text, 'earn_reward'::text, 'earn_bonus'::text, 'earn_referral'::text, 'earn_challenge'::text, 'earn_refund'::text, 'earn_admin_grant'::text, 'earn_promotion'::text, 'spend_purchase'::text, 'spend_fee'::text, 'spend_boost'::text, 'expire'::text, 'freeze'::text, 'unfreeze'::text, 'admin_deduct'::text])))`
  - replay : `sp_ledger|sp_ledger_transaction_type_check|c|CHECK ((transaction_type = ANY (ARRAY['earn_starter_pack'::text, 'earn_reward'::text, 'earn_referral'::text, 'earn_challenge'::text, 'earn_refund'::text, 'earn_admin_grant'::text, 'earn_promotion'::text, 'spend_purchase'::text, 'spend_fee'::text, 'spend_boost'::text, 'expire'::text, 'freeze'::text, 'unfreeze'::text, 'admin_deduct'::text])))`

### INDEX (4)

- `items.idx_items_node_id`
  - staging: `items|idx_items_node_id|CREATE INDEX idx_items_node_id ON public.items USING btree (node_id) WHERE (node_id IS NOT NULL)`
  - replay : `items|idx_items_node_id|CREATE INDEX idx_items_node_id ON public.items USING btree (node_id)`
- `trade_events.idx_trade_events_cron_idempotency`
  - staging: `trade_events|idx_trade_events_cron_idempotency|CREATE UNIQUE INDEX idx_trade_events_cron_idempotency ON public.trade_events USING btree (trade_id, event_type) WHERE (event_type = ANY (ARRAY['offer_expired'::text, 'auto_completed'::text, 'sp_released_to_seller'::text, 'sp_restored_to_buyer'::text]))`
  - replay : `trade_events|idx_trade_events_cron_idempotency|CREATE UNIQUE INDEX idx_trade_events_cron_idempotency ON public.trade_events USING btree (trade_id, event_name) WHERE (event_name = ANY (ARRAY['offer_expired'::text, 'auto_completed'::text, 'sp_released_to_seller'::text, 'sp_restored_to_buyer'::text]))`
- `trade_events.idx_trade_events_trade_id`
  - staging: `trade_events|idx_trade_events_trade_id|CREATE INDEX idx_trade_events_trade_id ON public.trade_events USING btree (trade_id, created_at DESC)`
  - replay : `trade_events|idx_trade_events_trade_id|CREATE INDEX idx_trade_events_trade_id ON public.trade_events USING btree (trade_id)`
- `trades.idx_trades_completed_at`
  - staging: `trades|idx_trades_completed_at|CREATE INDEX idx_trades_completed_at ON public.trades USING btree (completed_at)`
  - replay : `trades|idx_trades_completed_at|CREATE INDEX idx_trades_completed_at ON public.trades USING btree (completed_at) WHERE (status = 'completed'::text)`

### ENUM (3)

- `admin_config_category.referral`
  - staging: `admin_config_category|referral|11`
  - replay : `admin_config_category|referral|13`
- `admin_config_category.tax`
  - staging: `admin_config_category|tax|13`
  - replay : `admin_config_category|tax|12`
- `admin_config_category.trade`
  - staging: `admin_config_category|trade|12`
  - replay : `admin_config_category|trade|11`

### FUNCTION (79)

- `acknowledge_trade_disclaimer.p_trade_id uuid, p_disclaimer_policy_id uuid`
  - staging: `acknowledge_trade_disclaimer|p_trade_id uuid, p_disclaimer_policy_id uuid|json|SECURITY_DEFINER|-`
  - replay : `acknowledge_trade_disclaimer|p_trade_id uuid, p_disclaimer_policy_id uuid|json|SECURITY_DEFINER|search_path=public, pg_temp`
- `add_to_retry_queue.p_notification_id uuid, p_user_id uuid, p_error text, p_error_details jsonb`
  - staging: `add_to_retry_queue|p_notification_id uuid, p_user_id uuid, p_error text, p_error_details jsonb|void|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `add_to_retry_queue|p_notification_id uuid, p_user_id uuid, p_error text, p_error_details jsonb|void|SECURITY_DEFINER|-`
- `admin_delete_user.p_admin_id uuid, p_user_id uuid, p_reason text`
  - staging: `admin_delete_user|p_admin_id uuid, p_user_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public`
  - replay : `admin_delete_user|p_admin_id uuid, p_user_id uuid, p_reason text|jsonb|SECURITY_DEFINER|-`
- `admin_force_delete_listing.p_listing_id uuid, p_reason text`
  - staging: `admin_force_delete_listing|p_listing_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public, auth`
  - replay : `admin_force_delete_listing|p_listing_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public`
- `admin_get_user_analytics.p_admin_id uuid`
  - staging: `admin_get_user_analytics|p_admin_id uuid|jsonb|SECURITY_DEFINER|search_path=public`
  - replay : `admin_get_user_analytics|p_admin_id uuid|jsonb|SECURITY_DEFINER|-`
- `admin_get_user_detail.p_admin_id uuid, p_user_id uuid`
  - staging: `admin_get_user_detail|p_admin_id uuid, p_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public`
  - replay : `admin_get_user_detail|p_admin_id uuid, p_user_id uuid|jsonb|SECURITY_DEFINER|-`
- `admin_list_users.p_admin_id uuid, p_search text, p_account_status text, p_subscription_status text, p_node_id text, p_page integer, p_page_size integer`
  - staging: `admin_list_users|p_admin_id uuid, p_search text, p_account_status text, p_subscription_status text, p_node_id text, p_page integer, p_page_size integer|jsonb|SECURITY_DEFINER|search_path=public`
  - replay : `admin_list_users|p_admin_id uuid, p_search text, p_account_status text, p_subscription_status text, p_node_id text, p_page integer, p_page_size integer|jsonb|SECURITY_DEFINER|-`
- `admin_pause_listing.p_listing_id uuid, p_reason text`
  - staging: `admin_pause_listing|p_listing_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public, auth`
  - replay : `admin_pause_listing|p_listing_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public`
- `admin_suspend_user.p_admin_id uuid, p_user_id uuid, p_reason text`
  - staging: `admin_suspend_user|p_admin_id uuid, p_user_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `admin_suspend_user|p_admin_id uuid, p_user_id uuid, p_reason text|jsonb|SECURITY_DEFINER|-`
- `admin_unpause_listing.p_listing_id uuid, p_reason text`
  - staging: `admin_unpause_listing|p_listing_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public, auth`
  - replay : `admin_unpause_listing|p_listing_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public`
- `admin_unsuspend_user.p_admin_id uuid, p_user_id uuid, p_reason text`
  - staging: `admin_unsuspend_user|p_admin_id uuid, p_user_id uuid, p_reason text|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `admin_unsuspend_user|p_admin_id uuid, p_user_id uuid, p_reason text|jsonb|SECURITY_DEFINER|-`
- `award_badge_if_eligible.p_user_id uuid, p_category text, p_current_value integer`
  - staging: `award_badge_if_eligible|p_user_id uuid, p_category text, p_current_value integer|void|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `award_badge_if_eligible|p_user_id uuid, p_category text, p_current_value integer|void|SECURITY_DEFINER|-`
- `award_challenge_sp.p_user_id uuid, p_challenge_id uuid, p_sp_amount integer`
  - staging: `award_challenge_sp|p_user_id uuid, p_challenge_id uuid, p_sp_amount integer|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `award_challenge_sp|p_user_id uuid, p_challenge_id uuid, p_sp_amount integer|jsonb|SECURITY_DEFINER|-`
- `calculate_payout_fee_cents.p_method_type text, p_amount_cents integer`
  - staging: `calculate_payout_fee_cents|p_method_type text, p_amount_cents integer|integer|SECURITY_DEFINER|search_path=public`
  - replay : `calculate_payout_fee_cents|p_method_type text, p_amount_cents integer|integer|SECURITY_DEFINER|-`
- `check_badge_milestones.p_user_id uuid`
  - staging: `check_badge_milestones|p_user_id uuid|void|SECURITY_DEFINER|search_path=public`
  - replay : `check_badge_milestones|p_user_id uuid|void|SECURITY_DEFINER|-`
- `check_push_rate_limit.p_user_id uuid`
  - staging: `check_push_rate_limit|p_user_id uuid|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `check_push_rate_limit|p_user_id uuid|boolean|SECURITY_DEFINER|-`
- `check_referral_code_exists.p_code text`
  - staging: `check_referral_code_exists|p_code text|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `check_referral_code_exists|p_code text|boolean|SECURITY_DEFINER|-`
- `check_sp_badges.`
  - staging: `check_sp_badges||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `check_sp_badges||trigger|SECURITY_DEFINER|-`
- `cleanup_expired_deduplications.`
  - staging: `cleanup_expired_deduplications||integer|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `cleanup_expired_deduplications||integer|SECURITY_DEFINER|-`
- `create_badge_notification.p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb`
  - staging: `create_badge_notification|p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb|uuid|SECURITY_DEFINER|search_path=public`
  - replay : `create_badge_notification|p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb|uuid|SECURITY_DEFINER|-`
- `create_email_log.p_user_id uuid, p_recipient_email text, p_template_type text, p_template_data jsonb`
  - staging: `create_email_log|p_user_id uuid, p_recipient_email text, p_template_type text, p_template_data jsonb|uuid|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `create_email_log|p_user_id uuid, p_recipient_email text, p_template_type text, p_template_data jsonb|uuid|SECURITY_DEFINER|-`
- `create_notification.p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb`
  - staging: `create_notification|p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb|void|SECURITY_DEFINER|search_path=public`
  - replay : `create_notification|p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb|void|SECURITY_DEFINER|-`
- `create_referral_code.p_user_id uuid`
  - staging: `create_referral_code|p_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public,row_security=off`
  - replay : `create_referral_code|p_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
- `create_sp_notification.p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb, p_check_subscription boolean`
  - staging: `create_sp_notification|p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb, p_check_subscription boolean|uuid|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `create_sp_notification|p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb, p_check_subscription boolean|uuid|SECURITY_DEFINER|-`
- `create_trade_with_disclaimer_v2.p_item_id uuid, p_sp_amount integer, p_disclaimer_policy_id uuid`
  - staging: `create_trade_with_disclaimer_v2|p_item_id uuid, p_sp_amount integer, p_disclaimer_policy_id uuid|json|SECURITY_DEFINER|-`
  - replay : `create_trade_with_disclaimer_v2|p_item_id uuid, p_sp_amount integer, p_disclaimer_policy_id uuid|json|SECURITY_DEFINER|search_path=public, pg_temp`
- `dispatch_sp_notification_push.`
  - staging: `dispatch_sp_notification_push||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `dispatch_sp_notification_push||trigger|SECURITY_DEFINER|-`
- `extend_trial_period.p_user_id uuid, p_referral_user_id uuid`
  - staging: `extend_trial_period|p_user_id uuid, p_referral_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `extend_trial_period|p_user_id uuid, p_referral_user_id uuid|jsonb|SECURITY_DEFINER|-`
- `fn_items_enforce_pending_for_starter_pack.`
  - staging: `fn_items_enforce_pending_for_starter_pack||trigger|SECURITY_DEFINER|search_path=public`
  - replay : `fn_items_enforce_pending_for_starter_pack||trigger|SECURITY_DEFINER|-`
- `fn_on_listing_pending_notification.`
  - staging: `fn_on_listing_pending_notification||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `fn_on_listing_pending_notification||trigger|SECURITY_DEFINER|-`
- `fn_validate_trade_timing_config.`
  - staging: `fn_validate_trade_timing_config||trigger|INVOKER|search_path=public`
  - replay : `fn_validate_trade_timing_config||trigger|INVOKER|-`
- `get_ab_test_performance.p_notification_type text, p_start_date timestamp with time zone, p_end_date timestamp with time zone`
  - staging: `get_ab_test_performance|p_notification_type text, p_start_date timestamp with time zone, p_end_date timestamp with time zone|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_ab_test_performance|p_notification_type text, p_start_date timestamp with time zone, p_end_date timestamp with time zone|jsonb|SECURITY_DEFINER|-`
- `get_admin_notifications.p_admin_id uuid, p_limit integer, p_unread_only boolean`
  - staging: `get_admin_notifications|p_admin_id uuid, p_limit integer, p_unread_only boolean|TABLE(id uuid, notification_type text, entity_id uuid, title text, message text, is_read boolean, created_at timestamp with time zone)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_admin_notifications|p_admin_id uuid, p_limit integer, p_unread_only boolean|TABLE(id uuid, notification_type text, entity_id uuid, title text, message text, is_read boolean, created_at timestamp with time zone)|SECURITY_DEFINER|-`
- `get_email_delivery_stats.p_start_date timestamp with time zone, p_end_date timestamp with time zone`
  - staging: `get_email_delivery_stats|p_start_date timestamp with time zone, p_end_date timestamp with time zone|TABLE(total_sent bigint, total_delivered bigint, total_opened bigint, total_clicked bigint, total_bounced bigint, total_failed bigint, delivery_rate numeric, open_rate numeric, click_rate numeric, bounce_rate numeric)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_email_delivery_stats|p_start_date timestamp with time zone, p_end_date timestamp with time zone|TABLE(total_sent bigint, total_delivered bigint, total_opened bigint, total_clicked bigint, total_bounced bigint, total_failed bigint, delivery_rate numeric, open_rate numeric, click_rate numeric, bounce_rate numeric)|SECURITY_DEFINER|-`
- `get_notification_channel_metrics.p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_category text`
  - staging: `get_notification_channel_metrics|p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_category text|TABLE(category text, email bigint, in_app bigint, push bigint, total bigint)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_notification_channel_metrics|p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_category text|TABLE(category text, email bigint, in_app bigint, push bigint, total bigint)|SECURITY_DEFINER|-`
- `get_notification_preferences.p_user_id uuid`
  - staging: `get_notification_preferences|p_user_id uuid|TABLE(category notification_category, push_enabled boolean, in_app_enabled boolean, email_enabled boolean, quiet_hours_enabled boolean, quiet_hours_start time without time zone, quiet_hours_end time without time zone)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_notification_preferences|p_user_id uuid|TABLE(category notification_category, push_enabled boolean, in_app_enabled boolean, email_enabled boolean, quiet_hours_enabled boolean, quiet_hours_start time without time zone, quiet_hours_end time without time zone)|SECURITY_DEFINER|-`
- `get_seller_node_id.p_seller_id uuid`
  - staging: `get_seller_node_id|p_seller_id uuid|uuid|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_seller_node_id|p_seller_id uuid|uuid|SECURITY_DEFINER|-`
- `get_sp_config.p_key text`
  - staging: `get_sp_config|p_key text|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_sp_config|p_key text|jsonb|SECURITY_DEFINER|-`
- `get_subscription_status.p_user_id uuid`
  - staging: `get_subscription_status|p_user_id uuid|TABLE(id uuid, user_id uuid, tier_id uuid, status text, has_used_trial boolean, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, current_period_start timestamp with time zone, current_period_end timestamp with time zone, next_billing_date timestamp with time zone, grace_started_at timestamp with time zone, grace_ends_at timestamp with time zone, cancelled_at timestamp with time zone, cancel_reason text, paused_until timestamp with time zone, auto_renew_enabled boolean, payment_retry_count integer, payment_failed_at timestamp with time zone, stripe_customer_id text, stripe_subscription_id text, stripe_payment_method_id text)|SECURITY_DEFINER|search_path=public`
  - replay : `get_subscription_status|p_user_id uuid|TABLE(id uuid, user_id uuid, tier_id uuid, status text, has_used_trial boolean, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, current_period_start timestamp with time zone, current_period_end timestamp with time zone, next_billing_date timestamp with time zone, grace_started_at timestamp with time zone, grace_ends_at timestamp with time zone, cancelled_at timestamp with time zone, cancel_reason text, paused_until timestamp with time zone, auto_renew_enabled boolean, payment_retry_count integer, stripe_customer_id text, stripe_subscription_id text, stripe_payment_method_id text)|SECURITY_DEFINER|search_path=public`
- `get_subscription_summary.p_user_id uuid`
  - staging: `get_subscription_summary|p_user_id uuid|TABLE(status text, can_spend_sp boolean, can_earn_sp boolean, trial_end_date timestamp with time zone, current_period_end timestamp with time zone)|SECURITY_DEFINER|search_path=public`
  - replay : `get_subscription_summary|p_user_id uuid|TABLE(status text, can_spend_sp boolean, trial_end_date timestamp with time zone, current_period_end timestamp with time zone)|SECURITY_DEFINER|-`
- `get_unread_messages_for_email.p_limit integer`
  - staging: `get_unread_messages_for_email|p_limit integer|TABLE(message_id uuid, trade_id uuid, sender_id uuid, recipient_id uuid, content text, created_at timestamp with time zone, sender_name text, recipient_email text)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_unread_messages_for_email|p_limit integer|TABLE(message_id uuid, trade_id uuid, sender_id uuid, recipient_id uuid, content text, created_at timestamp with time zone, sender_name text, recipient_email text)|SECURITY_DEFINER|-`
- `get_unread_notification_count.p_user_id uuid`
  - staging: `get_unread_notification_count|p_user_id uuid|integer|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_unread_notification_count|p_user_id uuid|integer|SECURITY_DEFINER|-`
- `get_user_expiration_warnings.p_user_id uuid`
  - staging: `get_user_expiration_warnings|p_user_id uuid|TABLE(warning_id uuid, sp_amount integer, expires_at timestamp with time zone, days_until_expiry integer, warning_type text)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `get_user_expiration_warnings|p_user_id uuid|TABLE(warning_id uuid, sp_amount integer, expires_at timestamp with time zone, days_until_expiry integer, warning_type text)|SECURITY_DEFINER|-`
- `get_user_sp_wallet_summary.p_user_id uuid`
  - staging: `get_user_sp_wallet_summary|p_user_id uuid|TABLE(available_points integer, pending_points integer, lifetime_earned integer, lifetime_spent integer, reserved_points integer, wallet_state text)|SECURITY_DEFINER|search_path=public`
  - replay : `get_user_sp_wallet_summary|p_user_id uuid|TABLE(available_points integer, pending_points integer, lifetime_earned integer, lifetime_spent integer, wallet_state text)|SECURITY_DEFINER|search_path=public`
- `invoke_trial_conversion_edge_function.`
  - staging: `invoke_trial_conversion_edge_function||jsonb|SECURITY_DEFINER|-`
  - replay : `invoke_trial_conversion_edge_function||jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
- `is_duplicate_notification.p_user_id uuid, p_notification_type text, p_fingerprint text`
  - staging: `is_duplicate_notification|p_user_id uuid, p_notification_type text, p_fingerprint text|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `is_duplicate_notification|p_user_id uuid, p_notification_type text, p_fingerprint text|boolean|SECURITY_DEFINER|-`
- `is_earning_subscriber.p_user_id uuid`
  - staging: `is_earning_subscriber|p_user_id uuid|boolean|SECURITY_DEFINER|-`
  - replay : `is_earning_subscriber|p_user_id uuid|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
- `is_eligible_for_starter_pack.p_seller_id uuid`
  - staging: `is_eligible_for_starter_pack|p_seller_id uuid|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `is_eligible_for_starter_pack|p_seller_id uuid|boolean|SECURITY_DEFINER|-`
- `is_in_quiet_hours.p_user_id uuid, p_current_time time without time zone`
  - staging: `is_in_quiet_hours|p_user_id uuid, p_current_time time without time zone|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `is_in_quiet_hours|p_user_id uuid, p_current_time time without time zone|boolean|SECURITY_DEFINER|-`
- `issue_starter_pack.p_user_id uuid, p_listing_id uuid`
  - staging: `issue_starter_pack|p_user_id uuid, p_listing_id uuid|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `issue_starter_pack|p_user_id uuid, p_listing_id uuid|jsonb|SECURITY_DEFINER|-`
- `log_push_delivery.p_user_id uuid, p_notification_id uuid, p_push_token_id uuid, p_expo_receipt_id text, p_receipt_status text, p_receipt_message text, p_receipt_details jsonb, p_retry_count integer`
  - staging: `log_push_delivery|p_user_id uuid, p_notification_id uuid, p_push_token_id uuid, p_expo_receipt_id text, p_receipt_status text, p_receipt_message text, p_receipt_details jsonb, p_retry_count integer|uuid|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `log_push_delivery|p_user_id uuid, p_notification_id uuid, p_push_token_id uuid, p_expo_receipt_id text, p_receipt_status text, p_receipt_message text, p_receipt_details jsonb, p_retry_count integer|uuid|SECURITY_DEFINER|-`
- `mark_all_notifications_read.p_user_id uuid`
  - staging: `mark_all_notifications_read|p_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_all_notifications_read|p_user_id uuid|jsonb|SECURITY_DEFINER|-`
- `mark_expired_messages.`
  - staging: `mark_expired_messages||integer|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_expired_messages||integer|SECURITY_DEFINER|-`
- `mark_message_email_sent.p_message_id uuid`
  - staging: `mark_message_email_sent|p_message_id uuid|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_message_email_sent|p_message_id uuid|boolean|SECURITY_DEFINER|-`
- `mark_notification_as_read.p_notification_id uuid`
  - staging: `mark_notification_as_read|p_notification_id uuid|void|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_notification_as_read|p_notification_id uuid|void|SECURITY_DEFINER|-`
- `mark_notification_read.p_notification_id uuid, p_user_id uuid`
  - staging: `mark_notification_read|p_notification_id uuid, p_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_notification_read|p_notification_id uuid, p_user_id uuid|jsonb|SECURITY_DEFINER|-`
- `mark_starter_pack_claimed.p_listing_id uuid`
  - staging: `mark_starter_pack_claimed|p_listing_id uuid|void|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_starter_pack_claimed|p_listing_id uuid|void|SECURITY_DEFINER|-`
- `mark_trade_messages_delivered.p_trade_id uuid, p_user_id uuid`
  - staging: `mark_trade_messages_delivered|p_trade_id uuid, p_user_id uuid|integer|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_trade_messages_delivered|p_trade_id uuid, p_user_id uuid|integer|SECURITY_DEFINER|-`
- `mark_trade_messages_read.p_trade_id uuid, p_user_id uuid`
  - staging: `mark_trade_messages_read|p_trade_id uuid, p_user_id uuid|integer|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `mark_trade_messages_read|p_trade_id uuid, p_user_id uuid|integer|SECURITY_DEFINER|-`
- `notify_new_message.`
  - staging: `notify_new_message||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `notify_new_message||trigger|SECURITY_DEFINER|-`
- `notify_seller_item_status_change.`
  - staging: `notify_seller_item_status_change||trigger|SECURITY_DEFINER|search_path=public`
  - replay : `notify_seller_item_status_change||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
- `populate_trade_node_id.`
  - staging: `populate_trade_node_id||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `populate_trade_node_id||trigger|SECURITY_DEFINER|-`
- `process_sp_expiration.`
  - staging: `process_sp_expiration||jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `process_sp_expiration||jsonb|SECURITY_DEFINER|-`
- `process_unsubscribe.p_token text`
  - staging: `process_unsubscribe|p_token text|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `process_unsubscribe|p_token text|jsonb|SECURITY_DEFINER|-`
- `recompute_seller_balance.p_user_id uuid`
  - staging: `recompute_seller_balance|p_user_id uuid|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `recompute_seller_balance|p_user_id uuid|jsonb|SECURITY_DEFINER|-`
- `record_notification_dedup.p_user_id uuid, p_notification_type text, p_fingerprint text`
  - staging: `record_notification_dedup|p_user_id uuid, p_notification_type text, p_fingerprint text|void|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `record_notification_dedup|p_user_id uuid, p_notification_type text, p_fingerprint text|void|SECURITY_DEFINER|-`
- `refund_sp_for_cancelled_trade.p_user_id uuid, p_trade_id uuid, p_sp_amount integer`
  - staging: `refund_sp_for_cancelled_trade|p_user_id uuid, p_trade_id uuid, p_sp_amount integer|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `refund_sp_for_cancelled_trade|p_user_id uuid, p_trade_id uuid, p_sp_amount integer|jsonb|SECURITY_DEFINER|-`
- `remove_from_retry_queue.p_notification_id uuid`
  - staging: `remove_from_retry_queue|p_notification_id uuid|void|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `remove_from_retry_queue|p_notification_id uuid|void|SECURITY_DEFINER|-`
- `rpc_cart_add_item.p_listing_id uuid`
  - staging: `rpc_cart_add_item|p_listing_id uuid|jsonb|INVOKER|search_path=public`
  - replay : `rpc_cart_add_item|p_listing_id uuid|jsonb|SECURITY_DEFINER|search_path=public`
- `search_listings_by_category_and_query.p_category_id uuid, p_query text, p_sp_eligible_only boolean, p_limit integer, p_offset integer`
  - staging: `search_listings_by_category_and_query|p_category_id uuid, p_query text, p_sp_eligible_only boolean, p_limit integer, p_offset integer|TABLE(id uuid, title text, description text, price numeric, accepts_swap_points boolean, status text, seller_id uuid, category_id uuid, condition text, created_at timestamp with time zone, updated_at timestamp with time zone, relevance real)|INVOKER|-`
  - replay : `search_listings_by_category_and_query|p_category_id uuid, p_query text, p_sp_eligible_only boolean, p_limit integer, p_offset integer|TABLE(id uuid, title text, description text, price numeric, accepts_swap_points boolean, status text, seller_id uuid, category_id uuid, condition text, created_at timestamp with time zone, updated_at timestamp with time zone, relevance real, seller_name text, seller_avatar_url text, seller_verification_status text)|INVOKER|-`
- `search_listings_by_category.p_category_id uuid, p_sp_eligible_only boolean, p_limit integer, p_offset integer`
  - staging: `search_listings_by_category|p_category_id uuid, p_sp_eligible_only boolean, p_limit integer, p_offset integer|TABLE(id uuid, title text, description text, price numeric, accepts_swap_points boolean, status text, seller_id uuid, category_id uuid, condition text, created_at timestamp with time zone, updated_at timestamp with time zone)|INVOKER|-`
  - replay : `search_listings_by_category|p_category_id uuid, p_sp_eligible_only boolean, p_limit integer, p_offset integer|TABLE(id uuid, title text, description text, price numeric, accepts_swap_points boolean, status text, seller_id uuid, category_id uuid, condition text, created_at timestamp with time zone, updated_at timestamp with time zone, seller_name text, seller_avatar_url text, seller_verification_status text)|INVOKER|-`
- `send_sp_expiration_warnings.`
  - staging: `send_sp_expiration_warnings||jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `send_sp_expiration_warnings||jsonb|SECURITY_DEFINER|-`
- `sync_sp_config_on_admin_update.`
  - staging: `sync_sp_config_on_admin_update||trigger|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `sync_sp_config_on_admin_update||trigger|SECURITY_DEFINER|-`
- `track_email_event.p_sendgrid_message_id text, p_event_type text, p_bounce_reason text`
  - staging: `track_email_event|p_sendgrid_message_id text, p_event_type text, p_bounce_reason text|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `track_email_event|p_sendgrid_message_id text, p_event_type text, p_bounce_reason text|jsonb|SECURITY_DEFINER|-`
- `track_notification_event.p_notification_id uuid, p_event_type text, p_event_data jsonb`
  - staging: `track_notification_event|p_notification_id uuid, p_event_type text, p_event_data jsonb|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `track_notification_event|p_notification_id uuid, p_event_type text, p_event_data jsonb|jsonb|SECURITY_DEFINER|-`
- `update_email_log_status.p_log_id uuid, p_sendgrid_message_id text, p_status text, p_error_message text`
  - staging: `update_email_log_status|p_log_id uuid, p_sendgrid_message_id text, p_status text, p_error_message text|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `update_email_log_status|p_log_id uuid, p_sendgrid_message_id text, p_status text, p_error_message text|jsonb|SECURITY_DEFINER|-`
- `update_message_delivery_status.p_message_id uuid, p_status text`
  - staging: `update_message_delivery_status|p_message_id uuid, p_status text|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `update_message_delivery_status|p_message_id uuid, p_status text|boolean|SECURITY_DEFINER|-`
- `update_notification_preference.p_user_id uuid, p_category notification_category, p_push_enabled boolean, p_in_app_enabled boolean, p_email_enabled boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start time without time zone, p_quiet_hours_end time without time zone`
  - staging: `update_notification_preference|p_user_id uuid, p_category notification_category, p_push_enabled boolean, p_in_app_enabled boolean, p_email_enabled boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start time without time zone, p_quiet_hours_end time without time zone|jsonb|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `update_notification_preference|p_user_id uuid, p_category notification_category, p_push_enabled boolean, p_in_app_enabled boolean, p_email_enabled boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start time without time zone, p_quiet_hours_end time without time zone|jsonb|SECURITY_DEFINER|-`
- `update_sp_config.p_key text, p_value jsonb, p_admin_id uuid`
  - staging: `update_sp_config|p_key text, p_value jsonb, p_admin_id uuid|boolean|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `update_sp_config|p_key text, p_value jsonb, p_admin_id uuid|boolean|SECURITY_DEFINER|-`
- `upsert_admin_config.p_key text, p_value text`
  - staging: `upsert_admin_config|p_key text, p_value text|TABLE(key text, value text, updated boolean)|SECURITY_DEFINER|search_path=public, pg_temp`
  - replay : `upsert_admin_config|p_key text, p_value text|TABLE(key text, value text, updated boolean)|SECURITY_DEFINER|-`

### POLICY (4)

- `badges.Admins can update badges`
  - staging: `badges|Admins can update badges|UPDATE|authenticated|true|-`
  - replay : `badges|Admins can update badges|UPDATE|authenticated|user_has_role(auth.uid(), 'admin'::text)|user_has_role(auth.uid(), 'admin'::text)`
- `profiles.Users can insert their own profile`
  - staging: `profiles|Users can insert their own profile|INSERT|public|-|((user_id IN ( SELECT users.id FROM auth.users)) OR (auth.uid() IS NULL))`
  - replay : `profiles|Users can insert their own profile|INSERT|public|-|((auth.uid() IS NULL) OR (auth.uid() = user_id))`
- `trades.trades_select_participant_same_node`
  - staging: `trades|trades_select_participant_same_node|SELECT|authenticated|(((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND ((node_id IS NULL) OR (node_id = get_user_node_id(auth.uid())) OR (buyer_id = auth.uid()) OR (seller_id = auth.uid())))|-`
  - replay : `trades|trades_select_participant_same_node|SELECT|authenticated|(((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND ((node_id IS NULL) OR (node_id = get_user_node_id(auth.uid()))))|-`
- `user_badges.Service role can read all user badges`
  - staging: `user_badges|Service role can read all user badges|SELECT|public|true|-`
  - replay : `user_badges|Service role can read all user badges|SELECT|authenticated|true|-`

### RLS (2)

- `debug_logs`
  - staging: `debug_logs|true`
  - replay : `debug_logs|false`
- `nodes`
  - staging: `nodes|true`
  - replay : `nodes|false`

### VIEW (1)

- `user_subscriptions`
  - staging: `user_subscriptions|fd10d15658f92fc19a6398731d9e4476`
  - replay : `user_subscriptions|767bb836ee2303378a47f793f55c4415`

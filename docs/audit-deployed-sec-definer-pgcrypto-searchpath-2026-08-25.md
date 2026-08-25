# Deployed-Body Audit — SECURITY DEFINER search_path / pgcrypto / base64url

**Date:** 2026-08-25
**Project (staging):** `drntwgporzabmxdqykrp`
**Method:** Query `pg_proc` (joined `pg_namespace`) on **staging directly** for every
`SECURITY DEFINER` function in `public`, inspecting the **actual deployed** `proconfig`
(search_path) and the deployed body (`pg_get_functiondef`) for:
1. pgcrypto calls (`gen_random_bytes`, `gen_salt`, `crypt`, `digest`, `hmac`, `encrypt`,
   `decrypt`) that are not schema-qualified with `extensions.` **and** run under a
   search_path that does not include `extensions`;
2. any `encode(..., 'base64url')` usage (unsupported on this PG version).

This audit was triggered because migration 314 (`314_prod_p1_security_definer_search_path_hardening.sql`)
applies `SET search_path = public, pg_temp` to every public `SECURITY DEFINER` function at
deploy time, so the **deployed body can differ from the source migration file** — a source
grep is not authoritative.

## Result

- **Functions checked: 321** (all `public` `SECURITY DEFINER`)
- **pgcrypto-relevant bodies:** 4 (`generate_unsubscribe_token`, `hash_otp_code`,
  `verify_otp_code`, `check_account_exists_by_email`)
- **`base64url` in deployed bodies:** 0
- **Defects found: 0** — no new fix migrations required.

### Verdict notes (pgcrypto/base64url-relevant functions)

| Function | Deployed search_path | Verdict |
|---|---|---|
| `generate_unsubscribe_token` | `public, pg_temp` | **PASS** — deployed body calls `extensions.gen_random_bytes(32)` + `encode(...,'hex')` (fixes 318 + 319 confirmed live) |
| `hash_otp_code` | `public, extensions` | **PASS** — Phase-26 fix confirmed live; unqualified `crypt`/`gen_salt` resolve |
| `verify_otp_code` | `public, extensions` | **PASS** — Phase-26 fix confirmed live; unqualified `crypt` resolves |
| `check_account_exists_by_email` | `public, pg_temp` | **PASS** — **false positive**: deployed body == source; the only "crypt" match is the `encrypted_password` column substring. No pgcrypto call present. |

### Source-level cross-check (latent, not deployed)

- `base64url` appears only in superseded migrations `209` (original) and `318` (intermediate);
  the newest body (`319`) uses `hex`. No Edge Function references `base64url`.
- Unqualified pgcrypto usage in newest migrations exists only in the Phase-26 fix, which is
  correct because its functions carry `search_path = public, extensions`.

## Full audited-function list (PASS / FIXED per function)

| # | Function | Identity args | Deployed search_path | pgcrypto | base64url | Verdict |
|---|---|---|---|---|---|---|
| 1 | `add_to_retry_queue` | `p_notification_id uuid, p_user_id uuid, p_error text, p_error_details jsonb` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 2 | `adjust_sp_wallet` | `p_user_id uuid, p_amount integer, p_type text, p_description text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 3 | `admin_action_center_detail` | `p_source text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 4 | `admin_action_center_summary` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 5 | `admin_adjust_sp_wallet` | `p_user_id uuid, p_amount integer, p_reason text, p_admin_notes text, p_actor_id uuid, p_idempotency_key text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 6 | `admin_approve_flagged_listing` | `p_listing_id uuid, p_admin_user_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 7 | `admin_approve_listing` | `p_listing_id uuid, p_admin_user_id uuid, p_reason text` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 8 | `admin_cancellation_insights` | `p_start timestamp with time zone, p_end timestamp with time zone` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 9 | `admin_cancellation_user_detail` | `p_user_id uuid, p_start timestamp with time zone, p_end timestamp with time zone` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 10 | `admin_delete_user` | `p_admin_id uuid, p_user_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 11 | `admin_force_cancel_trade_db` | `p_trade_id uuid, p_admin_user_id uuid, p_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 12 | `admin_force_delete_listing` | `p_listing_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 13 | `admin_get_sp_wallet_detail` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 14 | `admin_get_trade_analytics` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 15 | `admin_get_user_analytics` | `p_admin_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 16 | `admin_get_user_detail` | `p_admin_id uuid, p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 17 | `admin_global_search` | `p_query text, p_limit integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 18 | `admin_has_role` | `p_user_id uuid` | `search_path=public, auth` | false | false | PASS (no pgcrypto/base64url usage) |
| 19 | `admin_health_summary` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 20 | `admin_list_users` | `p_admin_id uuid, p_search text, p_account_status text, p_subscription_status text, p_node_id text, p_page integer, p_page_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 21 | `admin_list_users` | `p_admin_id uuid, p_search text, p_account_status text, p_subscription_status text, p_node_id text, p_page integer, p_page_size integer, p_sort_by text, p_sort_order text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 22 | `admin_node_kpis` | `p_node_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 23 | `admin_pause_listing` | `p_listing_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 24 | `admin_reset_trial_uses` | `p_user_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 25 | `admin_search_listings_v2` | `p_query text, p_status text, p_sp_eligible boolean, p_page integer, p_items_per_page integer` | `search_path=public, auth` | false | false | PASS (no pgcrypto/base64url usage) |
| 26 | `admin_sp_economy_summary` | `p_start timestamp with time zone, p_end timestamp with time zone, p_node_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 27 | `admin_suspend_user` | `p_admin_id uuid, p_user_id uuid, p_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 28 | `admin_toggle_sp_wallet_status` | `p_user_id uuid, p_new_status text, p_admin_notes text, p_actor_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 29 | `admin_trigger_retroactive_awards` | `p_badge_id uuid, p_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 30 | `admin_unpause_listing` | `p_listing_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 31 | `admin_unsuspend_user` | `p_admin_id uuid, p_user_id uuid, p_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 32 | `apply_profile_signup_referral_from_metadata` | `` | `search_path=public;row_security=off` | false | false | PASS (no pgcrypto/base64url usage) |
| 33 | `apply_referral_code` | `p_user_id uuid, p_code text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 34 | `apply_starter_pack_on_approval` | `p_actor_admin_id uuid, p_seller_id uuid, p_listing_id uuid, p_eligible_for_sp boolean` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 35 | `apply_tax_to_trade` | `p_trade_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 36 | `award_badge_if_eligible` | `p_user_id uuid, p_category text, p_current_value integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 37 | `award_challenge_sp` | `p_user_id uuid, p_challenge_id uuid, p_sp_amount integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 38 | `award_listing_referral_sp` | `p_referrer_id uuid, p_referee_id uuid, p_referral_id uuid, p_item_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 39 | `award_referral_sp` | `p_referrer_id uuid, p_referee_id uuid, p_referral_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 40 | `calculate_node_distance` | `node1_id uuid, node2_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 41 | `calculate_payout_fee_cents` | `p_method_type text, p_amount_cents integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 42 | `calculate_tax` | `p_node_id uuid, p_taxable_amount_cents integer, p_tax_category_id uuid, p_item_price_cents integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 43 | `can_send_trade_notification` | `p_trade_id uuid, p_user_id uuid, p_type text, p_is_payout_related boolean` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 44 | `can_user_earn_sp` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 45 | `can_user_spend_sp` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 46 | `cancel_trade_v2` | `p_trade_id uuid, p_user_id uuid, p_reason text` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 47 | `check_account_exists_by_email` | `p_email text` | `search_path=public, pg_temp` | true | false | PASS (no pgcrypto call; "crypt" = encrypted_password substring) |
| 48 | `check_badge_milestones` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 49 | `check_coppa_before_item_insert` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 50 | `check_coppa_before_trade_insert` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 51 | `check_expired_trials` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 52 | `check_phone_verification_status` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 53 | `check_push_rate_limit` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 54 | `check_referral_code_exists` | `p_code text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 55 | `check_sp_badges` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 56 | `check_trade_badges` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 57 | `cleanup_expired_deduplications` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 58 | `complete_trade_v2` | `p_trade_id uuid, p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 59 | `convert_trial_to_active` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 60 | `create_badge_notification` | `p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 61 | `create_email_log` | `p_user_id uuid, p_recipient_email text, p_template_type text, p_template_data jsonb` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 62 | `create_notification` | `p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 63 | `create_referral_code` | `p_user_id uuid` | `search_path=public;row_security=off` | false | false | PASS (no pgcrypto/base64url usage) |
| 64 | `create_seller_payout_on_trade_completion` | `p_trade_id uuid, p_seller_id uuid, p_gross_amount_cents integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 65 | `create_sp_notification` | `p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb, p_check_subscription boolean` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 66 | `create_system_notification_with_preferences` | `p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 67 | `create_trade_notification` | `p_user_id uuid, p_notification_type text, p_title text, p_body text, p_data jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 68 | `create_trial_subscription` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 69 | `credit_sp_for_cancelled_trade` | `p_user_id uuid, p_trade_id uuid, p_points integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 70 | `deactivate_tax_rule` | `p_rule_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 71 | `debit_sp_for_trade` | `p_user_id uuid, p_trade_id uuid, p_points integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 72 | `debug_auth_context` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 73 | `dispatch_sp_notification_push` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 74 | `downgrade_trial_to_grace` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 75 | `earn_sp_for_trade` | `p_user_id uuid, p_trade_id uuid, p_points integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 76 | `edu_is_admin` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 77 | `enforce_max_drafts` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 78 | `enforce_min_age_on_signup` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 79 | `enforce_phone_verified_on_item_insert` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 80 | `ensure_profile_referral_code` | `` | `search_path=public;row_security=off` | false | false | PASS (no pgcrypto/base64url usage) |
| 81 | `ensure_sp_wallet_exists` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 82 | `extend_trial_period` | `p_user_id uuid, p_referral_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 83 | `fn_admin_config_int` | `p_key text, p_default integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 84 | `fn_admin_get_fee_tier_stats` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 85 | `fn_analytics_backfill_node` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 86 | `fn_analytics_sp_events` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 87 | `fn_analytics_subscription_events` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 88 | `fn_analytics_trade_created` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 89 | `fn_analytics_trade_outcome` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 90 | `fn_analytics_user_activated_listing` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 91 | `fn_analytics_user_registered` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 92 | `fn_audit_tax_rule_change` | `` | `search_path=public, auth` | false | false | PASS (no pgcrypto/base64url usage) |
| 93 | `fn_cleanup_test_buyer_trades` | `p_buyer_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 94 | `fn_emit_engagement` | `p_user_id uuid, p_node_id uuid, p_trade_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 95 | `fn_enforce_cart_limits` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 96 | `fn_expire_saved_carts` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 97 | `fn_get_admin_config_meta` | `p_keys text[]` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 98 | `fn_get_admin_config_values` | `p_keys text[]` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 99 | `fn_get_buyer_fee_for_checkout` | `p_user_id uuid, p_cash_portion_cents integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 100 | `fn_get_fee_config` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 101 | `fn_get_sp_entitlement` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 102 | `fn_handle_seller_cancellation` | `p_seller_id uuid, p_trade_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 103 | `fn_insert_analytics_event` | `p_event_name text, p_user_id uuid, p_node_id uuid, p_category text, p_properties jsonb, p_source text, p_idempotency_key text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 104 | `fn_item_effective_sp_cap` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 105 | `fn_item_images_require_reapproval` | `` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 106 | `fn_items_enforce_pending_for_starter_pack` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 107 | `fn_items_require_reapproval_on_seller_edit` | `` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 108 | `fn_log_analytics_event` | `p_event_name text, p_user_id uuid, p_node_id uuid, p_category text, p_properties jsonb, p_source text, p_idempotency_key text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 109 | `fn_log_financial_audit` | `p_mutation_type text, p_entity_type text, p_entity_id uuid, p_actor_id uuid, p_before_state jsonb, p_after_state jsonb, p_amount_cents integer, p_idempotency_key text, p_node_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 110 | `fn_on_listing_pending_notification` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 111 | `fn_payments_sync_from_trade` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 112 | `fn_queue_payout_on_complete` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 113 | `fn_recompute_buyer_fee_state` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 114 | `fn_reset_unanswered_counter` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 115 | `fn_resolve_admin_emails` | `p_user_ids uuid[]` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 116 | `fn_restore_first_trade_eligibility_on_full_refund` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 117 | `fn_sync_buyer_fee_state_on_subscription` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 118 | `fn_sync_buyer_fee_state_on_trade` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 119 | `fn_touch_cart_on_item_status_change` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 120 | `generate_unsubscribe_token` | `p_user_id uuid, p_category notification_category` | `search_path=public, pg_temp` | true | false | PASS (qualified extensions.gen_random_bytes + hex) |
| 121 | `get_ab_test_performance` | `p_notification_type text, p_start_date timestamp with time zone, p_end_date timestamp with time zone` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 122 | `get_admin_notifications` | `p_admin_id uuid, p_limit integer, p_unread_only boolean` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 123 | `get_admin_payout_config` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 124 | `get_admin_payouts` | `p_status text, p_search text, p_limit integer, p_offset integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 125 | `get_badge_audit_logs` | `p_user_id uuid, p_badge_id uuid, p_action_type text, p_limit integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 126 | `get_badge_config_history` | `p_badge_id uuid, p_limit integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 127 | `get_badge_leaderboard` | `p_limit integer, p_offset integer` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 128 | `get_config_value` | `p_key text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 129 | `get_cron_jobs_with_last_run` | `p_include_inactive boolean, p_timezone text` | `search_path=public, cron` | false | false | PASS (no pgcrypto/base64url usage) |
| 130 | `get_cron_recent_runs` | `p_lookback_hours integer, p_limit integer, p_timezone text` | `search_path=public, cron` | false | false | PASS (no pgcrypto/base64url usage) |
| 131 | `get_current_policy` | `p_policy_type text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 132 | `get_email_delivery_stats` | `p_start_date timestamp with time zone, p_end_date timestamp with time zone` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 133 | `get_engagement_metrics` | `p_admin_id uuid, p_date date` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 134 | `get_listing_by_id` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 135 | `get_listing_moderation_gate` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 136 | `get_max_trial_uses` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 137 | `get_node_tax_rate` | `p_node_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 138 | `get_nodes_within_radius` | `center_lat double precision, center_lng double precision, radius_miles double precision` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 139 | `get_notification_analytics` | `p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_category text, p_notification_type text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 140 | `get_notification_channel_metrics` | `p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_category text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 141 | `get_notification_preferences` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 142 | `get_recommendations` | `p_user_id uuid, p_limit integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 143 | `get_referral_config_values` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 144 | `get_referral_funnel` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 145 | `get_referral_listing_config` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 146 | `get_referral_metrics` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 147 | `get_revenue_metrics` | `p_admin_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 148 | `get_revenue_time_series` | `p_admin_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_interval text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 149 | `get_seller_node_id` | `p_seller_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 150 | `get_sp_config` | `p_key text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 151 | `get_sp_economy_metrics` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 152 | `get_subscription_status` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 153 | `get_subscription_summary` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 154 | `get_tax_export_data` | `p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_status_filter text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 155 | `get_tax_summary_for_period` | `p_start_date date, p_end_date date, p_node_id uuid, p_report_type text, p_status_filter text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 156 | `get_top_referrers` | `p_limit integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 157 | `get_trial_duration_days` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 158 | `get_trial_limit_status` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 159 | `get_unread_messages_for_email` | `p_limit integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 160 | `get_unread_notification_count` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 161 | `get_user_expiration_warnings` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 162 | `get_user_node_id` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 163 | `get_user_sp_wallet_summary` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 164 | `get_user_transaction_fee` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 165 | `grant_referral_rewards_for_trade_v2` | `p_trade_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 166 | `handle_new_user` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 167 | `handle_referral_rewards_on_trade_completion` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 168 | `handle_user_update` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 169 | `has_accepted_current_policy` | `p_user_id uuid, p_policy_type text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 170 | `hash_otp_code` | `p_code text` | `search_path=public, extensions` | true | false | PASS (search_path includes extensions) |
| 171 | `increment_trial_uses` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 172 | `initialize_sp_wallet` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 173 | `initialize_user_preferences` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 174 | `invoke_cpsc_import_cron` | `` | `search_path=public, extensions, net` | false | false | PASS (no pgcrypto/base64url usage) |
| 175 | `invoke_grace_period_cron` | `` | `search_path=public, extensions, net` | false | false | PASS (no pgcrypto/base64url usage) |
| 176 | `invoke_trial_conversion_edge_function` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 177 | `is_active_subscriber` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 178 | `is_admin` | `user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 179 | `is_duplicate_notification` | `p_user_id uuid, p_notification_type text, p_fingerprint text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 180 | `is_eligible_for_starter_pack` | `p_seller_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 181 | `is_in_quiet_hours` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 182 | `is_in_quiet_hours` | `p_user_id uuid, p_current_time time without time zone` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 183 | `is_phone_verified` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 184 | `is_trial_enabled` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 185 | `is_user_trial_eligible` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 186 | `issue_starter_pack` | `p_user_id uuid, p_listing_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 187 | `link_social_account` | `p_provider_name text, p_provider_user_id text, p_provider_email text, p_provider_data jsonb` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 188 | `list_tax_categories` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 189 | `list_tax_rules` | `p_active_only boolean, p_tax_category_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 190 | `log_debug` | `p_process_name text, p_user_id uuid, p_message text, p_payload jsonb, p_error_message text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 191 | `log_push_delivery` | `p_user_id uuid, p_notification_id uuid, p_push_token_id uuid, p_expo_receipt_id text, p_receipt_status text, p_receipt_message text, p_receipt_details jsonb, p_retry_count integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 192 | `log_trade_event` | `p_trade_id uuid, p_event_name text, p_user_id uuid, p_metadata jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 193 | `manual_award_badge` | `p_user_id uuid, p_badge_id uuid, p_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 194 | `manual_revoke_badge` | `p_user_id uuid, p_badge_id uuid, p_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 195 | `mark_all_notifications_read` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 196 | `mark_expired_messages` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 197 | `mark_message_email_sent` | `p_message_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 198 | `mark_notification_as_read` | `p_notification_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 199 | `mark_notification_read` | `p_notification_id uuid, p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 200 | `mark_starter_pack_claimed` | `p_listing_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 201 | `mark_trade_messages_delivered` | `p_trade_id uuid, p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 202 | `mark_trade_messages_read` | `p_trade_id uuid, p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 203 | `merge_item_draft` | `p_draft_id uuid, p_updates jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 204 | `notify_new_message` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 205 | `notify_referral_rewards_granted` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 206 | `notify_seller_item_status_change` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 207 | `populate_trade_node_id` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 208 | `preview_retroactive_awards` | `p_badge_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 209 | `process_referral_bonus_on_listing_v2` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 210 | `process_referral_bonus_on_trade` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 211 | `process_sp_expiration` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 212 | `process_unsubscribe` | `p_token text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 213 | `publish_policy` | `p_policy_id uuid, p_admin_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 214 | `publish_section` | `p_section_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 215 | `recompute_seller_balance` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 216 | `record_notification_dedup` | `p_user_id uuid, p_notification_type text, p_fingerprint text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 217 | `record_payment_attempt` | `p_user_id uuid, p_success boolean, p_amount integer, p_charge_id text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 218 | `record_policy_acceptance` | `p_user_id uuid, p_policy_id uuid, p_ip_address text, p_user_agent text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 219 | `refund_sp_for_cancelled_trade` | `p_user_id uuid, p_trade_id uuid, p_sp_amount integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 220 | `refund_tax` | `p_trade_id uuid, p_refund_amount_cents integer, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 221 | `remove_from_retry_queue` | `p_notification_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 222 | `reorder_categories` | `p_category_orders jsonb` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 223 | `request_account_deletion` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 224 | `request_seller_payout` | `p_user_id uuid, p_amount_cents integer` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 225 | `retroactive_award_badges` | `p_badge_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 226 | `rpc_apply_seller_recovery` | `p_dispute_id text, p_amount_cents integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 227 | `rpc_apply_trade_extension` | `p_trade_id uuid, p_actor_id uuid, p_new_pi_id text, p_new_pi_amount_cents integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 228 | `rpc_auto_cancel_trade` | `p_trade_id uuid, p_reason text, p_cancelled_at timestamp with time zone` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 229 | `rpc_cancel_pending_trade_pi` | `p_trade_id uuid, p_cancellation_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 230 | `rpc_capture_trade_payment` | `p_trade_id uuid, p_stripe_payment_intent_id text, p_stripe_capture_id text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 231 | `rpc_cart_clear` | `p_cart_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 232 | `rpc_cart_get_items` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 233 | `rpc_cart_remove_item` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 234 | `rpc_cart_save_current` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 235 | `rpc_cart_switch_to_saved` | `p_cart_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 236 | `rpc_cart_validate_for_checkout` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 237 | `rpc_emit_daily_analytics_snapshots` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 238 | `rpc_favorites_add` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 239 | `rpc_favorites_get` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 240 | `rpc_favorites_remove` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 241 | `rpc_favorites_resolve_user_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 242 | `rpc_finalize_trade_after_capture` | `p_trade_id uuid, p_stripe_capture_id text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 243 | `rpc_flag_tax_reconciliation` | `p_trade_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 244 | `rpc_get_buyer_sp_balance` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 245 | `rpc_get_category_sp_cap` | `p_listing_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 246 | `rpc_mark_tax_capture_failed` | `p_trade_id uuid, p_failure_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 247 | `rpc_mark_tax_collected` | `p_trade_id uuid, p_stripe_capture_id text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 248 | `rpc_process_auto_complete` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 249 | `rpc_process_expired_offers` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 250 | `rpc_process_extension_timeouts` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 251 | `rpc_record_dispute_event` | `p_dispute_id text, p_event_type text, p_charge_id text, p_payment_intent_id text, p_status text, p_amount_cents integer, p_outcome text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 252 | `rpc_record_faq_vote` | `p_faq_item_id uuid, p_vote text, p_user_id uuid, p_anonymous_id text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 253 | `rpc_record_payment_refund` | `p_trade_id uuid, p_stripe_refund_id text, p_refund_price_cents integer, p_refund_fee_cents integer, p_refund_tax_cents integer, p_reason text, p_initiating_actor text, p_refund_status text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 254 | `rpc_refund_tax_with_status` | `p_trade_id uuid, p_refund_amount_cents integer, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 255 | `rpc_release_due_payouts` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 256 | `rpc_release_pending_sp` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 257 | `rpc_request_trade_extension` | `p_trade_id uuid, p_requester_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 258 | `rpc_reset_faq_votes` | `p_faq_item_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 259 | `rpc_send_auto_complete_reminders` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 260 | `rpc_send_offer_reminders` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 261 | `rpc_send_pickup_reminders` | `p_batch_size integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 262 | `rpc_set_sp_wallet_state` | `p_user_id uuid, p_state text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 263 | `rpc_sync_payment_refund_webhook` | `p_trade_id uuid, p_stripe_refund_id text, p_refund_amount_cents integer, p_status text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 264 | `rpc_track_analytics_event` | `p_event_name text, p_user_id uuid, p_node_id uuid, p_category text, p_properties jsonb, p_source text, p_idempotency_key text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 265 | `rpc_trigger_process_extension_timeouts` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 266 | `rpc_trigger_send_offer_reminders` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 267 | `rpc_trigger_send_pickup_reminders` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 268 | `rpc_upsert_web_subscription` | `p_user_id uuid, p_stripe_customer_id text, p_stripe_subscription_id text, p_tier_id uuid, p_status text, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_has_used_trial boolean, p_cancel_at_period_end boolean, p_trial_end timestamp with time zone` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 269 | `rpc_void_tax_for_trade` | `p_trade_id uuid, p_reason text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 270 | `run_cron_job_now` | `p_job_id bigint` | `search_path=public, cron` | false | false | PASS (no pgcrypto/base64url usage) |
| 271 | `scheduled_award_tenure_badges` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 272 | `scheduled_message_cleanup` | `p_invoked_by text, p_job_payload jsonb` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 273 | `scheduled_send_message_emails` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 274 | `scheduled_trial_reminders` | `` | `search_path=public, extensions, net` | false | false | PASS (no pgcrypto/base64url usage) |
| 275 | `secure_upsert_admin_config` | `p_key text, p_value text, p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 276 | `send_sp_expiration_warnings` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 277 | `set_cart_item_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 278 | `set_dispute_cost_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 279 | `set_item_node_id_from_seller` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 280 | `set_payment_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 281 | `set_payout_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 282 | `set_primary_payout_method` | `p_user_id uuid, p_method_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 283 | `set_seller_balance_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 284 | `set_sp_batch_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 285 | `set_sp_ledger_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 286 | `set_trade_refund_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 287 | `set_wallet_node_id` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 288 | `setup_user_profile` | `p_user_id uuid, p_display_name text, p_zip_code text` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 289 | `sync_notification_channel_from_channels` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 290 | `sync_profile_dob_from_auth` | `p_user_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 291 | `sync_profile_subscription_id` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 292 | `sync_referral_table_on_profile_update` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 293 | `sync_sp_config_on_admin_update` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 294 | `test_complete_trade_type_handling` | `` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 295 | `track_badge_config_changes` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 296 | `track_email_event` | `p_sendgrid_message_id text, p_event_type text, p_bounce_reason text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 297 | `track_notification_event` | `p_notification_id uuid, p_event_type text, p_event_data jsonb` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 298 | `track_notification_open_event_on_read` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 299 | `trigger_retroactive_award_on_threshold_decrease` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 300 | `trigger_trial_reminders` | `` | `search_path=public, extensions, net` | false | false | PASS (no pgcrypto/base64url usage) |
| 301 | `unpublish_section` | `p_section_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 302 | `update_category_item_count` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 303 | `update_cron_job_schedule` | `p_job_id bigint, p_schedule text` | `search_path=public, cron` | false | false | PASS (no pgcrypto/base64url usage) |
| 304 | `update_education_sections_updated_at` | `` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 305 | `update_email_log_status` | `p_log_id uuid, p_sendgrid_message_id text, p_status text, p_error_message text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 306 | `update_item_drafts_updated_at` | `` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 307 | `update_item_tax_category_admin` | `p_item_id uuid, p_tax_category_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 308 | `update_message_delivery_status` | `p_message_id uuid, p_status text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 309 | `update_node_tax_config` | `p_node_id uuid, p_tax_rate numeric, p_tax_jurisdiction text, p_tax_enabled boolean` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 310 | `update_notification_preference` | `p_user_id uuid, p_category notification_category, p_push_enabled boolean, p_in_app_enabled boolean, p_email_enabled boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start time without time zone, p_quiet_hours_end time without time zone` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 311 | `update_seller_balance_on_trade_completion` | `` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
| 312 | `update_sp_config` | `p_key text, p_value jsonb, p_admin_id uuid` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 313 | `update_subscription_status` | `p_user_id uuid, p_status text, p_tier_id uuid, p_stripe_subscription_id text, p_has_used_trial boolean, p_auto_renew_enabled boolean, p_payment_retry_count integer, p_grace_started_at timestamp with time zone, p_grace_ends_at timestamp with time zone, p_cancelled_at timestamp with time zone, p_cancel_reason text, p_next_billing_date timestamp with time zone, p_last_payment_date timestamp with time zone, p_last_payment_amount integer` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 314 | `update_subscription_status` | `p_user_id uuid, p_status text, p_tier_id uuid, p_stripe_subscription_id text, p_next_billing_date timestamp with time zone, p_has_used_trial boolean, p_payment_retry_count integer, p_grace_started_at timestamp with time zone, p_grace_ends_at timestamp with time zone, p_cancelled_at timestamp with time zone, p_cancel_reason text, p_auto_renew_enabled boolean` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 315 | `upgrade_free_subscription_to_trial` | `p_user_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 316 | `upsert_admin_config` | `p_key text, p_value text` | `search_path=public, pg_temp` | false | false | PASS (no pgcrypto/base64url usage) |
| 317 | `upsert_admin_config_setting` | `p_key text, p_value text, p_category admin_config_category, p_data_type text, p_is_secret boolean, p_is_active boolean, p_admin_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 318 | `upsert_category_tax_mapping` | `p_category_id uuid, p_tax_category_id uuid` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 319 | `upsert_tax_rule` | `p_rule_id uuid, p_tax_category_id uuid, p_display_name text, p_description text, p_is_taxable boolean, p_tax_rate numeric, p_jurisdiction text, p_min_item_price_cents integer, p_max_item_price_cents integer, p_effective_from timestamp with time zone, p_effective_to timestamp with time zone` | `search_path=public` | false | false | PASS (no pgcrypto/base64url usage) |
| 320 | `verify_otp_code` | `p_verification_id uuid, p_code text` | `search_path=public, extensions` | true | false | PASS (search_path includes extensions) |
| 321 | `verify_user_phone` | `p_user_id uuid, p_phone text` | `(none — role default)` | false | false | PASS (no pgcrypto/base64url usage) |
*Audit queries were run as read-only `pg_proc`/`pg_namespace` introspection against staging with per-call owner approval.*

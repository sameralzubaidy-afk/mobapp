# QA Task 43a-exec — Config-Propagation Ledger (2026-09-08)

Every config write + revert this run, with DB verification. **No staging config left changed at session end.**

| # | Config key / column | Guide pair | Before | After (fresh) | Write path | Reverted to | Revert DB-verified |
|---|---|---|---|---|---|---|---|
| 1 | `admin_config.default_radius_miles` | AUTH-O05 | 10 | 15 | `qa:admin-config-set` (R37) | 10 | ✅ (read-back + post-revert mobile re-check) |
| 2 | `admin_config.min_user_radius_miles` | AUTH-O05 | 5 | 8 | `qa:admin-config-set` | 5 | ✅ |
| 3 | `admin_config.max_user_radius_miles` | AUTH-O05 | 25 | 40 | `qa:admin-config-set` | 25 | ✅ |
| 4 | `categories.sp_earning_multiplier` (Books 4b400d90) | AUTH-J14/J15 | 1.30 | 1.40 | admin `/categories` → SP Config tab (`input-sp-earn`) | 1.30 | ✅ (SELECT) |
| 5 | `categories.is_active` (Games 103eefdc) | AUTH-N01 | true | false | admin `/categories` modal (`input-active`) | true | ✅ (SELECT) |
| 6 | `sp_config.referral_reward_referrer_sp` | MSG-F04 | 25 | 30 | admin `/referrals` (`ref-config-first-trade-referrer-sp`) | 25 | ✅ (SELECT) |
| 7 | `sp_config.referral_reward_referee_sp` | MSG-F04 | 10 | 15 | admin `/referrals` (`ref-config-first-trade-referee-sp`) | 10 | ✅ (SELECT; needed 2nd save) |

All writes used the sanctioned QA fixture-write paths (R37 / R-16-3 / admin-portal UI). `updated_by` recorded as `1a546991-5361-4b4e-b44b-eee9bf730757` on the admin_config writes (the documented shared editor id).

## Config baselines captured (read-only) for future dispatches
- Radius: default 10 / min 5 / max 25.
- Grace: `grace_period_days=30`. Trial: `trial_enabled=false` (intentional D-001), `trial_period_days=30`, `subscription_price_monthly=599`.
- SP: `sp_pending_days=2`, `sp_expiration_days=700`, `sp_max_percentage_per_purchase=100`, `sp_redemption_cap_global=100`.
- Withdrawal: `minimum_withdrawal_amount_cents=200`.
- Payout fees: `payout_fee_stripe_fixed_cents=25`/`payout_fee_stripe_percentage=0.25`, `payout_fee_paypal_cap_cents=3000`/`percentage 1.0`, `payout_fee_venmo_cap_cents=1000`/`percentage 2.0`, `payout_fee_bank_ach_cents=25`.
- Buyer fees: `buyer_fee_active_member_cents=149`, `buyer_fee_label="Safety & Platform Fee"`, `buyer_fee_first_trade_cents=149`, `buyer_fee_subsequent_fixed_cents=199`/`percentage 5`/`max 499`.
- Moderation: `moderation_appeal_max_attempts=3`, `moderation_appeal_window_days=14`, `moderation_ai_enabled=false`.
- Safety: `cpsc_recall_check_enabled=true`, `cpsc_match_threshold=0.5`.
- Offer/trade: `max_pending_offers_per_seller=3`, `offer_timeout_hours=48`, `pickup_window_hours=72`, `auto_complete_hours=72`, `cart_min_value_cents=0`, `min_listing_price=0`, `charge_one_fee_per_bundle=true`.
- Tax: `sales_tax_enabled=true`, `include_fee_in_tax_base=false`.
- Categories: all 10 active (display_order 1–10); multipliers Books 1.30 / Games 1.10 / Toys 1.20 / Sports 1.10 / Electronics 1.30 / Clothing 1.10 / Art & Crafts 1.30 / Other 1.10 / Shoes 1.10 / Bookies 1.10; Toys `sp_redemption_cap=100`.
- Referral sp_config: referrer 25 / referee 10 / referrer_listing 10 / referee_listing 25; program_enabled true; first_trade_enabled true; first_listing_enabled true.

## Session residue
- Mobile left logged in as **test-buyer** (Referrals screen) — no app logout performed at close (session left on the emulator for the next session's convenience; config all reverted).
- No fixtures created; no items/drafts created by this run.
- Admin portal left logged in at `/referrals` (`samer@samer.com`).

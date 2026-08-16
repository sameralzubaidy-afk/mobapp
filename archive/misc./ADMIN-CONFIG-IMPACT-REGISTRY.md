# Admin Config Impact Registry

This document tracks which admin-controlled values are actually reflected in the mobile user experience today, which manual cases prove that behavior, and which keys still have implementation gaps.

> Note: there is no standalone `admin_config` key for a "single item buy limit" in the current schema/admin UI. The runtime limits today are the one-active-cart rule plus per-item trade creation, not a separate admin-configurable purchase cap.

## End-to-End Coverage

| Key | Admin UI | User-visible effect | Manual coverage |
|---|---|---|---|
| `subscription_price` | Subscriptions | Plans price and payment totals | `TC-A03`, `TC-R05` |
| `trial_days` | Subscriptions | Trial badge and first-charge messaging | `TC-B01`, `TC-B02`, `TC-R05` |
| `trial_enabled` | Subscriptions | Trial CTA hidden/blocked | `TC-B05` |
| `max_trial_uses` | `/config` | Trial eligibility for exhausted users | `TC-B04`, `TC-B08` |
| `transaction_fee_subscriber_cents` | Trade Timing | Subscriber fee across subscription, trade, and cart | `TC-A03`, `TC-R01`, `TC-R05`, Admin `TC-F03` |
| `transaction_fee_non_subscriber_cents` | Trade Timing | Non-subscriber fee across subscription, trade, and cart | `TC-A03`, `TC-R05`, Admin `TC-F03` |
| `grace_period_days` | Subscriptions | Grace countdown and wallet-freeze messaging | `TC-D01`, `TC-R05`, Admin `TC-M01` |
| `grace_reminder_thresholds` | Subscriptions | Grace reminder notification timing | `TC-D06`, `TC-D07` |
| `sp_expiration_days` | Subscriptions | Wallet expiration info box and alert copy | `TC-I04`, `TC-R05` |
| `minimum_withdrawal_amount_cents` | `/config` | Request Payout minimum validation | `TC-H06`, `TC-H07` |
| `moderation_ai_enabled` | `/config` | Automated image moderation on listing submission | Safety `TC-G08` |
| `moderation_appeal_max_attempts` | `/config` | Appeal CTA disabled/blocked after configured count | Safety `TC-G02`, `TC-G06` |
| `moderation_appeal_window_days` | `/config` | Appeal window expiry | Safety `TC-G07` |
| `cpsc_recall_check_enabled` | `/config` | Recall alert / safety review creation | Safety `TC-G05`, `TC-G09` |
| `cpsc_match_threshold` | `/config` | Borderline recall matching sensitivity | Safety `TC-G09` |
| `default_radius_miles` | Node Settings | Discover default radius | Discovery `TC-O05`, Admin `TC-E04` |
| `min_user_radius_miles` | Node Settings | Discover minimum radius bound | Discovery `TC-O05`, Admin `TC-E04` |
| `max_user_radius_miles` | Node Settings | Discover maximum radius bound | Discovery `TC-O05`, Admin `TC-E04` |
| `cart_min_value_cents` | Cart Settings | Checkout blocked below configured minimum | Trade `TC-M11`, `TC-N01`, Admin `TC-F02` |
| `offer_timeout_hours` | Trade Timing | Offer expiry countdown and timeout behavior | Trade `TC-B02`, `TC-D03`, Admin `TC-F03` |
| `offer_notification_1_hours_before` | Trade Timing | First offer reminder | Trade `TC-G01`, Admin `TC-F03` |
| `offer_notification_2_hours_before` | Trade Timing | Second offer reminder | Trade `TC-G01`, Admin `TC-F03` |
| `auto_complete_hours` | Trade Timing | Auto-complete window and banner timing | Trade `TC-D01`, `TC-D02`, `TC-D04`, Admin `TC-F03` |
| `auto_complete_notification_hours_before` | Trade Timing | Auto-complete reminder timing | Trade `TC-G02`, Admin `TC-F03` |
| `pending_sp_release_days` | Trade Timing | Pending earnings / pending SP release delay | Subscription `TC-F06`, Admin `TC-F03` |

## Not Fully Covered Yet

| Key | Current state | What must happen before calling it covered |
|---|---|---|
| `sms_rate_limit_per_hour` | Admin UI exists, but the current OTP send path uses hardcoded Edge Function limits. | Wire the runtime OTP send path to `admin_config`, then add end-to-end verification. |
| `verification_code_expiry_minutes` | OTP generation/verification services still hardcode a 10-minute expiry. | Move expiry calculation to config-backed runtime logic. |
| `max_verification_attempts` | The verification flow still hardcodes 3 failed attempts. | Move failed-attempt enforcement to config-backed runtime logic. |
| `max_login_attempts` | No verified mobile/auth runtime consumer was found. | Implement the enforcement path or remove the key from admin. |
| `password_reset_expiry_minutes` | No verified mobile/auth runtime consumer was found. | Implement the reset-expiry path or remove the key from admin. |
| `allow_user_radius_adjustment` | Saved in Node Settings, but no Discover UI behavior was found. | Decide the user-facing behavior and wire the filter UI to it. |
| `max_assignment_distance_miles` | Saved in Node Settings, but no dedicated end-user/mobile assertion was found. | Confirm the intended runtime consumer and add a user-visible assertion. |
| `distance_warning_threshold_miles` | Saved in Node Settings, but no dedicated end-user warning surface was found. | Wire the warning surface and add a matching test. |
| `cart_max_saved_carts` | Admin saves the value, but the DB trigger/RPC and cart UI still hardcode 3 saved carts. | Wire the backend and UI label to the saved config before marking coverage complete. |
| `cart_saved_expiry_days` | Admin saves the value, but no configurable expiry consumption was found in the cart runtime. | Implement expiry cleanup/query behavior that reads the config. |

## QA Protocol

When an admin changes a value:
1. Save the change in the admin portal and refresh the page to confirm persistence.
2. Look up the key in the tables above.
3. Rerun the linked manual cases in the corresponding guide.
4. If the key is listed under **Not Fully Covered Yet**, track it as an implementation gap, not a manual-testing gap.

_Last Updated: 2026-05-30_  
_Owner: Platform Team_

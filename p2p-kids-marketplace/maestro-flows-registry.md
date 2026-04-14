# Maestro Flows Registry

## Active Flows

- `.maestro/auth-signup.yaml` - Signup happy path.
- `.maestro/auth-login.yaml` - Login path.
- `.maestro/listing-create.yaml` - Listing creation with image upload (SAFETY-P001).
- `.maestro/browse-search.yaml` - Browse and search listings.
- `.maestro/swap-points-wallet.yaml` - SP wallet display and transactions.
- `.maestro/sp-notifications.yaml` - SP event notifications (earned, spent, frozen, low_balance) with subscription gating (NOTIF-V2-003).
- `.maestro/subscription-payment-flow.yaml` - Subscription payment flow (SUB-015).
- `.maestro/payment-failure-handling.yaml` - Payment retry/failure flow (SUB-018).
- `.maestro/re-subscribe-from-grace.yaml` - Grace period re-subscribe flow.
- `.maestro/sub-020-trial-limit.yaml` - Trial limit enforcement states (SUB-020).
- `.maestro/safety-p003-item-flagging.yaml` - Item flagging and rejection status (SAFETY-P003).
- `.maestro/safety-002-cpsc-recall-matching.yaml` - CPSC recall matching on listing creation (SAFETY-002).
- `.maestro/safety-004-image-moderation.yaml` - Google Vision AI image moderation (SAFETY-004).
- `.maestro/tos-system.yaml` - Terms of Service view from Settings and acceptance from Signup (SAFETY-010).
- `.maestro/privacy-policy-system.yaml` - Privacy Policy view from Settings and Signup link navigation (SAFETY-011).
- `.maestro/liability-disclaimer-flow.yaml` - Liability Disclaimer view from Settings and mandatory acknowledgment during trade (SAFETY-012).
- `.maestro/notif-v2-005-push-delivery.yaml` - Push notification delivery with rate limiting, quiet hours, deduplication, and retry (NOTIF-V2-005).

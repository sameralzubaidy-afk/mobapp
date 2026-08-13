# Canonical Index — Subscriptions · Payouts · SP Wallet

**Source:** `misc./MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
**Last updated:** 2026-05-30
**Total test cases extracted:** 72

## Groups & Counts

| Group | Cases | Description |
|---|---|---|
| A — Plans & Comparison | 5 | Plans screen cards, comparison table+POPULAR badge, dynamic pricing from admin config, current plan reflection, Kids Club+ overview by status |
| B — Start Trial & Payment | 8 | Start trial→payment screen, payment screen benefits+pricing, Stripe payment→success, trial already used block, trial disabled globally, mid-trial urgency, referral bonus loss warning, admin trial-limit config update |
| C — Manage & Cancel | 7 | My Subscription paid view, quick menu (Billing/Payment/Help), Manage Kids Club+, cancel retention screen, cancel reason+confirmation, cancelled stays active, auto-renew/payment method |
| D — Renewal, Grace & Expiry | 7 | Grace period banner+frozen wallet, re-subscribe from grace, expired screen+renew, isRenewal payment, reactivate from cancelled, subscription event notifications, grace reminder notifications |
| E — Billing History & Status | 4 | Billing history list, empty state, failed charge error, subscription status screen |
| F — Payout Dashboard & Earnings | 6 | Payout dashboard hero, payout method section, payout history list, seller earnings screen, earnings empty state, pending earnings release |
| G — Payout Methods & Verification | 6 | Add Stripe Connect, add PayPal/Venmo, add Bank ACH, set primary/delete, unverified blocks payout, requires_action→setup |
| H — Request & Withdraw | 7 | Request payout validation, fee+net summary, confirm payout success, blocked no method, withdraw now, admin minimum withdrawal, minimum disabled at 0 |
| I — SP Wallet Balance & Earn | 6 | SP wallet hero, quick actions, how to earn SP, expiration info, wallet warning banners, free user inactive state |
| J — SP Transaction History | 4 | History tabs (All/Earned/Spent), transaction rows, empty state per tab, pull-to-refresh |
| K — Transaction / Billing History (Profile) | 2 | Transaction history list, empty+error/retry |
| L — Webhooks & Reconciliation | 5 | Renewal webhook→billing, payment-failed→grace, invalid signature rejected, duplicate webhook idempotent, payout-status webhook |

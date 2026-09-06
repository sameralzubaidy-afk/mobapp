# QA Task 36 — Batch A disposable real-Stripe fixture (internal fixture notes)

- **Disposable user (Batch A):** email `qa.alice.17886912933741957@kidsmarketplace.test`, user_id `6f8a7811-91ab-4501-9f36-3181fb232c3e`, display name "QA Task36 Parent", node Norwalk Central, phone-verified.
- **Password:** fixture Alice test-user password (per testUsers.ts registry). Not echoed in reports.
- **Real subscription:** Stripe customer `cus_VD3mpkM0uk9OOu`, sub `sub_1UCdep4I6kCJlvXoAu7oa30V`, status `active`, period 2026-09-06 → 2026-10-06, auto-renew on. Checkout session `cs_test_a1AwAUbot9MXALrlpYwUsiMZUVyUOdWlNNId3j83gjGkVsW1QFLXiJ0vuy`.
- `subscription_events` row `web_subscription_upsert` (source web_first_subscription_r7). sp_wallets.state = active.
- **Cleanup target (BP-70):** cancel/delete Stripe sub + customer, delete DB child rows + profiles + auth user `6f8a7811-…`.

## Batch B G01 target
- qa-payout-seller (`qa-payout-seller@kidsmarketplace.test`, fixed `a1234567-…-f2`) — clean methods baseline, sub active. Will mint a fresh Express Connect account via create-stripe-connect-account EF on-device.

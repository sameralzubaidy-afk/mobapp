# Task: Create 3 new manual test files + extend 1, mirroring MODULE-15.1.2-TradeFlowV2 format

## Reference format (MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md)
Header(Source of truth, Tasks covered, Last updated, Scope, Devices) → Test Case Index table → Pre-conditions → Accounts table → Groups (each TC: Ref, Actors, Objective, Steps, Expected Result) → Regression (TC-RXX) → Verification checklist mapping table.

## Deliverables (in order)
1. NEW FILE: Subscription Lifecycle + Seller Payouts & Withdrawals + SP Wallet & Transaction History (mobile)
2. NEW FILE: Account management + Home Dashboard + Help/Education/SP Calculator + Legal screens (mobile)
3. NEW FILE: ALL admin flows (web tool, not mobile) — 50 admin pages under p2p-kids-admin/src/app
4. EXTEND: AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md → add Refund/Cancellation state machine group

## Status
- [x] File 1 -> MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md
- [x] File 2 -> MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md
- [x] File 3 -> MODULE-ADMIN-PORTAL-MANUAL-TESTING.md (all admin flows, Groups A-V)
- [x] File 4 -> AUTH file extended with Group P Refund & Cancellation State Machine (TC-P01..P13)

ALL DONE.

Mobile screens: p2p-kids-marketplace/src/screens. Admin: p2p-kids-admin/src/app (NOT app/).
Reminder: do NOT create extra markdown docs about changes.

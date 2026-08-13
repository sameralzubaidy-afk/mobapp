# Canonical Index — Auth · Onboarding · Nodes · Listing · Discovery

**Source:** `misc./AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Last updated:** 2026-08-11
**Total test cases extracted:** 82

## Groups & Counts

| Group | Cases | Description |
|---|---|---|
| A — Signup (Email/Password) | 7 | Valid signup, field validation, password mismatch, under-18 block, duplicate email, referral code, TOS/Privacy links |
| B — Login & Session Restore | 6 | Successful login routes, invalid credentials, forgot password, session restore, silent resume, cold launch |
| C — Social Login | 7 | Google, Facebook, Apple, account-link prompt, provider unavailable, cancel OAuth, set password |
| D — Logout | 3 | Profile logout, Settings sign out, post-logout landing |
| E — Phone Verification (Deferred Gate) | 5 | OTP send/verify, invalid/expired code, resend cooldown, rate limiting, listing gate |
| F — Node/ZIP Gating & Waitlist (End User) | 6 | Active ZIP→node, inactive ZIP→waitlist, waitlist confirmation, continue trading, ZIP auto-lookup, node-scoped content |
| G — Node Management (Admin) | 6 | Create active node, create inactive, edit, deactivate warning, reactivate, stats cards |
| H — Profile Setup & Onboarding | 7 | Profile setup fields, validation errors, avatar upload failure, welcome screen, feature highlights, onboarding carousel, completion routes |
| I — Subscription Choice (Onboarding) | 3 | Start free trial, continue free, trial limit reached |
| J — Listing Creation (Single Item) | 15 | Photo-first gating, AI auto-fill, required validation, condition/age/gender/color, "Other" category, payment preference, SP preview, submit for review, phone gate, draft auto-save, photo management, bonus category badge, SP earn preview |
| K — Bulk Listing Creation | 6 | Multi-photo upload, regroup/merge, step indicator, apply-to-all bar, submit N items, bulk SP summary |
| L — Admin Review / Pending | 4 | Listing invisible until approved, admin approves, approval notification, edit returns to pending |
| M — Discovery: Search & Filters | 10 | Search bar, recent searches+autocomplete, sort options, filters modal, "Accepts SP" toggle, empty/no-results, recent searches chips, trending section, result count+filter chips, discover header |
| N — Discovery: Category & Favorites | ~5 | Category browse filters, favorites |
| O — Global App Shell & Navigation | ~3 | Header, floating nav, home composer |
| P — Category SP Calculations & Bonus Badges | ~2 | SP calculations, bonus badges |

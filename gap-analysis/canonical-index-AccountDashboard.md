# Canonical Index — Account · Home Dashboard · Help & Education · Legal

**Source:** `misc./MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`
**Last updated:** 2026-05-30
**Total test cases extracted:** 57

## Groups & Counts

| Group | Cases | Description |
|---|---|---|
| A — Settings Hub | 4 | Settings sections+rows, sign out confirmation, test push notification (rate limit/quiet hours/queued), legal & help links |
| B — Edit Profile | 5 | Fields load+save (optimistic), email re-verification, phone OTP modal, avatar upload, profile screen stats/badges/reviews |
| C — Linked Accounts | 4 | Linked accounts list, link social provider (password re-auth gate), unlink provider (confirmation+last-method guard), email mismatch on link blocked |
| D — Notification Preferences | 4 | Five categories×three channel toggles, optimistic toggle revert, quiet hours toggle+time validation, empty state→initialize settings |
| E — Delete Account (COPPA) | 3 | Delete account consequences+password gate, wrong password blocked, two-step confirmation→deletion+logout |
| F — Suspended / Unsubscribe / Offline | 3 | Suspended account screen (logout only), unsubscribe via email token, offline screen+try again |
| G — Home Dashboard | 6 | Greeting+subscription badge+SP balance, priority banners, quick action tiles, ID verification CTA banner, recommendations+recent trade card, pull-to-refresh |
| H — Help & Support Menu | 5 | Help & Support menu routes, FAQ list search+category filter, FAQ offline fallback, FAQ detail helpful vote, contact support form |
| I — Education & SP Calculator | 5 | Education help screen sections, SP calculator free mode, calculator bonus category badge, calculator validation, education analytics events |
| J — Legal Screens | 5 | TOS view+last updated, TOS acceptance flow, privacy policy view+acceptance, liability disclaimer, policy versioning re-acceptance |
| K — Privacy & Security / MFA | 4 | MFA factors list+enrollment, enroll+verify authenticator, protected action MFA challenge, recovery+remove factor |
| L — Error Recovery & Crash Reporting | 4 | Render-time error fallback, try again recovery, persistent error containment, safe error reporting |

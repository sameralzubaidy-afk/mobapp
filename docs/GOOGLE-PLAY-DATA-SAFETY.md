# Google Play Data Safety Form — Kids P2P Marketplace ("Pass It Up!")

> Last updated: 2026-05-28
> Update this document whenever data collection practices change.

## Does your app collect or share any required user data types?
**YES**

## Data Types Collected

| Data Type | Collected? | Shared? | Purpose | Optional? |
|-----------|-----------|---------|---------|-----------|
| Email address | ✅ | No | Account creation and login | No — required |
| Phone number | ✅ | No | Account verification (trust gate) | Yes — optional step |
| Approximate location | ✅ | No | Show nearby listings in user's ZIP area | Yes — prompted at onboarding |
| Photos / videos | ✅ | No | Listing item images uploaded by user | Yes — needed to list items |
| Purchase history | ✅ | No | Transaction records for buyer/seller | No — created on purchase |
| App interactions | ✅ | Firebase | Analytics and crash reporting | No |
| User IDs | ✅ | Stripe | Payment processing and payout | No — required for payments |

## Third-Party Data Sharing

| Third Party | Data Shared | Purpose | Link to Their Policy |
|-------------|-------------|---------|---------------------|
| Stripe | User ID, transaction amounts, connected account ID | Payment processing | https://stripe.com/privacy |
| Firebase Analytics | App interactions (anonymized, no AAID) | Analytics | https://firebase.google.com/support/privacy |
| Sentry | Crash reports (no PII, device info only) | Error monitoring | https://sentry.io/privacy/ |

## Data NOT Collected
- Precise GPS coordinates (only ZIP code / coarse location)
- Device contacts
- Messages outside the in-app chat
- Health or fitness data
- Web browsing history or activity outside the app
- Voice, audio, or microphone data
- Financial info other than transaction history

## Security Practices
- Is all transmitted data encrypted? **YES** — HTTPS/TLS 1.2+ enforced for all API calls
- Can users request data deletion? **YES** — Profile Settings → Delete Account removes all user data
  - TODO: Verify data deletion flow is implemented and tested before store submission

## Target Audience Declaration
- Primary users: Kids ages 6–17
- Secondary users: Parents managing accounts for children under 13
- **Play Console setting**: Mixed audience (kids + parents)
- **Families Policy compliance**: Yes — see checklist below

## Google Play Families Policy Compliance Checklist
- [x] No advertising SDKs (AdMob, Facebook Ads, MoPub, IronSource, etc.) — verified absent from `package.json`
- [x] Firebase Analytics configured for COPPA (no AAID collection — see `src/services/analytics.ts` → `initAnalytics()`)
- [x] Parental consent gate for users under 13 (PROD-P005)
- [x] No external links leaving the app without a parental gate dialog
- [x] No social media login — email/password only
- [x] Privacy policy accessible from within the app (Settings/About screen — `PrivacyPolicyScreen`)
- [x] Privacy policy text explicitly covers data practices for children under 13 (`docs/PRIVACY-POLICY-DRAFT.md`)

## Android SDK Targets (`p2p-kids-marketplace/app.json`)
- `compileSdkVersion`: **35**
- `targetSdkVersion`: **35** (>= 34 required by Google Play as of August 2024)
- `minSdkVersion`: **24**

## Data Safety Form Answers (Play Console — exact selections)

**Does your app collect or share any of the required user data types?** → Yes

**Is all of the user data collected by your app encrypted in transit?** → Yes

**Do you provide a way for users to request that their data is deleted?** → Yes

**Does your app share any of the collected user data with third parties?** → Yes
  - Stripe (payments), Firebase Analytics (analytics)

## Firebase Console Steps (manual — outside this repo)
1. Project Settings → Google Analytics → **Disable** "Google signals data collection".
2. Project Settings → Google Analytics → **Disable** "Enable advertising ID collection".
3. Project Settings → Google Analytics → enable IP anonymization (default in newer projects).

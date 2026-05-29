# App Store Submission Checklist — Kids P2P Marketplace

> **Status:** DRAFT (PROD-009 deliverable)
> **Last updated:** PROD-009
> **Owner:** Engineering + Legal review required before submission

Cross-references:
- iOS privacy descriptions: PROD-P001
- Error boundary: PROD-P003
- Crash reporting: PROD-P004
- Privacy policy draft: [PRIVACY-POLICY-DRAFT.md](./PRIVACY-POLICY-DRAFT.md)
- Terms of service draft: [TERMS-OF-SERVICE-DRAFT.md](./TERMS-OF-SERVICE-DRAFT.md)
- Google Play Data Safety: [GOOGLE-PLAY-DATA-SAFETY.md](./GOOGLE-PLAY-DATA-SAFETY.md) (PROD-011)

---

## Apple App Store (iOS)

### Required Before Submission
- [ ] App builds with `eas build --platform ios --profile production`
- [ ] Privacy Policy URL hosted and accessible (in-app: Profile → Privacy Policy uses DB-backed service)
- [ ] Terms of Service URL hosted and accessible
- [ ] `NSUsageDescription` strings in `Info.plist` (PROD-P001)
- [ ] `PrivacyInfo.xcprivacy` privacy manifest present (PROD-P001)
- [ ] Age Rating: 4+ with parental gate, or "Made for Kids"
- [ ] COPPA: declare "Yes, this app is directed at children under 13"
- [ ] App Category: Shopping (primary) / Lifestyle (secondary)
- [ ] Screenshots: 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 14 Plus)
- [ ] App Icon: 1024×1024 PNG, no alpha channel
- [ ] No debug/test code in production build
- [ ] No placeholder text or Lorem Ipsum
- [ ] Error Boundary prevents blank screens (PROD-P003)
- [ ] Crash reporting active (PROD-P004)

### Apple Kids App Requirements
- [ ] No third-party trackers; Firebase Analytics configured for COPPA (no AAID — PROD-011)
- [ ] No advertising SDKs
- [ ] No social media login (email/password only)
- [ ] Parental consent gate for under-13 users (PROD-P005)
- [ ] No external links that leave the app without a parental gate
- [ ] Privacy policy accessible from within the app

---

## Google Play Store (Android)

### Required Before Submission
- [ ] AAB builds with `eas build --platform android --profile production`
- [ ] Privacy Policy URL set in Play Console
- [ ] Data Safety section completed — see [GOOGLE-PLAY-DATA-SAFETY.md](./GOOGLE-PLAY-DATA-SAFETY.md)
- [ ] Target audience: Mixed audience (kids + parents)
- [ ] Families Policy compliance verified (if targeting under 13)
- [ ] Content Rating: complete IARC questionnaire
- [ ] App Category: Shopping
- [ ] Feature graphic: 1024×500 PNG
- [ ] Screenshots: phone + tablet
- [ ] COPPA: declare in Play Console
- [ ] `targetSdkVersion >= 34` (PROD-011)

### Data Safety Summary (Google Play)
See full document at `docs/GOOGLE-PLAY-DATA-SAFETY.md`.

Data collected:
- Email (account management)
- Phone (optional, account verification)
- Approximate location (ZIP-level)
- Photos (listing images)
- Purchase history
- App interactions (analytics, COPPA-compliant)

Data shared:
- Stripe — payments
- Firebase Analytics — anonymized (no AAID)
- Sentry — crash diagnostics (no PII)

---

## In-App Surfaces

- **Privacy Policy** — `src/screens/profile/PrivacyPolicyScreen.tsx` (DB-backed via `privacyPolicyService`)
- **Terms of Service** — exposed in Signup flow; SignupScreen validates acceptance.
- **URLs** — see `p2p-kids-marketplace/src/constants/legal.ts` (LEGAL_URLS constants).

---

## Sign-Off

| Section | Owner | Status |
|---|---|---|
| Engineering Build | TBD | Pending |
| Legal Review (Privacy + ToS) | TBD | Pending |
| Apple Submission | TBD | Pending |
| Google Submission | TBD | Pending |

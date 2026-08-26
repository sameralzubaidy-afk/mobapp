/**
 * Legal URLs — Privacy Policy and Terms of Service.
 *
 * PROD-009: Single source of truth for hosted legal page URLs. The in-app
 * Privacy Policy screen (`src/screens/profile/PrivacyPolicyScreen.tsx`) renders
 * the DB-backed policy via `privacyPolicyService`. These URLs are the canonical
 * hosted pages referenced in the App Store and Google Play submissions.
 *
 * TODO(PROD-009): Replace placeholder URLs with the final hosted URLs before
 * store submission. URLs must also match what is configured in App Store
 * Connect and Google Play Console.
 */

export const LEGAL_URLS = {
  PRIVACY_POLICY:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
    'https://kidsp2p.example.com/privacy',
  TERMS_OF_SERVICE:
    process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL ||
    'https://kidsp2p.example.com/terms',
  // Internal canonical support address (legal/notification email config only).
  // User-facing support routes to the in-app Contact Support form — no raw email surfaces.
  SUPPORT_EMAIL: 'support@p2pkidsmarketplace.com',
  PRIVACY_EMAIL: 'privacy@kidsp2p.example.com',
} as const;

export type LegalUrlKey = keyof typeof LEGAL_URLS;

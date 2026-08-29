// File: p2p-kids-marketplace/src/components/QaLoginAsDeepLinkHandler.tsx
// QA-ONLY deep link handler (Dev Task 51 item 2) — collapses the 8–10-tool-call
// email/password persona login (repeated 5+ times per TRD run) into ONE call:
//
//   p2pkidsmarketplace://qa-login-as?persona=test-buyer
//
// It also auto-accepts the current published TOS + Privacy Policy for the
// persona (the soft-gate's J02 path), so the PolicyReacceptanceGate prompt does
// not re-appear on every launch for a fixture persona. The acceptance persists
// (DB rows), so once a persona is accepted it stays accepted.
//
// Login goes through the CANONICAL path — `loginWithContext` (src/services/auth)
// + `AuthContext.setSession` — exactly like LoginScreen, so the enriched session
// (subscription status, SP wallet, profile) is what the rest of the app sees.
//
// SECURITY GATE: identical to QaLogoutDeepLinkHandler / QaDevToggleDeepLinkHandler —
// the listener is registered only in dev / staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers it, so the deep link (and the persona credentials it references)
// are inert in release builds.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useAuth } from '@/hooks/useAuth';
import { loginWithContext } from '@/services/auth';
import { getTOSService } from '@/services/tos';
import { getPrivacyPolicyService } from '@/services/privacyPolicy';
import { getQaPersona } from '@/services/qaPersonas';
import type { AuthSession } from '@/types/user';

/**
 * Enables the QA login-as deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build never registers the listener.
 */
const QA_LOGIN_AS_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-login-as). */
const QA_LOGIN_AS_PATH = 'qa-login-as';

/**
 * Process-lifetime flag: set synchronously when a qa-login-as fires, cleared
 * when the login + policy auto-accept finish. PolicyReacceptanceGate consults
 * `isQaLoginAsInProgress()` so it never navigates to the TOS/privacy screens
 * in the brief window between the session being set and the auto-accept rows
 * landing. Fail-open: if acceptance fails, the gate simply re-prompts on the
 * next launch (the flag is only true while the handler is actively working).
 */
let qaLoginAsInProgress = false;

/** Read by PolicyReacceptanceGate — true while a qa-login-as is being processed. */
export function isQaLoginAsInProgress(): boolean {
  return qaLoginAsInProgress;
}

function isQaLoginAsUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const firstSegment = (parsed.path || parsed.hostname || '')
      .replace(/^\/+/, '')
      .split('?')[0];
    return firstSegment === QA_LOGIN_AS_PATH;
  } catch {
    return false;
  }
}

/**
 * Auto-accept the current published TOS + Privacy Policy for the signed-in
 * user. No-ops (gracefully) if a policy has no published version. Uses the
 * existing services → RPCs (`get_current_policy` + `record_policy_acceptance`).
 */
async function autoAcceptCurrentPolicies(): Promise<{ tos: boolean; privacy: boolean }> {
  const tosService = getTOSService();
  const privacyService = getPrivacyPolicyService();

  const [tosPolicy, privacyPolicy] = await Promise.all([
    tosService.getCurrentTOS().catch(() => null),
    privacyService.getCurrentPrivacyPolicy().catch(() => null),
  ]);

  let tos = false;
  let privacy = false;
  if (tosPolicy) {
    await tosService.acceptTOS(tosPolicy.id).then(() => {
      tos = true;
    });
  }
  if (privacyPolicy) {
    await privacyService.acceptPrivacyPolicy(privacyPolicy.id).then(() => {
      privacy = true;
    });
  }
  return { tos, privacy };
}

/**
 * Executes the qa-login-as flow for a URL. Sets the in-progress flag first
 * (synchronously) so PolicyReacceptanceGate skips the prompt until acceptance
 * lands, then signs in via the canonical path and auto-accepts the policies.
 */
async function applyQaLoginAs(
  url: string,
  setSession: (session: AuthSession | null) => void
): Promise<void> {
  const parsed = Linking.parse(url);
  const query = (parsed.queryParams ?? {}) as Record<string, string | undefined>;
  const personaName = query.persona;

  if (!personaName) {
    // eslint-disable-next-line no-console
    console.warn('[QaLoginAsDeepLink] Missing persona param');
    return;
  }

  const persona = getQaPersona(personaName);
  if (!persona) {
    // eslint-disable-next-line no-console
    console.warn(`[QaLoginAsDeepLink] Unknown persona: ${personaName}`);
    return;
  }

  qaLoginAsInProgress = true;
  try {
    const session = await loginWithContext({
      email: persona.email,
      password: persona.password,
    });
    // Canonical AuthContext login handoff (mirrors LoginScreen).
    setSession(session);

    const accepted = await autoAcceptCurrentPolicies();
    // eslint-disable-next-line no-console
    console.log(
      `[QaLoginAsDeepLink] Logged in as ${personaName}; TOS accepted: ${accepted.tos}, Privacy accepted: ${accepted.privacy}`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[QaLoginAsDeepLink] Login-as ${personaName} failed: ${(err as Error)?.message ?? err}`
    );
  } finally {
    qaLoginAsInProgress = false;
  }
}

/**
 * Renders nothing. Listens for the qa-login-as deep link and signs in as the
 * named QA persona (auto-accepting current TOS/Privacy).
 *
 * Must be mounted INSIDE AuthProvider (it consumes useAuth() → setSession).
 * Covers both entry modes (foreground listener + cold-start getInitialURL).
 */
export default function QaLoginAsDeepLinkHandler() {
  const { setSession } = useAuth();
  const enabled = QA_LOGIN_AS_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaLoginAsUrl(event.url)) {
        void applyQaLoginAs(event.url, setSession);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaLoginAsUrl(initialUrl)) {
        void applyQaLoginAs(initialUrl, setSession);
      }
    });

    return () => subscription.remove();
  }, [enabled, setSession]);

  return null;
}

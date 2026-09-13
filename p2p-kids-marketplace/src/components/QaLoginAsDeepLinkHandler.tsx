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
// FIX-Task-27 item 1 (2026-09-13): the switch is retried a bounded number of
// times and, when it finally fails, the REAL cause (AuthError code + underlying
// error) is logged instead of a bare message. A failed switch also clears the
// half-switched session on BOTH sides (Supabase client + React), because
// `signInWithPassword` may already have replaced the client session while React
// never received `setSession` — the desync behind QA's "stuck on Loading trade…"
// wedge. See QA_LOGIN_AS_ATTEMPTS / loginAsWithRetry / describeLoginAsFailure.
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
import { supabase } from '@/config/supabase';
import { redactForLogging } from '@/utils/authError';
import type { AuthError, AuthSession } from '@/types/user';

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
 * FIX-Task-27 item 1 (2026-09-13): how many times the persona switch is attempted
 * before it is declared failed, and the linear backoff between attempts.
 * QA saw `qa-login-as?persona=test-seller` fail with "User profile not found"
 * while the profile was intact in the DB, then wedge on "Loading trade…" until a
 * force-stop + cold relaunch — a transient failure that a retry would have
 * absorbed (see `readProfileWithRetry` in src/services/auth).
 */
const QA_LOGIN_AS_ATTEMPTS = 3;
const QA_LOGIN_AS_RETRY_BASE_DELAY_MS = 300;

/**
 * A readable description of WHY a persona switch failed. The old handler logged
 * `err.message` only, so a transient profile-read failure was indistinguishable
 * from a genuinely missing profile. The `AuthError.details` payload carries the
 * underlying cause (e.g. the PostgREST error); `redactForLogging` keeps it safe
 * for a dev-build LogBox.
 */
function describeLoginAsFailure(err: unknown): string {
  const authError = err as Partial<AuthError> & { details?: unknown };
  const parts = [
    `code=${authError?.code ?? 'UNKNOWN'}`,
    `message=${authError?.message ?? String(err)}`,
  ];
  if (authError?.details) {
    parts.push(`cause=${JSON.stringify(redactForLogging(authError.details))}`);
  }
  return parts.join(' | ');
}

/**
 * FIX-Task-27 item 1: bounded retry around the canonical login. `loginWithContext`
 * now retries its own profile read, so this outer retry covers the other
 * transient legs of the switch (session handoff, wallet/subscription enrichment).
 */
async function loginAsWithRetry(
  personaName: string,
  email: string,
  password: string
): Promise<AuthSession> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= QA_LOGIN_AS_ATTEMPTS; attempt++) {
    try {
      return await loginWithContext({ email, password });
    } catch (err) {
      lastError = err;
      // eslint-disable-next-line no-console
      console.warn(
        `[QaLoginAsDeepLink] login-as ${personaName} attempt ${attempt}/${QA_LOGIN_AS_ATTEMPTS} failed: ${describeLoginAsFailure(err)}`
      );
      if (attempt < QA_LOGIN_AS_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, QA_LOGIN_AS_RETRY_BASE_DELAY_MS * attempt)
        );
      }
    }
  }

  throw lastError;
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
    const session = await loginAsWithRetry(personaName, persona.email, persona.password);
    // Canonical AuthContext login handoff (mirrors LoginScreen).
    setSession(session);

    const accepted = await autoAcceptCurrentPolicies();
    // eslint-disable-next-line no-console
    console.log(
      `[QaLoginAsDeepLink] Logged in as ${personaName}; TOS accepted: ${accepted.tos}, Privacy accepted: ${accepted.privacy}`
    );
  } catch (err) {
    // FIX-Task-27 item 1 (2026-09-13): log the REAL cause (code + underlying
    // error), not just `.message` — the old single-line log is why a transient
    // profile-read failure was misread as "the profile doesn't exist".
    // eslint-disable-next-line no-console
    console.warn(
      `[QaLoginAsDeepLink] Login-as ${personaName} failed after ${QA_LOGIN_AS_ATTEMPTS} attempts: ${describeLoginAsFailure(err)}`
    );

    // RECOVERY (FIX-Task-27 item 1): `signInWithPassword` may already have
    // succeeded, which REPLACES the Supabase client's stored session, while
    // React's AuthContext never received `setSession` (the failure happened
    // before it). That half-switched state is the "stuck on Loading trade…"
    // wedge: the UI still renders the previous persona while every request now
    // runs as the new one. Clear BOTH sides so the client is consistent again
    // and the QA agent can simply re-fire the deep link.
    //
    // `scope: 'local'` (not 'global') so clearing a failed local switch never
    // signs the persona out of any other device/session.
    // Note: AuthContext has NO onAuthStateChange listener, so signing out the
    // Supabase client does not clear React state on its own — setSession(null)
    // below is what actually releases the stale persona.
    try {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      // eslint-disable-next-line no-console
      console.warn(
        '[QaLoginAsDeepLink] Cleared the half-switched session — re-fire the deep link to retry the switch'
      );
    } catch (recoveryErr) {
      // eslint-disable-next-line no-console
      console.warn(
        `[QaLoginAsDeepLink] Could not clear the half-switched session: ${describeLoginAsFailure(recoveryErr)}`
      );
    }
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

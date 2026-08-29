// File: p2p-kids-marketplace/src/components/PolicyReacceptanceGate.tsx
// ACC-TC-J05 (policy versioning re-prompt) + ACC-TC-J02 (acceptance path).
//
// Soft gate: on authenticated app launch (post-onboarding), if the current
// published Terms of Service or Privacy Policy is NOT accepted by the signed-in
// user, navigate to the relevant acceptance-mode screen (requireAcceptance:
// true) once per user per app session. Decline/dismiss (back) lets the user
// continue using the app — the re-prompt returns on the next app launch. Users
// who have already accepted the current published versions are never routed
// (the `has_accepted_current_policy` RPC compares against the current published
// version only, so draft versions are ignored).
//
// This is the ONLY production path that sets `requireAcceptance: true`, which
// makes the legal screens' acceptance-mode footer (I Accept / Decline)
// reachable instead of unit-test-only dead code (J02).
//
// Renders nothing. Uses the shared navigationRef (navigationRef.ts) so it can
// live beside the other root-level gates (ConnectivityGate).

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { navigationRef } from '@/navigation/navigationRef';
import { getTOSService } from '@/services/tos';
import { getPrivacyPolicyService } from '@/services/privacyPolicy';
// QA login-as deep link (Dev Task 51 item 2): while it is signing in a persona
// and auto-accepting the current TOS/Privacy, skip the prompt so the gate never
// races the handler to the TOS screen. No-op in production (flag is only ever
// set by the dev/staging-gated handler).
import { isQaLoginAsInProgress } from '@/components/QaLoginAsDeepLinkHandler';

/** Max time to wait for the navigation container to become ready before the
 *  re-prompt is skipped for this session (fail-open — never block the app). */
const MAX_READY_ATTEMPTS = 20; // 20 × 250ms = 5s
const READY_RETRY_MS = 250;

/**
 * Process-lifetime ("app session") guard: once we have prompted a given user
 * about an unaccepted policy this session, we do not prompt them again — so
 * Decline / back cannot loop. Reset on a fresh app launch (new process).
 */
let lastPromptedUserId: string | null = null;

/** Test-only reset of the session guard (jest). */
export function resetPolicyReacceptanceState(): void {
  lastPromptedUserId = null;
}

export default function PolicyReacceptanceGate({ enabled }: { enabled: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId) return;
    // A qa-login-as deep link is actively signing in + auto-accepting policies —
    // never race it to the TOS screen (Dev Task 51 item 2). Once the handler
    // finishes, the acceptance rows exist, so the next launch finds them accepted.
    if (isQaLoginAsInProgress()) return;
    if (lastPromptedUserId === userId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkAndPrompt = async () => {
      try {
        const [tosAccepted, privacyAccepted] = await Promise.all([
          getTOSService().hasAcceptedCurrentTOS(),
          getPrivacyPolicyService().hasAcceptedCurrentPrivacyPolicy(),
        ]);

        if (cancelled) return;
        if (tosAccepted && privacyAccepted) return; // current versions accepted — nothing to do

        // Soft gate: prompt once for the first unmet policy (TOS priority).
        lastPromptedUserId = userId;

        const route = navigationRef.getCurrentRoute()?.name;
        if (route === 'TermsOfService' || route === 'PrivacyPolicy') return;

        if (!tosAccepted) {
          navigationRef.navigate('TermsOfService', { requireAcceptance: true } as never);
        } else {
          navigationRef.navigate('PrivacyPolicy', { requireAcceptance: true } as never);
        }
      } catch {
        // Fail-open: a policy-check error never blocks the app.
      } finally {
        inFlightRef.current = false;
      }
    };

    const tryRun = () => {
      if (!navigationRef.isReady()) {
        if (attempts < MAX_READY_ATTEMPTS) {
          attempts += 1;
          timer = setTimeout(tryRun, READY_RETRY_MS);
        } else {
          inFlightRef.current = false;
        }
        return;
      }
      void checkAndPrompt();
    };

    tryRun();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, userId]);

  return null;
}

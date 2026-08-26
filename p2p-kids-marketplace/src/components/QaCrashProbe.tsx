// File: src/components/QaCrashProbe.tsx
// QA-ONLY render-crash trigger (ACC-TC-L01–L04).
//
// ErrorBoundary is wired at the app root (App.tsx) but had no on-demand way to
// trigger a render-time crash for QA. This probe — mounted inside a screen's
// render tree — reads the SESSION-LOCAL `qa_local_crash_trigger` toggle (armed
// via the `p2pkidsmarketplace://qa-dev-toggle` deep link, NOT admin_config) and
// throws a CONTROLLED Error during render, which the root ErrorBoundary catches:
//   - 'once'    → throws once, then disarms itself so "Try Again" recovers (L01+L02)
//   - 'persist' → throws on every render while armed so the fallback persists
//                 and proves the error is contained (L03)
//   - 'none' / unset / unknown / release build → renders null (fail-closed)
//
// SECURITY GATE: getQaCrashTriggerMode() is gated by devTestingService's
// isDevEnvironment() — a release build always returns 'none', so this probe is
// inert in production (it never throws, never writes).

import { useEffect, useState } from 'react';
import {
  QA_CRASH_TRIGGER_KEY,
  getQaCrashTriggerMode,
  setQaLocalValue,
} from '@/services/devTestingService';

type QaCrashTriggerMode = 'once' | 'persist' | 'none';

/**
 * Renders null normally. When the session-local crash trigger is armed it
 * throws during render, which propagates to the nearest error boundary (the
 * root ErrorBoundary in App.tsx). `screenName` is used only for the thrown
 * error message so QA logs identify which screen's render path crashed.
 */
export default function QaCrashProbe({ screenName }: { screenName: string }) {
  const [armed, setArmed] = useState<QaCrashTriggerMode>('none');

  useEffect(() => {
    let active = true;
    // Short delay so a cold-start qa-dev-toggle DISARM URL is processed by
    // QaDevToggleDeepLinkHandler before this probe reads the toggle — makes
    // recovery from a previously-armed 'persist' crash deterministic (the
    // AsyncStorage write lands before this read).
    const timer = setTimeout(() => {
      void getQaCrashTriggerMode().then((mode) => {
        if (active) setArmed(mode);
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (armed === 'persist') {
    // Thrown during render → caught by the root ErrorBoundary (L01/L03).
    throw new Error(`[QA crash trigger] persistent render crash on ${screenName} (ACC-TC-L01/L03)`);
  }

  if (armed === 'once') {
    // Disarm so "Try Again" (ErrorBoundary reset) recovers on the next render
    // (ACC-TC-L02). Fire-and-forget; the probe's 150ms read delay lets the
    // write land before a remount re-reads the toggle.
    void setQaLocalValue(QA_CRASH_TRIGGER_KEY, 'none');
    throw new Error(`[QA crash trigger] one-shot render crash on ${screenName} (ACC-TC-L01/L02)`);
  }

  return null;
}

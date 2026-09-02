/**
 * File: p2p-kids-marketplace/src/hooks/useTrialEligibility.ts
 * Shared trial-marketing gate (QA Task 20 F-3 / owner decision 2026-09-02).
 *
 * Kids Club+ trial availability is an admin_config switch (`trial_enabled`).
 * Marketing surfaces that promise a "free trial" / "Start Trial" must only show
 * that messaging when the switch is ON; when OFF the CTA/copy is a plain
 * "Join Kids Club+" upsell. Re-enabling trials later = a config flip (no code
 * change) because every surface reads this hook.
 *
 * Defaults are conservative: until the config resolves, `trialEnabled` is false
 * so no surface advertises a trial that may not be offered.
 */

import { useEffect, useState } from 'react';
import { getTrialDays, isTrialEnabled } from '@/services/adminConfig';

export interface TrialEligibility {
  /** True only once admin_config reports trial_enabled=true. */
  trialEnabled: boolean;
  /** trial_period_days from config (fallback 30). Only meaningful when enabled. */
  trialDays: number;
  /** True once the config read resolved (success or failure). */
  ready: boolean;
}

export function useTrialEligibility(): TrialEligibility {
  const [state, setState] = useState<TrialEligibility>({
    trialEnabled: false,
    trialDays: 30,
    ready: false,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [enabled, days] = await Promise.all([isTrialEnabled(), getTrialDays()]);
        if (mounted) {
          setState({ trialEnabled: enabled === true, trialDays: days || 30, ready: true });
        }
      } catch {
        // Config read failed → keep trial OFF (fail-safe: never advertise a
        // trial that may not be offered).
        if (mounted) setState((prev) => ({ ...prev, ready: true }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

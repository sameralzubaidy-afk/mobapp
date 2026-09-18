/**
 * FIX-Task-53 item 3 (2026-09-17) — `useSubscriptionStatus().isTrialExpired`.
 *
 * The hook checked the legacy 'grace' alias only. Once FIX-Task-51 normalized the
 * last legacy-spelled row, that comparison could never be true for a real grace
 * user. Grace IS the post-trial state, so both spellings must classify as expired.
 */

import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useSubscriptionStatus } from '../useAuth';

function renderWithSession(subscription_status: string, can_spend_sp = true) {
  const value = { session: { subscription_status, can_spend_sp } } as never;

  return renderHook(() => useSubscriptionStatus(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(AuthContext.Provider, { value }, children),
  });
}

describe('useSubscriptionStatus.isTrialExpired — FIX-Task-53 item 3', () => {
  it('is TRUE for the canonical grace_period status', () => {
    expect(renderWithSession('grace_period').result.current.isTrialExpired).toBe(true);
  });

  it('is TRUE for the legacy grace alias too', () => {
    expect(renderWithSession('grace').result.current.isTrialExpired).toBe(true);
  });

  it('is TRUE for a free user', () => {
    expect(renderWithSession('free').result.current.isTrialExpired).toBe(true);
  });

  it('is FALSE for paying members (trial / active)', () => {
    expect(renderWithSession('trial').result.current.isTrialExpired).toBe(false);
    expect(renderWithSession('active').result.current.isTrialExpired).toBe(false);
  });

  it('passes the session SP flag straight through', () => {
    expect(renderWithSession('grace_period', true).result.current.canSpendSP).toBe(true);
    expect(renderWithSession('free', false).result.current.canSpendSP).toBe(false);
  });
});

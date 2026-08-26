// File: p2p-kids-marketplace/src/components/__tests__/PolicyReacceptanceGate.test.tsx
// ACC-TC-J05 (policy re-prompt, soft gate) + ACC-TC-J02 (acceptance path).
//
// PolicyReacceptanceGate navigates to the TermsOfService/PrivacyPolicy
// acceptance-mode screens (requireAcceptance: true) once per user per session
// when the current published policy is not accepted, and never loops, never
// fires for already-accepted users, and never fires while onboarding is active.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import PolicyReacceptanceGate, { resetPolicyReacceptanceState } from '../PolicyReacceptanceGate';
import { useAuth } from '@/hooks/useAuth';
import { navigationRef } from '@/navigation/navigationRef';
import { getTOSService } from '@/services/tos';
import { getPrivacyPolicyService } from '@/services/privacyPolicy';

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: jest.fn(() => true),
    getCurrentRoute: jest.fn(() => ({ name: 'Home' })),
    navigate: jest.fn(),
  },
}));

jest.mock('@/services/tos', () => ({
  getTOSService: jest.fn(),
}));

jest.mock('@/services/privacyPolicy', () => ({
  getPrivacyPolicyService: jest.fn(),
}));

describe('PolicyReacceptanceGate (J05 soft gate / J02 acceptance path)', () => {
  const mockTosAccepted = jest.fn();
  const mockPrivacyAccepted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetPolicyReacceptanceState();
    (useAuth as jest.Mock).mockReturnValue({ session: { user: { id: 'user-001' } } });
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'Home' });
    (getTOSService as jest.Mock).mockReturnValue({ hasAcceptedCurrentTOS: mockTosAccepted });
    (getPrivacyPolicyService as jest.Mock).mockReturnValue({
      hasAcceptedCurrentPrivacyPolicy: mockPrivacyAccepted,
    });
  });

  it('does nothing when both current policies are accepted (no loop/block)', async () => {
    mockTosAccepted.mockResolvedValue(true);
    mockPrivacyAccepted.mockResolvedValue(true);

    render(<PolicyReacceptanceGate enabled />);

    await waitFor(() => {
      expect(mockTosAccepted).toHaveBeenCalled();
      expect(mockPrivacyAccepted).toHaveBeenCalled();
    });
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('navigates to TermsOfService with requireAcceptance when TOS is not accepted (J02 path)', async () => {
    mockTosAccepted.mockResolvedValue(false);
    mockPrivacyAccepted.mockResolvedValue(true);

    render(<PolicyReacceptanceGate enabled />);

    await waitFor(() => {
      expect(navigationRef.navigate).toHaveBeenCalledWith('TermsOfService', {
        requireAcceptance: true,
      });
    });
  });

  it('navigates to PrivacyPolicy with requireAcceptance when only Privacy is not accepted', async () => {
    mockTosAccepted.mockResolvedValue(true);
    mockPrivacyAccepted.mockResolvedValue(false);

    render(<PolicyReacceptanceGate enabled />);

    await waitFor(() => {
      expect(navigationRef.navigate).toHaveBeenCalledWith('PrivacyPolicy', {
        requireAcceptance: true,
      });
    });
  });

  it('does not re-prompt the same user twice in a session (Decline cannot loop)', async () => {
    mockTosAccepted.mockResolvedValue(false);
    mockPrivacyAccepted.mockResolvedValue(true);

    const first = render(<PolicyReacceptanceGate enabled />);
    await waitFor(() => {
      expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
    });

    first.unmount();
    // Remount in the same session — the process-lifetime guard must suppress a
    // second prompt for the same user.
    render(<PolicyReacceptanceGate enabled />);
    await waitFor(() => {
      expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
    });
  });

  it('does nothing when the gate is disabled (e.g. onboarding carousel active)', async () => {
    mockTosAccepted.mockResolvedValue(false);
    mockPrivacyAccepted.mockResolvedValue(false);

    render(<PolicyReacceptanceGate enabled={false} />);

    // Give any (suppressed) effect a moment; nothing should be checked or navigated.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockTosAccepted).not.toHaveBeenCalled();
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does nothing for an unauthenticated user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });

    render(<PolicyReacceptanceGate enabled />);

    await new Promise((r) => setTimeout(r, 20));
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when the user is already on a legal screen', async () => {
    mockTosAccepted.mockResolvedValue(false);
    mockPrivacyAccepted.mockResolvedValue(true);
    (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'TermsOfService' });

    render(<PolicyReacceptanceGate enabled />);

    await waitFor(() => {
      expect(mockTosAccepted).toHaveBeenCalled();
    });
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate while the navigation container is not ready (fail-open)', async () => {
    mockTosAccepted.mockResolvedValue(false);
    mockPrivacyAccepted.mockResolvedValue(true);
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);

    render(<PolicyReacceptanceGate enabled />);

    // While the container is not ready the gate must never navigate; the bounded
    // readiness retry gives up quietly if readiness never arrives.
    await new Promise((r) => setTimeout(r, 20));
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });
});

// File: src/components/__tests__/QaLoginAsDeepLinkHandler.test.tsx
// FIX-Task-27 item 1 (2026-09-13) — the qa-login-as persona switch must survive a
// transient failure and never leave the client in the half-switched state QA hit.
//
// Sourced from the 2026-09-13 QA round: `qa-login-as?persona=test-seller` failed
// with "User profile not found" although the profile was intact, the retry logged
// nothing, and the app stayed wedged on "Loading trade…" until a force-stop.
//
// Why that wedges: `loginWithContext` calls `signInWithPassword` FIRST (which
// replaces the Supabase client's session) and only then reads the profile. If the
// profile read fails, React's AuthContext never receives `setSession` — so the UI
// renders the PREVIOUS persona while every request runs as the NEW one.
//
// These tests drive the REAL handler through the deep-link listener, with only its
// collaborators mocked, and assert the three contract points:
//   1. success            → setSession(session), no recovery needed
//   2. transient failure  → retried, then setSession(session)
//   3. persistent failure → retried a bounded number of times, the REAL cause is
//      logged (code + underlying error, not a bare message), and the half-switched
//      session is cleared on BOTH sides (Supabase signOut + React setSession(null))

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import QaLoginAsDeepLinkHandler from '../QaLoginAsDeepLinkHandler';

const mockSetSession = jest.fn();
const mockLoginWithContext = jest.fn();
const mockSignOut = jest.fn();

// Identity-stable mock objects (BP-93).
const mockAuth = { setSession: mockSetSession };
const mockPersonas: Record<string, { email: string; password: string }> = {
  'test-seller': { email: 'seller@test.dev', password: 'Password123' },
};

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/auth', () => ({
  loginWithContext: (...args: unknown[]) => mockLoginWithContext(...args),
}));
jest.mock('@/services/tos', () => ({
  getTOSService: () => ({
    getCurrentTOS: () => Promise.resolve(null),
    acceptTOS: jest.fn(),
  }),
}));
jest.mock('@/services/privacyPolicy', () => ({
  getPrivacyPolicyService: () => ({
    getCurrentPrivacyPolicy: () => Promise.resolve(null),
    acceptPrivacyPolicy: jest.fn(),
  }),
}));
jest.mock('@/services/qaPersonas', () => ({
  getQaPersona: (name: string) => mockPersonas[name] ?? null,
}));
jest.mock('@/config/supabase', () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => mockSignOut(...args) } },
}));
jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

const mockParse = Linking.parse as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;
const mockGetInitialURL = Linking.getInitialURL as jest.Mock;

let urlListener: ((event: { url: string }) => void) | null = null;

const SESSION = { user: { id: 'seller-1' }, access_token: 'token' } as never;

/** An AuthError-shaped failure, exactly as `loginWithContext` throws it. */
function profileNotFoundError() {
  return Object.assign(new Error('User profile not found'), {
    name: 'AuthError',
    code: 'PROFILE_NOT_FOUND',
    details: { message: 'Gateway Timeout', code: 'PGRST000' },
  });
}

const warnedText = () =>
  (console.warn as jest.Mock).mock.calls.map((c) => c.map(String).join(' ')).join(' | ');

describe('QaLoginAsDeepLinkHandler (FIX-Task-27 item 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    urlListener = null;

    mockAddEventListener.mockImplementation(
      (_type: string, handler: (e: { url: string }) => void) => {
        urlListener = handler;
        return { remove: jest.fn() };
      }
    );
    mockGetInitialURL.mockResolvedValue(null);
    mockParse.mockReturnValue({
      path: 'qa-login-as',
      queryParams: { persona: 'test-seller' },
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  const fireLoginAs = () => {
    render(<QaLoginAsDeepLinkHandler />);
    if (!urlListener) throw new Error('url listener not registered');
    urlListener({ url: 'p2pkidsmarketplace://qa-login-as?persona=test-seller' });
  };

  it('signs the persona in and hands the session to AuthContext', async () => {
    mockLoginWithContext.mockResolvedValue(SESSION);

    fireLoginAs();

    await waitFor(() => expect(mockSetSession).toHaveBeenCalledWith(SESSION));
    expect(mockLoginWithContext).toHaveBeenCalledTimes(1);
    expect(mockLoginWithContext).toHaveBeenCalledWith({
      email: 'seller@test.dev',
      password: 'Password123',
    });
    // Nothing to recover from: the switch completed on the first attempt.
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('retries a transient failure and still completes the switch', async () => {
    mockLoginWithContext.mockRejectedValueOnce(profileNotFoundError()).mockResolvedValue(SESSION);

    fireLoginAs();

    await waitFor(() => expect(mockSetSession).toHaveBeenCalledWith(SESSION));
    expect(mockLoginWithContext).toHaveBeenCalledTimes(2);
    // A recovered switch must NOT sign anything out.
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('logs the REAL cause (code + underlying error) rather than a bare message', async () => {
    mockLoginWithContext.mockRejectedValue(profileNotFoundError());

    fireLoginAs();

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());

    const warnings = warnedText();
    expect(warnings).toContain('code=PROFILE_NOT_FOUND');
    expect(warnings).toContain('cause=');
    // The old handler logged `.message` only — which is why a transient read
    // failure was misread as "the profile doesn't exist".
    expect(warnings).toContain('Gateway Timeout');
  });

  it('clears the half-switched session on BOTH sides when the switch gives up', async () => {
    mockLoginWithContext.mockRejectedValue(profileNotFoundError());

    fireLoginAs();

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' }));
    // Bounded: it does not retry forever.
    expect(mockLoginWithContext).toHaveBeenCalledTimes(3);
    // AuthContext has no auth-state listener, so the client-side signOut alone
    // would leave React rendering the stale persona — setSession(null) is the half
    // that actually releases it.
    expect(mockSetSession).toHaveBeenCalledWith(null);
    // …and the session was NEVER handed over as if it had succeeded.
    expect(mockSetSession).not.toHaveBeenCalledWith(SESSION);
  });

  it('ignores an unknown persona without touching the session', async () => {
    mockParse.mockReturnValue({
      path: 'qa-login-as',
      queryParams: { persona: 'nobody' },
    });

    fireLoginAs();

    await waitFor(() => expect(warnedText()).toContain('Unknown persona'));
    expect(mockLoginWithContext).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

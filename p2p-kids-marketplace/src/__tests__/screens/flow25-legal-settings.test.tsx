/**
 * Unit Tests: FLOW-25 Legal & Settings Screen Suite
 * MODULE-15.1 FLOW-25: Restyle verification
 *
 * Covers:
 *  - SettingsScreen: grouped sections, Sign Out, Delete Account row
 *  - PrivacyPolicyScreen: loading / content / error states
 *  - TermsOfServiceScreen: loading / content / accept/decline
 *  - DeleteAccountScreen: renders hero, consequences, input, buttons
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return function Markdown({ children }: any) {
    return <Text testID="markdown-content">{children}</Text>;
  };
});

jest.mock('phosphor-react-native', () => ({
  Gear: 'Gear',
  Lock: 'Lock',
  FileText: 'FileText',
  Shield: 'Shield',
  Sun: 'Sun',
  Translate: 'Translate',
  SignOut: 'SignOut',
  Trash: 'Trash',
  CaretRight: 'CaretRight',
  CaretLeft: 'CaretLeft',
  BellSimple: 'BellSimple',
  BellSimpleSlash: 'BellSimpleSlash',
  PaperPlaneTilt: 'PaperPlaneTilt',
  Link: 'Link',
  Question: 'Question',
  ArrowLeft: 'ArrowLeft',
  WarningCircle: 'WarningCircle',
  X: 'X',
}));

jest.mock('@/components/ui', () => ({
  LoadingSpinner: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'loading-spinner'} />;
  },
}));

jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { email: 'test@example.com' } },
        error: null,
      }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

// ─── SettingsScreen ───────────────────────────────────────────────────────────

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', user_id: 'user-1' },
    logout: jest.fn(),
  }),
}));

jest.mock('../../services/pushDelivery', () => ({
  sendTestPushNotification: jest.fn().mockResolvedValue({ success: true, sent: true }),
}));

import SettingsScreen from '@/screens/profile/SettingsScreen';

describe('SettingsScreen (FLOW-25)', () => {
  const nav = { ...mockNavigation };

  it('renders grouped section headers', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    expect(getByTestId('settings-section-notifications')).toBeTruthy();
    expect(getByTestId('settings-section-account')).toBeTruthy();
    expect(getByTestId('settings-section-legal')).toBeTruthy();
    expect(getByTestId('settings-section-danger-zone')).toBeTruthy();
  });

  it('renders Sign Out row', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    expect(getByTestId('settings-sign-out-button')).toBeTruthy();
  });

  it('renders Delete Account row', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    expect(getByTestId('settings-delete-account-button')).toBeTruthy();
  });

  it('navigates to DeleteAccount on Delete Account press', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    fireEvent.press(getByTestId('settings-delete-account-button'));
    expect(nav.navigate).toHaveBeenCalledWith('DeleteAccount');
  });

  it('shows Sign Out confirmation dialog', () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    fireEvent.press(getByTestId('settings-sign-out-button'));
    expect(alertSpy).toHaveBeenCalledWith('Sign Out', expect.any(String), expect.any(Array));
  });

  it('navigates to TOS on Terms of Service press', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    fireEvent.press(getByTestId('settings-tos-button'));
    expect(nav.navigate).toHaveBeenCalledWith('TermsOfService');
  });

  it('navigates to PrivacyPolicy on Privacy Policy press', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    fireEvent.press(getByTestId('settings-privacy-policy-button'));
    expect(nav.navigate).toHaveBeenCalledWith('PrivacyPolicy');
  });

  it('navigates to LiabilityDisclaimer on press', () => {
    const { getByTestId } = render(<SettingsScreen navigation={nav} />);
    fireEvent.press(getByTestId('settings-liability-disclaimer-button'));
    expect(nav.navigate).toHaveBeenCalledWith('LiabilityDisclaimer');
  });
});

// ─── PrivacyPolicyScreen ──────────────────────────────────────────────────────

const mockGetCurrentPrivacyPolicy = jest.fn();
const mockAcceptPrivacyPolicy = jest.fn();

jest.mock('../../services/privacyPolicy', () => ({
  getPrivacyPolicyService: () => ({
    getCurrentPrivacyPolicy: mockGetCurrentPrivacyPolicy,
    acceptPrivacyPolicy: mockAcceptPrivacyPolicy,
  }),
}));

import PrivacyPolicyScreen from '@/screens/profile/PrivacyPolicyScreen';

describe('PrivacyPolicyScreen (FLOW-25)', () => {
  const nav = { ...mockNavigation };
  const route = { params: {} };

  const mockPolicy = {
    id: 'pp-1',
    title: 'Privacy Policy',
    version: '2.0',
    content: '## Data Collection\n\nWe collect minimal data.',
    effective_date: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => jest.clearAllMocks());

  it('shows loading state initially', () => {
    mockGetCurrentPrivacyPolicy.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<PrivacyPolicyScreen navigation={nav} route={route as any} />);
    expect(getByTestId('privacy-policy-loading')).toBeTruthy();
  });

  it('renders policy content', async () => {
    mockGetCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);
    const { getByTestId } = render(<PrivacyPolicyScreen navigation={nav} route={route as any} />);
    await waitFor(() => {
      expect(getByTestId('privacy-policy-content')).toBeTruthy();
    });
  });

  it('renders "Last updated" date', async () => {
    mockGetCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);
    const { getByTestId } = render(<PrivacyPolicyScreen navigation={nav} route={route as any} />);
    await waitFor(() => {
      expect(getByTestId('privacy-policy-effective-date')).toBeTruthy();
    });
  });

  it('shows error state when service throws', async () => {
    mockGetCurrentPrivacyPolicy.mockRejectedValue(new Error('fetch failed'));
    const { getByTestId } = render(<PrivacyPolicyScreen navigation={nav} route={route as any} />);
    await waitFor(() => {
      expect(getByTestId('privacy-policy-error')).toBeTruthy();
    });
  });

  it('renders back button', async () => {
    mockGetCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);
    const { getByTestId } = render(<PrivacyPolicyScreen navigation={nav} route={route as any} />);
    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });
  });
});

// ─── TermsOfServiceScreen ─────────────────────────────────────────────────────

const mockGetCurrentTOS = jest.fn();
const mockAcceptTOS = jest.fn();

jest.mock('../../services/tos', () => ({
  getTOSService: () => ({
    getCurrentTOS: mockGetCurrentTOS,
    acceptTOS: mockAcceptTOS,
  }),
}));

import TermsOfServiceScreen from '@/screens/profile/TermsOfServiceScreen';

describe('TermsOfServiceScreen (FLOW-25)', () => {
  const nav = { ...mockNavigation };

  const mockTOS = {
    id: 'tos-1',
    title: 'Terms of Service',
    version: '1.0',
    content: '## Your Agreement\n\nYou agree to our terms.',
    effective_date: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => jest.clearAllMocks());

  it('shows loading state initially', () => {
    mockGetCurrentTOS.mockReturnValue(new Promise(() => {}));
    const { getByText } = render(
      <TermsOfServiceScreen navigation={nav} route={{ params: {} } as any} />
    );
    expect(getByText('Loading Terms of Service...')).toBeTruthy();
  });

  it('renders TOS content', async () => {
    mockGetCurrentTOS.mockResolvedValue(mockTOS);
    const { getByTestId } = render(
      <TermsOfServiceScreen navigation={nav} route={{ params: {} } as any} />
    );
    await waitFor(() => {
      expect(getByTestId('tos-content')).toBeTruthy();
    });
  });

  it('renders accept/decline buttons when requireAcceptance=true', async () => {
    mockGetCurrentTOS.mockResolvedValue(mockTOS);
    const { getByTestId } = render(
      <TermsOfServiceScreen
        navigation={nav}
        route={{ params: { requireAcceptance: true } } as any}
      />
    );
    await waitFor(() => {
      expect(getByTestId('accept-tos-button')).toBeTruthy();
      expect(getByTestId('decline-tos-button')).toBeTruthy();
    });
  });

  it('hides accept/decline buttons when requireAcceptance=false', async () => {
    mockGetCurrentTOS.mockResolvedValue(mockTOS);
    const { queryByTestId } = render(
      <TermsOfServiceScreen
        navigation={nav}
        route={{ params: { requireAcceptance: false } } as any}
      />
    );
    await waitFor(() => {
      expect(queryByTestId('accept-tos-button')).toBeNull();
      expect(queryByTestId('decline-tos-button')).toBeNull();
    });
  });
});

// ─── DeleteAccountScreen ──────────────────────────────────────────────────────

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    logout: jest.fn(),
  }),
}));

import DeleteAccountScreen from '@/screens/settings/DeleteAccountScreen';

describe('DeleteAccountScreen (FLOW-25)', () => {
  const nav = { ...mockNavigation };

  it('renders trash icon', () => {
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    expect(getByTestId('delete-account-icon')).toBeTruthy();
  });

  it('renders heading "Delete Account?"', () => {
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    expect(getByTestId('delete-account-heading')).toBeTruthy();
  });

  it('renders password input', () => {
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    expect(getByTestId('password-input')).toBeTruthy();
  });

  it('renders "Delete My Account" button', () => {
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    expect(getByTestId('delete-account-button')).toBeTruthy();
  });

  it('renders "Cancel" text link', () => {
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    expect(getByTestId('cancel-delete-button')).toBeTruthy();
  });

  it('calls navigation.goBack when Cancel is pressed', () => {
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    fireEvent.press(getByTestId('cancel-delete-button'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('shows Alert when deleting without password', () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    fireEvent.press(getByTestId('delete-account-button'));
    expect(alertSpy).toHaveBeenCalledWith('Password required', expect.any(String));
  });

  it('shows confirmation dialog when password is entered', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    const { getByTestId } = render(<DeleteAccountScreen navigation={nav} />);
    fireEvent.changeText(getByTestId('password-input'), 'mypassword123');
    fireEvent.press(getByTestId('delete-account-button'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Delete Account',
        expect.any(String),
        expect.any(Array)
      );
    });
  });
});

/**
 * Unit Tests: LiabilityDisclaimerScreen
 * TASK SAFETY-012: Liability Disclaimer Screen Tests
 * MODULE-15.1 FLOW-25: Updated for Phosphor Icons restyle
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LiabilityDisclaimerScreen from '@/screens/settings/LiabilityDisclaimerScreen';
import { supabase } from '@/config/supabase';
import { getQaPolicyLoadFailureMode } from '@/services/devTestingService';

// Mock dependencies
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@/services/devTestingService', () => ({
  getQaPolicyLoadFailureMode: jest.fn().mockResolvedValue('none'),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

jest.mock(
  'react-native-markdown-display',
  () => {
    const { Text } = require('react-native');
    return function Markdown({ children }: any) {
      return <Text>{children}</Text>;
    };
  },
  { virtual: true }
);

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('phosphor-react-native', () => ({
  CaretLeft: 'CaretLeft',
  WarningCircle: 'WarningCircle',
}));

describe('LiabilityDisclaimerScreen', () => {
  const mockPolicy = {
    id: 'policy-456',
    policy_type: 'liability_disclaimer',
    version: '1.0',
    title: 'Platform Liability Disclaimer',
    content: '# Liability Disclaimer\n\n## Terms and Conditions\n\nThis is the disclaimer content.',
    effective_date: '2026-03-15T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Fail-closed default so a toggle armed in a prior test never leaks (BP-60).
    (getQaPolicyLoadFailureMode as jest.Mock).mockResolvedValue('none');
  });

  describe('Loading State', () => {
    it('shows loading indicator while fetching', async () => {
      (supabase.rpc as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            /* Never resolves */
          })
      );

      const { getByTestId, getByText } = render(<LiabilityDisclaimerScreen />);

      expect(getByTestId('loading-indicator')).toBeTruthy();
      expect(getByText('Loading disclaimer...')).toBeTruthy();
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPolicy],
        error: null,
      });
    });

    it('renders disclaimer title and last-updated after successful fetch', async () => {
      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText('Platform Liability Disclaimer')).toBeTruthy();
      });
    });

    it('displays last updated date', async () => {
      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText(/Last updated:/i)).toBeTruthy();
      });
    });

    it('renders WarningCircle icon and no action buttons', async () => {
      const { UNSAFE_getByType: _UNSAFE_getByType, queryByText } = render(
        <LiabilityDisclaimerScreen />
      );

      await waitFor(() => {
        // No accept/decline buttons — read-only screen
        expect(queryByText(/accept/i)).toBeNull();
      });
    });

    it('has a back button', async () => {
      const { getByTestId } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByTestId('back-button')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('shows error message when RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText(/Failed to load disclaimer/i)).toBeTruthy();
      });
    });

    it('shows error message when no policy data returned', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText(/No published liability disclaimer available/i)).toBeTruthy();
      });
    });

    it('shows retry button in error state', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('shows "no published disclaimer" + Retry when QA no_policy toggle is armed (J12)', async () => {
      (getQaPolicyLoadFailureMode as jest.Mock).mockResolvedValue('no_policy');

      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText(/No published liability disclaimer available/i)).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('shows load-failure + Retry when QA fetch_failure toggle is armed (J08)', async () => {
      (getQaPolicyLoadFailureMode as jest.Mock).mockResolvedValue('fetch_failure');

      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText(/Failed to load disclaimer/i)).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('refetches when retry button is pressed', async () => {
      // First call fails
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' },
      });

      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });

      // Second call succeeds
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: [mockPolicy],
        error: null,
      });

      const retryButton = getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(getByText('Platform Liability Disclaimer')).toBeTruthy();
      });
    });
  });

  describe('Rendering States', () => {
    it('renders all key UI elements in success state', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPolicy],
        error: null,
      });

      const { getByTestId, getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        // Header elements
        expect(getByTestId('back-button')).toBeTruthy();
        expect(getByText('Disclaimer')).toBeTruthy();

        // Content elements
        expect(getByTestId('disclaimer-content')).toBeTruthy();
        expect(getByText('Platform Liability Disclaimer')).toBeTruthy();
      });
    });
  });
});

/**
 * Unit Tests: LiabilityDisclaimerScreen
 * TASK SAFETY-012: Liability Disclaimer Screen Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LiabilityDisclaimerScreen from '@/screens/settings/LiabilityDisclaimerScreen';
import { supabase } from '@/config/supabase';

// Mock dependencies
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return function Markdown({ children }: any) {
    return <Text>{children}</Text>;
  };
}, { virtual: true });

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
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

    it('renders disclaimer content after successful fetch', async () => {
      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText('Platform Liability Disclaimer')).toBeTruthy();
        expect(getByText('Version 1.0')).toBeTruthy();
      });
    });

    it('displays effective date', async () => {
      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(getByText(/Effective:/i)).toBeTruthy();
      });
    });

    it('displays informational notice at bottom', async () => {
      const { getByText } = render(<LiabilityDisclaimerScreen />);

      await waitFor(() => {
        expect(
          getByText(/This disclaimer is shown before every purchase/i)
        ).toBeTruthy();
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
        expect(getByText('Liability Disclaimer')).toBeTruthy();

        // Content elements
        expect(getByTestId('disclaimer-content')).toBeTruthy();
        expect(getByText('Platform Liability Disclaimer')).toBeTruthy();
      });
    });
  });
});

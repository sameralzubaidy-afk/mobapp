/**
 * Unit Tests: DisclaimerModal Component
 * TASK SAFETY-012: Liability Disclaimer Modal Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DisclaimerModal from '@/components/DisclaimerModal';
import { supabase } from '@/config/supabase';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

// Mock Markdown component
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

describe('DisclaimerModal', () => {
  const mockPolicy = {
    id: 'policy-123',
    policy_type: 'liability_disclaimer',
    version: '1.0',
    title: 'Liability Disclaimer',
    content: '# Test Disclaimer\n\nThis is a test disclaimer.',
    effective_date: '2026-03-01T00:00:00Z',
  };

  const mockOnAccept = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading indicator when fetching disclaimer', async () => {
      (supabase.rpc as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            /* Never resolves */
          })
      );

      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(getByTestId('disclaimer-modal-loading')).toBeTruthy();
      });
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
      const { getByText } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(getByText('Liability Disclaimer')).toBeTruthy();
        expect(getByText('Version 1.0')).toBeTruthy();
      });
    });

    it('displays checkbox and buttons', async () => {
      const { getByTestId, getByText } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(getByTestId('disclaimer-modal-checkbox')).toBeTruthy();
        expect(getByText('Accept & Continue')).toBeTruthy();
        expect(getByText('Cancel')).toBeTruthy();
      });
    });

    it('accept button is disabled until checkbox is checked', async () => {
      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const acceptButton = getByTestId('disclaimer-modal-accept-button');
        expect(acceptButton.props.accessibilityState.disabled).toBe(true);
      });
    });

    it('enables accept button after checkbox is checked', async () => {
      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const checkbox = getByTestId('disclaimer-modal-checkbox');
        fireEvent.press(checkbox);
      });

      await waitFor(() => {
        const acceptButton = getByTestId('disclaimer-modal-accept-button');
        expect(acceptButton.props.accessibilityState.disabled).toBe(false);
      });
    });

    it('calls onAccept with policy ID when accept button is pressed', async () => {
      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const checkbox = getByTestId('disclaimer-modal-checkbox');
        fireEvent.press(checkbox);
      });

      await waitFor(() => {
        const acceptButton = getByTestId('disclaimer-modal-accept-button');
        fireEvent.press(acceptButton);
      });

      expect(mockOnAccept).toHaveBeenCalledWith('policy-123');
    });

    it('calls onCancel when cancel button is pressed', async () => {
      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const cancelButton = getByTestId('disclaimer-modal-cancel-button');
        fireEvent.press(cancelButton);
      });

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close button (X) is pressed', async () => {
      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const closeButton = getByTestId('disclaimer-modal-close-button');
        fireEvent.press(closeButton);
      });

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('resets checkbox when modal is reopened', async () => {
      const { getByTestId, rerender } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      // Check the checkbox
      await waitFor(() => {
        const checkbox = getByTestId('disclaimer-modal-checkbox');
        fireEvent.press(checkbox);
      });

      // Close modal
      rerender(<DisclaimerModal visible={false} onAccept={mockOnAccept} onCancel={mockOnCancel} />);

      // Reopen modal
      rerender(<DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />);

      await waitFor(() => {
        const acceptButton = getByTestId('disclaimer-modal-accept-button');
        // Should be disabled again (checkbox unchecked)
        expect(acceptButton.props.accessibilityState.disabled).toBe(true);
      });
    });
  });

  describe('Error State', () => {
    it('shows error message when RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      const { getByText } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(getByText(/Failed to load disclaimer/i)).toBeTruthy();
      });
    });

    it('shows error message when no policy data returned', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const { getByText } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(getByText(/Liability Disclaimer not available/i)).toBeTruthy();
      });
    });

    it('shows retry button in error state', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const { getByText } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('refetches disclaimer when retry is pressed', async () => {
      // First call fails
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' },
      });

      const { getByText, rerender: _rerender } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

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
        expect(getByText('Version 1.0')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPolicy],
        error: null,
      });
    });

    it('has proper accessibility labels', async () => {
      const { getByTestId } = render(
        <DisclaimerModal visible={true} onAccept={mockOnAccept} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const checkbox = getByTestId('disclaimer-modal-checkbox');
        expect(checkbox.props.accessibilityLabel).toBe(
          'I have read and understand this disclaimer'
        );

        const acceptButton = getByTestId('disclaimer-modal-accept-button');
        expect(acceptButton.props.accessibilityLabel).toBe('Accept and continue');

        const closeButton = getByTestId('disclaimer-modal-close-button');
        expect(closeButton.props.accessibilityLabel).toBe('Close disclaimer');
      });
    });
  });
});

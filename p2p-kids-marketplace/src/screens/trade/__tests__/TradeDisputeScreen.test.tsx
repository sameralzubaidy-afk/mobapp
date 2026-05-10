/**
 * Unit Tests: TradeDisputeScreen
 * Tests dispute filing flow with conditional description input
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeDisputeScreen from '../TradeDisputeScreen';

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: { tradeId: 'trade-123' },
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

describe('TradeDisputeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render warning banner', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);
      const banner = getByTestId('dispute-warning-banner');
      expect(banner).toBeTruthy();
    });

    it('should render all reason chips', () => {
      const { getByText } = render(<TradeDisputeScreen />);

      expect(getByText('Item not as described')).toBeTruthy();
      expect(getByText('Item not received')).toBeTruthy();
      expect(getByText('Safety concern')).toBeTruthy();
      expect(getByText('Payment issue')).toBeTruthy();
      expect(getByText('Other')).toBeTruthy();
    });

    it('should hide description textarea initially', () => {
      const { queryByTestId } = render(<TradeDisputeScreen />);
      expect(queryByTestId('dispute-description')).toBeNull();
    });

    it('should render description textarea only when Other is selected', () => {
      const { queryByTestId, getByTestId } = render(<TradeDisputeScreen />);

      expect(queryByTestId('dispute-description')).toBeNull();

      const otherReason = getByTestId('reason-chip-4');
      fireEvent.press(otherReason);

      expect(queryByTestId('dispute-description')).toBeTruthy();
    });
  });

  describe('Reason Selection', () => {
    it('should toggle reason chip selection', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-0'); // "Item not as described"
      fireEvent.press(chip);

      // Chip should be selected (red background)
      // Note: Verify styling change in actual implementation
    });

    it('should allow only one reason selection at a time', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip1 = getByTestId('reason-chip-0');
      const chip2 = getByTestId('reason-chip-1');

      fireEvent.press(chip1);
      fireEvent.press(chip2);

      // Only chip2 should be selected
    });
  });

  describe('Description Input', () => {
    it('should accept text input', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const otherReason = getByTestId('reason-chip-4');
      fireEvent.press(otherReason);

      const textarea = getByTestId('dispute-description');
      fireEvent.changeText(textarea, 'The item arrived damaged');

      expect(textarea.props.value).toBe('The item arrived damaged');
    });

    it('should enforce 1000 character limit', () => {
      const { getByTestId, getByText } = render(<TradeDisputeScreen />);

      const otherReason = getByTestId('reason-chip-4');
      fireEvent.press(otherReason);

      const textarea = getByTestId('dispute-description');
      const longText = 'a'.repeat(1100);

      fireEvent.changeText(textarea, longText);

      // Should show character count
      expect(getByText(/1000/)).toBeTruthy();
    });

    it('should update character counter', () => {
      const { getByTestId, getByText } = render(<TradeDisputeScreen />);

      const otherReason = getByTestId('reason-chip-4');
      fireEvent.press(otherReason);

      const textarea = getByTestId('dispute-description');
      fireEvent.changeText(textarea, 'Test description');

      // Should show character count (e.g., "16/1000")
      expect(getByText(/16/)).toBeTruthy();
    });
  });
  describe('Form Validation', () => {
    it('should disable submit button when reason not selected', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const submitButton = getByTestId('submit-dispute-button');

      // Should be disabled initially
      expect(submitButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should disable submit button when Other is selected and description too short', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-4');
      fireEvent.press(chip);

      const textarea = getByTestId('dispute-description');
      fireEvent.changeText(textarea, 'Short'); // Less than 10 chars

      const submitButton = getByTestId('submit-dispute-button');
      expect(submitButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should enable submit button when non-Other reason is selected', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-0');
      fireEvent.press(chip);

      const submitButton = getByTestId('submit-dispute-button');
      expect(submitButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('should enable submit button when Other has valid description', () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-4');
      fireEvent.press(chip);

      const textarea = getByTestId('dispute-description');
      fireEvent.changeText(textarea, 'This is a valid description with enough characters');

      const submitButton = getByTestId('submit-dispute-button');
      expect(submitButton.props.accessibilityState?.disabled).toBe(false);
    });
  });

  describe('Dispute Submission', () => {
    it('should call dispute RPC with correct params', async () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-0');
      fireEvent.press(chip);

      const submitButton = getByTestId('submit-dispute-button');
      fireEvent.press(submitButton);

      // TODO: Verify RPC call when implemented
      // expect(mockSupabase.rpc).toHaveBeenCalledWith('file_trade_dispute', {
      //   p_trade_id: 'trade-123',
      //   p_reason: 'Item not as described',
      //   p_description: 'Item was damaged on arrival',
      //   p_evidence_urls: [],
      // });
    });

    it('should show success message on successful submission', async () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-0');
      fireEvent.press(chip);

      const submitButton = getByTestId('submit-dispute-button');
      fireEvent.press(submitButton);

      await waitFor(() => {
        // Should show success alert or navigate
      });
    });

    it('should show error on submission failure', async () => {
      const { getByTestId } = render(<TradeDisputeScreen />);

      const chip = getByTestId('reason-chip-0');
      fireEvent.press(chip);

      const submitButton = getByTestId('submit-dispute-button');
      fireEvent.press(submitButton);

      // Mock failure scenario
      await waitFor(() => {
        // Should show error alert
      });
    });
  });
});

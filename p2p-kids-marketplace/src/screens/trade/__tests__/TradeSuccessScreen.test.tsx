/**
 * Unit Tests: TradeSuccessScreen
 * Tests success/failure states, navigation, SP earned badge
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TradeSuccessScreen from '../TradeSuccessScreen';

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: {},
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

describe('TradeSuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success State', () => {
    it('should render success icon', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true },
      });

      const { getByTestId } = render(<TradeSuccessScreen />);
      expect(getByTestId('success-icon')).toBeTruthy();
    });

    it('should render success message', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText(/Success/i)).toBeTruthy();
    });

    it('should render SP earned badge when SP > 0', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, spEarned: 25 },
      });

      const { getByTestId, getByText } = render(<TradeSuccessScreen />);

      expect(getByTestId('sp-earned-badge')).toBeTruthy();
      expect(getByText(/25 SP/)).toBeTruthy();
    });

    it('should not render SP badge when SP = 0', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, spEarned: 0 },
      });

      const { queryByTestId } = render(<TradeSuccessScreen />);
      expect(queryByTestId('sp-earned-badge')).toBeNull();
    });

    it('should render "View Trade" button', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, tradeId: 'trade-123' },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText('View Trade')).toBeTruthy();
    });

    it('should navigate to TradeTimeline on "View Trade" press', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, tradeId: 'trade-123' },
      });

      const { getByText } = render(<TradeSuccessScreen />);

      const button = getByText('View Trade');
      fireEvent.press(button);

      expect(mockNavigate).toHaveBeenCalledWith('TradeTimeline', { tradeId: 'trade-123' });
    });
  });

  describe('Failure State', () => {
    it('should render failure icon', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false },
      });

      const { getByTestId } = render(<TradeSuccessScreen />);
      expect(getByTestId('failure-icon')).toBeTruthy();
    });

    it('should render failure message', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false, errorMessage: 'Insufficient funds' },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText(/Insufficient funds/i)).toBeTruthy();
    });

    it('should render "Try Again" button', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText('Try Again')).toBeTruthy();
    });

    it('should go back on "Try Again" press', () => {
      const mockGoBack = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: jest.fn(),
        goBack: mockGoBack,
      });

      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false },
      });

      const { getByText } = render(<TradeSuccessScreen />);

      const button = getByText('Try Again');
      fireEvent.press(button);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Shared Elements', () => {
    it('should render "Back to Home" link', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText('Back to Home')).toBeTruthy();
    });

    it('should navigate to Home on "Back to Home" press', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true },
      });

      const { getByText } = render(<TradeSuccessScreen />);

      const link = getByText('Back to Home');
      fireEvent.press(link);

      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });

    it('should display trade ID when provided', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, tradeId: 'trade-abc-123' },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText(/trade-abc-123/i)).toBeTruthy();
    });
  });

  describe('Default State', () => {
    it('should handle no params gracefully', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {},
      });

      const { getByTestId } = render(<TradeSuccessScreen />);
      // Should default to failure state or show generic message
    });
  });
});

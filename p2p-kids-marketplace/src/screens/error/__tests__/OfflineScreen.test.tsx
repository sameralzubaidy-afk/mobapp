// File: p2p-kids-marketplace/src/screens/error/__tests__/OfflineScreen.test.tsx
// FLOW-26 Unit Tests: OfflineScreen

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OfflineScreen from '../OfflineScreen';
import { NavigationContainer } from '@react-navigation/native';

// Mock navigation
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
}));

describe('OfflineScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with all elements', () => {
    const { getByTestId } = render(<OfflineScreen />);
    
    expect(getByTestId('offline-screen')).toBeTruthy();
    expect(getByTestId('offline-icon')).toBeTruthy();
    expect(getByTestId('offline-heading')).toBeTruthy();
    expect(getByTestId('offline-subtext')).toBeTruthy();
    expect(getByTestId('retry-button')).toBeTruthy();
  });

  it('displays correct heading text', () => {
    const { getByTestId } = render(<OfflineScreen />);
    const heading = getByTestId('offline-heading');
    
    expect(heading.props.children).toBe('No Internet Connection');
  });

  it('displays correct subtext', () => {
    const { getByTestId } = render(<OfflineScreen />);
    const subtext = getByTestId('offline-subtext');
    
    expect(subtext.props.children).toBe('Check your connection and try again');
  });

  it('calls custom onRetry handler when provided', () => {
    const mockOnRetry = jest.fn();
    const { getByTestId } = render(<OfflineScreen onRetry={mockOnRetry} />);
    
    const retryButton = getByTestId('retry-button');
    fireEvent.press(retryButton);
    
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('calls navigation.goBack when no custom onRetry provided', () => {
    const { getByTestId } = render(<OfflineScreen />);
    
    const retryButton = getByTestId('retry-button');
    fireEvent.press(retryButton);
    
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('has correct accessibility label on retry button', () => {
    const { getByTestId } = render(<OfflineScreen />);
    const retryButton = getByTestId('retry-button');
    
    expect(retryButton.props.accessibilityLabel).toBe('Try again');
    expect(retryButton.props.accessibilityRole).toBe('button');
  });

  it('applies correct design system colors', () => {
    const { getByTestId } = render(<OfflineScreen />);
    const retryButton = getByTestId('retry-button');
    
    // Button should be green (#5DBB8E)
    expect(retryButton.props.style).toMatchObject(
      expect.objectContaining({ backgroundColor: '#5DBB8E' })
    );
  });
});

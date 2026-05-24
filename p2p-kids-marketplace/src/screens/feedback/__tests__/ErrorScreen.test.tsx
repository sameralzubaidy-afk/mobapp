// File: p2p-kids-marketplace/src/screens/feedback/__tests__/ErrorScreen.test.tsx
// FLOW-26 Unit Tests: ErrorScreen

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorScreen from '../ErrorScreen';

// Mock navigation
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
let mockRouteParams = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

describe('ErrorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  it('renders correctly with default params', () => {
    const { getByTestId } = render(<ErrorScreen />);
    
    expect(getByTestId('error-screen')).toBeTruthy();
    expect(getByTestId('error-icon')).toBeTruthy();
    expect(getByTestId('error-title')).toBeTruthy();
    expect(getByTestId('error-message')).toBeTruthy();
    expect(getByTestId('retry-button')).toBeTruthy();
    expect(getByTestId('go-back-link')).toBeTruthy();
  });

  it('displays default title', () => {
    const { getByTestId } = render(<ErrorScreen />);
    const title = getByTestId('error-title');
    
    expect(title.props.children).toBe('Something Went Wrong');
  });

  it('displays custom title from route params', () => {
    mockRouteParams = { title: 'Upload Failed' };
    
    const { getByTestId } = render(<ErrorScreen />);
    const title = getByTestId('error-title');
    
    expect(title.props.children).toBe('Upload Failed');
  });

  it('displays default error message', () => {
    const { getByTestId } = render(<ErrorScreen />);
    const message = getByTestId('error-message');
    
    expect(message.props.children).toBe('An error occurred. Please try again.');
  });

  it('displays custom error message from route params', () => {
    mockRouteParams = { message: 'Network connection failed' };
    
    const { getByTestId } = render(<ErrorScreen />);
    const message = getByTestId('error-message');
    
    expect(message.props.children).toBe('Network connection failed');
  });

  it('calls navigation.goBack when retry button pressed (default behavior)', () => {
    const { getByTestId } = render(<ErrorScreen />);
    const retryButton = getByTestId('retry-button');
    
    fireEvent.press(retryButton);
    
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls custom onRetry handler when provided', () => {
    const mockOnRetry = jest.fn();
    mockRouteParams = { onRetry: mockOnRetry };
    
    const { getByTestId } = render(<ErrorScreen />);
    const retryButton = getByTestId('retry-button');
    
    fireEvent.press(retryButton);
    
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('calls navigation.goBack when go back link pressed', () => {
    const { getByTestId } = render(<ErrorScreen />);
    const goBackLink = getByTestId('go-back-link');
    
    fireEvent.press(goBackLink);
    
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows go back link by default', () => {
    const { getByTestId } = render(<ErrorScreen />);
    
    expect(getByTestId('go-back-link')).toBeTruthy();
  });

  it('hides go back link when showGoBack is false', () => {
    mockRouteParams = { showGoBack: false };
    
    const { queryByTestId } = render(<ErrorScreen />);
    
    expect(queryByTestId('go-back-link')).toBeNull();
  });

  it('has correct accessibility labels', () => {
    const { getByTestId } = render(<ErrorScreen />);
    const retryButton = getByTestId('retry-button');
    const goBackLink = getByTestId('go-back-link');
    
    expect(retryButton.props.accessibilityLabel).toBe('Try again');
    expect(retryButton.props.accessibilityRole).toBe('button');
    expect(goBackLink.props.accessibilityLabel).toBe('Go back');
    expect(goBackLink.props.accessibilityRole).toBe('button');
  });

  it('has correct design system colors', () => {
    const { getByTestId } = render(<ErrorScreen />);
    const retryButton = getByTestId('retry-button');
    
    // Retry button should be green (#5DBB8E)
    expect(retryButton.props.style).toMatchObject(
      expect.objectContaining({ backgroundColor: '#5DBB8E' })
    );
  });
});

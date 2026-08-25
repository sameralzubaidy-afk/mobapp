// File: p2p-kids-marketplace/src/screens/error/__tests__/OfflineScreen.test.tsx
// FLOW-26 Unit Tests: OfflineScreen
// F03 (ACC-TC-F03): "Try Again" re-checks connectivity (NetInfo) and returns to
// the prior screen only when the connection is restored.

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import OfflineScreen from '../OfflineScreen';

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
    mockCanGoBack.mockReturnValue(true);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
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

  it('returns to the prior screen when Try Again is tapped and connectivity is restored (F03)', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    const { getByTestId, queryByTestId } = render(<OfflineScreen />);

    fireEvent.press(getByTestId('retry-button'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(NetInfo.fetch).toHaveBeenCalled();
    expect(queryByTestId('offline-retry-failed')).toBeNull();
  });

  it('stays on the offline screen and shows a message when still disconnected (F03)', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    const { getByTestId, queryByTestId } = render(<OfflineScreen />);

    fireEvent.press(getByTestId('retry-button'));

    await waitFor(() => expect(queryByTestId('offline-retry-failed')).toBeTruthy());
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(queryByTestId('offline-retry-failed')?.props.children).toBe(
      'Still offline. Check your connection and try again.'
    );
  });

  it('fails open (goes back) if the connectivity check itself throws (F03)', async () => {
    (NetInfo.fetch as jest.Mock).mockRejectedValue(new Error('native check unavailable'));
    const { getByTestId, queryByTestId } = render(<OfflineScreen />);

    fireEvent.press(getByTestId('retry-button'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(queryByTestId('offline-retry-failed')).toBeNull();
  });

  it('does not go back when canGoBack is false', async () => {
    mockCanGoBack.mockReturnValue(false);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    const { getByTestId } = render(<OfflineScreen />);

    fireEvent.press(getByTestId('retry-button'));

    // Allow the async check to resolve; no back should occur.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGoBack).not.toHaveBeenCalled();
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

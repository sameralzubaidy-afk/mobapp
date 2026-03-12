/**
 * FILE: p2p-kids-marketplace/src/components/subscription/__tests__/PaymentFailureBanner.test.tsx
 * MODULE-11 TASK SUB-018: Payment Failure Banner Unit Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaymentFailureBanner } from '../PaymentFailureBanner';
import { usePaymentFailure } from '@/hooks/usePaymentFailure';
import { useNavigation } from '@react-navigation/native';

// Mock hooks
jest.mock('@/hooks/usePaymentFailure');
jest.mock('@react-navigation/native');

const mockUsePaymentFailure = usePaymentFailure as jest.MockedFunction<typeof usePaymentFailure>;
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockNavigate = jest.fn();

describe('PaymentFailureBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigation.mockReturnValue({ navigate: mockNavigate } as any);
  });

  it('should not render when no payment failure', () => {
    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: false,
        retryCount: 0,
        failedAt: null,
        isRecentFailure: false,
        isMaxRetriesReached: false,
        message: '',
        urgencyLevel: 'low',
      },
      loading: false,
      dismissBanner: jest.fn(),
      bannerDismissed: false,
    });

    const { queryByTestId } = render(<PaymentFailureBanner />);

    expect(queryByTestId('paymentFailureBanner')).toBeNull();
  });

  it('should not render when banner is dismissed', () => {
    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: true,
        retryCount: 1,
        failedAt: new Date().toISOString(),
        isRecentFailure: true,
        isMaxRetriesReached: false,
        message: 'Payment failed',
        urgencyLevel: 'medium',
      },
      loading: false,
      dismissBanner: jest.fn(),
      bannerDismissed: true,
    });

    const { queryByTestId } = render(<PaymentFailureBanner />);

    expect(queryByTestId('paymentFailureBanner')).toBeNull();
  });

  it('should render banner with first retry message', () => {
    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: true,
        retryCount: 1,
        failedAt: new Date().toISOString(),
        isRecentFailure: true,
        isMaxRetriesReached: false,
        message: 'Your payment was declined. Please update your payment method.',
        urgencyLevel: 'medium',
      },
      loading: false,
      dismissBanner: jest.fn(),
      bannerDismissed: false,
    });

    const { getByText, getByTestId } = render(<PaymentFailureBanner />);

    expect(getByTestId('paymentFailureBanner')).toBeTruthy();
    expect(getByText('Payment Failed')).toBeTruthy();
    expect(getByText(/Your payment was declined/)).toBeTruthy();
    expect(getByText(/Retry 1 of 3/)).toBeTruthy();
  });

  it('should render high urgency banner for second retry', () => {
    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: true,
        retryCount: 2,
        failedAt: new Date().toISOString(),
        isRecentFailure: true,
        isMaxRetriesReached: false,
        message: 'Payment declined again. Your subscription is at risk.',
        urgencyLevel: 'high',
      },
      loading: false,
      dismissBanner: jest.fn(),
      bannerDismissed: false,
    });

    const { getByText } = render(<PaymentFailureBanner />);

    expect(getByText(/Payment declined again/)).toBeTruthy();
    expect(getByText(/Retry 2 of 3/)).toBeTruthy();
  });

  it('should navigate to ManageKidsClub on "Update Payment Method" press', () => {
    const mockDismissBanner = jest.fn();

    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: true,
        retryCount: 1,
        failedAt: new Date().toISOString(),
        isRecentFailure: true,
        isMaxRetriesReached: false,
        message: 'Your payment was declined',
        urgencyLevel: 'medium',
      },
      loading: false,
      dismissBanner: mockDismissBanner,
      bannerDismissed: false,
    });

    const { getByTestId } = render(<PaymentFailureBanner />);

    fireEvent.press(getByTestId('paymentFailureBanner-updatePayment'));

    expect(mockNavigate).toHaveBeenCalledWith('ManageKidsClub');
  });

  it('should call dismissBanner and onDismiss when Dismiss pressed', () => {
    const mockDismissBanner = jest.fn();
    const mockOnDismiss = jest.fn();

    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: true,
        retryCount: 1,
        failedAt: new Date().toISOString(),
        isRecentFailure: true,
        isMaxRetriesReached: false,
        message: 'Your payment was declined',
        urgencyLevel: 'medium',
      },
      loading: false,
      dismissBanner: mockDismissBanner,
      bannerDismissed: false,
    });

    const { getByTestId } = render(<PaymentFailureBanner onDismiss={mockOnDismiss} />);

    fireEvent.press(getByTestId('paymentFailureBanner-dismiss'));

    expect(mockDismissBanner).toHaveBeenCalled();
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('should render max retries message when retry count is 3', () => {
    mockUsePaymentFailure.mockReturnValue({
      failureInfo: {
        hasFailure: true,
        retryCount: 3,
        failedAt: new Date().toISOString(),
        isRecentFailure: true,
        isMaxRetriesReached: true,
        message: 'Your Kids Club+ access has been paused. Re-subscribe to restore Swap Points.',
        urgencyLevel: 'high',
      },
      loading: false,
      dismissBanner: jest.fn(),
      bannerDismissed: false,
    });

    const { getByText, queryByText } = render(<PaymentFailureBanner />);

    expect(getByText(/access has been paused/)).toBeTruthy();
    // Should NOT show retry count when max reached
    expect(queryByText(/Retry/)).toBeNull();
  });
});

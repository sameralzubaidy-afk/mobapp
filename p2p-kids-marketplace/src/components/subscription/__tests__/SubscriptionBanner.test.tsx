/**
 * Unit tests for SubscriptionBanner component
 * MODULE-11 TASK SUB-010
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SubscriptionBanner } from '../SubscriptionBanner';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigation } from '@react-navigation/native';

// Mock dependencies
jest.mock('@/hooks/useSubscription');
jest.mock('@react-navigation/native');

const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>;
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockNavigate = jest.fn();

describe('SubscriptionBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigation.mockReturnValue({ navigate: mockNavigate } as any);
  });

  it('should not render for active subscription', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'active' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { queryByText } = render(<SubscriptionBanner />);

    expect(queryByText('Kids Club+')).toBeNull();
  });

  it('should not render for cancelled subscription', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'cancelled' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { queryByText } = render(<SubscriptionBanner />);

    expect(queryByText('Kids Club+')).toBeNull();
  });

  it('should render for free user with correct message', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'free' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    expect(getByText('Kids Club+')).toBeTruthy();
    expect(getByText(/Unlock Swap Points and lower fees/)).toBeTruthy();
    expect(getByText('Start Free Trial')).toBeTruthy();
  });

  it('should render for trial user with correct message', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'trial' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    expect(getByText(/free trial of Kids Club\+/)).toBeTruthy();
    expect(getByText('Continue Kids Club+')).toBeTruthy();
  });

  it('should render for grace_period user with correct message', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'grace_period' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    expect(getByText(/Swap Points are frozen/)).toBeTruthy();
    expect(getByText('Re-subscribe')).toBeTruthy();
  });

  it('should render for expired user with correct message', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'expired' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    expect(getByText(/Kids Club\+ expired/)).toBeTruthy();
    expect(getByText('Re-subscribe')).toBeTruthy();
  });

  it('should navigate to KidsClubOverview when free user taps banner', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'free' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    fireEvent.press(getByText('Start Free Trial'));

    expect(mockNavigate).toHaveBeenCalledWith('KidsClubOverview');
  });

  it('should navigate to ContinueKidsClub when trial user taps banner', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'trial' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    fireEvent.press(getByText('Continue Kids Club+'));

    expect(mockNavigate).toHaveBeenCalledWith('ContinueKidsClub');
  });

  it('should navigate to ManageKidsClub when grace_period user taps banner', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'grace_period' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    fireEvent.press(getByText('Re-subscribe'));

    expect(mockNavigate).toHaveBeenCalledWith('ManageKidsClub');
  });

  it('should handle null subscription (default to free)', () => {
    mockUseSubscription.mockReturnValue({
      subscription: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    expect(getByText(/Unlock Swap Points/)).toBeTruthy();
    expect(getByText('Start Free Trial')).toBeTruthy();
  });
});

/**
 * Unit tests for SubscriptionBanner component
 * MODULE-11 TASK SUB-010
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SubscriptionBanner } from '../SubscriptionBanner';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigation } from '@react-navigation/native';

// Mock dependencies
jest.mock('@/hooks/useSubscription');
jest.mock('@react-navigation/native');
// Trial is admin-config-gated (QA Task 20 F-3): default OFF so the free-user CTA
// is "Join Kids Club+". Flip isTrialEnabled to true to test the trial CTA path.
jest.mock('@/services/adminConfig', () => ({
  isTrialEnabled: jest.fn().mockResolvedValue(false),
  getTrialDays: jest.fn().mockResolvedValue(30),
}));

const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>;
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockNavigate = jest.fn();

describe('SubscriptionBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the trial gate mock to OFF (clearAllMocks keeps implementations).
    const adminConfigMock = jest.requireMock('@/services/adminConfig');
    adminConfigMock.isTrialEnabled.mockResolvedValue(false);
    adminConfigMock.getTrialDays.mockResolvedValue(30);
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
    expect(getByText('Join Kids Club+')).toBeTruthy();
  });

  it('should show Start Free Trial CTA when trial_enabled=true (config flip)', async () => {
    const adminConfigMock = jest.requireMock('@/services/adminConfig');
    adminConfigMock.isTrialEnabled.mockResolvedValue(true);
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'free' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    // Hook resolves trial_enabled=true asynchronously -> trial CTA returns.
    await waitFor(() => expect(getByText('Start Free Trial')).toBeTruthy());
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

  it('should navigate to JoinKidsClub when free user taps banner', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'free' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    fireEvent.press(getByText('Join Kids Club+'));

    expect(mockNavigate).toHaveBeenCalledWith('JoinKidsClub');
  });

  it('should navigate to JoinKidsClub when trial user taps banner', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { status: 'trial' } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<SubscriptionBanner />);

    fireEvent.press(getByText('Continue Kids Club+'));

    expect(mockNavigate).toHaveBeenCalledWith('JoinKidsClub');
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
    expect(getByText('Join Kids Club+')).toBeTruthy();
  });
});

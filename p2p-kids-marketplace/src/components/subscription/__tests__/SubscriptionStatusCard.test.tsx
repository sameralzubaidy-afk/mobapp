/**
 * Unit tests for SubscriptionStatusCard component
 * MODULE-11 TASK SUB-010
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SubscriptionStatusCard } from '../SubscriptionStatusCard';

describe('SubscriptionStatusCard', () => {
  it('should render free plan message when no subscription', () => {
    const { getByText } = render(<SubscriptionStatusCard subscription={null} />);

    expect(getByText('You are on the Free plan')).toBeTruthy();
    expect(getByText(/Upgrade to Kids Club+/)).toBeTruthy();
  });

  it('should render free plan message when status is free', () => {
    const subscription = { status: 'free' } as any;
    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('You are on the Free plan')).toBeTruthy();
  });

  it('should render trial subscription correctly', () => {
    const subscription = {
      status: 'trial',
      price_cents: 499,
      trial_ends_at: '2024-12-31T23:59:59Z',
    } as any;

    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('Kids Club+')).toBeTruthy();
    expect(getByText('On 30-day free trial')).toBeTruthy();
    expect(getByText('Trial ends:')).toBeTruthy();
  });

  it('should render active subscription correctly', () => {
    const subscription = {
      status: 'active',
      price_cents: 499,
      current_period_end: '2024-12-31T23:59:59Z',
    } as any;

    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('Kids Club+')).toBeTruthy();
    expect(getByText('Kids Club+ is active')).toBeTruthy();
    expect(getByText(/\$4\.99/)).toBeTruthy();
    expect(getByText('Next billing:')).toBeTruthy();
  });

  it('should render cancelled subscription correctly', () => {
    const subscription = {
      status: 'cancelled',
      price_cents: 499,
      current_period_end: '2024-12-31T23:59:59Z',
    } as any;

    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('Kids Club+ will end soon')).toBeTruthy();
    expect(getByText('Access until:')).toBeTruthy();
  });

  it('should render grace period subscription correctly', () => {
    const subscription = {
      status: 'grace_period',
      price_cents: 499,
      subscription_expires_at: '2024-12-31T23:59:59Z',
    } as any;

    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('Grace period (SP frozen)')).toBeTruthy();
  });

  it('should render expired subscription correctly', () => {
    const subscription = {
      status: 'expired',
      price_cents: 499,
    } as any;

    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('Subscription expired')).toBeTruthy();
  });

  it('should display grace message when provided', () => {
    const subscription = {
      status: 'grace_period',
      grace_period_ends_at: '2024-12-31T23:59:59Z',
    } as any;

    const graceMessage = 'Only 5 days left to re-subscribe!';

    const { getByText } = render(
      <SubscriptionStatusCard subscription={subscription} graceMessage={graceMessage} />
    );

    expect(getByText(graceMessage)).toBeTruthy();
  });

  it('should not display grace message when not provided', () => {
    const subscription = {
      status: 'active',
      price_cents: 499,
    } as any;

    const { queryByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(queryByText(/days left/)).toBeNull();
  });

  it('should handle paused status', () => {
    const subscription = {
      status: 'paused',
      price_cents: 499,
    } as any;

    const { getByText } = render(<SubscriptionStatusCard subscription={subscription} />);

    expect(getByText('Subscription paused')).toBeTruthy();
  });
});

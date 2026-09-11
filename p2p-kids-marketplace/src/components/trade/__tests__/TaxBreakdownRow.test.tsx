// File: p2p-kids-marketplace/src/components/trade/__tests__/TaxBreakdownRow.test.tsx
// FIX-Task-16 item 5: the tax row displays the applied rate (previously the
// `taxRate`/`jurisdiction` props were accepted and silently ignored).

import React from 'react';
import { render } from '@testing-library/react-native';
import TaxBreakdownRow from '../TaxBreakdownRow';

describe('TaxBreakdownRow', () => {
  it('shows the applied rate next to the label when the rate is positive', () => {
    const { getByText, getByTestId } = render(
      <TaxBreakdownRow taxAmountCents={210} taxRate={0.0699} jurisdiction="CT" />
    );

    expect(getByText('Sales Tax (6.99%)')).toBeTruthy();
    expect(getByTestId('tax-amount').props.children).toBe('$2.10');
  });

  it('omits the rate when the rate is zero (no misleading "0.00%")', () => {
    const { getByText, queryByText } = render(<TaxBreakdownRow taxAmountCents={150} taxRate={0} />);

    expect(getByText('Sales Tax')).toBeTruthy();
    expect(queryByText('Sales Tax (0.00%)')).toBeNull();
  });

  it('omits the rate when the rate is missing (legacy rows)', () => {
    const { getByText, queryByText } = render(
      <TaxBreakdownRow taxAmountCents={150} taxRate={undefined as unknown as number} />
    );

    expect(getByText('Sales Tax')).toBeTruthy();
    expect(queryByText('Sales Tax (0.00%)')).toBeNull();
  });

  it('keeps the visible label kid-friendly and exposes the jurisdiction to assistive tech only', () => {
    const { getByTestId, queryByText } = render(
      <TaxBreakdownRow taxAmountCents={210} taxRate={0.0699} jurisdiction="CT" />
    );

    expect(queryByText('CT')).toBeNull();
    expect(getByTestId('tax-label').props.accessibilityLabel).toBe('Sales Tax, 6.99%, CT');
  });

  it('hides the row when tax is zero and not forced', () => {
    const { queryByTestId } = render(<TaxBreakdownRow taxAmountCents={0} taxRate={0.0699} />);

    expect(queryByTestId('tax-breakdown-row')).toBeNull();
  });

  it('renders the Tax Free badge for a tax-exempt item', () => {
    const { getByTestId, queryByText } = render(
      <TaxBreakdownRow taxAmountCents={0} taxRate={0} isTaxExempt />
    );

    expect(getByTestId('tax-free-badge')).toBeTruthy();
    expect(queryByText('Sales Tax')).toBeNull();
  });

  it('renders the custom label with its rate (in-progress "Estimated Sales Tax")', () => {
    const { getByText } = render(
      <TaxBreakdownRow taxAmountCents={70} taxRate={0.07} label="Estimated Sales Tax" />
    );

    expect(getByText('Estimated Sales Tax (7.00%)')).toBeTruthy();
  });
});

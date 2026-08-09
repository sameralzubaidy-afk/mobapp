/**
 * File: p2p-kids-marketplace/src/components/trade/TaxBreakdownRow.tsx
 * MODULE-15.3-PART3 TAX-011
 *
 * Reusable Order-Summary tax row.
 * - Hidden when tax = 0 AND not loading (graceful when tax is disabled).
 * - Always shown as a small row inside an existing Order Summary block.
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { formatCents } from '@/services/tax';

interface Props {
  taxAmountCents: number;
  taxRate: number;
  jurisdiction?: string | null;
  loading?: boolean;
  /** Override the auto-hide behavior - e.g. always show on historical trades. */
  alwaysShow?: boolean;
  testID?: string;
  /** TAX-REFUND-INTEGRITY (2026-07-24): Custom label. Defaults to "Sales Tax".
   *  Use "Estimated Sales Tax" for in-progress/uncaptured trades. */
  label?: string;
  /** TC-O05 (2026-08-01): item is tax-exempt (tax_exempt_goods category).
   *  When true, renders a "Tax Free" badge instead of a hidden $0 tax row. */
  isTaxExempt?: boolean;
}

export const TaxBreakdownRow: React.FC<Props> = ({
  taxAmountCents,
  taxRate,
  jurisdiction,
  loading,
  alwaysShow,
  testID = 'tax-breakdown-row',
  label = 'Sales Tax',
  isTaxExempt,
}) => {
  // TC-O05 (2026-08-01): a tax-exempt item renders a "Tax Free" badge instead of
  // hiding the row when tax is $0 — this distinguishes a true exemption from a
  // merely-disabled/zero node rate (TC-O03/TC-O04 must NOT show the badge).
  if (isTaxExempt && !loading) {
    return (
      <View style={styles.row} testID="tax-free-badge">
        <View style={styles.exemptBadge}>
          <Text style={styles.exemptBadgeText}>Tax Free</Text>
        </View>
        <Text style={styles.value}>{formatCents(0)}</Text>
      </View>
    );
  }

  if (!alwaysShow && !loading && taxAmountCents <= 0) return null;

  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" testID="tax-loading" />
      ) : (
        <Text style={styles.value} testID="tax-amount">
          {formatCents(taxAmountCents)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: { fontSize: 15, color: '#222' },
  value: { fontSize: 15, color: '#222' },
  // TC-O05 (2026-08-01): badge styling follows docx/design-system-passitup.md —
  // primary green #5DBB8E text on the light-green tint #E8F5F0, pill shape.
  exemptBadge: {
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  exemptBadgeText: {
    color: '#5DBB8E',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default TaxBreakdownRow;

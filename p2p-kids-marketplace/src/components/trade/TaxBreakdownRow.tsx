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
import { formatCents, formatTaxRate } from '@/services/tax';

interface Props {
  taxAmountCents: number;
  taxRate: number;
  jurisdiction?: string | null;
  loading?: boolean;
  /** Override the auto-hide behavior - e.g. always show on historical trades. */
  alwaysShow?: boolean;
  testID?: string;
}

export const TaxBreakdownRow: React.FC<Props> = ({
  taxAmountCents,
  taxRate,
  jurisdiction,
  loading,
  alwaysShow,
  testID = 'tax-breakdown-row',
}) => {
  if (!alwaysShow && !loading && taxAmountCents <= 0) return null;

  return (
    <View style={styles.row} testID={testID}>
      <View>
        <Text style={styles.label}>Sales Tax</Text>
        <Text style={styles.subtext}>
          {formatTaxRate(taxRate)}
          {jurisdiction ? ` · ${jurisdiction}` : ''}
        </Text>
      </View>
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
  subtext: { fontSize: 11, color: '#888', marginTop: 2 },
  value: { fontSize: 15, color: '#222' },
});

export default TaxBreakdownRow;

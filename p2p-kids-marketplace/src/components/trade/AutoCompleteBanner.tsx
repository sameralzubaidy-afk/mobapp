// File: p2p-kids-marketplace/src/components/trade/AutoCompleteBanner.tsx
// TFV2-020: Urgency-styled auto-complete warning bar (orange/amber)
// Supports buyer copy (warning) and seller copy (positive payout framing)

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Timer, WarningCircle } from 'phosphor-react-native';
import { createCountdownModel, formatCountdownLabel } from './countdown';
import type { CountdownModel } from './countdown';

type AutoCompleteBannerProps = {
  autoCompleteAt?: string | null;
  status?: string | null;
  nowMs?: number;
  testID?: string;
  isSeller?: boolean;
};

export default function AutoCompleteBanner({
  autoCompleteAt,
  status,
  nowMs,
  testID,
  isSeller = false,
}: AutoCompleteBannerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((value) => value + 1);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  let model: CountdownModel | null = null;
  if (autoCompleteAt) {
    const baseMs = Date.parse(autoCompleteAt) - 72 * 60 * 60 * 1000;
    const syntheticStart = Number.isFinite(baseMs) ? new Date(baseMs).toISOString() : autoCompleteAt;
    model = createCountdownModel(autoCompleteAt, syntheticStart, nowMs ?? Date.now());
  }

  if (status !== 'in_progress' || !autoCompleteAt || !model) {
    return null;
  }

  const isUrgent = model.minutesLeft < 240; // < 4 hours

  const title = model.expired
    ? 'Trade is ready for auto-completion'
    : isSeller
      ? `Auto-completes in ${formatCountdownLabel(model)} — payout releases then`
      : `Auto-completes in ${formatCountdownLabel(model)}`;

  const subtitle = model.expired
    ? 'Complete the trade now or contact support if there is an issue.'
    : isSeller
      ? "If the buyer doesn't confirm, the trade closes automatically and your funds are released."
      : 'If you do not complete this trade, it will auto-complete and funds will be released to the seller.';

  return (
    <View testID={testID ?? 'auto-complete-banner'} style={styles.container}>
      <View style={[styles.iconWrap, isUrgent && styles.iconWrapUrgent]}>
        {isUrgent ? (
          <WarningCircle size={18} color="#FFFFFF" weight="fill" />
        ) : (
          <Timer size={18} color="#92400E" weight="fill" />
        )}
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
  },
  iconWrapUrgent: {
    backgroundColor: '#F59E0B',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#92400E',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: '#B45309',
  },
});

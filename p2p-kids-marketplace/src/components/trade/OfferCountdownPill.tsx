// File: p2p-kids-marketplace/src/components/trade/OfferCountdownPill.tsx

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { Timer } from 'phosphor-react-native';
import { createCountdownModel, formatCountdownLabel } from './countdown';

type OfferCountdownPillProps = {
  offerExpiresAt?: string | null;
  createdAt?: string | null;
  style?: StyleProp<ViewStyle>;
  nowMs?: number;
  testID?: string;
};

export default function OfferCountdownPill({
  offerExpiresAt,
  createdAt,
  style,
  nowMs,
  testID,
}: OfferCountdownPillProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((value) => value + 1);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const safeCreatedAt = createdAt ?? new Date().toISOString();
  const model = createCountdownModel(offerExpiresAt ?? '', safeCreatedAt, nowMs ?? Date.now());

  const urgencyStyle =
    model.urgency === 'critical'
      ? styles.critical
      : model.urgency === 'warning'
        ? styles.warning
        : model.expired
          ? styles.expired
          : styles.normal;

  const iconColor =
    model.urgency === 'critical' ? '#B91C1C' : model.urgency === 'warning' ? '#B45309' : '#475569';

  return (
    <View testID={testID ?? 'offer-countdown-pill'} style={[styles.container, urgencyStyle, style]}>
      <Timer size={14} color={iconColor} weight="duotone" />
      <Text style={[styles.text, model.expired && styles.expiredText]}>{formatCountdownLabel(model)}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${model.percentLeft}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  normal: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  warning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  critical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  expired: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  expiredText: {
    color: '#64748B',
  },
  progressTrack: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#5DBB8E',
  },
});

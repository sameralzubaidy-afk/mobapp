// File: p2p-kids-marketplace/src/components/trade/AutoCompleteBanner.tsx

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Timer } from 'phosphor-react-native';
import { createCountdownModel, formatCountdownLabel } from './countdown';
import type { CountdownModel } from './countdown';

type AutoCompleteBannerProps = {
  autoCompleteAt?: string | null;
  status?: string | null;
  nowMs?: number;
  testID?: string;
};

export default function AutoCompleteBanner({
  autoCompleteAt,
  status,
  nowMs,
  testID,
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

  return (
    <View testID={testID ?? 'auto-complete-banner'} style={styles.container}>
      <View style={styles.iconWrap}>
        <Timer size={18} color="#0F766E" weight="fill" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {model.expired ? 'Trade is ready for auto-completion' : `Auto-completes in ${formatCountdownLabel(model)}`}
        </Text>
        <Text style={styles.subtitle}>
          Resolve any issue now if the handoff is incomplete.
        </Text>
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
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#134E4A',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: '#0F766E',
  },
});

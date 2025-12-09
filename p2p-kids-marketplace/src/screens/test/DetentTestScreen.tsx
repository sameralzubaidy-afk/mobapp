import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { sanitizePropsObject } from '@/utils/propSanitizer';

export default function DetentTestScreen() {
  // Example props that often trip native conversions
  const rawProps = {
    sheetAllowedDetents: 'large',
    sheetLargestUndimmedDetent: 'all',
    width: 'lg',
    height: 'sm',
    flex: 'auto',
  } as const;

  // Be defensive: ensure sanitizer exists and returns an object
  let sanitized: Record<string, any> = {};
  try {
    if (typeof sanitizePropsObject === 'function') {
      sanitized = sanitizePropsObject(rawProps as any) || {};
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Sanitizer failed or returned invalid value', err);
    sanitized = {};
  }

  return (
    <View style={styles.container} testID="detent-test-screen">
      <Text style={styles.title}>Detent / Sanitizer test</Text>

      <View style={styles.row}>
        <Text>raw.sheetAllowedDetents: </Text>
        <Text testID="raw-sheetAllowedDetents">{String(rawProps.sheetAllowedDetents)}</Text>
      </View>
      <View style={styles.row}>
        <Text>sanitized.sheetAllowedDetents: </Text>
        <Text testID="sanitized-sheetAllowedDetents">{String(sanitized.sheetAllowedDetents)}</Text>
      </View>

      <View style={styles.row}>
        <Text>raw.width: </Text>
        <Text testID="raw-width">{String(rawProps.width)}</Text>
      </View>
      <View style={styles.row}>
        <Text>sanitized.width: </Text>
        <Text testID="sanitized-width">{String(sanitized.width)}</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text testID="sanitizer-ready">Sanitizer ran</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 8 },
});

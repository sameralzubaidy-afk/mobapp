import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { getStartupStep } from '@/utils/startupDebug';

export default function StartupDebugOverlay() {
  const step = getStartupStep();
  if (!step) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.title}>Startup</Text>
        <Text numberOfLines={2} style={styles.step}>{step}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 8,
    left: 8,
    right: 8,
    alignItems: 'center',
  },
  box: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  step: {
    color: '#fff',
    fontSize: 12,
    maxWidth: 360,
  },
});

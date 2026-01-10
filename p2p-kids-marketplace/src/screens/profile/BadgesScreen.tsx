// filepath: p2p-kids-marketplace/src/screens/profile/BadgesScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BadgesScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Badges</Text>
      <Text style={styles.subtitle}>Badges module implementation in progress (Phase 1 complete: Schema & Types)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
});

export default BadgesScreen;

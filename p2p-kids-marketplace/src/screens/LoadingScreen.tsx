// File: p2p-kids-marketplace/src/screens/LoadingScreen.tsx
// FLOW-26 Screen 4/6: Loading Screen

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading…' }) => {
  return (
    <View style={styles.container} testID="loading-screen">
      <ActivityIndicator size="large" color="#5DBB8E" testID="loading-indicator" />
      <Text style={styles.loadingText} testID="loading-text">
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B6B6B',
  },
});

export default LoadingScreen;

// File: p2p-kids-marketplace/src/screens/error/OfflineScreen.tsx
// FLOW-26 Screen 1/6: Offline / No Connection

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { WifiX, ArrowCounterClockwise } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';

interface OfflineScreenProps {
  onRetry?: () => void;
}

const OfflineScreen: React.FC<OfflineScreenProps> = ({ onRetry }) => {
  const navigation = useNavigation();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    // Default behavior: go back
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="offline-screen">
      <View style={styles.content}>
        <WifiX size={64} color="#E0E0E0" testID="offline-icon" />
        
        <Text style={styles.heading} testID="offline-heading">
          No Internet Connection
        </Text>
        
        <Text style={styles.subtext} testID="offline-subtext">
          Check your connection and try again
        </Text>
        
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={handleRetry}
          testID="retry-button"
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <ArrowCounterClockwise size={18} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 16,
  },
  subtext: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    width: '100%',
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default OfflineScreen;

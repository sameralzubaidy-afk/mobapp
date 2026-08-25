// File: p2p-kids-marketplace/src/screens/error/OfflineScreen.tsx
// FLOW-26 Screen 1/6: Offline / No Connection
// F03 (ACC-TC-F03): "Try Again" re-checks connectivity (NetInfo) and returns to
// the prior screen only when the connection is restored.

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { WifiX, ArrowCounterClockwise } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';

interface OfflineScreenProps {
  onRetry?: () => void;
}

const OfflineScreen: React.FC<OfflineScreenProps> = ({ onRetry }) => {
  const navigation = useNavigation();
  const [retryFailed, setRetryFailed] = useState(false);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
      return;
    }
    void checkConnectivityAndReturn();
  };

  // F03: only leave the offline gate once connectivity is actually restored.
  const checkConnectivityAndReturn = async () => {
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected === true) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      } else {
        setRetryFailed(true);
      }
    } catch {
      // If the connectivity check itself fails, fail open and return to the
      // prior screen rather than trapping the user on the offline gate.
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
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
          accessible
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <ArrowCounterClockwise size={18} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>

        {retryFailed && (
          <Text style={styles.retryFailedText} testID="offline-retry-failed">
            Still offline. Check your connection and try again.
          </Text>
        )}
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
  retryFailedText: {
    fontSize: 14,
    color: '#E85D75',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
    paddingHorizontal: 8,
  },
});

export default OfflineScreen;

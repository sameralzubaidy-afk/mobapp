// File: p2p-kids-marketplace/src/screens/feedback/ErrorScreen.tsx
// FLOW-26 Screen 6/6: Action Failure / Error Screen

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { XCircle, ArrowCounterClockwise } from 'phosphor-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

type ErrorScreenParams = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showGoBack?: boolean;
};

type ErrorScreenRouteProp = RouteProp<{ Error: ErrorScreenParams }, 'Error'>;

const ErrorScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ErrorScreenRouteProp>();

  const {
    title = 'Something Went Wrong',
    message = 'An error occurred. Please try again.',
    onRetry,
    showGoBack = true,
  } = route.params || {};

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="error-screen">
      <View style={styles.content}>
        <XCircle size={72} color="#E85D75" weight="fill" testID="error-icon" />

        <Text style={styles.title} testID="error-title">
          {title}
        </Text>

        <Text style={styles.message} testID="error-message">
          {message}
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

        {showGoBack && (
          <TouchableOpacity
            onPress={handleGoBack}
            testID="go-back-link"
            accessible
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.goBackLink}>Go Back</Text>
          </TouchableOpacity>
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
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: 'row',
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goBackLink: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default ErrorScreen;

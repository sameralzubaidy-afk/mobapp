// File: p2p-kids-marketplace/src/components/ErrorBoundary.tsx
// PROD-P003: Global React error boundary.
//
// Wraps the app tree so a render-time exception in any screen shows a
// friendly fallback with "Try Again" instead of a blank/red screen.
// Reports the error to Sentry via errorReporter (no-op if DSN missing).

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { captureException } from '../services/errorReporter';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. Receives error + reset callback. */
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
  /** Optional hook for logging/analytics on every catch. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Always log so devs see it even without Sentry.
    console.error('[ErrorBoundary] caught', error, info.componentStack);
    try {
      captureException(error, {
        tags: { source: 'ErrorBoundary' },
        extra: { componentStack: info.componentStack },
      });
    } catch (e) {
      console.warn('[ErrorBoundary] reporter failed', e);
    }
    try {
      this.props.onError?.(error, info);
    } catch (e) {
      console.warn('[ErrorBoundary] onError hook failed', e);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback && this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }

    return (
      <View testID="error-boundary-fallback" style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.emoji}>😵</Text>
          <Text testID="error-boundary-title" style={styles.title}>
            Something went wrong
          </Text>
          <Text testID="error-boundary-subtitle" style={styles.subtitle}>
            We hit an unexpected error. You can try again, or restart the app if the problem persists.
          </Text>

          {__DEV__ && this.state.error ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>DEV details:</Text>
              <Text testID="error-boundary-dev-message" style={styles.devText}>
                {this.state.error.message}
              </Text>
            </View>
          ) : null}

          <Pressable
            testID="error-boundary-retry"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={this.reset}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  devBox: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  devLabel: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  devText: { fontSize: 12, color: '#92400E', fontFamily: 'Courier' },
  button: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

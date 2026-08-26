// File: p2p-kids-marketplace/src/screens/auth/SuspendedAccountScreen.tsx
// FLOW-01: Auth Suspended Account Screen (Redesigned)
// Design System: Prompts/re-desing/design-system.md

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { captureException } from '@/services/errorReporter';
import { Button } from '@/components/ui';
import { theme } from '@/theme';

export default function SuspendedAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      captureException(error, {
        tags: { screen: 'SuspendedAccountScreen', action: 'logout' },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.icon}>🚫</Text>
          <Text style={styles.title}>Account Suspended</Text>
          <Text style={styles.message}>
            Your account is currently suspended. Please contact our support team for help.
          </Text>

          <Button
            variant="secondary"
            size="large"
            onPress={() => navigation.navigate('ContactSupport')}
            testID="suspended-contact-support-button"
            style={styles.contactSupportButton}
          >
            Contact Support
          </Button>

          <Button
            variant="primary"
            size="large"
            onPress={handleLogout}
            testID="logout-button"
            style={styles.logoutButton}
          >
            Log Out
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColors.page,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.componentSpacing.pageMargin,
  },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.backgroundColors.card,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.level2,
  },

  icon: {
    fontSize: 42,
    marginBottom: theme.spacing.md,
  },

  title: {
    ...theme.typography.h2,
    color: theme.textColors.primary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },

  message: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },

  contactSupportButton: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },

  logoutButton: {
    width: '100%',
  },
});

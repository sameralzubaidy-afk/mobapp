// File: p2p-kids-marketplace/src/screens/auth/LandingScreen.tsx
// FLOW-01: Auth Landing Screen (Complete Rewrite)
// Design System: Prompts/re-desing/design-system.md
// Requirements: Hero section, value prop, social proof, CTA buttons

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { theme } from '@/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* Logo Section */}
          <View style={styles.hero}>
            <View style={styles.logoContainer}>
              <View style={styles.logoViewport}>
                <Image
                  source={require('../../../assets/app-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                  testID="app-logo"
                />
              </View>
              <Text style={styles.appName}>Pass It Up</Text>
            </View>

            {/* Subtitle */}
            <View style={styles.valueProposition}>
              <Text style={styles.subTagline}>
                Local community • Parent-approved • Earn rewards
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              variant="primary"
              size="large"
              onPress={() => navigation.navigate('Signup')}
              testID="landing-signup-button"
            >
              Get Started
            </Button>

            <Button
              variant="secondary"
              size="large"
              onPress={() => navigation.navigate('Login')}
              testID="landing-login-button"
            >
              Log In
            </Button>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate('TermsOfService' as any)}
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate('PrivacyPolicy' as any)}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.componentSpacing.pageMargin,
    paddingBottom: theme.spacing.xl,
  },

  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },

  hero: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },

  logoViewport: {
    width: 280,
    height: 280,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },

  logo: {
    width: 280,
    height: 280,
    transform: [{ scale: 3 }],
  },

  appName: {
    ...theme.typography.h1,
    fontSize: 32,
    color: theme.textColors.primary,
    textAlign: 'center',
  },

  valueProposition: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },

  subTagline: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  actions: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },

  footer: {
    marginTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md,
  },

  footerText: {
    ...theme.typography.caption,
    textAlign: 'center',
    color: theme.textColors.tertiary,
  },

  footerLink: {
    color: theme.textColors.secondary,
    fontWeight: '500',
  },
});

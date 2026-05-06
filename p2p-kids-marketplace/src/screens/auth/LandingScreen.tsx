// File: p2p-kids-marketplace/src/screens/auth/LandingScreen.tsx
// FLOW-01: Auth Landing Screen (Complete Rewrite)
// Design System: Prompts/re-desing/design-system.md
// Requirements: Hero section, value prop, social proof, CTA buttons

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
        {/* Hero Section */}
        <View style={styles.hero}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🤝</Text>
            <Text style={styles.appName}>Pass It Up</Text>
          </View>

          {/* Value Proposition */}
          <View style={styles.valueProposition}>
            <Text style={styles.tagline}>
              The safe marketplace for kids to buy, sell, and trade
            </Text>
            <Text style={styles.subTagline}>
              Local community • Parent-approved • Earn rewards
            </Text>
          </View>

          {/* Feature Highlights */}
          <View style={styles.features}>
            <FeatureItem emoji="🔒" title="Safe & Secure" description="Parent-verified accounts" />
            <FeatureItem emoji="💰" title="Earn Points" description="Trade and get rewarded" />
            <FeatureItem emoji="🌍" title="Local First" description="Meet nearby neighbors" />
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

// Feature Item Component
interface FeatureItemProps {
  emoji: string;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ emoji, title, description }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureEmoji}>{emoji}</Text>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDescription}>{description}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColors.page,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.componentSpacing.pageMargin,
    paddingBottom: theme.spacing.xl,
  },

  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },

  logoEmoji: {
    fontSize: 80,
    marginBottom: theme.spacing.md,
  },

  appName: {
    ...theme.typography.h1,
    color: theme.textColors.primary,
    textAlign: 'center',
  },

  valueProposition: {
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },

  tagline: {
    ...theme.typography.h3,
    color: theme.textColors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },

  subTagline: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
  },

  features: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: theme.spacing.xl,
  },

  featureItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },

  featureEmoji: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },

  featureTitle: {
    ...theme.typography.label,
    color: theme.textColors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    textTransform: 'none',
  },

  featureDescription: {
    ...theme.typography.bodySmall,
    color: theme.textColors.tertiary,
    textAlign: 'center',
  },

  actions: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },

  footer: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },

  footerText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },

  footerLink: {
    color: theme.textColors.link,
    textDecorationLine: 'underline',
  },
});

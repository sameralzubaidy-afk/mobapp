// FILE: p2p-kids-marketplace/src/components/onboarding/OnboardingScreenCard.tsx
// MODULE-18 V1 EDU-004: Single onboarding screen card component

import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import type { OnboardingScreenData } from '../../data/onboarding-screens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingScreenCardProps {
  screen: OnboardingScreenData;
  /**
   * Body override from DB (via getSectionByType)
   * Falls back to static screen.body if null
   */
  dbBody?: string | null;
}

/**
 * Single onboarding screen card
 * Displays illustration + title + body (from DB or fallback)
 * Full-screen width for carousel swipe
 */
export default function OnboardingScreenCard({
  screen,
  dbBody,
}: OnboardingScreenCardProps): React.JSX.Element {
  // Use DB content if available, otherwise fallback to static
  const body = dbBody || screen.body;
  const isWelcomeIllustration = screen.illustrationName === 'welcome.png';
  const isPointsIllustration = screen.illustrationName === 'swap-points-intro.png';
  const isSPEarningIllustration = screen.illustrationName === 'onboarding-sp-earning.png';
  const isLargeIllustration = isWelcomeIllustration || isPointsIllustration || isSPEarningIllustration;

  return (
    <View
      style={styles.card}
      accessibilityLabel={screen.a11yLabel}
      accessible={true}
      accessibilityRole="text"
    >
      {/* Illustration */}
      <View
        style={[
          styles.illustrationContainer,
          isLargeIllustration && styles.welcomeIllustrationContainer,
        ]}
      >
        <Image
          source={getIllustrationSource(screen.illustrationName)}
          style={[
            styles.illustration,
            isWelcomeIllustration && styles.welcomeIllustration,
            isPointsIllustration && styles.pointsIllustration,
            isSPEarningIllustration && styles.spEarningIllustration,
          ]}
          resizeMode="contain"
          accessible={true}
          accessibilityLabel={`${screen.title} illustration`}
        />
      </View>

      {/* Title */}
      <Text style={styles.title} accessibilityRole="header">
        {screen.title}
      </Text>

      {/* Body */}
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

/**
 * Get illustration source from asset name
 * Placeholder images until design delivers
 */
function getIllustrationSource(name: string): any {
  // Map asset names to local requires
  // TODO(DESIGN): Replace with final illustrations
  const illustrations: Record<string, any> = {
    'welcome.png': require('../../../assets/illustrations/welcome.png'),
    'swap-points-intro.png': require('../../../assets/illustrations/pionts.png'),
    'onboarding-sp-earning.png': require('../../../assets/illustrations/onboarding-sp-earning.png'),
    'spending-sp.png': require('../../assets/onboarding/spending-sp.png'),
    'safety.png': require('../../assets/onboarding/safety.png'),
  };

  return illustrations[name] || illustrations['welcome.png'];
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
  },
  illustrationContainer: {
    width: '100%',
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    overflow: 'visible',
  },
  welcomeIllustrationContainer: {
    height: 320,
    marginBottom: 40,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  welcomeIllustration: {
    transform: [{ scale: 1.5 }],
  },
  pointsIllustration: {
    transform: [{ scale: 1.2 }],
  },
  spEarningIllustration: {
    transform: [{ scale: 1.35 }],
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
});

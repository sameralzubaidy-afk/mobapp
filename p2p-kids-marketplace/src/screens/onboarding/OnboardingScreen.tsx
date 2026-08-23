// FILE: p2p-kids-marketplace/src/screens/onboarding/OnboardingScreen.tsx
// MODULE-18 V1 EDU-004: Onboarding screen container + gating logic

import React, { useContext, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import OnboardingCarousel from '../../components/onboarding/OnboardingCarousel';
import {
  markOnboardingComplete,
  markOnboardingSkipped,
  trackEducationEvent,
} from '../../services/educationAnalyticsService';
import { captureException, captureMessage } from '@/services/errorReporter';
import { AuthContext } from '../../contexts/AuthContext';

/**
 * MODULE-18 V1 EDU-004: Onboarding Screen
 *
 * Root screen for the 5-screen carousel shown on first app open
 * Handles:
 * - Analytics event tracking (onboarding_start on mount)
 * - Completion via markOnboardingComplete
 * - Skip via markOnboardingSkipped
 * - Navigation to MainTabs after either path
 *
 * Acceptance Criteria:
 * - onboarding_start event fires on first render (guarded against duplicates)
 * - Skip button calls markOnboardingSkipped → navigates to MainTabs
 * - Get Started calls markOnboardingComplete → navigates to MainTabs
 * - Subsequent app opens: shouldShowOnboarding returns false → carousel bypassed
 */
export default function OnboardingScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { session } = useContext(AuthContext);
  const userId = session?.user?.id;

  const navigateToHome = () => {
    // Replace avoids cross-stack reset warnings and prevents returning to onboarding.
    navigation.replace('Home');

    // MODULE-18 EDU-004 FIX: Flip the root-level onboarding gate so the
    // PersistentTabBar (gated on !showOnboardingCarousel in RootNavigator)
    // mounts immediately — no relaunch required. This must run on BOTH the
    // Skip and Get Started paths; previously the gate was only flipped by the
    // [currentUserId] effect on a fresh mount, so Skip left the tab bar hidden
    // until the app was force-quit and relaunched.
    route?.params?.onOnboardingFinished?.();
  };

  // Track onboarding_start exactly once per mount
  const hasTrackedStartRef = useRef(false);

  useEffect(() => {
    if (userId && !hasTrackedStartRef.current) {
      void trackEducationEvent('onboarding_start');
      hasTrackedStartRef.current = true;
    }
  }, [userId]);

  /**
   * Handle "Get Started" (onboarding complete)
   * - Set onboarding_completed_at
   * - Fire analytics event
   * - Navigate to Home
   */
  const handleComplete = async () => {
    if (!userId) {
      captureMessage('[OnboardingScreen] No userId available', 'warning');
      return;
    }

    try {
      // Mark complete in DB
      await markOnboardingComplete(userId);

      // Track analytics (fire-and-forget)
      void trackEducationEvent('onboarding_complete');

      // Navigate to Home inside authenticated stack.
      navigateToHome();
    } catch (error) {
      captureException(error, {
        tags: { screen: 'OnboardingScreen', action: 'complete' },
      });
      // Navigate anyway (don't block user)
      navigateToHome();
    }
  };

  /**
   * Handle "Skip" (onboarding skipped)
   * - Set onboarding_skipped_at
   * - Fire analytics event
   * - Navigate to Home
   */
  const handleSkip = async () => {
    if (!userId) {
      captureMessage('[OnboardingScreen] No userId available', 'warning');
      return;
    }

    try {
      // Mark skipped in DB
      await markOnboardingSkipped(userId);

      // Track analytics (fire-and-forget)
      void trackEducationEvent('onboarding_skip');

      // Navigate to Home inside authenticated stack.
      navigateToHome();
    } catch (error) {
      captureException(error, {
        tags: { screen: 'OnboardingScreen', action: 'skip' },
      });
      // Navigate anyway (don't block user)
      navigateToHome();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <OnboardingCarousel onComplete={handleComplete} onSkip={handleSkip} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

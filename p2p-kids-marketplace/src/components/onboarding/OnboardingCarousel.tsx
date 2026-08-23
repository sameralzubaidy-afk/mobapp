// FILE: p2p-kids-marketplace/src/components/onboarding/OnboardingCarousel.tsx
// MODULE-18 V1 EDU-004: 5-screen swipeable carousel with progress dots

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import OnboardingScreenCard from './OnboardingScreenCard';
import { ONBOARDING_SCREENS, ONBOARDING_SCREEN_COUNT } from '../../data/onboarding-screens';
import { getSectionByType } from '../../services/educationContentService';
import type { EducationSection } from '../../types/education';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingCarouselProps {
  /**
   * Called when user clicks "Get Started" on final screen
   */
  onComplete: () => void;

  /**
   * Called when user clicks "Skip" on any screen
   */
  onSkip: () => void;
}

/**
 * MODULE-18 V1 EDU-004: Onboarding Carousel
 *
 * Five-screen swipeable carousel with:
 * - Progress dots (filled = current; ghosted = others)
 * - Skip button on every screen
 * - "Get Started" button on final screen
 * - Swipe left/right navigation
 * - Keyboard arrow keys (web)
 * - DB content override for screens 2-5
 *
 * Acceptance Criteria:
 * - Carousel renders 5 screens
 * - Swipe left/right navigates
 * - Keyboard arrow keys work on web
 * - Progress dots update
 * - Skip button calls onSkip
 * - Final screen shows "Get Started" → calls onComplete
 * - Full a11y support
 */
export default function OnboardingCarousel({
  onComplete,
  onSkip,
}: OnboardingCarouselProps): React.JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dbSections, setDbSections] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList>(null);

  // Fetch DB content for screens 2-5 on mount
  useEffect(() => {
    async function loadDbContent() {
      try {
        const sections = await Promise.all([
          getSectionByType('sp_definition'),
          getSectionByType('sp_earning'),
          getSectionByType('sp_spending'),
          getSectionByType('safety'),
        ]);

        const sectionMap: Record<string, string> = {};
        sections.forEach((section: EducationSection | null) => {
          if (section) {
            sectionMap[section.section_type] = section.body;
          }
        });

        setDbSections(sectionMap);
      } catch (error) {
        console.warn('[OnboardingCarousel] Failed to load DB sections:', error);
        // Fallback to static content (screens already have it)
      }
    }

    void loadDbContent();
  }, []);

  // Handle scroll end to update current index
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  }, []);

  // Navigate to next screen
  const goToNext = useCallback(() => {
    if (currentIndex < ONBOARDING_SCREEN_COUNT - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [currentIndex]);

  // Navigate to previous screen
  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
    }
  }, [currentIndex]);

  // Handle keyboard navigation (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        goToNext();
      } else if (event.key === 'ArrowLeft') {
        goToPrev();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToNext, goToPrev]);

  // Render a single screen
  const renderScreen = useCallback(
    ({ item, index }: { item: (typeof ONBOARDING_SCREENS)[number]; index: number }) => {
      const dbBody = item.sectionType ? dbSections[item.sectionType] : null;
      return (
        <View testID={`onboarding-slide-${index}`}>
          <OnboardingScreenCard screen={item} dbBody={dbBody} />
        </View>
      );
    },
    [dbSections]
  );

  const isLastScreen = currentIndex === ONBOARDING_SCREEN_COUNT - 1;

  return (
    <View style={styles.container}>
      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SCREENS}
        renderItem={renderScreen}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        testID="onboarding-carousel"
      />

      {/* Progress dots */}
      <View style={styles.progressContainer} accessible={false} testID="onboarding-pagination-dots">
        {ONBOARDING_SCREENS.map((screen, index) => (
          <View
            key={screen.id}
            style={[styles.dot, index === currentIndex && styles.dotActive]}
            testID={`onboarding-dot-${index}`}
          />
        ))}
      </View>

      {/* Bottom buttons */}
      <View style={styles.buttonContainer}>
        {/* Skip button (all screens) */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          accessibilityLabel="Skip onboarding"
          accessibilityRole="button"
          testID="skip-button"
          accessible
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        {/* Get Started button (last screen only) */}
        {isLastScreen && (
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={onComplete}
            accessibilityLabel="Get Started"
            accessibilityRole="button"
            testID="onboarding-get-started-button"
            accessible
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0', // Inactive
  },
  dotActive: {
    backgroundColor: '#5DBB8E', // Active - green
    width: 24, // Elongated active dot
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  getStartedButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuthContext } from '@/contexts/AuthContext';
import { captureException } from '@/services/errorReporter';
import { CaretRight } from 'phosphor-react-native';
// TODO: Implement analytics service
// import { trackEvent } from '@/services/analytics';

const { width } = Dimensions.get('window');

const features = [
  {
    emoji: '🔍',
    title: 'Discover Items',
    description: 'Browse listings from kids in your community. Find toys, books, games, and more!',
  },
  {
    emoji: '💰',
    title: 'Earn Money',
    description: 'List items you no longer need and earn money. Learn valuable business skills!',
  },
  {
    emoji: '🤝',
    title: 'Safe Trading',
    description: 'Trade within your local node with parental guidance and moderation.',
  },
  {
    emoji: '⭐',
    title: 'Build Reputation',
    description: 'Earn points and badges by being a trusted trader in your community.',
  },
];

export default function FeatureHighlightsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId: routeUserId } = (route.params as any) || {};
  const { session } = React.useContext(AuthContext);

  // Use session user ID if available, otherwise fall back to route params
  const userId = session?.user?.id || routeUserId;

  const scrollViewRef = useRef<ScrollView | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentIndex(index);
  };

  const handleGetStarted = async () => {
    try {
      if (!userId) {
        throw new Error('User ID not available');
      }

      console.log('[ONBOARDING] Tutorials finished/skipped, navigating to Welcome screen');
      (navigation as any).navigate('Welcome', { userId });
    } catch (error) {
      captureException(error, {
        tags: { screen: 'FeatureHighlightsScreen', action: 'tutorial_navigation' },
      });
    }
  };

  const handleNext = (index: number) => {
    const nextIndex = index + 1;
    if (nextIndex >= features.length) {
      return;
    }

    scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    setCurrentIndex(nextIndex);
  };

  return (
    <SafeAreaView style={styles.container} testID="feature-highlights-screen">
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
      </View>

      {/* Feature Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        testID="feature-highlights-carousel"
      >
        {features.map((feature: (typeof features)[0], index: number) => (
          <View key={index} style={[styles.slide, { width }]} testID={`feature-slide-${index}`}>
            <View style={styles.slideContent}>
              <Text style={styles.emoji}>{feature.emoji}</Text>
              <Text style={styles.featureTitle} testID={`feature-title-${index}`}>
                {feature.title}
              </Text>
              <Text style={styles.featureDescription} testID={`feature-description-${index}`}>
                {feature.description}
              </Text>
            </View>
            {/* Pagination Dots */}
            <View
              style={styles.paginationContainer}
              testID={index === currentIndex ? 'pagination-dots' : `pagination-dots-${index}`}
            >
              {features.map((_: (typeof features)[0], dotIndex: number) => (
                <View
                  key={dotIndex}
                  style={[
                    styles.dot,
                    dotIndex === currentIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                  testID={`feature-dot-${dotIndex}`}
                />
              ))}
            </View>
            {/* Action Button */}
            accessible accessibilityRole="button"
            {index === features.length - 1 ? (
              <TouchableOpacity
                accessible
                accessibilityRole="button"
                style={styles.button}
                onPress={handleGetStarted}
                testID={
                  index === currentIndex ? 'get-started-button' : `get-started-button-${index}`
                }
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.skipContainer}>
                <TouchableOpacity
                  accessible
                  accessibilityRole="button"
                  style={styles.nextButton}
                  onPress={() => handleNext(index)}
                  testID={index === currentIndex ? 'next-button' : `next-button-${index}`}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <CaretRight size={20} color="#FFFFFF" weight="regular" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginLeft: 4,
  },
  progressActive: {
    backgroundColor: '#5DBB8E',
  },
  progressInactive: {
    backgroundColor: '#E0E0E0',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: 24,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 100,
    marginBottom: 24,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  featureDescription: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#5DBB8E',
  },
  dotInactive: {
    backgroundColor: '#E0E0E0',
  },
  button: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipContainer: {
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});

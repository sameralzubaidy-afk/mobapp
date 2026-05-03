import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { AuthContext } from '@/contexts/AuthContext';
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
  const { session, refreshSession } = React.useContext(AuthContext);

  // Use session user ID if available, otherwise fall back to route params
  const userId = session?.user?.id || routeUserId;

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
      console.error('❌ Tutorial navigation error:', error);
    }
  };

  const isLastSlide = currentIndex === features.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
      </View>

      {/* Feature Carousel */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {features.map((feature: (typeof features)[0], index: number) => (
          <View key={index} style={[styles.slide, { width }]}>
            <View style={styles.slideContent}>
              <Text style={styles.emoji}>{feature.emoji}</Text>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>

            {/* Pagination Dots */}
            <View style={styles.paginationContainer}>
              {features.map((_: (typeof features)[0], dotIndex: number) => (
                <View
                  key={dotIndex}
                  style={[styles.dot, dotIndex === index ? styles.dotActive : styles.dotInactive]}
                />
              ))}
            </View>

            {/* Action Button */}
            {index === features.length - 1 ? (
              <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.skipContainer}>
                <TouchableOpacity onPress={handleGetStarted}>
                  <Text style={styles.skipText}>Skip</Text>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#3b82f6',
  },
  progressInactive: {
    backgroundColor: '#e5e7eb',
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  featureDescription: {
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#3b82f6',
  },
  dotInactive: {
    backgroundColor: '#d1d5db',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipContainer: {
    alignItems: 'center',
    padding: 16,
  },
  skipText: {
    color: '#666',
    fontSize: 16,
  },
});

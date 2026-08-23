import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { captureException, captureMessage } from '@/services/errorReporter';
import { AuthContext } from '@/contexts/AuthContext';

export default function WelcomeScreen() {
  const _navigation = useNavigation();
  const route = useRoute();
  const { session, refreshSession } = React.useContext(AuthContext);
  const { userId: routeUserId } = (route.params as any) || {};

  // Priority: 1. Route Params, 2. Current Session
  const userId = routeUserId || session?.user?.id;

  const [loading, setLoading] = React.useState(false);

  const handleGetStarted = async () => {
    try {
      if (!userId) {
        captureMessage('[WelcomeScreen] No userId found in params or session', 'warning');
        return;
      }

      setLoading(true);
      console.log('[WelcomeScreen] 🏁 Completing onboarding for user:', userId);

      // Mark onboarding as complete in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          // Ensure profile is marked as complete too
          profile_completed: true,
        })
        .eq('user_id', userId);

      if (error) {
        captureException(error, {
          tags: { screen: 'WelcomeScreen', action: 'mark_onboarding_complete' },
        });
        throw error;
      }

      console.log('[WelcomeScreen] ✅ Onboarding marked complete in DB');

      // Safety delay for DB propagation
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log('[WelcomeScreen] 🔄 Refreshing session...');

      // Refresh session so AuthContext picks up onboarding_completed = true
      // RootNavigator will then automatically switch to the Home stack
      // Pass silent=false to show a loading spinner while switching stacks
      await refreshSession(false);

      console.log(
        '[WelcomeScreen] 🎉 Session refresh triggered. RootNavigator should switch to HomeStack.'
      );
    } catch (error: any) {
      captureException(error, {
        tags: { screen: 'WelcomeScreen', action: 'complete_onboarding' },
      });
      Alert.alert('Error', error.message || 'Failed to finish onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="welcome-screen">
      <View style={styles.content}>
        {/* Illustration */}
        <Image
          source={require('../../../assets/illustrations/welcome.png')}
          style={styles.illustration}
          resizeMode="contain"
          testID="welcome-illustration"
        />

        {/* Title */}
        <Text style={styles.title} testID="welcome-headline">
          accessible accessibilityRole="button" accessibilityLabel="Welcome get started button"
          Welcome to a safe, neighborhood marketplace built exclusively for local families.
        </Text>

        {/* Description */}
        <Text style={styles.description} testID="welcome-description">
          Join a trusted community where you can easily buy and sell pre-loved items with people you
          know and count on.
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          disabled={loading}
          testID="welcome-get-started-button"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Get Started"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    width: 240,
    height: 240,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  description: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

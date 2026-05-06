import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { AuthContext } from '@/contexts/AuthContext';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { session, refreshSession } = React.useContext(AuthContext);
  const { userId: routeUserId } = (route.params as any) || {};

  // Priority: 1. Route Params, 2. Current Session
  const userId = routeUserId || session?.user?.id;

  const [loading, setLoading] = React.useState(false);

  const handleGetStarted = async () => {
    try {
      if (!userId) {
        console.error('[WelcomeScreen] ❌ No userId found in params or session');
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
        console.error('[WelcomeScreen] ❌ Supabase update error:', error);
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
      console.error('[WelcomeScreen] ❌ Error completing onboarding:', error);
      Alert.alert('Error', error.message || 'Failed to finish onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="welcome-screen">
      <View style={styles.content}>
        {/* Logo/Illustration */}
        <Text style={styles.emoji}>🌟</Text>

        {/* Title */}
        <Text style={styles.title} testID="welcome-headline">Welcome to{'\n'}P2P Kids Marketplace</Text>

        {/* Description */}
        <Text style={styles.description} testID="welcome-description">
          A safe space for kids to trade items,{'\n'}
          learn entrepreneurship, and build{'\n'}
          their community
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity style={styles.button} onPress={handleGetStarted} disabled={loading} testID="welcome-get-started-button">
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
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
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

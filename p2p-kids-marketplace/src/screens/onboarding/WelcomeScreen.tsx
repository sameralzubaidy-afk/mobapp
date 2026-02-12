import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
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
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[WelcomeScreen] 🔄 Refreshing session...');
      
      // Refresh session so AuthContext picks up onboarding_completed = true
      // RootNavigator will then automatically switch to the Home stack
      // Pass silent=false to show a loading spinner while switching stacks
      await refreshSession(false);
      
      console.log('[WelcomeScreen] 🎉 Session refresh triggered. RootNavigator should switch to HomeStack.');
      
    } catch (error: any) {
      console.error('[WelcomeScreen] ❌ Error completing onboarding:', error);
      Alert.alert('Error', error.message || 'Failed to finish onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Illustration */}
        <Text style={styles.emoji}>🌟</Text>

        {/* Title */}
        <Text style={styles.title}>
          Welcome to{'\n'}P2P Kids Marketplace
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          A safe space for kids to trade items,{'\n'}
          learn entrepreneurship, and build{'\n'}
          their community
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

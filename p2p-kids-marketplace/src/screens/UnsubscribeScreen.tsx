/**
 * UnsubscribeScreen
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
 * TASK: Email unsubscribe flow
 *
 * Allows users to unsubscribe from email notifications using a token
 * from an unsubscribe link in an email.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../config/supabase';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

type RootStackParamList = {
  Unsubscribe: { token: string };
};

type UnsubscribeScreenRouteProp = RouteProp<RootStackParamList, 'Unsubscribe'>;
type UnsubscribeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function UnsubscribeScreen() {
  const route = useRoute<UnsubscribeScreenRouteProp>();
  const navigation = useNavigation<UnsubscribeScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const token = route.params?.token;
    if (token) {
      processUnsubscribe(token);
    } else {
      setError('Invalid unsubscribe link');
      setLoading(false);
    }
  }, [route.params?.token]);

  const processUnsubscribe = async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('process_unsubscribe', {
        p_token: token,
      });

      if (rpcError) {
        console.error('[UnsubscribeScreen] Error processing unsubscribe:', rpcError);
        setError('Failed to process unsubscribe request. The link may be invalid or expired.');
        setLoading(false);
        return;
      }

      if (data?.success) {
        setSuccess(true);
        setCategory(data.category || 'email');
      } else {
        setError(data?.error || 'Failed to unsubscribe');
      }
    } catch (err) {
      console.error('[UnsubscribeScreen] Exception:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoHome = () => {
    navigation.navigate('Home' as never);
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Unsubscribe">
        <View style={styles.content}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Processing your request...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (success) {
    return (
      <ScreenLayout variant="detail" title="Unsubscribe">
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.title} testID="success-title">
            You've Been Unsubscribed
          </Text>
          <Text style={styles.message}>
            You will no longer receive {category} email notifications.
          </Text>
          <Text style={styles.note}>
            You can manage your notification preferences anytime in the app settings.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleGoHome} testID="go-home-button">
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Unsubscribe">
      <View style={styles.content}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>✕</Text>
        </View>
        <Text style={styles.title} testID="error-title">
          Unable to Unsubscribe
        </Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleGoHome} testID="go-home-button">
          <Text style={styles.buttonText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIconText: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  note: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

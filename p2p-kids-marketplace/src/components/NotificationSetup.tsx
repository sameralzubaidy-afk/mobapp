// File: p2p-kids-marketplace/src/components/NotificationSetup.tsx
// Component to enable push notifications for the user

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '@/config/supabase';
import {
  registerForPushNotifications,
  savePushToken,
  useNotificationObserver,
  sendLocalNotification,
} from '@/services/notifications';

interface NotificationSetupProps {
  onComplete?: () => void;
  isOptional?: boolean;
}

export const NotificationSetup: React.FC<NotificationSetupProps> = ({
  onComplete,
  isOptional = false,
}) => {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser ? { id: authUser.id } : null);
    };

    getCurrentUser();
  }, []);

  // Set up notification listeners when component mounts
  useEffect(() => {
    const cleanup = useNotificationObserver();
    return cleanup;
  }, []);

  const handleEnableNotifications = async () => {
    if (!user) {
      setStatus('error');
      setErrorMessage('User not authenticated');
      return;
    }

    setLoading(true);
    setStatus('requesting');
    setErrorMessage(null);

    try {
      // Step 1: Request permissions and get push token
      const token = await registerForPushNotifications();

      if (!token) {
        setStatus('error');
        setErrorMessage(
          Platform.OS === 'web'
            ? 'Push notifications are not available on web'
            : 'Could not obtain push notification token. Make sure you granted permissions.'
        );
        setLoading(false);
        return;
      }

      // Step 2: Save token to database
      const result = await savePushToken(user.id, token);

      if (result.success) {
        setStatus('success');
        setErrorMessage(null);

        // Send a test notification
        await sendLocalNotification(
          'Notifications Enabled',
          'You will now receive real-time alerts for messages, trades, and more!',
          { type: 'test' }
        );

        // Call completion callback if provided
        if (onComplete) {
          setTimeout(onComplete, 1500);
        }
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to save notification token');
      }
    } catch (err) {
      const error = err as Error;
      setStatus('error');
      setErrorMessage(`Error: ${error.message}`);
      console.warn('⚠️ Notification setup error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🔔 Stay Connected</Text>
          <Text style={styles.subtitle}>Enable push notifications to stay updated</Text>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>You'll receive alerts for:</Text>
          <BenefitItem icon="💬" text="New messages from buyers" />
          <BenefitItem icon="🤝" text="Trade requests on your items" />
          <BenefitItem icon="📦" text="Item updates and restocks" />
          <BenefitItem icon="⭐" text="Reviews and feedback" />
          <BenefitItem icon="🎁" text="Swap Points updates" />
        </View>

        {/* Status Display */}
        {status === 'requesting' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size={32} color="#4CAF50" />
            <Text style={styles.loadingText}>Setting up notifications...</Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.successSection}>
            <Text style={styles.successText}>✅ Notifications enabled!</Text>
            <Text style={styles.successSubtext}>You're all set to receive alerts</Text>
          </View>
        )}

        {status === 'error' && errorMessage && (
          <View style={styles.errorSection}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            {!isOptional && (
              <Text style={styles.errorSubtext}>Please try again or contact support</Text>
            )}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Privacy & Permissions</Text>
          <Text style={styles.infoText}>
            • We never share your device information{'\n'}
            • You can disable notifications anytime in settings{'\n'}
            • Notifications are stored securely in our database
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.bottomSection}>
        {status !== 'success' && (
          <Button
            title={loading ? 'Setting up...' : 'Enable Notifications'}
            onPress={handleEnableNotifications}
            disabled={loading}
            color="#4CAF50"
          />
        )}

        {isOptional && status !== 'success' && (
          <Button
            title="Maybe Later"
            onPress={onComplete}
            color="#999"
            disabled={loading}
          />
        )}

        {status === 'success' && (
          <Button
            title="Continue"
            onPress={onComplete}
            color="#4CAF50"
          />
        )}
      </View>
    </SafeAreaView>
  );
};

interface BenefitItemProps {
  icon: string;
  text: string;
}

const BenefitItem: React.FC<BenefitItemProps> = ({ icon, text }) => (
  <View style={styles.benefitItem}>
    <Text style={styles.benefitIcon}>{icon}</Text>
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  benefitsSection: {
    marginBottom: 30,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 0,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  loadingSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  successSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 14,
    color: '#558B2F',
  },
  errorSection: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 12,
    color: '#D32F2F',
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#666',
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    padding: 16,
    gap: 12,
  },
});

import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { getTOSService } from '../../services/tos';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

interface TOSPolicy {
  id: string;
  title: string;
  version: string;
  content: string;
  effective_date: string;
}

export default function TermsOfServiceScreen({ navigation, route }: Props) {
  const [policy, setPolicy] = useState<TOSPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const requireAcceptance = route.params?.requireAcceptance || false;
  const onAccept = route.params?.onAccept;

  useLayoutEffect(() => {
    // Add custom back button for Android/iOS if needed, 
    // or just rely on default header if possible.
    // However, if the user sees "no back button", it might be due to 
    // the screen being presented as a modal or in a specific stack state.
    // We'll explicitly add a left button to ensure visibility.
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="tos-back-button"
        >
          <Ionicons 
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} 
            size={24} 
            color="#007AFF" 
          />
          {Platform.OS === 'ios' && <Text style={styles.backText}>Back</Text>}
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    loadPolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPolicy = async () => {
    try {
      const tosService = getTOSService();
      const currentPolicy = await tosService.getCurrentTOS();

      if (!currentPolicy) {
        Alert.alert('Error', 'Terms of Service not available');
        navigation.goBack();
        return;
      }

      setPolicy(currentPolicy);
    } catch (error) {
      console.error('Error loading TOS:', error);
      Alert.alert('Error', 'Failed to load Terms of Service');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!policy) return;

    setAccepting(true);

    try {
      const tosService = getTOSService();
      await tosService.acceptTOS(policy.id);

      if (onAccept) {
        onAccept();
      }

      if (requireAcceptance) {
        navigation.goBack();
      } else {
        Alert.alert('Success', 'You have accepted the Terms of Service');
      }
    } catch (error) {
      console.error('Error accepting TOS:', error);
      Alert.alert('Error', 'Failed to record acceptance. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Terms of Service...</Text>
      </View>
    );
  }

  if (!policy) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Terms of Service not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="tos-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        testID="tos-content-scroll"
      >
        <View style={styles.header}>
          <Text style={styles.title} testID="tos-title">
            {policy.title}
          </Text>
          <Text style={styles.version} testID="tos-version">
            Version {policy.version}
          </Text>
          <Text style={styles.effectiveDate}>
            Effective: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.content} testID="tos-content">
            {policy.content}
          </Text>
        </View>
      </ScrollView>

      {requireAcceptance && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
            testID="accept-tos-button"
          >
            {accepting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.acceptButtonText}>I Accept</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => navigation.goBack()}
            disabled={accepting}
            testID="decline-tos-button"
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 14,
    color: '#666',
  },
  contentSection: {
    marginBottom: 24,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginTop: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Platform.OS === 'ios' ? 0 : 8,
  },
  backText: {
    color: '#007AFF',
    fontSize: 17,
    marginLeft: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
    paddingBottom: 32,
  },
  acceptButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptButtonDisabled: {
    backgroundColor: '#ccc',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  declineButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

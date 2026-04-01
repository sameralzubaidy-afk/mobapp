// File: p2p-kids-marketplace/src/screens/profile/PrivacyPolicyScreen.tsx
// MODULE-13 SAFETY-011: Privacy Policy Screen
// Reuses platform_policies infrastructure from SAFETY-010

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { getPrivacyPolicyService } from '../../services/privacyPolicy';
import Markdown from 'react-native-markdown-display';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

interface PrivacyPolicy {
  id: string;
  title: string;
  version: string;
  content: string;
  effective_date: string;
}

export default function PrivacyPolicyScreen({ navigation, route }: Props) {
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const requireAcceptance = route.params?.requireAcceptance || false;
  const onAccept = route.params?.onAccept;

  useEffect(() => {
    loadPolicy();
  }, []);

  const loadPolicy = async () => {
    try {
      const privacyPolicyService = getPrivacyPolicyService();
      const currentPolicy = await privacyPolicyService.getCurrentPrivacyPolicy();

      if (!currentPolicy) {
        Alert.alert('Error', 'Privacy Policy not available');
        navigation.goBack();
        return;
      }

      setPolicy(currentPolicy);
    } catch (error) {
      console.error('Error loading Privacy Policy:', error);
      Alert.alert('Error', 'Failed to load Privacy Policy');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!policy) return;

    setAccepting(true);

    try {
      const privacyPolicyService = getPrivacyPolicyService();
      await privacyPolicyService.acceptPrivacyPolicy(policy.id);

      if (onAccept) {
        onAccept();
      }

      if (requireAcceptance) {
        navigation.goBack();
      } else {
        Alert.alert('Success', 'You have accepted the Privacy Policy');
      }
    } catch (error) {
      console.error('Error accepting Privacy Policy:', error);
      Alert.alert('Error', 'Failed to record acceptance. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer} testID="privacy-policy-loading">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Privacy Policy...</Text>
      </View>
    );
  }

  if (!policy) {
    return (
      <View style={styles.container} testID="privacy-policy-error">
        <Text style={styles.errorText}>Privacy Policy not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="privacy-policy-screen">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        testID="privacy-policy-content"
      >
        <Text style={styles.title}>{policy.title}</Text>
        <Text style={styles.version} testID="privacy-policy-version">
          Version {policy.version}
        </Text>
        {policy.effective_date && (
          <Text style={styles.effectiveDate} testID="privacy-policy-effective-date">
            Effective: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        )}

        <View style={styles.contentContainer}>
          <Markdown>{policy.content}</Markdown>
        </View>

        {requireAcceptance && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={accepting}
            testID="privacy-policy-accept-button"
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept Privacy Policy</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  contentContainer: {
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  acceptButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

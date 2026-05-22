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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { getPrivacyPolicyService } from '../../services/privacyPolicy';
import Markdown from 'react-native-markdown-display';
import { LoadingSpinner } from '@/components/ui';

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
        </View>
        <View style={styles.loadingContainer} testID="privacy-policy-loading">
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading Privacy Policy...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!policy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
        </View>
        <View style={styles.container} testID="privacy-policy-error">
          <Text style={styles.errorText}>Privacy Policy not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="privacy-policy-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="back-button"
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} testID="privacy-policy-content">
        <Text style={styles.title}>{policy.title}</Text>

        <View style={styles.metaContainer}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText} testID="privacy-policy-version">
              Version {policy.version}
            </Text>
          </View>
          {policy.effective_date && (
            <Text style={styles.effectiveDate} testID="privacy-policy-effective-date">
              Effective: {new Date(policy.effective_date).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.contentContainer}>
          <Markdown>{policy.content}</Markdown>
        </View>

        {requireAcceptance && (
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
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
    color: '#6B7280',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  versionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  effectiveDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  contentContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
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
  acceptButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

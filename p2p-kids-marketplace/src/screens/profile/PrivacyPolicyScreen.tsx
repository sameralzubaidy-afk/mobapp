// File: p2p-kids-marketplace/src/screens/profile/PrivacyPolicyScreen.tsx
// MODULE-13 SAFETY-011: Privacy Policy Screen
// Reuses platform_policies infrastructure from SAFETY-010

// MODULE-15.1 FLOW-25: Restyled — Phosphor Icons, updated typography
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
import { captureException } from '@/services/errorReporter';
import { getQaPolicyLoadFailureMode } from '@/services/devTestingService';
import { formatPolicyEffectiveDate } from '@/utils/policyDate';
import Markdown from 'react-native-markdown-display';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

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
      // ACC-TC-J07/J08 QA toggle: arm via the qa-dev-toggle deep link
      // (key=policy_failure, value=no_policy|fetch_failure) — dev-only, fail-closed.
      const qaMode = await getQaPolicyLoadFailureMode();
      if (qaMode === 'no_policy') {
        Alert.alert('Error', 'Privacy Policy not available');
        navigation.goBack();
        return;
      }
      if (qaMode === 'fetch_failure') {
        throw new Error('Simulated fetch failure (ACC-TC-J08)');
      }

      const privacyPolicyService = getPrivacyPolicyService();
      const currentPolicy = await privacyPolicyService.getCurrentPrivacyPolicy();

      if (!currentPolicy) {
        Alert.alert('Error', 'Privacy Policy not available');
        navigation.goBack();
        return;
      }

      setPolicy(currentPolicy);
    } catch (error) {
      captureException(error, {
        tags: { screen: 'PrivacyPolicyScreen', action: 'load_policy' },
      });
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
      captureException(error, {
        tags: { screen: 'PrivacyPolicyScreen', action: 'accept_policy' },
      });
      Alert.alert('Error', 'Failed to record acceptance. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Privacy Policy">
        <View style={styles.loadingContainer} testID="privacy-policy-loading">
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading Privacy Policy...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!policy) {
    return (
      <ScreenLayout variant="detail" title="Privacy Policy">
        <View style={styles.errorWrap} testID="privacy-policy-error">
          <Text style={styles.errorText}>Privacy Policy not available</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Privacy Policy">
      <ScrollView contentContainerStyle={styles.scrollContent} testID="privacy-policy-content">
        {policy.effective_date && (
          <Text style={styles.lastUpdated} testID="privacy-policy-effective-date">
            Last updated: {formatPolicyEffectiveDate(policy.effective_date)}
          </Text>
        )}

        {policy.version ? (
          <Text style={styles.versionBadge} testID="privacy-policy-version">
            Version {policy.version}
          </Text>
        ) : null}

        <View style={styles.contentContainer}>
          <Markdown style={markdownStyles}>{policy.content}</Markdown>
        </View>

        {requireAcceptance && (
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
            testID="privacy-policy-accept-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Privacy policy accept button"
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept Privacy Policy</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B6B6B',
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#E85D75',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    // BP-58: the floating pill nav overlays the stack bottom (~110pt up). The
    // in-flow Accept button is the last child, so give the scroll enough bottom
    // padding that it can scroll fully clear of the pill.
    paddingBottom: 100,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 8,
  },
  versionBadge: {
    alignSelf: 'flex-start',
    fontSize: 13,
    color: '#666666',
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  contentContainer: {
    marginBottom: 24,
  },
  acceptButton: {
    backgroundColor: '#5DBB8E',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

const markdownStyles = {
  heading1: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 24,
  },
  paragraph: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 24,
    marginBottom: 12,
  },
};

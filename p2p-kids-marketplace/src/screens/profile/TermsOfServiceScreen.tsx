// File: p2p-kids-marketplace/src/screens/profile/TermsOfServiceScreen.tsx
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
import { getTOSService } from '../../services/tos';
import { captureException } from '@/services/errorReporter';
import Markdown from 'react-native-markdown-display';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

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
      captureException(error, {
        tags: { screen: 'TermsOfServiceScreen', action: 'load_tos' },
      });
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
      captureException(error, {
        tags: { screen: 'TermsOfServiceScreen', action: 'accept_tos' },
      });
      Alert.alert('Error', 'Failed to record acceptance. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Terms of Service">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading Terms of Service...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!policy) {
    return (
      <ScreenLayout variant="detail" title="Terms of Service">
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Terms of Service not available</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Terms of Service">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        testID="tos-content-scroll"
      >
        {policy.effective_date && (
          <Text style={styles.lastUpdated}>
            Last updated: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        )}

        <View style={styles.contentContainer} testID="tos-content">
          <Markdown style={markdownStyles}>{policy.content}</Markdown>
        </View>
      </ScrollView>

      {requireAcceptance && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
            testID="accept-tos-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Accept tos button"
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
            accessible
            accessibilityRole="button"
            accessibilityLabel="Decline tos button"
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 16,
  },
  contentContainer: {
    marginBottom: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  acceptButton: {
    backgroundColor: '#5DBB8E',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  declineButtonText: {
    fontSize: 14,
    color: '#6B6B6B',
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

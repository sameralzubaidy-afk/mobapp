/**
 * File: p2p-kids-marketplace/src/components/DisclaimerModal.tsx
 * TASK SAFETY-012: Liability Disclaimer Modal for Trade Confirmation
 *
 * Modal that displays the liability disclaimer before completing a trade.
 * User must check "I understand" before they can proceed with the purchase.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';
import { LoadingSpinner } from '@/components/ui';

interface DisclaimerModalProps {
  visible: boolean;
  onAccept: (policyId: string) => void;
  onCancel: () => void;
  testID?: string;
}

interface DisclaimerPolicy {
  id: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  effective_date: string;
}

function markdownToPlainText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

export default function DisclaimerModal({
  visible,
  onAccept,
  onCancel,
  testID = 'disclaimer-modal',
}: DisclaimerModalProps) {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<DisclaimerPolicy | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchDisclaimer();
      setAccepted(false); // Reset checkbox on open
      setError(null);
    }
  }, [visible]);

  const fetchDisclaimer = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'liability_disclaimer',
      });

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        setPolicy(data[0]);
      } else {
        setError('Liability Disclaimer not available. Please contact support.');
      }
    } catch (err: any) {
      console.error('[DisclaimerModal] Error fetching disclaimer:', err);
      setError('Failed to load disclaimer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPress = () => {
    if (accepted && policy) {
      onAccept(policy.id);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
      testID={testID}
      accessibilityViewIsModal
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Liability Disclaimer
          </Text>
          <Pressable
            accessible
            accessibilityRole="button"
            onPress={onCancel}
            testID={`${testID}-close-button`}
            accessibilityLabel="Close disclaimer"
          >
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <LoadingSpinner
              fullScreen={false}
              size={40}
              color="#5DBB8E"
              testID={`${testID}-loading`}
            />

            <Text style={styles.loadingText}>Loading disclaimer...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={fetchDisclaimer}
              testID={`${testID}-retry-button`}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Retry loading disclaimer"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : !policy ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Disclaimer not available</Text>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              testID={`${testID}-scroll-view`}
            >
              <Text style={styles.subtitle}>
                Please read and acknowledge this disclaimer before completing your purchase
              </Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>Version {policy.version}</Text>
              </View>
              {policy.effective_date && (
                <Text style={styles.effectiveDate}>
                  Effective: {new Date(policy.effective_date).toLocaleDateString()}
                </Text>
              )}

              <View style={styles.contentContainer}>
                {Platform.OS === 'android' ? (
                  <Text style={styles.plainContentText}>{markdownToPlainText(policy.content)}</Text>
                ) : (
                  <Markdown>{policy.content}</Markdown>
                )}
              </View>
            </ScrollView>

            {/* Footer with checkbox and buttons */}
            <View style={styles.footer}>
              <Pressable
                accessible
                accessibilityRole="button"
                style={styles.checkbox}
                onPress={() => setAccepted(!accepted)}
                testID={`${testID}-checkbox`}
                accessibilityLabel="I have read and understand this disclaimer"
                accessibilityState={{ checked: accepted }}
              >
                <View style={[styles.checkboxInner, accepted && styles.checkboxChecked]}>
                  {accepted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>I have read and understand this disclaimer</Text>
              </Pressable>

              <View style={styles.buttonRow}>
                <Pressable
                  accessible
                  accessibilityRole="button"
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                  testID={`${testID}-cancel-button`}
                  accessibilityLabel="Cancel purchase"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  accessible
                  accessibilityRole="button"
                  style={[styles.button, styles.acceptButton, !accepted && styles.buttonDisabled]}
                  onPress={handleAcceptPress}
                  disabled={!accepted}
                  testID={`${testID}-accept-button`}
                  accessibilityLabel="Accept and continue"
                  accessibilityState={{ disabled: !accepted }}
                >
                  <Text style={[styles.acceptButtonText, !accepted && styles.buttonTextDisabled]}>
                    Accept & Continue
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    minHeight: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B6B6B',
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B6B6B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#E85D75',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    // DEV-TASK-69 (Item 4): fill the space between header and footer so the
    // footer (checkbox + Accept & Continue) is always pinned to the bottom edge
    // and never requires a scroll on smaller devices.
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 12,
    lineHeight: 20,
  },
  versionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  effectiveDate: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 16,
  },
  contentContainer: {
    marginTop: 8,
  },
  plainContentText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#5DBB8E',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#5DBB8E',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#5DBB8E',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5DBB8E',
  },
  acceptButton: {
    backgroundColor: '#5DBB8E',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
});

/**
 * File: p2p-kids-marketplace/src/screens/settings/LiabilityDisclaimerScreen.tsx
 * TASK SAFETY-012: Liability Disclaimer Viewer (from Settings)
 * MODULE-15.1 FLOW-25: Restyled — Phosphor Icons, WarningCircle, Whisk typography
 *
 * Standalone screen for viewing the current published liability disclaimer.
 * Read-only — no action buttons, scroll + back only.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CaretLeft, WarningCircle } from 'phosphor-react-native';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

interface DisclaimerPolicy {
  id: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  effective_date: string;
}

export default function LiabilityDisclaimerScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<DisclaimerPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDisclaimer();
  }, []);

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
        setError('No published liability disclaimer available.');
      }
    } catch (err: any) {
      console.error('[LiabilityDisclaimerScreen] Error fetching disclaimer:', err);
      setError('Failed to load disclaimer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Disclaimer">
        <View style={styles.loadingContainer}>
          <LoadingSpinner testID="loading-indicator" />
          <Text style={styles.loadingText}>Loading disclaimer...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error || !policy) {
    return (
      <ScreenLayout variant="detail" title="Disclaimer">
        <View style={styles.errorContainer}>
          <WarningCircle size={48} color="#F59E0B" weight="fill" />
          <Text style={styles.errorText}>{error || 'Disclaimer not available'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDisclaimer}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Disclaimer">

      <ScrollView contentContainerStyle={styles.scrollContent} testID="disclaimer-content">
        {/* Centered WarningCircle icon */}
        <View style={styles.iconContainer}>
          <WarningCircle size={48} color="#F59E0B" weight="fill" />
        </View>

        <Text style={styles.title}>{policy.title}</Text>

        {policy.effective_date && (
          <Text style={styles.lastUpdated}>
            Last updated: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        )}

        <View style={styles.contentContainer}>
          <Markdown style={markdownStyles}>{policy.content}</Markdown>
        </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B6B6B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#E85D75',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 16,
  },
  contentContainer: {
    marginTop: 8,
    marginBottom: 24,
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

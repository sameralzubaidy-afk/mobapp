/**
 * File: p2p-kids-marketplace/src/screens/settings/LiabilityDisclaimerScreen.tsx
 * TASK SAFETY-012: Liability Disclaimer Viewer (from Settings)
 * 
 * Standalone screen for viewing the current published liability disclaimer.
 * Accessible from Settings menu for user reference.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Liability Disclaimer</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" testID="loading-indicator" />
          <Text style={styles.loadingText}>Loading disclaimer...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !policy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Liability Disclaimer</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || 'Disclaimer not available'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDisclaimer}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="back-button"
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liability Disclaimer</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        testID="disclaimer-content"
      >
        <Text style={styles.title}>{policy.title}</Text>

        <View style={styles.metaContainer}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version {policy.version}</Text>
          </View>
          {policy.effective_date && (
            <Text style={styles.effectiveDate}>
              Effective: {new Date(policy.effective_date).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.contentContainer}>
          <Markdown>{policy.content}</Markdown>
        </View>

        <View style={styles.noticeContainer}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.noticeText}>
            This disclaimer is shown before every purchase to ensure all users understand
            the terms of trading on our platform.
          </Text>
        </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
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
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  noticeContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  noticeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
});

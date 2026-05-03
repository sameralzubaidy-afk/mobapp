/**
 * FILE: p2p-kids-marketplace/src/components/subscription/BillingHistoryLink.tsx
 * MODULE-11 TASK SUB-017: Billing History Link Component
 *
 * Provides a link to navigate to the BillingHistoryScreen.
 * Shows a summary of recent billing activity if available.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function BillingHistoryLink() {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('BillingHistory' as never);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Billing</Text>

      <TouchableOpacity style={styles.linkCard} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📄</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>View Billing History</Text>
          <Text style={styles.description}>See your past payments and download invoices</Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
  },
  arrow: {
    fontSize: 28,
    color: '#D1D5DB',
    marginLeft: 8,
  },
});

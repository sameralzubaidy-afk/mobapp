import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

const PLACEHOLDER_SUPPORT_EMAIL = 'admin-support@kidsmarketplace.app';

export default function SuspendedAccountScreen() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('[SuspendedAccountScreen] Logout failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🚫</Text>
        <Text style={styles.title}>Account Suspended</Text>
        <Text style={styles.message}>
          Your account is currently suspended. Please contact admin for help.
        </Text>
        <Text style={styles.supportLabel}>Support Email</Text>
        <Text style={styles.supportEmail}>{PLACEHOLDER_SUPPORT_EMAIL}</Text>

        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7FB',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  icon: {
    fontSize: 42,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 18,
  },
  supportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  supportEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 4,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

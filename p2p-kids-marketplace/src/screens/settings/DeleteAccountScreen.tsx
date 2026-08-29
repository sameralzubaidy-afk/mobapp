// File: p2p-kids-marketplace/src/screens/settings/DeleteAccountScreen.tsx
// MODULE-15.1 FLOW-25: Delete Account confirmation screen
//
// Design: Trash icon hero → heading → warning text → consequences list
// → password confirmation → red delete pill → cancel text link
//
// TODO(DELETE-ACCOUNT): Wire to a user-facing `request_account_deletion` RPC
// when it is implemented. Currently calls supabase.rpc('delete_account') stub
// and falls back to signing the user out.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Trash, X, Lock } from 'phosphor-react-native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '@/config/supabase';
import { captureException } from '@/services/errorReporter';
import ScreenLayout from '@/components/ScreenLayout';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

const CONSEQUENCES = [
  'Your profile and listings will be permanently deleted.',
  'All active trades will be cancelled and cannot be recovered.',
  'Your Swap Points balance will be forfeited.',
  'Your Kids Club+ subscription will be cancelled immediately.',
  'This action cannot be undone.',
];

export default function DeleteAccountScreen({ navigation }: any) {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!password.trim()) {
      Alert.alert('Password required', 'Please enter your password to confirm deletion.');
      return;
    }

    setLoading(true);

    // Step 1: Re-authenticate with the current user's email + supplied password.
    // This is the only way to verify the password is correct before proceeding.
    let userEmail: string | undefined;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.email) {
        Alert.alert('Error', 'Could not retrieve account information. Please sign in again.');
        setLoading(false);
        return;
      }
      userEmail = userData.user.email;

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password.trim(),
      });

      if (authError) {
        // Wrong password or auth failure
        Alert.alert('Incorrect password', 'The password you entered is wrong. Please try again.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      captureException(err, {
        tags: { screen: 'DeleteAccountScreen', action: 'reauth' },
      });
      Alert.alert('Error', 'Could not verify your password. Please try again.');
      setLoading(false);
      return;
    }

    setLoading(false);

    // Step 2: Password verified — ask for final confirmation before deleting.
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // request_account_deletion: marks profile as self-deleted,
              // freezes SP wallet, writes audit log. Defined in migration
              // 20260523000001_add_deletion_type_and_self_delete_rpc.sql
              const { error } = await supabase.rpc('request_account_deletion');
              if (error) {
                throw error;
              }
              await logout();
            } catch (err: any) {
              captureException(err, {
                tags: { screen: 'DeleteAccountScreen', action: 'delete_account' },
              });
              const errMsg =
                err?.message || (err?.code ? `Error code: ${err.code}` : 'Unknown error');
              Alert.alert(
                'Error',
                `Failed to delete account.\n${errMsg}\n\nPlease contact support.`
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenLayout variant="detail" title="Delete Account">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trash icon */}
          <View style={styles.iconContainer}>
            <Trash size={64} color="#E85D75" weight="regular" testID="delete-account-icon" />
          </View>

          {/* Heading */}
          <Text style={styles.heading} testID="delete-account-heading">
            Delete Account?
          </Text>

          {/* Warning text */}
          <Text style={styles.warningText}>
            Once deleted, your account cannot be recovered. Please read the following before
            proceeding:
          </Text>

          {/* Consequences list */}
          <View style={styles.consequencesList}>
            {CONSEQUENCES.map((item, idx) => (
              <View key={idx} style={styles.consequenceRow}>
                <X size={14} color="#E85D75" weight="bold" style={styles.consequenceIcon} />
                <Text style={styles.consequenceText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Password confirmation */}
          <View style={styles.inputContainer}>
            <Lock size={20} color="#6B6B6B" weight="regular" style={styles.inputIcon} />
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              style={styles.input}
              placeholder="Enter your password to confirm"
              placeholderTextColor="#999999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              testID="password-input"
              accessibilityLabel="Password input for account deletion"
            />
          </View>

          {/* Delete button */}
          <TouchableOpacity
            style={[styles.deleteButton, loading && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={loading}
            testID="delete-account-button"
            accessible
            accessibilityLabel="Delete account button"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete My Account</Text>
            )}
          </TouchableOpacity>

          {/* Cancel link */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
            testID="cancel-delete-button"
            accessible
            accessibilityLabel="Cancel delete button"
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  consequencesList: {
    width: '100%',
    marginBottom: 28,
    gap: 10,
  },
  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  consequenceIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  consequenceText: {
    flex: 1,
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  inputIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    height: '100%',
  },
  deleteButton: {
    width: '100%',
    backgroundColor: '#E85D75',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

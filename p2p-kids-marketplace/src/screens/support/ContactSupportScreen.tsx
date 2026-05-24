// FILE: p2p-kids-marketplace/src/screens/support/ContactSupportScreen.tsx
// MODULE-15.1 FLOW-19: Contact Support Form (Visual Redesign)

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { EnvelopeSimple, ArrowLeft } from 'phosphor-react-native';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import ScreenLayout from '@/components/ScreenLayout';

interface ContactSupportScreenProps {
  navigation: any;
}

export default function ContactSupportScreen({ navigation }: ContactSupportScreenProps) {
  const { session } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auth gate: user must be logged in to submit a support message
  if (!session) {
    return (
      <ScreenLayout variant="detail" title="Contact Support">
        <View style={styles.authGate}>
          <Text style={styles.authGateText}>
            Please log in to contact support.
          </Text>
          <Text style={styles.emailText}>
            Or email us at{' '}
            <Text style={styles.emailHighlight}>support@passitup.com</Text>
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const handleSubmit = async () => {
    // Validation
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a subject for your message.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter your message.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('support_messages')
        .insert({
          user_id: session.user.id,
          subject: subject.trim(),
          message: message.trim(),
        });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Message Sent',
        "Thank you for contacting us. We'll respond within 24 hours.",
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

      // Reset form
      setSubject('');
      setMessage('');
    } catch (error) {
      console.error('[ContactSupportScreen] Submit error:', error);
      Alert.alert('Error', 'Failed to send message. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout variant="detail" title="Contact Support">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Form Content */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          testID="form-scroll"
        >
          {/* Intro Text */}
          <Text style={styles.intro}>
            Have a question or issue? Send us a message and we'll get back to you within 24 hours.
          </Text>

          {/* Subject Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SUBJECT</Text>
            <View style={styles.inputWrapper}>
              <EnvelopeSimple size={20} color="#6B6B6B" />
              <TextInput
                style={styles.input}
                placeholder="Enter subject"
                placeholderTextColor="#999999"
                value={subject}
                onChangeText={setSubject}
                testID="subject-input"
                accessibilityLabel="Subject"
                maxLength={100}
              />
            </View>
          </View>

          {/* Message Textarea */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>MESSAGE</Text>
            <View style={styles.textareaWrapper}>
              <TextInput
                style={styles.textarea}
                placeholder="Describe your issue or question…"
                placeholderTextColor="#999999"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                testID="message-input"
                accessibilityLabel="Message"
                maxLength={1000}
              />
            </View>
            <Text style={styles.charCount}>
              {message.length} / 1000
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            testID="send-message-button"
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: submitting }}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Sending…' : 'Send Message'}
            </Text>
          </TouchableOpacity>

          {/* Email Fallback */}
          <View style={styles.emailContainer}>
            <Text style={styles.emailText}>
              Or email us at{' '}
              <Text style={styles.emailHighlight}>support@passitup.com</Text>
            </Text>
          </View>
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  intro: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textareaWrapper: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  textarea: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlignVertical: 'top',
    minHeight: 120,
  },
  charCount: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emailContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  emailText: {
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  emailHighlight: {
    color: '#5DBB8E',
    fontWeight: '500',
  },
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  authGateText: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
  },
});

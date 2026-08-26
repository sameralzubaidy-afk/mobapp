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
import { EnvelopeSimple } from 'phosphor-react-native';
import { supabase } from '@/config/supabase';
import { captureException } from '@/services/errorReporter';
import { useAuth } from '@/hooks/useAuth';
import ScreenLayout from '@/components/ScreenLayout';

interface ContactSupportScreenProps {
  navigation: any;
}

export default function ContactSupportScreen({ navigation }: ContactSupportScreenProps) {
  const { session } = useAuth();
  const isGuest = !session;
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  // HONEYPOT (guest path only): a hidden field real users never see; bots often
  // auto-fill it. If non-empty on submit we silently accept + discard (see
  // handleSubmit).
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Server-owned friendly copy when the guest rate limit is hit — the DB trigger
  // raises SQLSTATE 'GRATL' (migration 20260826000004_support_guest_rate_limit);
  // the client prefers the server message and only falls back to this constant.
  const GUEST_RATE_LIMIT_COPY =
    "You've reached the limit for support messages. Please try again later.";

  const handleSubmit = async () => {
    // HONEYPOT: checked BEFORE validation so bots that fill it never learn the
    // validation rules and never see an error — they get the same success alert
    // a real user sees, but NO row is inserted.
    if (isGuest && company.trim() !== '') {
      Alert.alert('Message Sent', "Thank you for contacting us. We'll respond within 24 hours.", [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      setSubject('');
      setMessage('');
      setContactEmail('');
      setContactPhone('');
      return;
    }

    // Validation
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a subject for your message.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter your message.');
      return;
    }
    if (isGuest) {
      const email = contactEmail.trim();
      if (!email) {
        Alert.alert('Missing Email', 'Please enter your email so we can reply.');
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
    }

    try {
      setSubmitting(true);

      // Unified support flow: authenticated rows carry user_id; guest rows carry
      // contact_email (required) + contact_phone (optional). See migration
      // 20260826000002_support_messages_anon_contact.
      const payload = isGuest
        ? {
            user_id: null,
            contact_email: contactEmail.trim(),
            contact_phone: contactPhone.trim() || null,
            subject: subject.trim(),
            message: message.trim(),
          }
        : {
            user_id: session!.user.id,
            subject: subject.trim(),
            message: message.trim(),
          };

      const { error } = await supabase.from('support_messages').insert(payload);

      if (error) {
        // Guest rate limit — the server trigger raises SQLSTATE 'GRATL' (see
        // migration 20260826000004_support_guest_rate_limit). Surface the
        // friendly server message instead of the generic error below.
        if (isGuest && error.code === 'GRATL') {
          Alert.alert('Limit Reached', error.message || GUEST_RATE_LIMIT_COPY);
          return;
        }
        throw error;
      }

      Alert.alert('Message Sent', "Thank you for contacting us. We'll respond within 24 hours.", [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

      // Reset form
      setSubject('');
      setMessage('');
    } catch (error) {
      captureException(error, {
        tags: { screen: 'ContactSupportScreen', action: 'submit' },
      });
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout variant="detail" title="Contact Support" onBack={() => navigation.goBack()}>
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

          {/* Guest reply channel — required email + optional phone (admin reply needs
              these; no raw "email us" surfaces exist anywhere in the support flow). */}
          {isGuest && (
            <>
              {/* HONEYPOT — positioned off-screen + zero opacity, invisible to real
                  users but present in the tree so automated fillers pick it up. */}
              <TextInput
                style={styles.honeypot}
                placeholder="Company (optional)"
                placeholderTextColor="transparent"
                value={company}
                onChangeText={setCompany}
                testID="company-input"
                accessibilityLabel="Company"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={100}
              />

              <View style={styles.inputGroup}>
                <Text style={styles.label}>YOUR EMAIL (SO WE CAN REPLY)</Text>
                <View style={styles.inputWrapper}>
                  <EnvelopeSimple size={20} color="#6B6B6B" />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#999999"
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    testID="contact-email-input"
                    accessibilityLabel="Your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={254}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PHONE (OPTIONAL)</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="(XXX) XXX-XXXX"
                    placeholderTextColor="#999999"
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    testID="contact-phone-input"
                    accessibilityLabel="Phone"
                    keyboardType="phone-pad"
                    maxLength={20}
                  />
                </View>
              </View>
            </>
          )}

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
            <Text style={styles.charCount}>{message.length} / 1000</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            testID="send-message-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: submitting }}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Sending…' : 'Send Message'}</Text>
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
  honeypot: {
    // Honeypot field: visually hidden (off-screen + transparent), still in the
    // tree so bots that auto-fill forms will populate it. Never affects layout.
    position: 'absolute',
    left: -10000,
    top: -10000,
    width: 1,
    height: 1,
    opacity: 0,
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
});

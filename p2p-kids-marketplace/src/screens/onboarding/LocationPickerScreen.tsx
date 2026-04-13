import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { assignNodeByZipCode, NodeAssignmentResult, incrementNodeMemberCount } from '@/services/location';
import { upsertZipWaitlist } from '@/services/waitlist';
import { trackEvent } from '@/services/analytics';

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = (route.params as any) || {};

  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<NodeAssignmentResult | null>(null);
  const [showWaitlistPopup, setShowWaitlistPopup] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Get user email for waitlist
  const getUserEmail = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) {
      throw new Error('Unable to retrieve user email');
    }
    return data.user.email;
  };

  const handleZipCodeChange = async (zip: string) => {
    setZipCode(zip);

    if (zip.length === 5) {
      try {
        const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (response.ok) {
          const data = await response.json();
          setCity(data.places[0]['place name']);
          setState(data.places[0]['state abbreviation']);
        }
      } catch (error) {
        console.error('ZIP lookup error:', error);
      }
    } else {
      setCity('');
      setState('');
    }
  };

  const handleContinue = async () => {
    if (!/^\d{5}$/.test(zipCode)) {
      Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit ZIP code');
      return;
    }

    setLoading(true);

    try {
      // NODE-003: Assign node (exact match or nearest active)
      const result = await assignNodeByZipCode(zipCode, userId);
      setAssignmentResult(result);

      console.log('✅ Node assignment result:', {
        matchType: result.matchType,
        nodeName: result.nodeName,
        distanceMiles: result.distanceMiles,
      });

      // Update user location in profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          zip_code: zipCode,
          city: result.city,
          state: result.state,
          node_id: result.nodeId,
        } as any)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // NODE-003: Increment node member count
      await incrementNodeMemberCount(result.nodeId);

      // Track analytics event
      trackEvent('onboarding_location_set', {
        user_id: userId,
        zip_code: zipCode,
        node_id: result.nodeId,
        match_type: result.matchType,
      });

      // NODE-003: If assigned to fallback node, show waitlist popup
      if (result.matchType === 'nearest') {
        console.log('⚠️ User assigned to fallback node - showing waitlist popup');
        setShowWaitlistPopup(true);
      } else {
        // Exact ZIP match - proceed to next screen
        (navigation as any).navigate('NodeSelection', {
          userId,
          nodeId: result.nodeId,
        });
      }
    } catch (error: any) {
      console.error('❌ Location picker error:', error);
      const errorMessage = error.message?.includes('not currently active')
        ? 'We are not currently active in your area. Please join the waitlist to be notified when we launch.'
        : 'Failed to set location. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // NODE-003: Handle waitlist opt-in
  const handleWaitlistOptIn = async () => {
    if (!assignmentResult) return;

    setWaitlistLoading(true);

    try {
      const email = await getUserEmail();

      // Add to waitlist
      await upsertZipWaitlist({
        userId,
        email,
        requestedZip: zipCode,
        assignedNodeId: assignmentResult.nodeId,
      });

      console.log('✅ User added to waitlist for:', zipCode);

      Alert.alert(
        'Waitlist Confirmed',
        `Thank you! We've added you to the waitlist for ${zipCode}. We'll notify you as soon as we launch in your area.\n\nIn the meantime, you can trade items with users in ${assignmentResult.nodeName}.`,
        [
          {
            text: 'Got it',
            onPress: () => {
              // Proceed to node selection with assigned node
              (navigation as any).navigate('NodeSelection', {
                userId,
                nodeId: assignmentResult.nodeId,
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Waitlist opt-in error:', error);
      Alert.alert('Error', 'Failed to join waitlist. Please try again later.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  // NODE-003: Handle skipping waitlist
  const handleSkipWaitlist = () => {
    if (!assignmentResult) return;

    setShowWaitlistPopup(false);

    // Track skip event
    trackEvent('waitlist_skipped', {
      user_id: userId,
      requested_zip: zipCode,
      assigned_node_id: assignmentResult.nodeId,
    });

    // Proceed to node selection with assigned node
    (navigation as any).navigate('NodeSelection', {
      userId,
      nodeId: assignmentResult.nodeId,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Where are you located?</Text>
        <Text style={styles.subtitle}>We'll connect you with nearby traders</Text>

        {/* ZIP Code Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>ZIP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="12345"
            value={zipCode}
            onChangeText={handleZipCodeChange}
            keyboardType="number-pad"
            maxLength={5}
            editable={!loading}
          />
          {city && state && (
            <Text style={styles.cityState}>
              📍 {city}, {state}
            </Text>
          )}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.button, (!city || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading || !city}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* NODE-003: Waitlist Popup Modal */}
      <Modal
        visible={showWaitlistPopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => handleSkipWaitlist()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>We're Coming Soon! 🎉</Text>
            <Text style={styles.modalMessage}>
              We're not quite active in {zipCode} yet, but we're coming soon! In the meantime,
              we've connected you with traders in {assignmentResult?.nodeName || 'a nearby area'}.
            </Text>

            <View style={styles.featuresList}>
              <Text style={styles.featuresTitle}>Get notified when we launch:</Text>
              <Text style={styles.featureItem}>✓ Early access to {zipCode}</Text>
              <Text style={styles.featureItem}>✓ Exclusive launch-day rewards</Text>
              <Text style={styles.featureItem}>✓ Special founder pricing</Text>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleWaitlistOptIn}
              disabled={waitlistLoading}
            >
              {waitlistLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Join Waitlist</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={handleSkipWaitlist}
              disabled={waitlistLoading}
            >
              <Text style={styles.modalButtonTextSecondary}>Continue Trading</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  content: {
    marginTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginLeft: 4,
  },
  progressActive: {
    backgroundColor: '#3b82f6',
    marginLeft: 0,
  },
  progressInactive: {
    backgroundColor: '#e5e7eb',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cityState: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // NODE-003: Waitlist Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresList: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#555',
    lineHeight: 24,
  },
  modalButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  modalButtonSecondary: {
    backgroundColor: '#e5e7eb',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});

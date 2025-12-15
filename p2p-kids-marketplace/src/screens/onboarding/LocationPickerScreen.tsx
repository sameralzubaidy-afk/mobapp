import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { assignNodeByZipCode } from '@/services/location';
// TODO: Implement analytics service
// import { trackEvent } from '@/services/analytics';

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = (route.params as any) || {};

  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Assign node based on ZIP code
      const nodeId = await assignNodeByZipCode(zipCode);

      // Update user location
      const { error } = await supabase
        .from('profiles')
        .update({
          zip_code: zipCode,
          city,
          state,
          node_id: nodeId,
        } as any) // TODO: Fix when profiles type is regenerated
        .eq('user_id', userId);

      if (error) throw error;

      // TODO: Track analytics event
      // trackEvent('onboarding_location_set', {
      //   user_id: userId,
      //   zip_code: zipCode,
      //   node_id: nodeId,
      // });

      // Navigate to node selection
      (navigation as any).navigate('NodeSelection', {
        userId,
        nodeId,
      });
    } catch (error: any) {
      console.error('Location picker error:', error);
      Alert.alert('Error', 'Failed to set location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
    </View>
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
});

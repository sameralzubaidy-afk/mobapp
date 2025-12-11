import React from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { Button as NBButton } from 'native-base';
import { trackEvent } from '@/services/analytics';

export default function HomeFeedScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Home Feed</Text>
      {/* Use valid numeric styles and native-base sizes */}
      <View style={{ width: 100, height: 20, backgroundColor: 'tomato', marginTop: 12 }} />

      <NBButton size="lg" mt={4} onPress={() => { trackEvent('home_nb_lg_pressed'); Alert.alert('Debug', 'NB lg pressed'); }} testID="nb-lg">NB lg</NBButton>

      {/* Debug repro #3: React Native ActivityIndicator with token */}
      <ActivityIndicator size={'large'} color="#3b82f6" style={{ marginTop: 12 }} />
    </View>
  );
}

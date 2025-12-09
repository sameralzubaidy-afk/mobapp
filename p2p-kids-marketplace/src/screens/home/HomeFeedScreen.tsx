import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Button as NBButton } from 'native-base';

export default function HomeFeedScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Home Feed</Text>
      {/* Debug repro #1: intentionally pass a string token into a numeric style to reproduce conversion crash */}
      <View
        testID="repro-string-to-float"
        // @ts-expect-error deliberate bad value for repro
        style={{ width: 'large', height: 20, backgroundColor: 'tomato', marginTop: 12 }}
      />

      {/* Debug repro #2: native-base token usage */}
      <NBButton size="large" mt={4} onPress={() => {}} testID="nb-large">NB large</NBButton>
      <NBButton size="lg" mt={4} onPress={() => {}} testID="nb-lg">NB lg</NBButton>

      {/* Debug repro #3: React Native ActivityIndicator with token */}
      <ActivityIndicator size={'large'} color="#3b82f6" style={{ marginTop: 12 }} />
    </View>
  );
}

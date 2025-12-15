import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function HomeFeedScreen() {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Home Feed
      </Text>

      {/* Simple action button - navigates to Signup for testing */}
      <Pressable
        style={{
          backgroundColor: '#3b82f6',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
          marginBottom: 20,
        }}
        onPress={() => (navigation as any).navigate('Signup')}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
          Press Me
        </Text>
      </Pressable>

      {/* Loading indicator */}
      <ActivityIndicator size={32} color="#3b82f6" style={{ marginVertical: 20 }} />

      <Text style={{ marginTop: 20, fontSize: 14, color: '#666', textAlign: 'center' }}>
        App is running on both iOS and Android!
      </Text>
    </View>
  );
}

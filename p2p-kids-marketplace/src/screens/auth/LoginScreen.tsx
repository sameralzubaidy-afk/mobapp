import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 16 }}>Login Screen</Text>
      <TouchableOpacity onPress={() => (navigation as any).navigate('Signup')} style={{ padding: 12, backgroundColor: '#007AFF', borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

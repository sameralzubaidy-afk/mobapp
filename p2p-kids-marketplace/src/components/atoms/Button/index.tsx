import React from 'react';
import { Pressable, Text } from 'react-native';

export default function Button({ children, onPress }: { children: React.ReactNode; onPress?: () => void; }) {
  return (
    <Pressable onPress={onPress} style={{ padding: 12, backgroundColor: '#0066FF', borderRadius: 8 }}>
      <Text style={{ color: '#fff', textAlign: 'center' }}>{children}</Text>
    </Pressable>
  );
}

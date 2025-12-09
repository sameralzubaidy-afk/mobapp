import React from 'react';
import { View, Text } from 'react-native';

export default function Badge({ text }: { text: string }) {
  return (
    <View style={{ padding: 6, backgroundColor: '#EEE', borderRadius: 8 }}>
      <Text>{text}</Text>
    </View>
  );
}

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';
// TEMPORARY: Commented out NativeBase imports until conversion issue is resolved
// import { Button as NBButton } from 'native-base';

export default function HomeFeedScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Feed</Text>
      <Text style={styles.subtitle}>Ready for development!</Text>

      {/* Safe numeric values - no token conversion issues */}
      <View style={styles.testBox} />

      {/* Using numeric size to avoid any string-to-float conversion */}
      <ActivityIndicator size={36} color="#3b82f6" style={{ marginTop: 12 }} />

      {/* Navigation helper for E2E: open the Detent test screen */}
      <Pressable
        testID="open-detent-test"
        onPress={() => navigation.navigate('DetentTest' as never)}
        style={{ marginTop: 18, backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 4 }}
      >
        <Text style={{ color: 'white' }}>Open Detent Test</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  testBox: {
    width: 100,
    height: 20,
    backgroundColor: '#3b82f6',
    marginTop: 12,
    borderRadius: 4,
  },
});

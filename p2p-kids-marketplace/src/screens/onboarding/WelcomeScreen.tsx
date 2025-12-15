import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = (route.params as any) || {};

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Illustration */}
        <Text style={styles.emoji}>🌟</Text>

        {/* Title */}
        <Text style={styles.title}>
          Welcome to{'\n'}P2P Kids Marketplace
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          A safe space for kids to trade items,{'\n'}
          learn entrepreneurship, and build{'\n'}
          their community
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => (navigation as any).navigate('LocationPicker', { userId })}
        >
          <Text style={styles.buttonText}>Get Started</Text>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

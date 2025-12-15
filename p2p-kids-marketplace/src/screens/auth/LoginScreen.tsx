import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signIn } from '@/services/supabase/auth';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 16 }}>Log In</Text>

      <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12 }}
        testID="login-email"
      />

      <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12 }}
        testID="login-password"
      />

      <TouchableOpacity
        onPress={async () => {
          setLoading(true);
          try {
            const { user, error } = await signIn({ email, password });
            if (error) {
              Alert.alert('Login failed', error.message || 'Invalid credentials');
            } else {
              (navigation as any).reset({ index: 0, routes: [{ name: 'Home' }] });
            }
          } catch (e) {
            console.error('Login error', e);
            Alert.alert('Login error', 'An unexpected error occurred');
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading || !email || !password}
        style={{ padding: 12, backgroundColor: loading || !email || !password ? '#ccc' : '#007AFF', borderRadius: 8, alignItems: 'center' }}
        testID="login-button"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Log In</Text>}
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => (navigation as any).navigate('Signup')} 
        style={{ marginTop: 12, padding: 12, alignItems: 'center' }}
        testID="signup-link"
      >
        <Text style={{ color: '#007AFF', fontSize: 14 }}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => (navigation as any).navigate('ForgotPassword')} 
        style={{ marginTop: 12, padding: 8 }}
        testID="forgot-password-link"
      >
        <Text style={{ color: '#007AFF', fontSize: 14 }}>Forgot Password?</Text>
      </TouchableOpacity>
      {__DEV__ && null}
    </View>
  );
}

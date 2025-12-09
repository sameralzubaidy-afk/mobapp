import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeFeedScreen from '@/screens/home/HomeFeedScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import DetentTestScreen from '@/screens/test/DetentTestScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerShown: false, // Disable default header to avoid potential token issues
        }}
      >
        <Stack.Screen name="Home" component={HomeFeedScreen} />
        <Stack.Screen name="DetentTest" component={DetentTestScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

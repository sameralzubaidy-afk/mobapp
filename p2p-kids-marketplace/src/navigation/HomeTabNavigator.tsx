// File: p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx
// MODULE-15.1 FLOW-16: Updated to Phosphor icons + Whisk design system
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, MagnifyingGlass } from 'phosphor-react-native';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';
import DiscoverScreen from '@/screens/home/DiscoverScreen';

const Tab = createBottomTabNavigator();

export function HomeTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#5DBB8E',
        tabBarInactiveTintColor: '#6B6B6B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarIcon: ({ focused }) => {
          const color = focused ? '#5DBB8E' : '#6B6B6B';
          const weight = focused ? 'fill' : 'regular';
          if (route.name === 'Dashboard') {
            return <House size={22} color={color} weight={weight} />;
          }
          if (route.name === 'Discover') {
            return <MagnifyingGlass size={22} color={color} weight={weight} />;
          }
          return null;
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={UserDashboardScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: 'Discover' }}
      />
    </Tab.Navigator>
  );
}

export default HomeTabNavigator;

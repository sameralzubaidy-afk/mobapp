// File: p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx
// MODULE-05-DISCOVERY-V3: Updated to use unified DiscoverScreen
// Task: DISCOVERY-V3-005 - Replace SearchScreen + BrowseItemsScreen with DiscoverScreen
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';
import DiscoverScreen from '@/screens/home/DiscoverScreen';

const Tab = createBottomTabNavigator();

// Simple icon component since we don't have icon library
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: { [key: string]: string } = {
    Dashboard: '🏠',
    Discover: '🔍',
    Messages: '💬',
    Profile: '👤',
  };

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
        height: 40,
      }}
    >
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icons[name] || '📦'}</Text>
      <Text
        style={{
          fontSize: 10,
          color: focused ? '#007AFF' : '#666',
          fontWeight: focused ? '600' : '400',
        }}
      >
        {name}
      </Text>
    </View>
  );
};

export function HomeTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontSize: 10,
              color: focused ? '#007AFF' : '#666',
              fontWeight: focused ? '600' : '400',
              marginBottom: 4,
            }}
          >
            {route.name === 'Dashboard'
              ? 'Dashboard'
              : route.name === 'Discover'
                ? 'Discover'
                : route.name}
          </Text>
        ),
        tabBarIcon: ({ focused }) => {
          const iconName =
            route.name === 'Dashboard'
              ? 'Dashboard'
              : route.name === 'Discover'
                ? 'Discover'
                : route.name;
          return <TabIcon name={iconName} focused={focused} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={UserDashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          title: 'Discover',
        }}
      />
    </Tab.Navigator>
  );
}

export default HomeTabNavigator;

// File: p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import HomeFeedScreen from '@/screens/home/HomeFeedScreen';
import BrowseItemsScreen from '@/screens/home/BrowseItemsScreen';

const Tab = createBottomTabNavigator();

// Simple icon component since we don't have icon library
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: { [key: string]: string } = {
    Feed: '🏠',
    Browse: '🔍',
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
            {route.name === 'HomeFeed'
              ? 'Feed'
              : route.name === 'BrowseItems'
              ? 'Browse'
              : route.name}
          </Text>
        ),
        tabBarIcon: ({ focused }) => {
          const iconName =
            route.name === 'HomeFeed'
              ? 'Feed'
              : route.name === 'BrowseItems'
              ? 'Browse'
              : route.name;
          return <TabIcon name={iconName} focused={focused} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeFeed"
        component={HomeFeedScreen}
        options={{
          title: 'Feed',
        }}
      />
      <Tab.Screen
        name="BrowseItems"
        component={BrowseItemsScreen}
        options={{
          title: 'Browse',
        }}
      />
    </Tab.Navigator>
  );
}

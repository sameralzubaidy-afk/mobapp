import React from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import RecommendationsCarousel from '../../components/organisms/RecommendationsCarousel';
import BottomNavBar from '../../components/organisms/BottomNavBar';

export default function HomeFeedScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
              Home Feed
            </Text>

            {/* DISCOVERY-V2-002: Personalized Recommendations */}
            <RecommendationsCarousel limit={10} />

            {/* Navigation Buttons */}
            <View style={{ marginTop: 20 }}>
              {/* Navigate to Profile */}
              <Pressable
                style={{
                  backgroundColor: '#3b82f6',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
                onPress={() => (navigation as any).navigate('Profile')}
              >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                  View Profile
                </Text>
              </Pressable>

              {/* Navigate to ProfileSetup for testing */}
              <Pressable
                style={{
                  backgroundColor: '#10b981',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginBottom: 20,
                }}
                onPress={() => (navigation as any).navigate('ProfileSetup')}
              >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                  Setup Profile (Test)
                </Text>
              </Pressable>
            </View>

            {/* Loading indicator */}
            <ActivityIndicator size={32} color="#3b82f6" style={{ marginVertical: 20 }} />

            <Text style={{ marginTop: 20, fontSize: 14, color: '#666', textAlign: 'center' }}>
              App is running on both iOS and Android!
            </Text>
          </View>
        </ScrollView>
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}

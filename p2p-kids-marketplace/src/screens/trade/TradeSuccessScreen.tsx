/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeSuccessScreen.tsx
 * TASK TRADE-V2-002: Initiate Trade with Subscription & SP Context
 * 
 * Success screen after trade initiation
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';

type TradeSuccessRouteProp = RouteProp<RootStackParamList, 'TradeSuccess'>;

export default function TradeSuccessScreen() {
  const route = useRoute<TradeSuccessRouteProp>();
  const navigation = useNavigation<any>();
  const { tradeId } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>Trade Initiated!</Text>
        <Text style={styles.message}>
          Your trade request has been sent. You can track the status in your trades list.
        </Text>
        <Text style={styles.tradeId}>Trade ID: {tradeId}</Text>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  tradeId: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

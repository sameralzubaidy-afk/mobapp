import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function RecentTradeCard({ navigation }: any) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [trade, setTrade] = useState<any | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchRecentTrade();

      // Subscribe to realtime updates for trades for this user so the card updates in real time
      const channel = supabase.channel(`recent-trade-${userId}`);

      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'trades',
            filter: `buyer_id=eq.${userId}`,
          },
          (payload: any) => {
            fetchRecentTrade();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'trades',
            filter: `seller_id=eq.${userId}`,
          },
          (payload: any) => {
            fetchRecentTrade();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [userId])
  );

  const fetchRecentTrade = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('id, status, created_at, listing:items(title, price)')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setTrade(data as any);
    } catch (err) {
      console.warn('[RecentTradeCard] error', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!trade) return null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.title}>{trade.listing?.title || 'Recent Trade'}</Text>
          <Text style={styles.subtitle}>{trade.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('TradeTimeline', { tradeId: trade.id })}
        >
          <Text style={styles.buttonText}>View Timeline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
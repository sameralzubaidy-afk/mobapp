import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Pressable, Image } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import { Ionicons } from '@expo/vector-icons';

export default function TradeListScreen({ navigation }: any) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchTrades();
    }, [userId])
  );

  const fetchTrades = async () => {
    console.log('[TradeList] userId:', userId);
    if (!userId) {
      console.warn('[TradeList] No userId, skipping fetch');
      setTrades([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('id, status, created_at, listing:items(title, price, images:item_images(id, url, thumbnail_url, display_order))')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      console.log('[TradeList] Query results:', data);
      if (error) throw error;
      setTrades(data || []);
    } catch (err) {
      console.warn('[TradeList] fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('TradeDetail', { tradeId: item.id })}>
      <View style={styles.tradeImageContainer}>
        {Array.isArray(item.listing?.images) && item.listing.images.length > 0 ? (
          <Image
            source={{ uri: item.listing.images[0].thumbnail_url || item.listing.images[0].url }}
            style={styles.tradeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.tradeImagePlaceholder}>
            <Text style={styles.tradeImagePlaceholderText}>📷</Text>
          </View>
        )}
      </View>
      <View style={styles.itemLeft}>
        <Text style={styles.title}>{item.listing?.title || 'Untitled'}</Text>
        <Text style={styles.subtitle}>{item.status.replace('_', ' ').toUpperCase()}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </Pressable>
        <Text style={styles.navTitle}>My Trades</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {trades.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trades found yet.</Text>
          </View>
        ) : (
          <FlatList data={trades} keyExtractor={(t) => t.id} renderItem={renderItem} />
        )}
      </View>
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 24, borderRadius: 12, backgroundColor: '#fff' },
  emptyText: { color: '#6B7280', textAlign: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  tradeImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginRight: 12,
  },
  tradeImage: {
    width: '100%',
    height: '100%',
  },
  tradeImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeImagePlaceholderText: {
    fontSize: 18,
  },
  itemLeft: { flex: 1 },
  title: { fontWeight: '600', fontSize: 16 },
  subtitle: { color: '#6B7280', marginTop: 4 },
  chev: { color: '#9CA3AF', fontSize: 20 },
});
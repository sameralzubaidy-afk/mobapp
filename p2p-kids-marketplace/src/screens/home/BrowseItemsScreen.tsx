// File: p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  SafeAreaView,
  RefreshControl,
  Switch,
} from 'react-native';
import { useUserStore } from '@/stores/userStore';
import { getItems, getCategories } from '@/services/items';
import { supabase } from '@/config/supabase';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<any>;

interface Item {
  id: string;
  title: string;
  description: string;
  price: number;
  category_id: string;
  condition: string;
  status: string;
  accepts_swap_points: boolean;
  created_at: string;
  seller_id: string;
  seller_node_id?: string;
  seller_node_name?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

export default function BrowseItemsScreen() {
  const { user, setUser } = useUserStore();
  const navigation = useNavigation<NavigationProp>();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load user from auth if not in store
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        // If user not in store, fetch from profiles table
        if (!user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .single();

          if (profileError) {
            console.error('Error loading profile:', profileError);
            setError('Failed to load user profile');
            setLoading(false);
            return;
          }

          if (profile && profile.node_id) {
            // Fetch node data separately
            const { data: nodeData } = await supabase
              .from('geographic_nodes')
              .select('id, name, city, state, latitude, longitude')
              .eq('id', profile.node_id)
              .single();

            // Map database fields to store format
            const userData = {
              id: profile.user_id,
              email: profile.email || authUser.email || '',
              name: profile.name || '',
              avatar_url: profile.avatar_url || '',
              node_id: profile.node_id,
              node: nodeData || undefined,
            };
            setUser(userData);
          } else if (profile) {
            // Profile exists but no node assigned
            const userData = {
              id: profile.user_id,
              email: profile.email || authUser.email || '',
              name: profile.name || '',
              avatar_url: profile.avatar_url || '',
              node_id: profile.node_id,
              node: undefined,
            };
            setUser(userData);
          }
        }

        setError(null);
      } catch (err) {
        console.error('Error in loadUser:', err);
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [user?.id, setUser]);

  // Fetch categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch items when filters or user data changes
  useEffect(() => {
    loadItems();
  }, [showAllNodes, selectedCategory, user?.node_id]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current auth user as fallback
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        setError('Not authenticated');
        setItems([]);
        setLoading(false);
        return;
      }

      // Use store user if available, otherwise need to fetch profile first
      const userId = user?.id || authUser.id;
      const nodeId = user?.node_id;

      if (!nodeId && !showAllNodes) {
        // If no node assigned and trying to show local items, show message
        setError('Your node is not assigned yet');
        setItems([]);
        setLoading(false);
        return;
      }

      const filters = {
        node_id: showAllNodes ? undefined : nodeId,
        category_id: selectedCategory || undefined,
      };

      const fetchedItems = await getItems(filters, userId);
      setItems(fetchedItems);
      setError(null);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const renderItemCard = ({ item }: { item: Item }) => {
    const isOtherNode = showAllNodes && item.seller_node_id !== user?.node_id;

    return (
      <TouchableOpacity
        style={{
          flex: 1,
          margin: 8,
          backgroundColor: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }}
      >
        {/* Image */}
        <View
          style={{
            width: '100%',
            height: 150,
            backgroundColor: '#f0f0f0',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#999', fontSize: 12 }}>📷 No Image</Text>
        </View>

        {/* Content */}
        <View style={{ padding: 12 }}>
          {/* Badges */}
          <View style={{ flexDirection: 'row', marginBottom: 8, gap: 6 }}>
            {isOtherNode && (
              <View
                style={{
                  backgroundColor: '#ffd700',
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: '#333', fontWeight: '600' }}>
                  Other Node
                </Text>
              </View>
            )}
            {item.accepts_swap_points && (
              <View
                style={{
                  backgroundColor: '#e8f5e9',
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: '#2e7d32', fontWeight: '600' }}>
                  ⚡ SP Eligible
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: '#333',
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          {/* Price */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#007AFF',
              marginBottom: 4,
            }}
          >
            ${item.price.toFixed(2)}
          </Text>

          {/* Node Name (if cross-node) */}
          {isOtherNode && (
            <Text style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
              📍 {item.seller_node_name || 'Unknown Node'}
            </Text>
          )}

          {/* Condition */}
          <Text style={{ fontSize: 11, color: '#999' }}>
            {item.condition ? item.condition.charAt(0).toUpperCase() + item.condition.slice(1) : 'Good'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>
        No Items Found
      </Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 20 }}>
        {showAllNodes
          ? 'No items available in nearby nodes'
          : 'No items in your node yet. Try expanding your search!'}
      </Text>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 12 }}>
          Browse Items
        </Text>

        {/* Node Filter Toggle */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f0f0f0',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: '#666', fontWeight: '600' }}>
              {showAllNodes 
                ? 'All Nodes' 
                : user?.node?.name 
                  ? `My Node: ${user.node.name}, ${user.node.city || 'City'}, ${user.node.state || 'State'}`
                  : 'My Node: Loading...'}
            </Text>
          </View>
          <Switch
            value={showAllNodes}
            onValueChange={setShowAllNodes}
            trackColor={{ false: '#ddd', true: '#81c784' }}
            thumbColor={showAllNodes ? '#4caf50' : '#f1f1f1'}
          />
        </View>

        {/* Category Filter */}
        {categories.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 8 }}>
              Categories
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: selectedCategory === null ? '#007AFF' : '#e0e0e0',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: selectedCategory === null ? '#fff' : '#333',
                    fontWeight: '600',
                  }}
                >
                  All
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: selectedCategory === cat.id ? '#007AFF' : '#e0e0e0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: selectedCategory === cat.id ? '#fff' : '#333',
                      fontWeight: '600',
                    }}
                  >
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={{ backgroundColor: '#ffebee', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#c62828', fontSize: 12 }}>Error: {error}</Text>
        </View>
      )}

      {/* Items Grid */}
      {items.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={items}
          renderItem={renderItemCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 4 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Quick Links Navigation Bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 1,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          style={{ alignItems: 'center' }}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>🏠</Text>
          <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignItems: 'center' }}
          onPress={() => navigation.navigate('BrowseItems')}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>🛍️</Text>
          <Text style={{ fontSize: 11, color: '#007AFF', fontWeight: '600' }}>Browse</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignItems: 'center' }}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>👤</Text>
          <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignItems: 'center' }}
          onPress={() => alert('Messages - coming soon')}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>💬</Text>
          <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Messages</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

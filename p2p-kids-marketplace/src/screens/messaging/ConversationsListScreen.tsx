/**
 * File: p2p-kids-marketplace/src/screens/messaging/ConversationsListScreen.tsx
 * MODULE-07 MSG-002: Conversations List Screen
 * 
 * Features:
 * - Display all active chats for the user
 * - Show last message preview
 * - Show unread count badge
 * - Navigate to chat screen on tap
 * - Real-time updates when new messages arrive
 * - Pull-to-refresh
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '@/contexts/AuthContext';
import { getConversations, markAsRead, Conversation } from '@/services/chat';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import Avatar from '@/components/atoms/Avatar';
import BottomNavBar from '@/components/organisms/BottomNavBar';

export default function ConversationsListScreen() {
  const navigation = useNavigation<any>();
  const { session } = useContext(AuthContext);
  const userId = session?.user?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelRef = React.useRef<RealtimeChannel | null>(null);

  // Load conversations on mount and when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('[ConversationsListScreen] Screen focused, loading conversations');
      loadConversations();
    }, [userId])
  );

  // Subscribe to real-time updates for new messages across all trades
  useEffect(() => {
    if (!userId) return;

    console.log('[ConversationsListScreen] Setting up real-time subscription for userId:', userId);

    // Subscribe to all message inserts
    channelRef.current = supabase
      .channel('conversations:all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[ConversationsListScreen] New message received, refreshing list');
          // When a new message arrives, refresh the conversations list
          loadConversations();
        }
      )
      .subscribe((status) => {
        console.log('[ConversationsListScreen] Subscription status:', status);
      });

    return () => {
      console.log('[ConversationsListScreen] Unmounting, unsubscribing');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [userId]);

  const loadConversations = async () => {
    if (!userId) {
      console.error('[ConversationsListScreen] No userId available');
      setLoading(false);
      return;
    }

    try {
      const convos = await getConversations(userId);
      console.log('[ConversationsListScreen] Loaded', convos.length, 'conversations');
      setConversations(convos);
    } catch (error) {
      console.error('[ConversationsListScreen] Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const handleConversationPress = async (conversation: Conversation) => {
    console.log('[ConversationsListScreen] Opening chat for trade:', conversation.trade_id);
    
    // Mark as read when opening the conversation
    if (userId) {
      try {
        await markAsRead(conversation.trade_id, userId);
        console.log('[ConversationsListScreen] Marked trade', conversation.trade_id, 'as read');
      } catch (error) {
        console.warn('[ConversationsListScreen] Failed to mark as read:', error);
      }
    }

    // Navigate to chat screen for this conversation
    navigation.navigate('Chat', { tradeId: conversation.trade_id });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderConversationCard = ({ item }: { item: Conversation }) => {
    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            imageUrl={item.other_user_avatar_url || undefined}
            name={item.other_user_name}
            size={50}
            verificationStatus={item.other_user_verification_status}
          />
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread_count > 9 ? '9+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.other_user_name}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.last_message_time)}</Text>
          </View>

          <Text style={styles.listingTitle} numberOfLines={1}>
            {item.listing_title} • ${item.listing_price.toFixed(2)}
          </Text>

          <Text
            style={[
              styles.lastMessage,
              item.unread_count > 0 && styles.lastMessageUnread,
            ]}
            numberOfLines={2}
          >
            {item.last_message_content}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No Messages Yet</Text>
          <Text style={styles.emptyText}>
            Start a trade and chat with other users!
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('BrowseItems')}
          >
            <Text style={styles.browseButtonText}>Browse Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
            />
          }
        />
      )}
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  browseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  listingTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  lastMessageUnread: {
    color: '#374151',
    fontWeight: '500',
  },
});

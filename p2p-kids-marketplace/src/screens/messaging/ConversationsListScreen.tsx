/**
 * File: p2p-kids-marketplace/src/screens/messaging/ConversationsListScreen.tsx
 * MODULE-07 MSG-002 + MODULE-15.1 FLOW-14: Conversations List Screen
 *
 * Features:
 * - Display all active chats for the user
 * - Show last message preview
 * - Show unread count badge
 * - Navigate to chat screen on tap
 * - Real-time updates when new messages arrive
 * - Pull-to-refresh
 * 
 * MODULE-15.1 FLOW-14 UI REDESIGN:
 * - Whisk-inspired design system (#5DBB8E green)
 * - Pill-shaped search bar with MagnifyingGlass Phosphor icon
 * - Green unread badge (20px circle, white count text)
 * - Trade context chip with ArrowsLeftRight icon + thumbnail
 * - Empty state with ChatCircleSlash Phosphor icon
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '@/contexts/AuthContext';
import { getConversations, markAsRead, Conversation } from '@/services/chat';
import { MagnifyingGlass, ChatCircleSlash, ArrowsLeftRight, ShieldCheck } from 'phosphor-react-native';
import { supabase } from '@/config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import Avatar from '@/components/atoms/Avatar';
import ScreenLayout from '@/components/ScreenLayout';

export default function ConversationsListScreen() {
  const navigation = useNavigation<any>();
  const { session } = useContext(AuthContext);
  const userId = session?.user?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const channelRef = React.useRef<RealtimeChannel | null>(null);

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.other_user_name.toLowerCase().includes(query) ||
      conv.listing_title.toLowerCase().includes(query) ||
      conv.last_message_content?.toLowerCase().includes(query)
    );
  });

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
        (_payload: unknown) => {
          console.log('[ConversationsListScreen] New message received, refreshing list');
          // When a new message arrives, refresh the conversations list
          loadConversations();
        }
      )
      .subscribe((status: string) => {
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
        testID={`conversation-${item.id}`}
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            imageUrl={item.other_user_avatar_url || undefined}
            name={item.other_user_name}
            size={48}
            verificationStatus={item.other_user_verification_status}
          />
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge} testID="unread-badge">
              <Text style={styles.unreadText}>
                {item.unread_count > 9 ? '9+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.other_user_name}
              </Text>
              {item.other_user_verification_status === 'approved' && (
                <ShieldCheck size={14} color="#5DBB8E" weight="fill" testID="verified-badge" />
              )}
            </View>
            <Text style={styles.timestamp}>{formatTimestamp(item.last_message_time)}</Text>
          </View>

          {/* Trade context chip with ArrowsLeftRight icon (no thumbnail - not in Conversation interface) */}
          <View style={styles.tradeChip}>
            <ArrowsLeftRight size={12} color="#5DBB8E" weight="regular" />
            <Text style={styles.listingTitle} numberOfLines={1}>
              {item.listing_title} • ${item.listing_price.toFixed(2)}
            </Text>
          </View>

          <Text
            style={[styles.lastMessage, item.unread_count > 0 && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {item.last_message_content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenLayout variant="tab" title="Messages">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5DBB8E" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="tab" title="Messages">

      {/* Pill-shaped search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MagnifyingGlass size={20} color="#6B6B6B" weight="regular" />
          <TextInput
            testID="conversations-search-input"
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ChatCircleSlash size={64} color="#E0E0E0" weight="regular" />
          <Text style={styles.emptyTitle}>
            {searchQuery.trim() ? 'No matches found' : 'No messages yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery.trim()
              ? 'Try a different search term'
              : 'Start a trade and chat with other users!'}
          </Text>
          {!searchQuery.trim() && (
            <TouchableOpacity
              testID="browse-items-button"
              style={styles.browseButton}
              onPress={() => navigation.navigate('Discover')}
            >
              <Text style={styles.browseButtonText}>Browse Items</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          testID="conversations-list"
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DBB8E" />
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Pill-shaped search bar (48px, #F0F0F0)
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B6B6B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  // Green pill button (#5DBB8E)
  browseButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 16,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  // Unread badge: 20px green circle (#5DBB8E), white count text (11px)
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#5DBB8E',
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
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
  },
  // Trade context chip with ArrowsLeftRight icon (12px, #5DBB8E) + thumbnail (24px)
  tradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 4,
  },
  tradeThumbnail: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  listingTitle: {
    fontSize: 14,
    color: '#6B6B6B',
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  lastMessageUnread: {
    color: '#1A1A1A',
    fontWeight: '500',
  },
});

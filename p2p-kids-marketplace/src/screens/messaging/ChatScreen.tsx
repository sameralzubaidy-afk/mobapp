/**
 * File: p2p-kids-marketplace/src/screens/messaging/ChatScreen.tsx
 * MODULE-07 MSG-001: Real-time Chat Screen
 * 
 * Features:
 * - Display item header with listing details
 * - Display messages chronologically
 * - Send text messages
 * - Real-time updates via Supabase Realtime
 * - Auto-scroll to latest message
 * - Distinguish own vs other messages
 */

import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';
import { Ionicons } from '@expo/vector-icons';
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  unsubscribeFromMessages,
  markAsRead,
  Message,
} from '@/services/chat';

type ChatScreenRouteProp = RouteProp<{ Chat: { tradeId: string } }, 'Chat'>;

interface Trade {
  id: string;
  listing?: {
    id: string;
    title: string;
    price: number;
    images?: Array<{
      id: string;
      url: string;
      thumbnail_url: string;
      display_order: number;
    }>;
  };
}

const MESSAGE_CHAR_LIMIT = 2000;

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<any>();
  const { tradeId } = route.params;
  const { session } = useContext(AuthContext);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loadingTrade, setLoadingTrade] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());

  // Fetch trade details (item info)
  useEffect(() => {
    fetchTrade();
  }, [tradeId]);

  const fetchTrade = async () => {
    try {
      setLoadingTrade(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*, listing:items(id, title, price, images:item_images(id, url, thumbnail_url, display_order))')
        .eq('id', tradeId)
        .single();

      if (error) {
        console.error('[ChatScreen] Error fetching trade:', error);
      } else {
        setTrade(data as any);
      }
    } catch (error) {
      console.error('[ChatScreen] Unexpected error fetching trade:', error);
    } finally {
      setLoadingTrade(false);
    }
  };

  useEffect(() => {
    console.log('[ChatScreen] Mounting with tradeId:', tradeId);
    seenMessageIdsRef.current.clear();
    loadMessages();

    // Mark as read when opening the chat screen
    if (session?.user?.id) {
      markAsRead(tradeId, session.user.id)
        .then(() => {
          console.log('[ChatScreen] Marked trade', tradeId, 'as read on mount');
        })
        .catch((error) => {
          console.warn('[ChatScreen] Failed to mark as read:', error);
        });
    }

    // Subscribe to new messages
    channelRef.current = subscribeToMessages(tradeId, (newMessage) => {
      console.log('[ChatScreen] Realtime message received:', newMessage.id);
      addMessageToState(newMessage);
    });

    return () => {
      console.log('[ChatScreen] Unmounting, unsubscribing from messages');
      if (channelRef.current) {
        unsubscribeFromMessages(channelRef.current);
      }
    };
  }, [tradeId, session?.user?.id]);

  const loadMessages = async () => {
    setLoading(true);
    const msgs = await getMessages(tradeId);
    seenMessageIdsRef.current = new Set(msgs.map((msg) => msg.id));
    setMessages(msgs);
    setLoading(false);
    // On iOS, force scroll to offset 0 (bottom of the inverted list) after data load
    if (Platform.OS === 'ios') {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 50);
    }
  };

  const addMessageToState = (message: Message) => {
    setMessages((prev) => {
      if (seenMessageIdsRef.current.has(message.id)) {
        return prev;
      }
      seenMessageIdsRef.current.add(message.id);
      return [...prev, message];
    });
  };

  const handleInputChange = (text: string) => {
    // Enforce character limit in real-time (prevents paste bypass)
    console.log(`[ChatScreen] handleInputChange called with ${text.length} chars`);
    if (text.length > MESSAGE_CHAR_LIMIT) {
      console.log(`[ChatScreen] ⚠️ Input EXCEEDED ${MESSAGE_CHAR_LIMIT} chars, truncating from ${text.length}`);
      const truncated = text.slice(0, MESSAGE_CHAR_LIMIT);
      setInputText(truncated);
      Alert.alert(
        'Message Too Long',
        `Your message was truncated to ${MESSAGE_CHAR_LIMIT} characters.`
      );
    } else {
      setInputText(text);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !session?.user?.id || sending) {
      return;
    }

    const messageText = inputText.trim();
    console.log(`[ChatScreen.handleSend] Attempting to send message with ${messageText.length} chars`);
    
    // Character limit is now enforced in handleInputChange, but keep this as a safety check
    if (messageText.length > MESSAGE_CHAR_LIMIT) {
      console.error(`[ChatScreen.handleSend] ⚠️ SAFETY CHECK TRIGGERED: Message exceeds ${MESSAGE_CHAR_LIMIT} chars (${messageText.length} chars)`);
      Alert.alert(
        'Message Too Long',
        `Messages must be ${MESSAGE_CHAR_LIMIT} characters or fewer. Current: ${messageText.length} chars`
      );
      setInputText(messageText.slice(0, MESSAGE_CHAR_LIMIT));
      return;
    }
    
    setInputText('');
    setSending(true);

    try {
      const result = await sendMessage({
        tradeId,
        senderId: session.user.id,
        content: messageText,
      });

      if (!result.success) {
        console.error('[ChatScreen] Send failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to send message');
        setInputText(messageText); // Restore input on error
      } else {
        // Optimistically add message to UI immediately
        console.log('[ChatScreen] Message sent successfully, adding to UI:', result.message?.id);
        if (result.message) {
          addMessageToState(result.message);
        }
      }
    } catch (error: any) {
      console.error('[ChatScreen.handleSend] Error:', error);
      Alert.alert('Error', 'Failed to send message');
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === session?.user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownText : styles.otherText,
            ]}
          >
            {item.content}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  const listing = trade?.listing;
  const listingImages = Array.isArray(listing?.images) ? listing.images : [];
  const firstListingImage = listingImages.length
    ? [...listingImages].sort((a: any, b: any) => (a?.display_order ?? 0) - (b?.display_order ?? 0))[0]
    : null;
  const listingImageUri: string | null = firstListingImage
    ? (firstListingImage.thumbnail_url as string | null) || (firstListingImage.url as string)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Item Info */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </Pressable>

        {loadingTrade ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : listing ? (
          <View style={styles.itemInfo}>
            {listingImageUri ? (
              <Image
                source={{ uri: listingImageUri }}
                style={styles.itemImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                <Text style={styles.itemImagePlaceholderText}>📦</Text>
              </View>
            )}
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {listing.title}
              </Text>
              <Text style={styles.itemPrice}>${(listing.price).toFixed(2)}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Messages List */}
      <KeyboardAvoidingView
        style={styles.containerBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          // iOS-specific props for chat stability
          maintainVisibleContentPosition={
            Platform.OS === 'ios' ? { minIndexForVisible: 0 } : undefined
          }
          onContentSizeChange={() => {
            // Ensure we stay at bottom when new messages come in
            if (messages.length > 0) {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={2000}
              editable={!sending}
            />
            <Text style={[
              styles.charCounter,
              inputText.length > MESSAGE_CHAR_LIMIT && styles.charCounterWarning
            ]}>
              {inputText.length}/{MESSAGE_CHAR_LIMIT}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerBody: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  itemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: 28,
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    transform: [{ scaleY: -1 }], // Flip back because FlatList is inverted
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '75%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#3B82F6',
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginHorizontal: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
    maxHeight: 120,
    color: '#111827',
  },
  charCounter: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    marginHorizontal: 12,
    marginBottom: 4,
    alignSelf: 'flex-end',
    fontWeight: '500',
  },
  charCounterWarning: {
    color: '#DC2626',
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 60,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

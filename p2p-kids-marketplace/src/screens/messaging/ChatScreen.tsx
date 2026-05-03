/**
 * File: p2p-kids-marketplace/src/screens/messaging/ChatScreen.tsx
 * MODULE-07 MSG-001-009: Real-time Chat Screen with Delivery Status & Typing Indicators
 *
 * Features:
 * - Display item header with listing details
 * - Display messages chronologically (MSG-001)
 * - Send text messages (MSG-001)
 * - Real-time updates via Supabase Realtime (MSG-001)
 * - Auto-scroll to latest message (MSG-001)
 * - Distinguish own vs other messages (MSG-001)
 * - MSG-006: Show push notification badges
 * - MSG-007: Email notification tracking (handled server-side)
 * - MSG-008: Display delivery status (sent ✓ → delivered ✓✓ → read ✓✓ blue)
 * - MSG-009: Show typing indicators when other user is typing
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
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, ListingImage } from '@/components/atoms';
import {
  getMessages,
  sendMessage,
  sendImageMessage,
  subscribeToMessages,
  unsubscribeFromMessages,
  markAsRead,
  Message,
  markTradeMessagesAsDelivered,
  markTradeMessagesAsRead,
} from '@/services/chat';
import { idBadgeService } from '@/services/idBadge';

type ChatScreenRouteProp = RouteProp<{ Chat: { tradeId: string } }, 'Chat'>;

interface Trade {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing?: {
    id: string;
    title: string;
    price: number;
    images?: {
      id: string;
      url: string;
      thumbnail_url: string;
      display_order: number;
    }[];
  };
}

const MESSAGE_CHAR_LIMIT = 2000;
const { width: screenWidth } = Dimensions.get('window');

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<any>();
  const { tradeId } = route.params;
  const { session } = useContext(AuthContext);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loadingTrade, setLoadingTrade] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<{
    name: string;
    avatar_url: string;
    verification_status: any;
  } | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerImages, setImageViewerImages] = useState<{ uri: string }[]>([]);
  // MSG-009: Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const otherUserTyping = Object.entries(typingUsers).some(
    ([uid, isTyping]) => uid !== session?.user?.id && isTyping
  );

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  // MSG-009: Typing state refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingSubscriptionRef = useRef<any>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  // MSG-009: Animated typing dots
  const typingAnimRef = useRef(new Animated.Value(0)).current;

  // Fetch trade details (item info)
  useEffect(() => {
    fetchTrade();
  }, [tradeId]);

  // MSG-009: Animate typing dots when indicator shows
  useEffect(() => {
    if (otherUserTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimRef, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(typingAnimRef, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      typingAnimRef.setValue(0);
    }
  }, [otherUserTyping, typingAnimRef]);

  const fetchTrade = async () => {
    try {
      setLoadingTrade(true);
      const { data, error } = await supabase
        .from('trades')
        .select(
          `
          id,
          buyer_id,
          seller_id,
          listing:items(id, title, price, images:item_images(id, url, thumbnail_url, display_order))
        `
        )
        .eq('id', tradeId)
        .single();

      if (error) {
        console.error('[ChatScreen] Error fetching trade:', error);
      } else {
        const tradeData = data as any;
        setTrade(tradeData);

        // Fetch partner profile information
        const partnerId =
          tradeData.buyer_id === session?.user?.id ? tradeData.seller_id : tradeData.buyer_id;

        if (partnerId) {
          const [{ data: profileData }, vStatus] = await Promise.all([
            supabase.from('profiles').select('id, name, avatar_url').eq('id', partnerId).single(),
            idBadgeService.getVerificationStatus(partnerId),
          ]);

          if (profileData) {
            setPartnerProfile({
              name: profileData.name || 'User',
              avatar_url: profileData.avatar_url,
              verification_status: vStatus?.status || null,
            });
          }
        }
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
      // MSG-008: Mark all messages as delivered when screen opens
      markTradeMessagesAsDelivered(tradeId, session.user.id)
        .then(() => {
          console.log('[ChatScreen] Marked all trade messages as delivered');
        })
        .catch((error) => {
          console.warn('[ChatScreen] Failed to mark as delivered:', error);
        });

      // MSG-008: Mark as read after 3 second delay
      markAsReadTimeoutRef.current = setTimeout(() => {
        markTradeMessagesAsRead(tradeId, session.user.id)
          .then(() => {
            console.log('[ChatScreen] Marked trade messages as read');
          })
          .catch((error) => {
            console.warn('[ChatScreen] Failed to mark as read:', error);
          });
      }, 3000);
    }

    // Subscribe to new messages
    channelRef.current = subscribeToMessages(tradeId, (newMessage) => {
      console.log('[ChatScreen] Realtime message received:', newMessage.id);
      addMessageToState(newMessage);
    });

    // MSG-009: Manage typing presence channel
    const typingChannelName = `presence-trade-${tradeId}`;
    console.log('[ChatScreen] Initializing typing presence channel:', typingChannelName);

    const typingChannel = supabase.channel(typingChannelName, {
      config: {
        presence: {
          key: 'typing',
        },
      },
    });

    typingChannelRef.current = typingChannel;

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        console.log('[ChatScreen] Typing presence sync:', JSON.stringify(state));

        const typingMap: Record<string, boolean> = {};
        Object.keys(state).forEach((key) => {
          const presences = state[key];
          presences?.forEach((p: any) => {
            if (p.user_id) {
              typingMap[p.user_id] = !!p.is_typing;
            }
          });
        });

        console.log('[ChatScreen] Calculated typingMap:', typingMap);
        setTypingUsers(typingMap);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[ChatScreen] Typing presence join:', key, newPresences);
        setTypingUsers((prev) => {
          const next = { ...prev };
          newPresences.forEach((p: any) => {
            if (p.user_id) next[p.user_id] = !!p.is_typing;
          });
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[ChatScreen] Typing presence leave:', key, leftPresences);
        setTypingUsers((prev) => {
          const next = { ...prev };
          leftPresences.forEach((p: any) => {
            if (p.user_id) next[p.user_id] = false;
          });
          return next;
        });
      });

    typingChannel.subscribe((status) => {
      console.log('[ChatScreen] Typing channel status:', status);
    });

    return () => {
      console.log('[ChatScreen] Unmounting, unsubscribing from messages & presence');
      if (channelRef.current) {
        unsubscribeFromMessages(channelRef.current);
      }
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
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
      console.log(
        `[ChatScreen] ⚠️ Input EXCEEDED ${MESSAGE_CHAR_LIMIT} chars, truncating from ${text.length}`
      );
      const truncated = text.slice(0, MESSAGE_CHAR_LIMIT);
      setInputText(truncated);
      Alert.alert(
        'Message Too Long',
        `Your message was truncated to ${MESSAGE_CHAR_LIMIT} characters.`
      );
    } else {
      setInputText(text);
    }

    // MSG-009: Broadcast typing status with debounce (3 second throttle)
    if (session?.user?.id && text.length > 0) {
      const now = Date.now();
      if (now - lastTypingBroadcastRef.current > 3000) {
        console.log('[ChatScreen] Broadcasting typing status: true');
        if (typingChannelRef.current) {
          typingChannelRef.current
            .track({
              user_id: session.user.id,
              is_typing: true,
              timestamp: new Date().toISOString(),
            })
            .catch((err) => console.warn('[ChatScreen] track error:', err));
        }
        lastTypingBroadcastRef.current = now;
      }
    }

    // Clear existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 3 seconds of inactivity
    if (text.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        if (session?.user?.id && typingChannelRef.current) {
          console.log('[ChatScreen] Broadcasting typing status: false');
          typingChannelRef.current
            .track({
              user_id: session.user.id,
              is_typing: false,
              timestamp: new Date().toISOString(),
            })
            .catch((err) => console.warn('[ChatScreen] track error (stop):', err));
        }
      }, 3000);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !session?.user?.id || sending) {
      return;
    }

    const messageText = inputText.trim();
    console.log(
      `[ChatScreen.handleSend] Attempting to send message with ${messageText.length} chars`
    );

    // Character limit is now enforced in handleInputChange, but keep this as a safety check
    if (messageText.length > MESSAGE_CHAR_LIMIT) {
      console.error(
        `[ChatScreen.handleSend] ⚠️ SAFETY CHECK TRIGGERED: Message exceeds ${MESSAGE_CHAR_LIMIT} chars (${messageText.length} chars)`
      );
      Alert.alert(
        'Message Too Long',
        `Messages must be ${MESSAGE_CHAR_LIMIT} characters or fewer. Current: ${messageText.length} chars`
      );
      setInputText(messageText.slice(0, MESSAGE_CHAR_LIMIT));
      return;
    }

    setInputText('');
    setSending(true);

    // MSG-009: Stop typing broadcast when message is sent
    if (session?.user?.id && typingChannelRef.current) {
      typingChannelRef.current
        .track({
          user_id: session.user.id,
          is_typing: false,
          timestamp: new Date().toISOString(),
        })
        .catch((err) => console.warn('[ChatScreen] track error (send):', err));
    }

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

  const handleImagePicker = async () => {
    try {
      // Request camera roll permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to share images.'
        );
        return;
      }

      // Show image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const imageAsset = result.assets[0];
        await handleSendImage(imageAsset.uri);
      }
    } catch (error) {
      console.error('[ChatScreen.handleImagePicker] Error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleSendImage = async (imageUri: string) => {
    if (!session?.user?.id || sendingImage) {
      return;
    }

    console.log('[ChatScreen.handleSendImage] Sending image:', imageUri);
    setSendingImage(true);

    try {
      const result = await sendImageMessage({
        tradeId,
        senderId: session.user.id,
        imageUri,
      });

      if (!result.success) {
        console.error('[ChatScreen.handleSendImage] Send failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to upload image');
      } else {
        console.log('[ChatScreen.handleSendImage] Image sent successfully:', result.message?.id);
        if (result.message) {
          addMessageToState(result.message);
        }
      }
    } catch (error: any) {
      console.error('[ChatScreen.handleSendImage] Error:', error);
      Alert.alert('Error', error?.message || 'Failed to upload image');
    } finally {
      setSendingImage(false);
    }
  };

  const handleImagePress = (imageUrl: string, allImages: string[]) => {
    const images = allImages.map((url) => ({ uri: url }));
    const index = allImages.findIndex((url) => url === imageUrl);

    setImageViewerImages(images);
    setImageViewerIndex(Math.max(0, index));
    setImageViewerVisible(true);
  };

  // MSG-008: Render delivery status indicator for own messages
  const renderDeliveryStatus = (message: Message) => {
    // Only show for own messages
    if (message.sender_id !== session?.user?.id) {
      return null;
    }

    const statusIcon = (status: string | null) => {
      switch (status) {
        case 'read':
          // Double checkmark in blue
          return <Text style={styles.readCheckmark}>✓✓</Text>;
        case 'delivered':
          // Double checkmark in gray
          return <Text style={styles.deliveredCheckmark}>✓✓</Text>;
        case 'sent':
          // Single checkmark
          return <Text style={styles.sentCheckmark}>✓</Text>;
        default:
          return <ActivityIndicator size="small" color="#9CA3AF" />;
      }
    };

    return (
      <View style={styles.deliveryStatusContainer}>
        {statusIcon(message.delivery_status || 'sent')}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === session?.user?.id;

    // Get all image URLs from messages for image viewer
    const allImageMessages = messages.filter(
      (msg) => msg.message_type === 'image' && msg.image_url
    );
    const allImageUrls = allImageMessages.map((msg) => msg.image_url!);

    return (
      <View
        style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
            item.message_type === 'image' && styles.imageBubble,
          ]}
        >
          {item.message_type === 'image' && item.image_url ? (
            <TouchableOpacity
              onPress={() => handleImagePress(item.image_url!, allImageUrls)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: item.image_url }} style={styles.chatImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isOwnMessage ? styles.ownText : styles.otherText]}>
              {item.content}
            </Text>
          )}
        </View>
        <View style={styles.messageMetaContainer}>
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {renderDeliveryStatus(item)}
        </View>
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
    ? [...listingImages].sort(
        (a: any, b: any) => (a?.display_order ?? 0) - (b?.display_order ?? 0)
      )[0]
    : null;
  const listingImageUri: string | null = firstListingImage
    ? (firstListingImage.thumbnail_url as string | null) || (firstListingImage.url as string)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Item Info */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </Pressable>

        {loadingTrade ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : listing ? (
          <View style={styles.headerInfo}>
            {partnerProfile && (
              <Avatar
                imageUrl={partnerProfile.avatar_url || undefined}
                name={partnerProfile.name}
                size={40}
                verificationStatus={partnerProfile.verification_status as any}
              />
            )}
            <View style={styles.itemInfo}>
              <ListingImage
                url={listingImageUri}
                containerStyle={styles.itemImage}
                imageStyle={styles.itemImage}
                resizeMode="cover"
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {listing.title}
                </Text>
                <Text style={styles.itemPrice}>${listing.price.toFixed(2)}</Text>
              </View>
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

        {/* MSG-009: Typing Indicator */}
        {otherUserTyping && (
          <View style={styles.typingIndicatorContainer}>
            <View style={[styles.messageBubble, styles.otherBubble, { paddingVertical: 8 }]}>
              <View style={styles.typingDots}>
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingAnimRef.interpolate({
                        inputRange: [0, 0.33, 0.66, 1],
                        outputRange: [0.4, 1, 0.4, 0.4],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingAnimRef.interpolate({
                        inputRange: [0, 0.33, 0.66, 1],
                        outputRange: [0.4, 0.4, 1, 0.4],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingAnimRef.interpolate({
                        inputRange: [0, 0.33, 0.66, 1],
                        outputRange: [0.4, 0.4, 0.4, 1],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

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
              editable={!sending && !sendingImage}
            />
            <Text
              style={[
                styles.charCounter,
                inputText.length > MESSAGE_CHAR_LIMIT && styles.charCounterWarning,
              ]}
            >
              {inputText.length}/{MESSAGE_CHAR_LIMIT}
            </Text>
          </View>

          {/* Image Picker Button */}
          <TouchableOpacity
            testID="image-picker-button"
            style={[styles.imageButton, (sending || sendingImage) && styles.buttonDisabled]}
            onPress={handleImagePicker}
            disabled={sending || sendingImage}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="image" size={24} color="#6B7280" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending || sendingImage) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || sendingImage}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <Pressable style={styles.imageViewerHeader} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>

          {imageViewerImages.length > 0 && (
            <Image
              source={imageViewerImages[imageViewerIndex]}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}

          {imageViewerImages.length > 1 && (
            <>
              <Pressable
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={() =>
                  setImageViewerIndex((prev) =>
                    prev === 0 ? imageViewerImages.length - 1 : prev - 1
                  )
                }
              >
                <Ionicons name="chevron-back" size={32} color="white" />
              </Pressable>

              <Pressable
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() =>
                  setImageViewerIndex((prev) =>
                    prev === imageViewerImages.length - 1 ? 0 : prev + 1
                  )
                }
              >
                <Ionicons name="chevron-forward" size={32} color="white" />
              </Pressable>

              <Text style={styles.imageCounter}>
                {imageViewerIndex + 1} / {imageViewerImages.length}
              </Text>
            </>
          )}
        </View>
      </Modal>
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
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    // On some platforms/versions, ListEmptyComponent may already be flipped by FlatList inverted={true}
    // If text appears upside down on Android, we remove this transform or use Platform.select
    ...(Platform.OS === 'ios' ? { transform: [{ scaleY: -1 }] } : {}),
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
  imageBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chatImage: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.6 * 0.75, // 4:3 aspect ratio
    borderRadius: 8,
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
    fontWeight: '500',
  },
  messageMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginHorizontal: 12,
  },
  deliveryStatusContainer: {
    marginLeft: 4,
  },
  sentCheckmark: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  deliveredCheckmark: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  readCheckmark: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '700',
  },
  typingIndicatorContainer: {
    marginBottom: 16,
    maxWidth: '75%',
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    gap: 8,
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
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
    padding: 8,
  },
  fullscreenImage: {
    width: screenWidth,
    height: Dimensions.get('window').height * 0.8,
  },
  navButton: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 25,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonDisabled: {
    opacity: 0.5,
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

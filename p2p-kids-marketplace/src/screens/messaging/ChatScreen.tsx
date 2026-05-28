/**
 * File: p2p-kids-marketplace/src/screens/messaging/ChatScreen.tsx
 * MODULE-07 MSG-001-009 + MODULE-15.1 FLOW-14: Real-time Chat Screen
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
 *
 * MODULE-15.1 FLOW-14 UI REDESIGN:
 * - Whisk-inspired design system (#5DBB8E green)
 * - Sent messages: #5DBB8E bg, white text, borderTopRightRadius: 4
 * - Received messages: #F0F0F0 bg, #1A1A1A text, borderTopLeftRadius: 4
 * - ShieldCheck (14px, #5DBB8E) for verified sellers in header
 * - Trade context banner: #F7F7F7 bg, ArrowsLeftRight green icon
 * - PaperPlaneRight send icon (24px, #5DBB8E) only visible when input has text
 * - PaperClip and Smiley icons are 20px, #6B6B6B (NOT green)
 * - Read receipt uses Check Phosphor icon (12px, #5DBB8E)
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
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';
import {
  PaperPlaneRight,
  PaperclipHorizontal,
  Smiley,
  Check,
  ShieldCheck,
  ArrowsLeftRight,
  CaretLeft,
  X,
  Warning,
  MapPin,
} from 'phosphor-react-native';
import { Avatar } from '@/components/atoms';
import {
  getMessages,
  sendMessage,
  sendImageMessage,
  subscribeToMessages,
  unsubscribeFromMessages,
  Message,
  markTradeMessagesAsDelivered,
  markTradeMessagesAsRead,
} from '@/services/chat';
import { idBadgeService } from '@/services/idBadge';
import ScreenLayout from '@/components/ScreenLayout';

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

  // TFV2-020: Safe meetup modal (shown once per listing)
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  // TFV2-021: Quick-reply chips visible state
  const [quickRepliesVisible, setQuickRepliesVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  // MSG-009: Typing state refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  // MSG-009: Animated typing dots
  const typingAnimRef = useRef(new Animated.Value(0)).current;

  // Fetch trade details (item info)
  useEffect(() => {
    fetchTrade();
  }, [tradeId]);

  // TFV2-020: Show safety modal once per listing (D-19)
  useEffect(() => {
    if (!tradeId) return;
    const key = `safety_shown_${tradeId}`;
    AsyncStorage.getItem(key).then((val) => {
      if (!val) {
        setSafetyModalVisible(true);
        AsyncStorage.setItem(key, '1').catch(() => {});
      }
    }).catch(() => {});
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

    // Subscribe to new messages and status updates
    channelRef.current = subscribeToMessages(
      tradeId,
      (newMessage) => {
        console.log('[ChatScreen] Realtime message received:', newMessage.id);
        upsertMessageInState(newMessage);
      },
      (updatedMessage) => {
        console.log(
          '[ChatScreen] Realtime message updated:',
          updatedMessage.id,
          updatedMessage.delivery_status
        );
        upsertMessageInState(updatedMessage);
      }
    );

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
      .on('presence', { event: 'join' }, ({ key, newPresences }: { key: string; newPresences: unknown[] }) => {
        console.log('[ChatScreen] Typing presence join:', key, newPresences);
        setTypingUsers((prev) => {
          const next = { ...prev };
          newPresences.forEach((p: any) => {
            if (p.user_id) next[p.user_id] = !!p.is_typing;
          });
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }: { key: string; leftPresences: unknown[] }) => {
        console.log('[ChatScreen] Typing presence leave:', key, leftPresences);
        setTypingUsers((prev) => {
          const next = { ...prev };
          leftPresences.forEach((p: any) => {
            if (p.user_id) next[p.user_id] = false;
          });
          return next;
        });
      });

    typingChannel.subscribe((status: string) => {
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
    try {
      const msgs = await getMessages(tradeId);
      seenMessageIdsRef.current = new Set(msgs.map((msg) => msg.id));
      setMessages(msgs);

      // On iOS, force scroll to offset 0 (bottom of the inverted list) after data load
      if (Platform.OS === 'ios') {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        }, 50);
      }
    } catch (error) {
      console.error('[ChatScreen.loadMessages] Error:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const upsertMessageInState = (message: Message) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((msg) => msg.id === message.id);

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...message,
        };
        return next;
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
          upsertMessageInState(result.message);
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
          upsertMessageInState(result.message);
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
          // Double Check icon in green (Phosphor)
          return (
            <View style={styles.deliveryStatusRow}>
              <Check size={12} color="#5DBB8E" weight="bold" />
              <Check size={12} color="#5DBB8E" weight="bold" style={{ marginLeft: -4 }} />
            </View>
          );
        case 'delivered':
          // Double Check icon in gray
          return (
            <View style={styles.deliveryStatusRow}>
              <Check size={12} color="#9CA3AF" weight="bold" />
              <Check size={12} color="#9CA3AF" weight="bold" style={{ marginLeft: -4 }} />
            </View>
          );
        case 'sent':
          // Single Check icon
          return <Check size={12} color="#9CA3AF" weight="bold" />;
        default:
          return <ActivityIndicator size="small" color="#9CA3AF" />;
      }
    };

    return (
      <View style={styles.deliveryStatusContainer}>
        {statusIcon(
          message.delivery_status || (message.read_at ? 'read' : message.delivered_at ? 'delivered' : 'sent')
        )}
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
        testID={`message-${item.id}`}
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
        <ActivityIndicator size="large" color="#5DBB8E" />
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
    <ScreenLayout variant="detail" title="Chat">
      {/* Header with back button, seller avatar, name, and verified badge */}
      <View style={styles.header} testID="chat-header">
        {loadingTrade ? (
          <ActivityIndicator size="small" color="#5DBB8E" />
        ) : (
          <View style={styles.headerInfo}>
            {partnerProfile && (
              <View style={styles.avatarRow}>
                <Avatar
                  imageUrl={partnerProfile.avatar_url || undefined}
                  name={partnerProfile.name}
                  size={36}
                  verificationStatus={partnerProfile.verification_status as any}
                />
                <View style={styles.nameColumn}>
                  <View style={styles.nameVerifiedRow}>
                    <Text style={styles.partnerName} numberOfLines={1}>
                      {partnerProfile.name}
                    </Text>
                    {['verified', 'approved', 'completed', 'complete'].includes(
                      String(partnerProfile.verification_status || '').toLowerCase()
                    ) && (
                      <ShieldCheck
                        size={14}
                        color="#5DBB8E"
                        weight="fill"
                        testID="verified-badge"
                      />
                    )}
                  </View>
                  {listing && (
                    <Text style={styles.headerListingTitle} numberOfLines={1}>
                      {listing.title}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Trade context banner: #F7F7F7 bg, ArrowsLeftRight green icon, "View Trade" link */}
      {listing && (
        <View style={styles.tradeBanner} testID="trade-banner">
          <ArrowsLeftRight size={16} color="#5DBB8E" weight="regular" />
          {listingImageUri && (
            <Image source={{ uri: listingImageUri }} style={styles.tradeThumbnail} />
          )}
          <Text style={styles.tradeItemName} numberOfLines={1}>
            {listing.title} • ${listing.price.toFixed(2)}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ListingDetail', { listing_id: listing.id })}
            testID="view-trade-link"
          >
            <Text style={styles.viewTradeLink}>View Trade</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TFV2-020: Persistent safety reminder banner (D-19) */}
      <TouchableOpacity
        style={styles.safetyBanner}
        onPress={() => setSafetyModalVisible(true)}
        testID="safety-banner"
        activeOpacity={0.85}
      >
        <MapPin size={14} color="#FF8C42" weight="fill" />
        <Text style={styles.safetyBannerText}>Meet in a safe, public place</Text>
        <Text style={styles.safetyBannerLearn}>Learn more</Text>
      </TouchableOpacity>

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
          <View style={styles.typingIndicatorContainer} testID="typing-indicator">
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

        {/* Input bar: #F7F7F7 bg strip */}
        <View style={styles.inputContainer} testID="message-input-bar">
          {/* TFV2-021: Quick-reply chips row */}
          {quickRepliesVisible && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickRepliesRow}
              contentContainerStyle={styles.quickRepliesContent}
              keyboardShouldPersistTaps="handled"
              testID="quick-replies-row"
            >
              {[
                'Meet at library? 📚',
                'Park works! 🌳',
                'Tomorrow 3pm?',
                'Weekend works?',
                'Community center nearby?',
                'School parking lot?',
              ].map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={styles.quickReplyChip}
                  onPress={() => {
                    setInputText((prev) => (prev ? `${prev} ${chip}` : chip));
                    setQuickRepliesVisible(false);
                  }}
                  testID={`quick-reply-${chip}`}
                >
                  <Text style={styles.quickReplyChipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {/* PaperClip icon (20px, #6B6B6B) */}
          <TouchableOpacity
            testID="image-picker-button"
            style={[styles.iconButton, (sending || sendingImage) && styles.buttonDisabled]}
            onPress={handleImagePicker}
            disabled={sending || sendingImage}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color="#6B6B6B" />
            ) : (
              <PaperclipHorizontal size={20} color="#6B6B6B" weight="regular" />
            )}
          </TouchableOpacity>

          {/* Message input (filled, 40px, #F0F0F0, 20px radius) */}
          <View style={styles.inputWrapper}>
            <TextInput
              testID="message-input"
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#999999"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={2000}
              editable={!sending && !sendingImage}
            />
          </View>

          {/* Smiley icon (20px, #6B6B6B) - placeholder for future emoji picker */}
          <TouchableOpacity
            testID="emoji-button"
            style={styles.iconButton}
            onPress={() => {
              /* Future: show emoji picker */
            }}
            disabled={sending || sendingImage}
          >
            <Smiley size={20} color="#6B6B6B" weight="regular" />
          </TouchableOpacity>

          {/* TFV2-021: Quick replies toggle (MapPin icon) */}
          <TouchableOpacity
            testID="quick-replies-toggle"
            style={styles.iconButton}
            onPress={() => setQuickRepliesVisible((v) => !v)}
            disabled={sending || sendingImage}
          >
            <MapPin size={20} color={quickRepliesVisible ? '#5DBB8E' : '#6B6B6B'} weight={quickRepliesVisible ? 'fill' : 'regular'} />
          </TouchableOpacity>

          {/* PaperPlaneRight send icon (24px, #5DBB8E) - only visible when input has text */}
          {inputText.trim().length > 0 && (
            <TouchableOpacity
              testID="send-button"
              style={[styles.sendButton, (sending || sendingImage) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sending || sendingImage}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <PaperPlaneRight size={24} color="#FFFFFF" weight="fill" />
              )}
            </TouchableOpacity>
          )}
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
          <Pressable
            style={styles.imageViewerHeader}
            onPress={() => setImageViewerVisible(false)}
            testID="close-image-viewer"
          >
            <X size={28} color="white" weight="bold" />
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
                <CaretLeft size={32} color="white" weight="bold" />
              </Pressable>

              <Pressable
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() =>
                  setImageViewerIndex((prev) =>
                    prev === imageViewerImages.length - 1 ? 0 : prev + 1
                  )
                }
              >
                <CaretLeft
                  size={32}
                  color="white"
                  weight="bold"
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>

              <Text style={styles.imageCounter}>
                {imageViewerIndex + 1} / {imageViewerImages.length}
              </Text>
            </>
          )}
        </View>
      </Modal>

      {/* TFV2-020: Safe Meetup Modal (D-19, D-21) */}
      <Modal
        visible={safetyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSafetyModalVisible(false)}
        testID="safety-modal"
      >
        <View style={styles.safetyModalOverlay}>
          <View style={styles.safetyModalCard}>
            <View style={styles.safetyModalHeader}>
              <Warning size={28} color="#FF8C42" weight="fill" />
              <Text style={styles.safetyModalTitle}>Stay Safe During Meetups</Text>
            </View>
            <Text style={styles.safetyModalBody}>
              Always meet in a safe, public place like a library, community center, or school parking lot.
            </Text>
            <View style={styles.safetyTipsList}>
              {[
                '📍 Choose busy public spaces',
                '👥 Bring a parent or trusted adult',
                '📱 Share your location with a family member',
                '🚫 Never meet at a private home',
                '🌞 Prefer daytime meetups',
              ].map((tip) => (
                <Text key={tip} style={styles.safetyTipItem}>{tip}</Text>
              ))}
            </View>
            <TouchableOpacity
              style={styles.safetyModalBtn}
              onPress={() => setSafetyModalVisible(false)}
              testID="safety-modal-confirm"
            >
              <Text style={styles.safetyModalBtnText}>Got it, stay safe!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerBody: {
    flex: 1,
  },
  // Header with back button, seller avatar, name, and ShieldCheck (14px, #5DBB8E)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameColumn: {
    flex: 1,
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerListingTitle: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  // Trade context banner: #F7F7F7 bg, ArrowsLeftRight green icon, "View Trade" green link
  tradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tradeThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  tradeItemName: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  viewTradeLink: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B6B6B',
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
    ...(Platform.OS === 'ios' ? { transform: [{ scaleY: -1 }] } : {}),
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
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
    color: '#6B6B6B',
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
    height: screenWidth * 0.6 * 0.75,
    borderRadius: 8,
  },
  // Sent message bubbles: #5DBB8E bg, white text, borderTopRightRadius: 4
  ownBubble: {
    backgroundColor: '#5DBB8E',
    borderTopRightRadius: 4,
  },
  // Received message bubbles: #F0F0F0 bg, #1A1A1A text, borderTopLeftRadius: 4
  otherBubble: {
    backgroundColor: '#F0F0F0',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  ownText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#1A1A1A',
  },
  messageTime: {
    fontSize: 11,
    color: '#999999',
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
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#6B6B6B',
  },
  // Input bar: #F7F7F7 bg strip
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    gap: 8,
  },
  // PaperClip and Smiley icons (20px, #6B6B6B - NOT green)
  iconButton: {
    padding: 8,
  },
  // Message input (filled, 40px, #F0F0F0, 20px radius)
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  input: {
    backgroundColor: 'transparent',
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // PaperPlaneRight send icon (24px, #5DBB8E) - circle button
  sendButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
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
  // TFV2-020: Safety banner styles
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F4',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4CC',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  safetyBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#664422',
    fontWeight: '500',
  },
  safetyBannerLearn: {
    fontSize: 12,
    color: '#FF8C42',
    fontWeight: '600',
  },
  // TFV2-020: Safety modal styles
  safetyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  safetyModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  safetyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  safetyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  safetyModalBody: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 16,
  },
  safetyTipsList: {
    gap: 8,
    marginBottom: 24,
  },
  safetyTipItem: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  safetyModalBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  safetyModalBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // TFV2-021: Quick replies row
  quickRepliesRow: {
    maxHeight: 44,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FAFAFA',
  },
  quickRepliesContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickReplyChip: {
    backgroundColor: '#EEF9F4',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C8EAD9',
  },
  quickReplyChipText: {
    fontSize: 13,
    color: '#2E7D5B',
    fontWeight: '500',
  },
});

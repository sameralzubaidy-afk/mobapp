/**
 * File: p2p-kids-marketplace/src/services/chat.ts
 * MODULE-07 MSG-001: Chat Service with Supabase Realtime
 * 
 * Implements:
 * - sendMessage: Send text message to trade chat
 * - getMessages: Fetch all messages for a trade (excluding deleted)
 * - subscribeToMessages: Subscribe to real-time message updates
 * - unsubscribeFromMessages: Clean up realtime subscription
 */

import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

function parseLastViewedMs(lastViewedStr: string | null): number {
  if (!lastViewedStr) return 0;
  const parsed = new Date(lastViewedStr).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface Message {
  id: string;
  trade_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image';
  image_url?: string;
  created_at: string;
  // MSG-008: Delivery status tracking
  delivery_status?: 'sent' | 'delivered' | 'read';
  delivered_at?: string;
  read_at?: string;
}

export interface SendImageMessageInput {
  tradeId: string;
  senderId: string;
  imageUri: string;
}

export interface SendImageMessageResult {
  success: boolean;
  message?: Message;
  error?: string;
}

export interface SendMessageInput {
  tradeId: string;
  senderId: string;
  content: string;
}

export interface SendMessageResult {
  success: boolean;
  message?: Message;
  error?: string;
}

/**
 * Send a text message to a trade chat
 * 
 * @param input - Message input (tradeId, senderId, content)
 * @returns Result with success flag and message or error
 */
export async function sendMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  const { tradeId, senderId, content } = input;

  // Validate input
  if (!tradeId || !senderId || !content?.trim()) {
    return {
      success: false,
      error: 'Missing required fields: tradeId, senderId, or content',
    };
  }

  const trimmedContent = content.trim();
  console.log(`[chat.sendMessage] Validating message with ${trimmedContent.length} chars`);
  
  if (trimmedContent.length > 2000) {
    console.error(`[chat.sendMessage] ⚠️ REJECTED: Message exceeds 2000 chars (${trimmedContent.length} chars)`);
    return {
      success: false,
      error: `Message content exceeds 2000 characters (current: ${trimmedContent.length})`,
    };
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        trade_id: tradeId,
        sender_id: senderId,
        content: content.trim(),
        message_type: 'text',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[chat.sendMessage] Database error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }

    return {
      success: true,
      message: data,
    };
  } catch (error: any) {
    console.error('[chat.sendMessage] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error sending message',
    };
  }
}

/**
 * Fetch all messages for a trade (excluding deleted)
 * 
 * @param tradeId - Trade ID to fetch messages for
 * @returns Array of messages sorted by created_at (oldest first)
 */
export async function getMessages(tradeId: string): Promise<Message[]> {
  if (!tradeId) {
    console.error('[chat.getMessages] Missing tradeId');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('trade_id', tradeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[chat.getMessages] Database error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[chat.getMessages] Unexpected error:', error);
    return [];
  }
}

/**
 * Subscribe to real-time message updates for a trade
 * 
 * @param tradeId - Trade ID to subscribe to
 * @param onMessage - Callback when new message arrives
 * @returns RealtimeChannel for cleanup
 */
export function subscribeToMessages(
  tradeId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`trade:${tradeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `trade_id=eq.${tradeId}`,
      },
      async (payload) => {
        console.log('[chat.subscribeToMessages] New message received:', payload.new.id);
        onMessage(payload.new as Message);
      }
    )
    .subscribe((status) => {
      console.log('[chat.subscribeToMessages] Subscription status:', status);
    });

  return channel;
}

/**
 * Unsubscribe from real-time messages
 * 
 * @param channel - RealtimeChannel to unsubscribe
 */
export async function unsubscribeFromMessages(
  channel: RealtimeChannel
): Promise<void> {
  if (channel) {
    await channel.unsubscribe();
    console.log('[chat.unsubscribeFromMessages] Unsubscribed');
  }
}

/**
 * Conversation interface for list display
 */
export interface Conversation {
  id: string;
  trade_id: string;
  other_user_id: string;
  other_user_name: string;
  listing_title: string;
  listing_price: number;
  last_message_content: string;
  last_message_time: string;
  unread_count: number;
}

/**
 * Get all conversations for the current user
 * Shows trades with messages, ordered by most recent message
 * 
 * @param userId - Current user ID
 * @returns Array of conversations with last message preview and unread count
 */
export async function getConversations(
  userId: string
): Promise<Conversation[]> {
  if (!userId) {
    console.error('[chat.getConversations] Missing userId');
    return [];
  }

  try {
    // Fetch all trades where user is buyer or seller (without joining to users table yet)
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select(`
        id,
        buyer_id,
        seller_id,
        listing:items(
          id,
          title,
          price
        )
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (tradesError) {
      console.error('[chat.getConversations] Error fetching trades:', tradesError);
      return [];
    }

    if (!trades || trades.length === 0) {
      console.log('[chat.getConversations] No trades found for user:', userId);
      return [];
    }

    console.log('[chat.getConversations] Found', trades.length, 'trades');

    // For each trade, get last message and unread count
    const conversations = await Promise.all(
      trades.map(async (trade: any) => {
        // Get last message for this trade
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('trade_id', trade.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!lastMessage) {
          return null; // Skip trades with no messages
        }

        // Determine other user (the one we're chatting with)
        const otherUserId = trade.buyer_id === userId ? trade.seller_id : trade.buyer_id;

        // Fetch other user's name from profiles table (main public table for names)
        let otherUserName = 'Unknown';
        try {
          const { data: otherProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', otherUserId)
            .single();

          if (otherProfile?.name) {
            otherUserName = otherProfile.name;
          } else {
            // Fallback to searching users table if first_name exists there
            const { data: otherUser } = await supabase
              .from('users')
              .select('first_name')
              .eq('id', otherUserId)
              .single();
            if (otherUser?.first_name) {
              otherUserName = otherUser.first_name;
            }
          }
        } catch (err) {
          console.warn('[chat.getConversations] Could not fetch profile name for', otherUserId);
        }

        // Get unread count based on last time user viewed this trade
        // Uses AsyncStorage timestamp set by markAsRead() (client-only MVP; no DB schema changes).
        let unreadCount = 0;
        try {
          const lastViewedKey = `last_viewed_${userId}_${trade.id}`;
          const lastViewedStr = await AsyncStorage.getItem(lastViewedKey);
          const lastViewedMs = parseLastViewedMs(lastViewedStr);

          const { data: unreadMessages } = await supabase
            .from('messages')
            .select('id, created_at')
            .eq('trade_id', trade.id)
            .eq('sender_id', otherUserId)
            .is('deleted_at', null)
            .gte('created_at', new Date(lastViewedMs).toISOString());

          unreadCount =
            unreadMessages?.filter((msg: any) => {
              const msgTime = new Date(msg.created_at).getTime();
              return Number.isFinite(msgTime) && msgTime > lastViewedMs;
            }).length ?? 0;
        } catch (err) {
          console.warn('[chat.getConversations] Could not compute unread count for trade:', trade.id);
        }

        return {
          id: trade.id,
          trade_id: trade.id,
          other_user_id: otherUserId,
          other_user_name: otherUserName,
          listing_title: trade.listing?.title || 'Unknown Item',
          listing_price: trade.listing?.price || 0,
          last_message_content: lastMessage.content,
          last_message_time: lastMessage.created_at,
          unread_count: unreadCount,
        } as Conversation;
      })
    );

    // Filter out nulls (trades with no messages) and sort by last message time
    const validConversations = conversations
      .filter((c): c is Conversation => c !== null)
      .sort(
        (a, b) =>
          new Date(b.last_message_time).getTime() -
          new Date(a.last_message_time).getTime()
      );

    console.log('[chat.getConversations] Returning', validConversations.length, 'valid conversations');
    return validConversations;
  } catch (error) {
    console.error('[chat.getConversations] Unexpected error:', error);
    return [];
  }
}

/**
 * Get unread message count for a specific trade
 * Compares message timestamps against the last time user viewed the trade
 * 
 * @param tradeId - Trade ID
 * @param userId - Current user ID
 * @returns Number of unread messages
 */
export async function getUnreadCount(
  tradeId: string,
  userId: string
): Promise<number> {
  if (!tradeId || !userId) {
    return 0;
  }

  try {
    // Get the last time this user viewed this trade's messages
    const lastViewedKey = `last_viewed_${userId}_${tradeId}`;
    const lastViewedStr = await AsyncStorage.getItem(lastViewedKey);
    const lastViewed = parseLastViewedMs(lastViewedStr);

    // Get trade to determine other user
    const { data: trade } = await supabase
      .from('trades')
      .select('buyer_id, seller_id')
      .eq('id', tradeId)
      .single();

    if (!trade) {
      return 0;
    }

    const otherUserId = trade.buyer_id === userId ? trade.seller_id : trade.buyer_id;

    // Count messages from other user that arrived AFTER last view time
    const { data: unreadMessages } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('trade_id', tradeId)
      .eq('sender_id', otherUserId)
      .is('deleted_at', null)
      .gte('created_at', new Date(lastViewed).toISOString());

    // Filter messages that are actually after the last viewed time
    const actualUnread =
      unreadMessages?.filter((msg: any) => {
        const msgTime = new Date(msg.created_at).getTime();
        return Number.isFinite(msgTime) && msgTime > lastViewed;
      }) || [];

    console.log('[chat.getUnreadCount] Trade', tradeId, '- Unread:', actualUnread.length, 'Last viewed:', new Date(lastViewed).toISOString());
    return actualUnread.length;
  } catch (error) {
    console.error('[chat.getUnreadCount] Error:', error);
    return 0;
  }
}

/**
 * Mark all messages in a trade as read
 * Stores the current timestamp as the "last viewed" time
 * This enables accurate unread count tracking without DB changes
 * 
 * @param tradeId - Trade ID
 * @param userId - Current user ID
 */
export async function markAsRead(
  tradeId: string,
  userId: string
): Promise<void> {
  if (!tradeId || !userId) {
    return;
  }

  try {
    // Store the current timestamp as when this user last viewed this trade
    const lastViewedKey = `last_viewed_${userId}_${tradeId}`;
    const now = new Date().toISOString();
    await AsyncStorage.setItem(lastViewedKey, now);
    console.log('[chat.markAsRead] Marked trade', tradeId, 'as read at', now);
  } catch (error) {
    console.error('[chat.markAsRead] Error:', error);
  }
}

/**
 * Compress an image before uploading to reduce file size
 * 
 * @param imageUri - Local image URI to compress
 * @returns Compressed image result with URI and base64 data
 */
export async function compressImage(
  imageUri: string
): Promise<{
  success: boolean;
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
  error?: string;
}> {
  try {
    console.log('[chat.compressImage] Compressing image:', imageUri);
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        // Resize to max 1200px width/height while maintaining aspect ratio
        { resize: { width: 1200 } },
      ],
      {
        compress: 0.8, // 80% quality
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!result.base64) {
      return {
        success: false,
        error: 'Failed to generate base64 from compressed image',
      };
    }

    console.log(
      `[chat.compressImage] Compressed: ${result.width}x${result.height}`
    );
    
    return {
      success: true,
      uri: result.uri,
      base64: result.base64,
      width: result.width,
      height: result.height,
    };
  } catch (error: any) {
    console.error('[chat.compressImage] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to compress image',
    };
  }
}

/**
 * Upload an image to Supabase Storage chat-images bucket
 * 
 * @param tradeId - Trade ID for organizing images
 * @param senderId - User ID of sender
 * @param base64Data - Base64 encoded image data
 * @returns Upload result with public URL
 */
export async function uploadChatImage(
  tradeId: string,
  senderId: string,
  base64Data: string
): Promise<{
  success: boolean;
  publicUrl?: string;
  error?: string;
}> {
  try {
    if (!tradeId || !senderId || !base64Data) {
      return {
        success: false,
        error: 'Missing required fields: tradeId, senderId, or base64Data',
      };
    }

    // Generate unique filename: {trade_id}/{sender_id}/{timestamp}-{uuid}.jpg
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const filename = `${tradeId}/${senderId}-${timestamp}-${randomId}.jpg`;

    console.log('[chat.uploadChatImage] Uploading to:', filename);

    // Convert base64 to ArrayBuffer
    const fileBuffer = decode(base64Data);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filename, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('[chat.uploadChatImage] Upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image',
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filename);

    console.log('[chat.uploadChatImage] Upload successful:', urlData.publicUrl);
    
    return {
      success: true,
      publicUrl: urlData.publicUrl,
    };
  } catch (error: any) {
    console.error('[chat.uploadChatImage] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error uploading image',
    };
  }
}

/**
 * MSG-008: Update delivery status for a message
 * 
 * @param messageId - Message ID to update
 * @param status - New status (sent, delivered, read)
 * @returns Success boolean
 */
export async function updateDeliveryStatus(
  messageId: string,
  status: 'sent' | 'delivered' | 'read'
): Promise<boolean> {
  if (!messageId || !status) {
    console.error('[chat.updateDeliveryStatus] Missing messageId or status');
    return false;
  }

  try {
    const { data, error } = await supabase
      .rpc('update_message_delivery_status', {
        p_message_id: messageId,
        p_status: status,
      });

    if (error) {
      console.error('[chat.updateDeliveryStatus] Error:', error);
      return false;
    }

    console.log(`[chat.updateDeliveryStatus] Updated message ${messageId} to ${status}`);
    return data === true;
  } catch (error) {
    console.error('[chat.updateDeliveryStatus] Unexpected error:', error);
    return false;
  }
}

/**
 * MSG-008: Mark all messages in a trade as delivered (when chat opened)
 * 
 * @param tradeId - Trade ID
 * @param userId - Current user ID
 * @returns Number of messages updated
 */
export async function markTradeMessagesAsDelivered(
  tradeId: string,
  userId: string
): Promise<number> {
  if (!tradeId || !userId) {
    return 0;
  }

  try {
    const { data, error } = await supabase
      .rpc('mark_trade_messages_delivered', {
        p_trade_id: tradeId,
        p_user_id: userId,
      });

    if (error) {
      console.error('[chat.markTradeMessagesAsDelivered] Error:', error);
      return 0;
    }

    console.log(`[chat.markTradeMessagesAsDelivered] Marked ${data} messages as delivered`);
    // Return updated count if provided by RPC, otherwise return number or undefined
    return (data && (data.updated_count ?? data)) ?? 0;
  } catch (error) {
    console.error('[chat.markTradeMessagesAsDelivered] Unexpected error:', error);
    return 0;
  }
}

/**
 * MSG-008: Mark all messages in a trade as read (when chat is actively viewed)
 * 
 * @param tradeId - Trade ID
 * @param userId - Current user ID
 * @returns Number of messages updated
 */
export async function markTradeMessagesAsRead(
  tradeId: string,
  userId: string
): Promise<number> {
  if (!tradeId || !userId) {
    return 0;
  }

  try {
    const { data, error } = await supabase
      .rpc('mark_trade_messages_read', {
        p_trade_id: tradeId,
        p_user_id: userId,
      });

    if (error) {
      console.error('[chat.markTradeMessagesAsRead] Error:', error);
      return 0;
    }

    console.log(`[chat.markTradeMessagesAsRead] Marked ${data} messages as read`);
    return (data && (data.updated_count ?? data)) ?? 0;
  } catch (error) {
    console.error('[chat.markTradeMessagesAsRead] Unexpected error:', error);
    return 0;
  }
}

/**
 * MSG-009: Broadcast typing status via Realtime presence
 * 
 * @param tradeId - Trade ID
 * @param userId - Current user ID
 * @param isTyping - Whether user is typing
 */
export async function broadcastTypingStatus(
  tradeId: string,
  userId: string,
  isTyping: boolean
): Promise<void> {
  if (!tradeId || !userId) {
    return;
  }

  // Use consistent presence channel naming expected by tests and other code
  const channel = supabase.channel(`presence-trade-${tradeId}`, {
    config: {
      presence: {
        key: 'typing',
      },
    },
  });

  // Ensure we subscribe before attempting to broadcast presence updates
  try {
    if (typeof channel.subscribe === 'function') {
      // subscribe may be async; await if it's a promise
      try {
        await channel.subscribe();
      } catch (err) {
        // swallow subscription errors for robustness in tests/dev
        console.warn('[chat.broadcastTypingStatus] Channel subscribe warning:', err);
      }
    }

    // Prefer using presence API when available
    if (typeof channel.track === 'function') {
      try {
        channel.track({
          user_id: userId,
          is_typing: isTyping,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[chat.broadcastTypingStatus] Error calling channel.track:', err);
      }
    } else if (typeof (channel as any).send === 'function') {
      try {
        // Fallback to a generic send/broadcast if track is not available
        (channel as any).send('broadcastTyping', {
          user_id: userId,
          is_typing: isTyping,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[chat.broadcastTypingStatus] Error sending broadcastTyping:', err);
      }
    }
  } catch (err) {
    console.warn('[chat.broadcastTypingStatus] Unexpected error:', err);
  }

  console.log(`[chat.broadcastTypingStatus] User ${userId} typing: ${isTyping}`);
}

/**
 * MSG-009: Subscribe to typing status updates
 * 
 * @param tradeId - Trade ID
 * @param onTypingChange - Callback when typing status changes (userId, isTyping)
 * @returns Unsubscribe function
 */
export function subscribeToTypingStatus(
  tradeId: string,
  onTypingChange: (userId: string, isTyping: boolean) => void
): () => void {
  const channel = supabase
    .channel(`presence-trade-${tradeId}`, {
      config: {
        presence: {
          key: 'typing',
        },
      },
    });

  const syncTypingStatus = () => {
    const state = channel.presenceState();
    console.log('[chat.subscribeToTypingStatus] Presence state synced:', JSON.stringify(state));
    
    // Create a set of users currently typing based on full presence state
    const currentTypingUsers = new Set<string>();
    
    Object.keys(state).forEach((key) => {
      const presences = state[key];
      presences?.forEach((p: any) => {
        if (p.user_id && p.is_typing) {
          currentTypingUsers.add(p.user_id);
          onTypingChange(p.user_id, true);
        } else if (p.user_id) {
          onTypingChange(p.user_id, false);
        }
      });
    });
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      syncTypingStatus();
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('[chat.subscribeToTypingStatus] Presence joined:', key, newPresences);
      newPresences?.forEach((p: any) => {
        if (p.user_id) {
          onTypingChange(p.user_id, !!p.is_typing);
        }
      });
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('[chat.subscribeToTypingStatus] Presence left:', key, leftPresences);
      leftPresences?.forEach((p: any) => {
        if (p.user_id) {
          // When someone leaves, they are definitely not typing anymore
          onTypingChange(p.user_id, false);
        }
      });
    });

  channel.subscribe((status) => {
    console.log('[chat.subscribeToTypingStatus] Subscription status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('[chat.subscribeToTypingStatus] Successfully subscribed to presence for trade:', tradeId);
    }
  });

  return () => {
    console.log('[chat.subscribeToTypingStatus] Unsubscribing from presence for trade:', tradeId);
    channel.unsubscribe();
  };
}

/**
 * Send an image message to a trade chat
 * Compresses the image, uploads to storage, then creates the message record
 * 
 * @param input - Image message input (tradeId, senderId, imageUri)
 * @returns Result with success flag and message or error
 */
export async function sendImageMessage(
  input: SendImageMessageInput
): Promise<SendImageMessageResult> {
  const { tradeId, senderId, imageUri } = input;

  // Validate input
  if (!tradeId || !senderId || !imageUri) {
    return {
      success: false,
      error: 'Missing required fields: tradeId, senderId, or imageUri',
    };
  }

  console.log('[chat.sendImageMessage] Processing image message for trade:', tradeId);

  try {
    // 1. Compress the image
    const compressionResult = await compressImage(imageUri);
    if (!compressionResult.success || !compressionResult.base64) {
      return {
        success: false,
        error: compressionResult.error || 'Failed to compress image',
      };
    }

    // 2. Upload to storage
    const uploadResult = await uploadChatImage(
      tradeId,
      senderId,
      compressionResult.base64
    );
    
    if (!uploadResult.success || !uploadResult.publicUrl) {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload image',
      };
    }

    // 3. Create message record
    const { data, error } = await supabase
      .from('messages')
      .insert({
        trade_id: tradeId,
        sender_id: senderId,
        content: 'Image', // Placeholder content for image messages
        message_type: 'image',
        image_url: uploadResult.publicUrl,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[chat.sendImageMessage] Database error:', error);
      return {
        success: false,
        error: error.message || 'Failed to save image message',
      };
    }

    console.log('[chat.sendImageMessage] Image message sent successfully:', data.id);
    return {
      success: true,
      message: data,
    };
  } catch (error: any) {
    console.error('[chat.sendImageMessage] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error sending image message',
    };
  }
}

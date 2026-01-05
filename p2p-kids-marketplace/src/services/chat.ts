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
